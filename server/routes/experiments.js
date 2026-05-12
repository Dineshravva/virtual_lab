const express = require('express');
const router = express.Router();
const Experiment = require('../models/Experiment');

// GET /api/experiments - list all saved experiments, newest first
router.get('/', async (req, res) => {
  try {
    const experiments = await Experiment.find().sort({ createdAt: -1 }).limit(50);
    res.json(experiments);
  } catch (err) {
    console.error('[experiments] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch experiments' });
  }
});

// POST /api/experiments - save a new experiment
router.post('/', async (req, res) => {
  try {
    const { name, bodies, constraints } = req.body;
    const trimmedName = typeof name === 'string' ? name.trim() : '';

    if (!trimmedName) {
      return res.status(400).json({ error: 'Experiment name is required' });
    }

    if (!Array.isArray(bodies) || bodies.length === 0) {
      return res.status(400).json({ error: 'Add at least one body before saving' });
    }

    const existing = await Experiment.findOne({ name: trimmedName })
      .collation({ locale: 'en', strength: 2 })
      .select('_id');

    if (existing) {
      return res.status(409).json({ error: 'An experiment with this name already exists' });
    }

    const experiment = new Experiment({
      name: trimmedName,
      bodies,
      constraints: Array.isArray(constraints) ? constraints : []
    });
    await experiment.save();
    res.status(201).json(experiment);
  } catch (err) {
    console.error('[experiments] POST error:', err.message);
    res.status(500).json({ error: 'Failed to save experiment' });
  }
});

module.exports = router;
