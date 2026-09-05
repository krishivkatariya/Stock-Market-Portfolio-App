const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error('MongoDB URI is missing. Add MONGO_URI to your .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      retryWrites: true,
      w: 'majority'
    });

    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed.');
    console.error('Possible causes:');
    console.error('1. Your current public IP is not added to MongoDB Atlas Network Access.');
    console.error('2. The username/password in .env is incorrect.');
    console.error('3. The Atlas cluster is paused or the connection string is wrong.');
    console.error(error.message);
    // Continue running so market-data endpoints (WebSocket/SSE) remain available.
    // Database-dependent routes will return appropriate errors at request time.
  }
};

module.exports = connectDB;