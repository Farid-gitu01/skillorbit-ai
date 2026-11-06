import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';

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

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    app: 'SkillOrbit AI',
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

export default router;
