const express = require('express');
const router = express.Router();

// --- Limits ----------------------------------------------------------------
// Hard caps so a noisy or malicious client can't burn the OpenAI key.
const MAX_QUESTION_CHARS = 800;
const MAX_SCENE_BYTES = 64 * 1024; // 64 KB serialized scene context
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX_REQUESTS = 10; // per IP per window
const UPSTREAM_TIMEOUT_MS = 25 * 1000;

// In-memory per-IP request log. Single-process only; for multi-process
// deployments swap this for Redis/Upstash. That is documented in the README.
const requestLog = new Map();

function takeRateToken(ip) {
  const now = Date.now();
  const bucket = requestLog.get(ip) || [];
  const fresh = bucket.filter((stamp) => now - stamp < RATE_WINDOW_MS);
  if (fresh.length >= RATE_MAX_REQUESTS) {
    requestLog.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  requestLog.set(ip, fresh);
  return true;
}

// Periodically clear empty buckets so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of requestLog) {
    const fresh = bucket.filter((stamp) => now - stamp < RATE_WINDOW_MS);
    if (fresh.length === 0) requestLog.delete(ip);
    else requestLog.set(ip, fresh);
  }
}, RATE_WINDOW_MS).unref();

function extractOutputText(response) {
  if (response.output_text) return response.output_text;

  if (Array.isArray(response.output)) {
    return response.output
      .flatMap((item) => item.content || [])
      .filter((part) => part.type === 'output_text' && part.text)
      .map((part) => part.text)
      .join('\n')
      .trim();
  }

  return '';
}

router.post('/', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        'AI assistant is not configured. Set OPENAI_API_KEY in server/.env and restart the server.'
    });
  }

  const ip = (req.ip || req.connection.remoteAddress || 'unknown').toString();
  if (!takeRateToken(ip)) {
    return res.status(429).json({
      error: 'Too many AI requests. Please wait a minute and try again.'
    });
  }

  const { question, scene } = req.body || {};
  const trimmedQuestion = typeof question === 'string' ? question.trim() : '';

  if (!trimmedQuestion) {
    return res.status(400).json({ error: 'Question is required.' });
  }
  if (trimmedQuestion.length > MAX_QUESTION_CHARS) {
    return res
      .status(413)
      .json({ error: `Question is too long (max ${MAX_QUESTION_CHARS} characters).` });
  }

  let sceneJson;
  try {
    sceneJson = JSON.stringify(scene || {}, null, 2);
  } catch {
    return res.status(400).json({ error: 'Scene payload could not be serialized.' });
  }
  if (Buffer.byteLength(sceneJson, 'utf8') > MAX_SCENE_BYTES) {
    return res
      .status(413)
      .json({ error: 'Scene snapshot is too large to send to the assistant.' });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        store: false,
        max_output_tokens: 320,
        instructions:
          'You are a concise university physics lab tutor. Explain the current 2D Matter.js scene using plain language, formulas when helpful, and one suggested observation. Keep answers under 140 words.',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Question: ${trimmedQuestion}\n\nScene JSON:\n${sceneJson}`
              }
            ]
          }
        ]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      const message =
        data.error && data.error.message
          ? data.error.message
          : 'AI assistant request failed.';
      return res.status(response.status).json({ error: message });
    }

    res.json({
      answer:
        extractOutputText(data) || 'I could not generate an answer for this scene.'
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'AI assistant timed out. Please try again.' });
    }
    console.error('[assistant] POST error:', err.message);
    res.status(500).json({ error: 'AI assistant failed to respond.' });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
