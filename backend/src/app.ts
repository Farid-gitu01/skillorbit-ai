/**
 * app.ts — Express application factory
 *
 * Registers global middleware and mounts all API routes.
 * Does NOT start the HTTP server — that is handled by server.ts.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { CLIENT_URL, IS_PRODUCTION } from './config/constants.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import apiRoutes from './routes/index.js';
import { sendError } from './utils/api-response.util.js';

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: IS_PRODUCTION ? CLIENT_URL : [CLIENT_URL, 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// ── Request body parsing ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// ── HTTP request logging (omit query strings that may contain one-time tokens) ──
morgan.token('safe-path', (req) => req.url?.split('?')[0] ?? '/');
app.use(morgan(':method :safe-path :status :response-time ms - :res[content-length]'));

// ── Global rate limiter ───────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 429, 'Too many requests, please try again later.', { code: 'RATE_LIMITED' });
  },
});
app.use(globalLimiter);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last middleware) ────────────────────────────
app.use(errorHandler);

export default app;
