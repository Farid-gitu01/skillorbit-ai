import { type Request, type Response } from 'express';
import { aiService, type AiService } from '../services/ai/index.js';
import {
  deleteAiConversation,
  getAiConversationById,
  listAiConversations,
  sendCareerChatMessage,
} from '../services/ai/features/ai-chat.service.js';
import { computeJobMatchForSeeker } from '../services/ai/features/job-matching.service.js';
import { getPersonalizedJobRecommendations } from '../services/ai/features/job-recommendations.service.js';
import { analyzeResumeById } from '../services/ai/features/resume-analysis.service.js';
import {
  deleteSeekerRoadmap,
  generateLearningRoadmapForSeeker,
  getSeekerRoadmapById,
  listSeekerRoadmaps,
  regenerateSeekerRoadmap,
  toggleRoadmapStepProgress,
  updateRoadmapStatus,
} from '../services/ai/features/roadmap.service.js';
import { analyzeSkillGapForSeeker } from '../services/ai/features/skill-gap.service.js';
import {
  applyExtractedSkillsToProfile,
  extractSkillsForSeeker,
} from '../services/ai/features/skill-extraction.service.js';
import { type AiResponseCache, sharedAiCache } from '../services/ai/utils/ai-cache.util.js';
import { handleAiControllerError } from '../services/ai/utils/ai-http-error.util.js';
import { sendCreated, sendError, sendSuccess } from '../utils/api-response.util.js';
import {
  aiChatBodySchema,
  applyExtractedSkillsSchema,
  generateRoadmapBodySchema,
  jobMatchBodySchema,
  jobRecommendationsQuerySchema,
  objectIdSchema,
  regenerateRoadmapBodySchema,
  resumeAnalyzeBodySchema,
  skillExtractBodySchema,
  skillGapBodySchema,
  toggleRoadmapStepBodySchema,
  updateRoadmapStatusBodySchema,
} from '../validators/ai.validator.js';

export interface AiControllerDependencies {
  ai?: AiService;
  cache?: AiResponseCache;
}

function requireUserId(req: Request, res: Response): string | undefined {
  if (!req.userId) {
    sendError(res, 401, 'Authentication required', { code: 'AUTHENTICATION_REQUIRED' });
    return undefined;
  }
  return req.userId;
}

