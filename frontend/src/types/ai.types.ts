export type ExtractedSkillCategory = 'technical' | 'soft' | 'tool' | 'framework' | 'language';
export type ProficiencyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface AiStatusResponse {
  configured: boolean;
  status: string;
  provider: string | null;
  model: string | null;
}

export interface AtsFeedback {
  estimatedCompletenessScore: number;
  methodology: string;
  formattingFindings: string[];
  keywordObservations: string[];
  recommendations: string[];
}

export interface ResumeAnalysisData {
  overview: string;
  professionalSummary: string;
  technicalSkills: string[];
  softSkills: string[];
  toolsAndTechnologies: string[];
  frameworksAndLanguages: string[];
  education: string[];
  workExperience: string[];
  projects: string[];
  certifications: string[];
  strengths: string[];
  weaknesses: string[];
  missingInformation: string[];
  improvementSuggestions: string[];
  atsFeedback: AtsFeedback;
  analyzedAt: string;
  provider: string;
  model: string;
  contentHash: string;
}

export interface AnalyzeResumeResponse {
  resumeId: string;
  fileName: string;
  analysis: ResumeAnalysisData;
  cached: boolean;
}

export interface NormalizedExtractedSkill {
  name: string;
  canonicalName: string;
  slug: string;
  category: ExtractedSkillCategory;
  suggestedLevel: ProficiencyLevel;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
  alreadyInProfile: boolean;
  existingUserLevel?: ProficiencyLevel;
  existingSkillVerified: boolean;
}

export interface ExtractSkillsResponse {
  resumeId?: string;
  extractedSkills: NormalizedExtractedSkill[];
  cached: boolean;
  provider: string;
  model: string;
}

export interface ApplyExtractedSkillsResponse {
  addedCount: number;
  skippedExistingCount: number;
  addedSkills: string[];
  skippedExistingSkills: string[];
  profileSkills: string[];
}

export interface PartialSkillMatch {
  skill: string;
  currentEvidence: string;
  gapDescription: string;
}

export interface MissingSkillItem {
  skill: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  whyItMatters: string;
  howToDevelop: string;
}

export interface InternalCourseSuggestion {
  courseId: string;
  title: string;
  level: string;
  deliveryMode: string;
  duration?: string;
  matchedSkills: string[];
}

export interface SkillGapResponse {
  targetType: 'job' | 'role';
  targetJobId?: string;
  targetTitle: string;
  experienceLevel?: string;
  seekerSkillsUsed: string[];
  summary: string;
  matchedSkills: string[];
  partiallyMatchedSkills: PartialSkillMatch[];
  missingSkills: MissingSkillItem[];
  recommendedNextSteps: string[];
  relatedCourses: InternalCourseSuggestion[];
  readinessEstimate: {
    coverageRatio: number;
    methodology: string;
  };
  cached: boolean;
  provider: string;
  model: string;
}

export interface LearningRoadmapStep {
  _id: string;
  order: number;
  title: string;
  description?: string;
  type: 'course' | 'skill' | 'project' | 'reading';
  skillName?: string;
  estimatedHours?: number;
  topics?: string[];
  projectIdea?: string;
  milestone?: string;
  resourceId?: string;
  resourceUrl?: string;
  resourceSearchQuery?: string;
  isCompleted: boolean;
  completedAt?: string;
}

export interface LearningRoadmap {
  _id: string;
  title: string;
  targetRole?: string;
  targetJob?: { _id: string; title: string; status: string } | string;
  experienceLevel?: string;
  learningObjectives?: string[];
  missingSkills?: string[];
  estimatedTotalWeeks?: number;
  milestones?: string[];
  steps: LearningRoadmapStep[];
  currentStep: number;
  progress: number;
  status: 'active' | 'completed' | 'archived';
  generatedByAI: boolean;
  lastRegeneratedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobMatchBreakdown {
  skillsScore: number;
  experienceScore: number;
  educationAndQualificationScore: number;
  roleAndLocationFitScore: number;
  methodology: string;
}

export interface JobMatchResponse {
  jobId: string;
  jobTitle: string;
  companyName?: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  breakdown: JobMatchBreakdown;
  explanation?: {
    summary: string;
    fitHighlights: string[];
    gapHighlights: string[];
    recommendedAction: string;
  };
  aiExplanationIncluded: boolean;
  cached: boolean;
}

export interface RecommendedJobItem {
  jobId: string;
  title: string;
  companyName?: string;
  location: string;
  locationType: string;
  type: string;
  experienceLevel: string;
  applicationDeadline?: string;
  createdAt: string;
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  reasons: string[];
  hasApplied: boolean;
  isSaved: boolean;
}

export interface JobRecommendationsResponse {
  recommendations: RecommendedJobItem[];
  totalMatched: number;
  profileCompleteForMatching: boolean;
  profileGuidance?: string;
}

export type AiChatTopic = 'general' | 'resume' | 'skills' | 'interview' | 'job_search';

export interface AiChatMessageEntry {
  _id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface AiConversationSummary {
  _id: string;
  title: string;
  topic: AiChatTopic;
  lastMessageAt: string;
  createdAt: string;
}

export interface AiConversation extends AiConversationSummary {
  messages: AiChatMessageEntry[];
}

export interface SendChatResponse {
  conversation: AiConversation;
  reply: string;
  disclaimer: string;
}
