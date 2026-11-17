import { api } from './api';
import type {
  AiChatTopic,
  AiConversation,
  AiConversationSummary,
  AiStatusResponse,
  AnalyzeResumeResponse,
  ApplyExtractedSkillsResponse,
  ExtractedSkillCategory,
  ExtractSkillsResponse,
  JobMatchResponse,
  JobRecommendationsResponse,
  LearningRoadmap,
  ProficiencyLevel,
  SendChatResponse,
  SkillGapResponse,
} from '@/types/ai.types';

// Backend AI requests default to 30s per attempt (+1 bounded retry), so use a longer client timeout
const AI_REQUEST_TIMEOUT_MS = 65_000;

export const aiService = {
  async getStatus(): Promise<AiStatusResponse> {
    const res = await api.get<{ data: AiStatusResponse }>('/ai/status');
    return res.data.data;
  },

  async analyzeResume(
    resumeId: string,
    forceRefresh = false
  ): Promise<AnalyzeResumeResponse> {
    const res = await api.post<{ data: AnalyzeResumeResponse }>(
      `/ai/resume/${resumeId}/analyze`,
      { forceRefresh },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
    return res.data.data;
  },

  async extractSkills(payload: {
    resumeId?: string;
    includeProfile?: boolean;
    forceRefresh?: boolean;
  }): Promise<ExtractSkillsResponse> {
    const res = await api.post<{ data: ExtractSkillsResponse }>(
      '/ai/skills/extract',
      payload,
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
    return res.data.data;
  },

  async applyExtractedSkills(
    skills: Array<{
      name: string;
      category?: ExtractedSkillCategory;
      level?: ProficiencyLevel;
    }>
  ): Promise<ApplyExtractedSkillsResponse> {
    const res = await api.post<{ data: ApplyExtractedSkillsResponse }>(
      '/ai/skills/apply',
      { skills }
    );
    return res.data.data;
  },

  async analyzeSkillGap(payload: {
    jobId?: string;
    targetRole?: string;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    forceRefresh?: boolean;
  }): Promise<SkillGapResponse> {
    const res = await api.post<{ data: SkillGapResponse }>('/ai/skill-gap', payload, {
      timeout: AI_REQUEST_TIMEOUT_MS,
    });
    return res.data.data;
  },

  async listRoadmaps(): Promise<LearningRoadmap[]> {
    const res = await api.get<{ data: { roadmaps: LearningRoadmap[] } }>('/ai/roadmaps');
    return res.data.data.roadmaps;
  },

  async getRoadmap(id: string): Promise<LearningRoadmap> {
    const res = await api.get<{ data: { roadmap: LearningRoadmap } }>(`/ai/roadmaps/${id}`);
    return res.data.data.roadmap;
  },

  async generateRoadmap(payload: {
    jobId?: string;
    targetRole?: string;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
    missingSkills?: string[];
    weeklyHours?: number;
  }): Promise<LearningRoadmap> {
    const res = await api.post<{ data: { roadmap: LearningRoadmap } }>(
      '/ai/roadmaps/generate',
      payload,
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
    return res.data.data.roadmap;
  },

  async toggleRoadmapStep(
    roadmapId: string,
    stepId: string,
    isCompleted: boolean
  ): Promise<LearningRoadmap> {
    const res = await api.patch<{ data: { roadmap: LearningRoadmap } }>(
      `/ai/roadmaps/${roadmapId}/steps/${stepId}`,
      { isCompleted }
    );
    return res.data.data.roadmap;
  },

  async regenerateRoadmap(
    roadmapId: string,
    payload: { missingSkills?: string[]; weeklyHours?: number }
  ): Promise<LearningRoadmap> {
    const res = await api.post<{ data: { roadmap: LearningRoadmap } }>(
      `/ai/roadmaps/${roadmapId}/regenerate`,
      payload,
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
    return res.data.data.roadmap;
  },

  async updateRoadmapStatus(
    roadmapId: string,
    status: 'active' | 'archived'
  ): Promise<LearningRoadmap> {
    const res = await api.patch<{ data: { roadmap: LearningRoadmap } }>(
      `/ai/roadmaps/${roadmapId}/status`,
      { status }
    );
    return res.data.data.roadmap;
  },

  async deleteRoadmap(roadmapId: string): Promise<void> {
    await api.delete(`/ai/roadmaps/${roadmapId}`);
  },

  async computeJobMatch(
    jobId: string,
    includeAiExplanation = true
  ): Promise<JobMatchResponse> {
    const res = await api.post<{ data: JobMatchResponse }>(
      `/ai/jobs/${jobId}/match`,
      { includeAiExplanation },
      { timeout: AI_REQUEST_TIMEOUT_MS }
    );
    return res.data.data;
  },

  async getJobRecommendations(params?: {
    q?: string;
    locationType?: string;
    type?: string;
    experienceLevel?: string;
    minScore?: number;
    sortBy?: 'matchScore' | 'newest';
    limit?: number;
  }): Promise<JobRecommendationsResponse> {
    const res = await api.get<{ data: JobRecommendationsResponse }>(
      '/ai/recommendations/jobs',
      { params }
    );
    return res.data.data;
  },

  async listConversations(): Promise<AiConversationSummary[]> {
    const res = await api.get<{ data: { conversations: AiConversationSummary[] } }>(
      '/ai/chat/conversations'
    );
    return res.data.data.conversations;
  },

  async getConversation(id: string): Promise<AiConversation> {
    const res = await api.get<{ data: { conversation: AiConversation } }>(
      `/ai/chat/conversations/${id}`
    );
    return res.data.data.conversation;
  },

  async sendChatMessage(payload: {
    message: string;
    conversationId?: string;
    topic?: AiChatTopic;
    includeProfileContext?: boolean;
  }): Promise<SendChatResponse> {
    const res = await api.post<{ data: SendChatResponse }>('/ai/chat', payload, {
      timeout: AI_REQUEST_TIMEOUT_MS,
    });
    return res.data.data;
  },

  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/ai/chat/conversations/${id}`);
  },
};
