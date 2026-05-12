import React, { useEffect, useRef, useState } from 'react';

export default function AIAssistantPanel({ onAsk }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Ask why something happened in the current scene.'
    }
  ]);
  const [busy, setBusy] = useState(false);

  // Track the in-flight request so we can cancel it on a new submit, on
  // unmount, or when the user clicks Cancel.
  const inflightRef = useRef(null);

  useEffect(() => {
    return () => {
      if (inflightRef.current) inflightRef.current.abort();
    };
  }, []);

  const ask = async () => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    if (inflightRef.current) inflightRef.current.abort();
    const controller = new AbortController();
    inflightRef.current = controller;

    setQuestion('');
    setMessages((current) => [...current, { role: 'user', text: trimmed }]);
    setBusy(true);

    try {
      const answer = await onAsk(trimmed, { signal: controller.signal });
      // If we were aborted between the await and here, drop the result.
      if (controller.signal.aborted) return;
      setMessages((current) => [...current, { role: 'assistant', text: answer }]);
    } catch (err) {
      // Axios marks cancellations as ERR_CANCELED — those are user-initiated,
      // so we don't render an error bubble for them.
      const isCanceled =
        err.code === 'ERR_CANCELED' ||
        err.name === 'CanceledError' ||
        err.name === 'AbortError';
      if (isCanceled) return;

      const message =
        err.response && err.response.data && err.response.data.error
          ? err.response.data.error
          : err.message || 'AI assistant is unavailable.';
      setMessages((current) => [
        ...current,
        { role: 'assistant', text: message }
      ]);
    } finally {
      if (inflightRef.current === controller) inflightRef.current = null;
      setBusy(false);
    }
  };

  const cancel = () => {
    if (inflightRef.current) inflightRef.current.abort();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      ask();
    }
  };

  return (
    <div className="p-4 border-b border-gray-800">
      <h3 className="text-sm font-semibold text-lab-accent mb-3 uppercase tracking-wide">
        AI Lab Assistant
      </h3>

      <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-gray-800 bg-gray-950 p-2">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded px-2 py-1.5 text-xs leading-relaxed ${
              message.role === 'user'
                ? 'bg-sky-950 text-sky-100'
                : 'bg-gray-900 text-gray-300'
            }`}
          >
            {message.text}
          </div>
        ))}
      </div>

      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Why did the spring keep oscillating?"
        rows={2}
        className="mt-3 w-full resize-none rounded border border-gray-700 bg-gray-900 px-2 py-1.5
                   text-sm text-white placeholder-gray-500 focus:border-lab-accent focus:outline-none"
      />

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={ask}
          disabled={busy || !question.trim()}
          className="flex-1 rounded bg-lab-accent px-3 py-2 text-sm font-semibold text-black
                     transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? 'Thinking...' : 'Ask Assistant'}
        </button>
        {busy && (
          <button
            type="button"
            onClick={cancel}
            className="rounded border border-gray-700 px-3 py-2 text-sm text-gray-200
                       transition hover:bg-gray-800"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
