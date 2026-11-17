import { type RequestHandler, Router } from 'express';
import { type AiControllerDependencies, createAiController } from '../controllers/ai.controller.js';
import { asyncHandler } from '../middlewares/async-handler.middleware.js';
import { protect, restrictTo } from '../middlewares/auth.middleware.js';
import { aiFeatureLimiter } from '../middlewares/rate-limit.middleware.js';

export interface CreateAiRouterOptions extends AiControllerDependencies {
  limiter?: RequestHandler;
}

export function createAiRouter(options: CreateAiRouterOptions = {}): Router {
  const router = Router();
  const controller = createAiController({ ai: options.ai, cache: options.cache });
  const limiter = options.limiter ?? aiFeatureLimiter;

  // All AI seeker endpoints require authenticated Job Seeker access
  router.use(asyncHandler(protect), restrictTo('seeker'));

  // Status & readiness
  router.get('/status', asyncHandler(controller.getAiStatus));

  // Phase 2.6.3 — Resume Analysis
  router.post('/resume/:resumeId/analyze', limiter, asyncHandler(controller.analyzeResume));

  // Phase 2.6.4 — Skill Extraction & Confirmation Apply
  router.post('/skills/extract', limiter, asyncHandler(controller.extractSkills));
  router.post('/skills/apply', asyncHandler(controller.applyExtractedSkills));

  // Phase 2.6.5 — Skill Gap Analysis
  router.post('/skill-gap', limiter, asyncHandler(controller.analyzeSkillGap));

  // Phase 2.6.6 — Learning Roadmaps
  router.get('/roadmaps', asyncHandler(controller.listRoadmaps));
  router.post('/roadmaps/generate', limiter, asyncHandler(controller.generateRoadmap));
  router.get('/roadmaps/:id', asyncHandler(controller.getRoadmap));
  router.patch('/roadmaps/:id/steps/:stepId', asyncHandler(controller.toggleRoadmapStep));
  router.post('/roadmaps/:id/regenerate', limiter, asyncHandler(controller.regenerateRoadmap));
  router.patch('/roadmaps/:id/status', asyncHandler(controller.updateRoadmapStatus));
  router.delete('/roadmaps/:id', asyncHandler(controller.deleteRoadmap));

  // Phase 2.6.7 & 2.6.8 — Job Matching & Personalized Recommendations
  router.post('/jobs/:jobId/match', limiter, asyncHandler(controller.computeJobMatch));
  router.get('/recommendations/jobs', asyncHandler(controller.getJobRecommendations));

  // Phase 2.6.9 — Career Assistant Chat
  router.get('/chat/conversations', asyncHandler(controller.listConversations));
  router.get('/chat/conversations/:id', asyncHandler(controller.getConversation));
  router.post('/chat', limiter, asyncHandler(controller.sendChatMessage));
  router.delete('/chat/conversations/:id', asyncHandler(controller.deleteConversation));

  return router;
}

export default createAiRouter();
