const mongoose = require('mongoose');

// Connects to MongoDB using the URI from environment variables.
// Called once at server startup.
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/virtual-lab';
    await mongoose.connect(uri);
    console.log('[db] MongoDB connected');
  } catch (err) {
    console.error('[db] MongoDB connection error:', err.message);
    // Exit so the developer notices the misconfiguration immediately
    process.exit(1);
  }
};

module.exports = connectDB;
