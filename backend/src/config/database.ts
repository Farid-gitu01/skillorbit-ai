/**
 * database.ts — MongoDB Atlas connection via Mongoose
 *
 * Usage: import connectDatabase from './config/database.js' then await connectDatabase()
 *        in server.ts before app.listen().
 *
 * Design decisions:
 *  - MONGODB_URI is read from env.ts (validated at startup — missing URI crashes early).
 *  - Connection options use Mongoose 8 defaults (no deprecated flags needed).
 *  - Duplicate connection guard: if Mongoose is already connected, returns immediately.
 *  - Connection events are logged without revealing credentials.
 *  - A failed connection exits the process — the server must not start without a database.
 */
import mongoose from 'mongoose';
import { MONGODB_URI, NODE_ENV } from './constants.js';

let isConnected = false;

const connectDatabase = async (): Promise<void> => {
  // Guard against duplicate connections (e.g. hot-reload during development)
  if (isConnected) {
    if (NODE_ENV === 'development') {
      console.log('[db] Reusing existing MongoDB connection.');
    }
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      // Mongoose 8 has sensible defaults — only override what is needed
      maxPoolSize: 10,          // Maximum number of sockets in the pool
      serverSelectionTimeoutMS: 5000,  // Fail fast if Atlas is unreachable
      socketTimeoutMS: 45000,   // Close sockets that are idle for 45 s
    });

    isConnected = true;

    // Log host only — never log the full URI which contains credentials
    const host = mongoose.connection.host;
    console.log(`[db] MongoDB connected — host: ${host}`);

    // Handle unexpected disconnection after initial connect
    mongoose.connection.on('disconnected', () => {
      console.warn('[db] MongoDB disconnected.');
      isConnected = false;
    });

    mongoose.connection.on('error', (err: Error) => {
      console.error('[db] MongoDB connection error:', err.name);
    });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    console.error(`[db] FATAL: MongoDB connection failed — ${errorName}`);
    // Exit so that the process manager (PM2 / Docker) can restart cleanly
    process.exit(1);
  }
};

export default connectDatabase;