export function createAiController(deps: AiControllerDependencies = {}) {
  const ai = deps.ai ?? aiService;
  const cache = deps.cache ?? sharedAiCache;

  return {
    getAiStatus: async (_req: Request, res: Response): Promise<void> => {
      try {
        const readiness = ai.getReadiness();
        const inspection = ai.inspectConfiguration();
        sendSuccess(res, 200, {
          configured: readiness.configured,
          status: readiness.status,
          provider: readiness.provider ?? null,
          model: inspection.status === 'configured' ? inspection.config.model : null,
        });
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    analyzeResume: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const resumeId = objectIdSchema.parse(req.params.resumeId);
        const body = resumeAnalyzeBodySchema.parse(req.body ?? {});
        const result = await analyzeResumeById({
          userId,
          resumeId,
          forceRefresh: body.forceRefresh,
          ai,
          cache,
        });
        sendSuccess(res, 200, result, 'Resume analysis completed successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    extractSkills: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const body = skillExtractBodySchema.parse(req.body ?? {});
        const result = await extractSkillsForSeeker({
          userId,
          resumeId: body.resumeId,
          includeProfile: body.includeProfile,
          forceRefresh: body.forceRefresh,
          ai,
          cache,
        });
        sendSuccess(res, 200, result, 'Skills extracted successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    applyExtractedSkills: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const body = applyExtractedSkillsSchema.parse(req.body ?? {});
        const result = await applyExtractedSkillsToProfile({
          userId,
          skills: body.skills,
        });
        sendSuccess(res, 200, result, 'Selected skills applied to your profile');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    analyzeSkillGap: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const body = skillGapBodySchema.parse(req.body ?? {});
        const result = await analyzeSkillGapForSeeker({
          userId,
          jobId: body.jobId,
          targetRole: body.targetRole,
          experienceLevel: body.experienceLevel,
          forceRefresh: body.forceRefresh,
          ai,
          cache,
        });
        sendSuccess(res, 200, result, 'Skill gap analysis completed successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    generateRoadmap: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const body = generateRoadmapBodySchema.parse(req.body ?? {});
        const roadmap = await generateLearningRoadmapForSeeker({
          userId,
          jobId: body.jobId,
          targetRole: body.targetRole,
          experienceLevel: body.experienceLevel,
          missingSkills: body.missingSkills,
          weeklyHours: body.weeklyHours,
          ai,
        });
        sendCreated(res, { roadmap }, 'Learning roadmap generated successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    listRoadmaps: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmaps = await listSeekerRoadmaps(userId);
        sendSuccess(res, 200, { roadmaps });
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    getRoadmap: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmapId = objectIdSchema.parse(req.params.id);
        const roadmap = await getSeekerRoadmapById(userId, roadmapId);
        sendSuccess(res, 200, { roadmap });
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    toggleRoadmapStep: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmapId = objectIdSchema.parse(req.params.id);
        const stepId = objectIdSchema.parse(req.params.stepId);
        const body = toggleRoadmapStepBodySchema.parse(req.body ?? {});
        const roadmap = await toggleRoadmapStepProgress({
          userId,
          roadmapId,
          stepId,
          isCompleted: body.isCompleted,
        });
        sendSuccess(res, 200, { roadmap }, 'Roadmap progress updated');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    regenerateRoadmap: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmapId = objectIdSchema.parse(req.params.id);
        const body = regenerateRoadmapBodySchema.parse(req.body ?? {});
        const roadmap = await regenerateSeekerRoadmap({
          userId,
          roadmapId,
          missingSkills: body.missingSkills,
          weeklyHours: body.weeklyHours,
          ai,
        });
        sendSuccess(res, 200, { roadmap }, 'Learning roadmap updated safely');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    updateRoadmapStatus: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmapId = objectIdSchema.parse(req.params.id);
        const body = updateRoadmapStatusBodySchema.parse(req.body ?? {});
        const roadmap = await updateRoadmapStatus({
          userId,
          roadmapId,
          status: body.status,
        });
        sendSuccess(res, 200, { roadmap }, 'Roadmap status updated');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    deleteRoadmap: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const roadmapId = objectIdSchema.parse(req.params.id);
        await deleteSeekerRoadmap(userId, roadmapId);
        sendSuccess(res, 200, {}, 'Learning roadmap deleted successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    computeJobMatch: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const jobId = objectIdSchema.parse(req.params.jobId);
        const body = jobMatchBodySchema.parse(req.body ?? {});
        const match = await computeJobMatchForSeeker({
          userId,
          jobId,
          includeAiExplanation: body.includeAiExplanation,
          ai,
          cache,
        });
        sendSuccess(res, 200, match, 'Job match computed successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    getJobRecommendations: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const query = jobRecommendationsQuerySchema.parse(req.query ?? {});
        const result = await getPersonalizedJobRecommendations({
          userId,
          ...query,
        });
        sendSuccess(res, 200, result);
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    listConversations: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const conversations = await listAiConversations(userId);
        sendSuccess(res, 200, { conversations });
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    getConversation: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const conversationId = objectIdSchema.parse(req.params.id);
        const conversation = await getAiConversationById(userId, conversationId);
        sendSuccess(res, 200, { conversation });
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    sendChatMessage: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const body = aiChatBodySchema.parse(req.body ?? {});
        const result = await sendCareerChatMessage({
          userId,
          message: body.message,
          conversationId: body.conversationId,
          topic: body.topic,
          includeProfileContext: body.includeProfileContext,
          ai,
        });
        sendSuccess(res, 200, result);
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },

    deleteConversation: async (req: Request, res: Response): Promise<void> => {
      const userId = requireUserId(req, res);
      if (!userId) return;
      try {
        const conversationId = objectIdSchema.parse(req.params.id);
        await deleteAiConversation(userId, conversationId);
        sendSuccess(res, 200, {}, 'Conversation deleted successfully');
      } catch (err) {
        handleAiControllerError(res, err);
      }
    },
  };
}
