import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { sendError, sendSuccess } from '../utils/api-response.util.js';

const router = Router();

/**
 * GET /api/health
 *
 * Returns the current health status of the API and its dependencies.
 * Never exposes credentials, internal config, or stack traces.
 */
router.get('/', (_req: Request, res: Response): void => {
  const dbState = mongoose.connection.readyState;

  // Mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStatusMap: Record<number, string> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  const dbStatus = dbStatusMap[dbState] ?? 'unknown';
  const isHealthy = dbState === 1;

  const data = {
    app: 'SkillOrbit AI',
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  };

  if (isHealthy) {
    sendSuccess(res, 200, data, 'SkillOrbit AI API is healthy');
    return;
  }

  sendError(res, 503, 'SkillOrbit AI API is degraded', { code: 'SERVICE_UNAVAILABLE' });
});

export default router;
