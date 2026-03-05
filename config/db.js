import mongoose from 'mongoose';
import logger from './logger.js';

/**
 * MongoDB connection handler.
 * Connects to MongoDB using MONGODB_URI from environment.
 * Exits process on connection failure in production.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info('MongoDB connected', { host: conn.connection.host });
  } catch (error) {
    logger.error('MongoDB connection error', { error: error.message });
    process.exit(1);
  }
};

/**
 * Gracefully disconnect from MongoDB.
 */
export async function disconnectDB() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB disconnected');
  } catch (error) {
    logger.error('MongoDB disconnect error', { error: error.message });
  }
}

export default connectDB;
