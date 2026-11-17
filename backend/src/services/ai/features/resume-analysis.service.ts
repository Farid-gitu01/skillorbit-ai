import { z } from 'zod';
import { type IResume, type IResumeAnalysis, Resume } from '../../../models/Resume.model.js';
import { ApplicationError } from '../../../utils/application-error.js';
import {
  aiService,
  type AiService,
  defineAiPrompt,
  wrapUntrustedUserBlock,
} from '../index.js';
import { type AiResponseCache, sharedAiCache } from '../utils/ai-cache.util.js';
import { extractResumeTextFromDisk } from '../utils/resume-extractor.js';

const RESUME_ANALYSIS_CACHE_TTL_MS = 10 * 60 * 1000;

export const resumeAnalysisAiOutputSchema = z.object({
  overview: z.string().trim().min(10).max(1200),
  professionalSummary: z.string().trim().min(10).max(1500),
  technicalSkills: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  softSkills: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
  toolsAndTechnologies: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  frameworksAndLanguages: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  education: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  workExperience: z.array(z.string().trim().min(1).max(400)).max(25).default([]),
  projects: z.array(z.string().trim().min(1).max(350)).max(25).default([]),
  certifications: z.array(z.string().trim().min(1).max(250)).max(25).default([]),
  strengths: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  weaknesses: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(15).default([]),
  improvementSuggestions: z.array(z.string().trim().min(1).max(350)).max(15).default([]),
  atsObservations: z.object({
    formattingFindings: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
    keywordObservations: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
    recommendations: z.array(z.string().trim().min(1).max(300)).max(10).default([]),
  }),
});

export type ResumeAnalysisAiOutput = z.infer<typeof resumeAnalysisAiOutputSchema>;

const resumeAnalysisPrompt = defineAiPrompt({
  id: 'resume_analysis',
  version: '1.0.0',
  feature: 'resume_analysis',
  defaultMaxTokens: 1800,
  defaultTemperature: 0.15,
  maxOutputChars: 12000,
  systemPrompt: [
    'You are an objective technical career advisor and resume analyst for SkillOrbit AI.',
    'Analyze ONLY the resume content inside <untrusted_input>. Do NOT invent credentials, employers, degrees, dates, or skills absent from the resume text.',
    'Return ONLY a valid JSON object matching this exact structure:',
    '{',
    '  "overview": string,',
    '  "professionalSummary": string,',
    '  "technicalSkills": string[],',
    '  "softSkills": string[],',
    '  "toolsAndTechnologies": string[],',
    '  "frameworksAndLanguages": string[],',
    '  "education": string[],',
    '  "workExperience": string[],',
    '  "projects": string[],',
    '  "certifications": string[],',
    '  "strengths": string[],',
    '  "weaknesses": string[],',
    '  "missingInformation": string[],',
    '  "improvementSuggestions": string[],',
    '  "atsObservations": {',
    '    "formattingFindings": string[],',
    '    "keywordObservations": string[],',
    '    "recommendations": string[]',
    '  }',
    '}',
  ].join('\n'),
  inputSchema: z.object({
    fileName: z.string().trim().min(1).max(255),
    resumeText: z.string().trim().min(20).max(24000),
  }),
  buildUserPrompt: ({ fileName, resumeText }) =>
    [
      wrapUntrustedUserBlock('resume_filename', fileName, 260),
      wrapUntrustedUserBlock('resume_extracted_text', resumeText, 24000),
    ].join('\n\n'),
});

