import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/globexsky';

let isConnected = false;

const connectMongoDB = async () => {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('[MongoDB] Connected successfully');

    mongoose.connection.on('disconnected', () => {
      isConnected = false;
      console.warn('[MongoDB] Disconnected');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
    });
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    throw error;
  }
};

export default connectMongoDB;
