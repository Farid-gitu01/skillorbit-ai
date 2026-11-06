/**
 * server.ts — HTTP server bootstrap
 *
 * Load order:
 *  1. dotenv     — populates process.env before any other import
 *  2. env.ts     — validates required environment variables (fails fast if missing)
 *  3. models     — registers all 13 Mongoose schemas so indexes are built on connect
 *  4. database   — connects to MongoDB Atlas
 *  5. app        — Express application (middleware + routes)
 *  6. listen     — starts accepting HTTP requests
 *
 * Shutdown: SIGINT and SIGTERM trigger graceful closure of the HTTP
 * server and the MongoDB connection before the process exits.
 */
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import './models/index.js';          // register all 13 models before connecting
import connectDatabase from './config/database.js';
import app from './app.js';

const startServer = async (): Promise<void> => {
  await connectDatabase();

  const server = http.createServer(app);

  server.listen(env.PORT, () => {
    console.log(`[server] SkillOrbit AI running on port ${env.PORT} (${env.NODE_ENV})`);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received — shutting down gracefully…`);

    server.close(async () => {
      console.log('[server] HTTP server closed.');
      try {
        await mongoose.connection.close();
        console.log('[db] MongoDB connection closed.');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[db] Error closing MongoDB connection: ${message}`);
      } finally {
        process.exit(0);
      }
    });

    // Force-exit if shutdown takes too long (10 s)
    setTimeout(() => {
      console.error('[server] Forced exit after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

startServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[server] FATAL: Unexpected startup error — ${message}`);
  process.exit(1);
});