function dedupeList(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Deterministic, transparent ATS section-completeness score so we never return
 * an opaque black-box ATS score claiming proprietary vendor calibration.
 */
function computeAtsCompleteness(rawText: string, aiOutput: ResumeAnalysisAiOutput): {
  estimatedCompletenessScore: number;
  methodology: string;
  formattingFindings: string[];
  keywordObservations: string[];
  recommendations: string[];
} {
  let score = 0;
  const findings: string[] = [];

  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(rawText);
  const hasPhoneOrLink =
    /(?:\+?\d[\d\s\-().]{7,}\d)|(?:https?:\/\/|linkedin\.com|github\.com)/i.test(rawText);
  if (hasEmail) score += 10;
  else findings.push('Contact email address was not clearly detected in extracted text.');
  if (hasPhoneOrLink) score += 5;
  else findings.push('Phone number or professional profile URL (e.g., LinkedIn/GitHub) is missing.');

  const allSkills = dedupeList([
    ...aiOutput.technicalSkills,
    ...aiOutput.toolsAndTechnologies,
    ...aiOutput.frameworksAndLanguages,
  ]);
  if (allSkills.length >= 6) score += 25;
  else if (allSkills.length >= 2) score += 15;
  else findings.push('Dedicated technical skills keywords are sparse or missing.');

  if (aiOutput.workExperience.length >= 1) score += 25;
  else findings.push('No formal work experience entries were detected.');

  if (aiOutput.education.length >= 1) score += 15;
  else findings.push('Education section or degree credentials were not detected.');

  if (aiOutput.projects.length >= 1 || aiOutput.certifications.length >= 1) score += 10;

  const hasQuantifiedMetrics = /\b\d+(?:\.\d+)?%|\b\d+\+\b|\$\d+|\b\d+\s*(?:years?|yrs?|users?|projects?|clients?)\b/i.test(
    rawText
  );
  if (hasQuantifiedMetrics) score += 10;
  else findings.push('Limited measurable impact metrics (%, counts, timelines) detected.');

  return {
    estimatedCompletenessScore: Math.min(100, Math.max(0, score)),
    methodology:
      'Transparent structural completeness estimate (contact info 15%, skills coverage 25%, work history 25%, education 15%, projects/certifications 10%, quantified outcomes 10%) paired with AI keyword and formatting observations.',
    formattingFindings: dedupeList([...findings, ...aiOutput.atsObservations.formattingFindings]).slice(0, 8),
    keywordObservations: dedupeList(aiOutput.atsObservations.keywordObservations).slice(0, 8),
    recommendations: dedupeList(aiOutput.atsObservations.recommendations).slice(0, 8),
  };
}

export async function loadValidatedResumeText(resume: IResume): Promise<{
  text: string;
  contentHash: string;
}> {
  if (resume.fileUrl) {
    try {
      const extracted = await extractResumeTextFromDisk({
        storedFileName: resume.fileUrl,
        originalFileName: resume.fileName,
        mimeType: resume.mimeType,
      });
      return { text: extracted.text, contentHash: extracted.contentHash };
    } catch (error) {
      // Fallback only if stored file is absent in test environment AND backend already persisted rawText
      if (!(error instanceof ApplicationError && error.code === 'FILE_NOT_FOUND' && resume.parsedData?.rawText)) {
        throw error;
      }
    }
  }

  const storedText = resume.parsedData?.rawText?.trim() ?? '';
  if (storedText.length < 30) {
    throw new ApplicationError('Resume contains insufficient readable text for AI analysis.', {
      statusCode: 400,
      code: 'RESUME_UNREADABLE',
    });
  }

  const { createHash } = await import('node:crypto');
  return {
    text: storedText.slice(0, 24000),
    contentHash: createHash('sha256').update(storedText.slice(0, 24000), 'utf8').digest('hex'),
  };
}

export interface AnalyzeResumeResult {
  resumeId: string;
  fileName: string;
  analysis: IResumeAnalysis;
  cached: boolean;
}

export async function analyzeResumeById(options: {
  userId: string;
  resumeId: string;
  forceRefresh?: boolean;
  ai?: AiService;
  cache?: AiResponseCache;
}): Promise<AnalyzeResumeResult> {
  const { userId, resumeId, forceRefresh = false } = options;
  const ai = options.ai ?? aiService;
  const cache = options.cache ?? sharedAiCache;

  const resume = await Resume.findById(resumeId).select('+parsedData.rawText');
  if (!resume) {
    throw new ApplicationError('Resume not found.', {
      statusCode: 404,
      code: 'RESUME_NOT_FOUND',
    });
  }

  if (resume.user.toString() !== userId) {
    throw new ApplicationError('You are not authorized to analyze this resume.', {
      statusCode: 403,
      code: 'FORBIDDEN',
    });
  }

  const extracted = await loadValidatedResumeText(resume);

  // Reuse persisted analysis when content hash matches and refresh is not forced
  if (
    !forceRefresh &&
    resume.parsedData?.analysis &&
    resume.parsedData.analysis.contentHash === extracted.contentHash
  ) {
    return {
      resumeId: resume._id.toString(),
      fileName: resume.fileName,
      analysis: resume.parsedData.analysis,
      cached: true,
    };
  }

  const cacheKey = `resume-analysis:${userId}:${resumeId}:${extracted.contentHash}`;
  const { value: analysisResult, cacheHit } = await cache.getOrCompute<IResumeAnalysis>(
    cacheKey,
    RESUME_ANALYSIS_CACHE_TTL_MS,
    async () => {
      const result = await ai.executeStructuredPrompt({
        template: resumeAnalysisPrompt,
        input: {
          fileName: resume.fileName,
          resumeText: extracted.text,
        },
        schema: resumeAnalysisAiOutputSchema,
      });

      const atsFeedback = computeAtsCompleteness(extracted.text, result.data);
      const analysis: IResumeAnalysis = {
        overview: result.data.overview,
        professionalSummary: result.data.professionalSummary,
        technicalSkills: dedupeList(result.data.technicalSkills),
        softSkills: dedupeList(result.data.softSkills),
        toolsAndTechnologies: dedupeList(result.data.toolsAndTechnologies),
        frameworksAndLanguages: dedupeList(result.data.frameworksAndLanguages),
        education: dedupeList(result.data.education),
        workExperience: dedupeList(result.data.workExperience),
        projects: dedupeList(result.data.projects),
        certifications: dedupeList(result.data.certifications),
        strengths: dedupeList(result.data.strengths),
        weaknesses: dedupeList(result.data.weaknesses),
        missingInformation: dedupeList(result.data.missingInformation),
        improvementSuggestions: dedupeList(result.data.improvementSuggestions),
        atsFeedback,
        analyzedAt: new Date(),
        provider: result.metadata.provider,
        model: result.metadata.model,
        contentHash: extracted.contentHash,
      };
      return analysis;
    },
    { skipCache: forceRefresh }
  );

  const combinedSkills = dedupeList([
    ...analysisResult.technicalSkills,
    ...analysisResult.toolsAndTechnologies,
    ...analysisResult.frameworksAndLanguages,
    ...analysisResult.softSkills,
  ]);

  resume.parseStatus = 'completed';
  resume.parsedAt = new Date();
  resume.parsedData = {
    ...(resume.parsedData ?? {}),
    rawText: extracted.text,
    summary: analysisResult.overview,
    extractedSkills: combinedSkills,
    analysis: analysisResult,
  };
  await resume.save();

  return {
    resumeId: resume._id.toString(),
    fileName: resume.fileName,
    analysis: analysisResult,
    cached: cacheHit,
  };
}
