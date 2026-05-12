const mongoose = require('mongoose');

// An "experiment" is a snapshot of a physics scene that students can save
// and reload later. We store bodies and constraints as flexible arrays
// because the physics objects are simple JSON we generate on the client.
const ExperimentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  bodies: {
    type: Array,
    default: []
  },
  constraints: {
    type: Array,
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Experiment', ExperimentSchema);
