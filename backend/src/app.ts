/**
 * app.ts — Express application factory
 *
 * Registers global security middleware, request parsing, sanitization,
 * logging, rate limiting, and mounts all API routes.
 * Does NOT start the HTTP server — that is handled by server.ts.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { CLIENT_URL, IS_PRODUCTION } from './config/constants.js';
import { notFound } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { globalLimiter } from './middlewares/rate-limit.middleware.js';
import { csrfProtection, methodFilter, sanitizeMongo } from './middlewares/security.middleware.js';
import apiRoutes from './routes/index.js';

const app = express();

// ── Disable Express fingerprinting ──────────────────────────────────────────
app.disable('x-powered-by');

// ── Method validation (rejects TRACE, CONNECT, etc.) ────────────────────────
app.use(methodFilter);

// ── Security headers ─────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: IS_PRODUCTION ? CLIENT_URL : [CLIENT_URL, 'http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400,
  })
);

// ── Request body parsing (64 KB limit) ───────────────────────────────────────
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));
app.use(cookieParser());

// ── Request sanitization (NoSQL injection defense) ──────────────────────────
app.use(sanitizeMongo);

// ── CSRF protection (Origin / Referer defense for state-changing requests) ───
app.use(csrfProtection);

// ── HTTP request logging (omit query strings that may contain one-time tokens) ──
morgan.token('safe-path', (req) => req.url?.split('?')[0] ?? '/');
app.use(morgan(':method :safe-path :status :response-time ms - :res[content-length]'));

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(globalLimiter);

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', apiRoutes);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last middleware) ────────────────────────────
app.use(errorHandler);

export default app;
