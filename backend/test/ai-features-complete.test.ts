import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-ai-features-test-secret-32c';
process.env.JWT_EXPIRES_IN = '15m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_ai_features_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { User },
  { Resume },
  { Skill },
  { UserSkill },
  { Profile },
  { Job },
  { Course },
  { LearningRoadmap },
  { AiConversation },
  { Application },
  { createAiService, AiProviderError },
  { extractResumeTextFromBuffer },
  { analyzeResumeById },
  { normalizeSkillName, extractSkillsForSeeker, applyExtractedSkillsToProfile },
  { recalculateRoadmapProgress, regenerateSeekerRoadmap },
  {
    evaluateDeterministicJobMatch,
    buildActiveJobFilter,
  },
  { getPersonalizedJobRecommendations },
  { sendCareerChatMessage, getAiConversationById, MAX_MESSAGES_PER_CONVERSATION },
  { mapAiErrorToHttpDescriptor },
  { AiResponseCache },
  { generateToken },
  { AUTH_COOKIE_NAME },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/models/user.model.js'),
  import('../src/models/Resume.model.js'),
  import('../src/models/Skill.model.js'),
  import('../src/models/UserSkill.model.js'),
  import('../src/models/Profile.model.js'),
  import('../src/models/Job.model.js'),
  import('../src/models/Course.model.js'),
  import('../src/models/LearningRoadmap.model.js'),
  import('../src/models/AiConversation.model.js'),
  import('../src/models/Application.model.js'),
  import('../src/services/ai/index.js'),
  import('../src/services/ai/utils/resume-extractor.js'),
  import('../src/services/ai/features/resume-analysis.service.js'),
  import('../src/services/ai/features/skill-extraction.service.js'),
  import('../src/services/ai/features/roadmap.service.js'),
  import('../src/services/ai/features/job-matching.service.js'),
  import('../src/services/ai/features/job-recommendations.service.js'),
  import('../src/services/ai/features/ai-chat.service.js'),
  import('../src/services/ai/utils/ai-http-error.util.js'),
  import('../src/services/ai/utils/ai-cache.util.js'),
  import('../src/utils/token.util.js'),
  import('../src/utils/auth-cookie.util.js'),
]);

function makeMinimalPdf(text: string): Buffer {
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const pdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Length 120 >>\nstream\nBT\n/F1 12 Tf\n72 720 Td\n(${escaped}) Tj\nET\nendstream\nendobj\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

function buildMinimalZip(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.content;

    const localHeader = Buffer.alloc(30 + nameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8); // store method 0
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);
    nameBuf.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + nameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt32LE(offset, 42);
    nameBuf.copy(centralHeader, 46);

    localParts.push(localHeader, data);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

function makeMinimalDocx(text: string): Buffer {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
  return buildMinimalZip([
    { name: '[Content_Types].xml', content: Buffer.from('<Types></Types>', 'utf8') },
    { name: 'word/document.xml', content: Buffer.from(xml, 'utf8') },
  ]);
}

function makeOpenAiJsonResponse(payload: unknown): Response {
  return new Response(
    JSON.stringify({
      id: 'chatcmpl-test',
      model: 'gpt-4o-mini',
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: typeof payload === 'string' ? payload : JSON.stringify(payload),
          },
        },
      ],
      usage: { prompt_tokens: 120, completion_tokens: 180, total_tokens: 300 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

async function dispatchToApp(
  routePath: string,
  options: { method?: string; cookie?: string; body?: unknown } = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const rawBody = options.body !== undefined ? JSON.stringify(options.body) : '';
    const reqStream = new Readable({
      read() {
        if (rawBody) this.push(rawBody);
        this.push(null);
      },
    }) as unknown as Record<string, unknown>;

    reqStream.method = options.method ?? 'GET';
    reqStream.url = routePath;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (options.cookie) headers.cookie = options.cookie;
    if (rawBody) headers['content-length'] = Buffer.byteLength(rawBody).toString();
    reqStream.headers = headers;
    reqStream.rawHeaders = [];

    const mockSocket = new Duplex({
      read() {},
      write(_chunk, _enc, cb) {
        cb();
      },
    }) as unknown as Record<string, unknown>;
    mockSocket.remoteAddress = '127.0.0.1';
    reqStream.socket = mockSocket;
    reqStream.connection = mockSocket;
    reqStream.ip = '127.0.0.1';

    const chunks: Buffer[] = [];
    const mockRes = new EventEmitter() as unknown as Record<string, unknown>;
    mockRes.statusCode = 200;
    mockRes.headersSent = false;
    mockRes.socket = mockSocket;
    mockRes.connection = mockSocket;
    const headerStore = new Map<string, unknown>();

    mockRes.setHeader = (name: string, val: unknown) => {
      headerStore.set(name.toLowerCase(), val);
      return mockRes;
    };
    mockRes.getHeader = (name: string) => headerStore.get(name.toLowerCase());
    mockRes.getHeaders = () => Object.fromEntries(headerStore.entries());
    mockRes.removeHeader = (name: string) => headerStore.delete(name.toLowerCase());
    mockRes.hasHeader = (name: string) => headerStore.has(name.toLowerCase());
    mockRes.writeHead = (code: number) => {
      mockRes.statusCode = code;
      mockRes.headersSent = true;
      return mockRes;
    };
    mockRes.write = (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    mockRes.end = (chunk?: Buffer | string) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed: Record<string, unknown> = {};
      try {
        parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        parsed = { raw: text };
      }
      resolve({ status: mockRes.statusCode as number, body: parsed });
    };

    try {
      (app as unknown as (req: unknown, res: unknown) => void)(reqStream, mockRes);
    } catch (err) {
      reject(err);
    }
  });
}

// ── Phase 2.6.3 Tests: Resume Extraction & Security ────────────────────────────

test('2.6.3: Extract valid PDF and DOCX resume text reliably and reject unsafe or malformed files', () => {
  const pdfBuffer = makeMinimalPdf(
    'Jane Doe Senior TypeScript React Developer jane@example.com 5 years experience'
  );
  const extractedPdf = extractResumeTextFromBuffer({
    buffer: pdfBuffer,
    fileName: 'jane_resume.pdf',
    mimeType: 'application/pdf',
  });
  assert.equal(extractedPdf.fileType, 'pdf');
  assert.match(extractedPdf.text, /Jane Doe/);
  assert.match(extractedPdf.text, /TypeScript/);
  assert.ok(extractedPdf.contentHash.length === 64);

  const docxBuffer = makeMinimalDocx(
    'Alice Smith Full Stack Node.js MongoDB Engineer alice@example.com'
  );
  const extractedDocx = extractResumeTextFromBuffer({
    buffer: docxBuffer,
    fileName: 'alice_cv.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  assert.equal(extractedDocx.fileType, 'docx');
  assert.match(extractedDocx.text, /Alice Smith/);
  assert.match(extractedDocx.text, /MongoDB/);

  assert.throws(
    () =>
      extractResumeTextFromBuffer({
        buffer: Buffer.alloc(0),
        fileName: 'empty.pdf',
        mimeType: 'application/pdf',
      }),
    /empty/i
  );

  assert.throws(
    () =>
      extractResumeTextFromBuffer({
        buffer: Buffer.from('%PDF-1.4\n1 0 obj << /Encrypt 2 0 R >> endobj\n%%EOF'),
        fileName: 'encrypted.pdf',
        mimeType: 'application/pdf',
      }),
    /encrypted/i
  );

  assert.throws(
    () =>
      extractResumeTextFromBuffer({
        buffer: Buffer.from('not-a-real-pdf-header'),
        fileName: 'fake.pdf',
        mimeType: 'application/pdf',
      }),
    /valid pdf signature/i
  );

  const macroDocx = buildMinimalZip([
    { name: 'word/document.xml', content: Buffer.from('<w:t>Hello World Resume Text</w:t>') },
    { name: 'word/vbaProject.bin', content: Buffer.from('macro') },
  ]);
  assert.throws(
    () =>
      extractResumeTextFromBuffer({
        buffer: macroDocx,
        fileName: 'macro.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    /macro/i
  );

  const traversalDocx = buildMinimalZip([
    { name: '../../etc/passwd', content: Buffer.from('x') },
  ]);
  assert.throws(
    () =>
      extractResumeTextFromBuffer({
        buffer: traversalDocx,
        fileName: 'traversal.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }),
    /unsafe/i
  );
});

test('2.6.3 & 2.6.10: analyzeResumeById validates AI JSON output, computes transparent ATS score, caches by contentHash, and handles malformed JSON safely', async () => {
  const userId = new mongoose.Types.ObjectId().toString();
  const resumeId = new mongoose.Types.ObjectId().toString();
  const rawResumeText =
    'Samira Khan Backend Software Engineer samira@example.com +1-555-010-2000\nSkills: TypeScript, Node.js, PostgreSQL, Docker\nExperience: Built API serving 50000+ users and reduced latency by 35% over 3 years.\nEducation: B.S. Computer Science';

  let saveCount = 0;
  const fakeResumeDoc: Record<string, unknown> = {
    _id: new mongoose.Types.ObjectId(resumeId),
    user: new mongoose.Types.ObjectId(userId),
    fileName: 'samira_resume.pdf',
    fileUrl: '',
    mimeType: 'application/pdf',
    parseStatus: 'completed',
    parsedData: {
      rawText: rawResumeText,
      extractedSkills: [],
    },
    save: async () => {
      saveCount += 1;
      return fakeResumeDoc;
    },
  };

  const origFindById = Resume.findById;
  Resume.findById = (() => ({
    select: async () => fakeResumeDoc,
  })) as unknown as typeof Resume.findById;

  let aiCallCount = 0;
  const mockedAi = createAiService({
    configSource: {
      provider: 'openai',
      apiKey: 'sk-test-1234567890abcdef1234567890',
      model: 'gpt-4o-mini',
    },
    adapterDeps: {
      httpClient: async () => {
        aiCallCount += 1;
        return makeOpenAiJsonResponse({
          overview: 'Strong backend engineer specializing in TypeScript and distributed APIs.',
          professionalSummary: 'Proven backend delivery with measurable throughput improvements.',
          technicalSkills: ['Backend Engineering', 'REST APIs'],
          softSkills: ['Technical Ownership'],
          toolsAndTechnologies: ['Docker', 'PostgreSQL'],
          frameworksAndLanguages: ['TypeScript', 'Node.js'],
          education: ['B.S. Computer Science'],
          workExperience: ['Built API serving 50000+ users (35% latency reduction)'],
          projects: [],
          certifications: [],
          strengths: ['Quantified latency improvement'],
          weaknesses: ['Missing cloud deployment specifics'],
          missingInformation: ['Public portfolio or GitHub URL'],
          improvementSuggestions: ['Add explicit cloud provider experience where applicable.'],
          atsObservations: {
            formattingFindings: ['Clear contact email and phone header present.'],
            keywordObservations: ['Core TypeScript/Node.js stack terms clearly present.'],
            recommendations: ['Include unit testing framework keywords if used.'],
          },
        });
      },
    },
  });

  const testCache = new AiResponseCache(50);

  try {
    const first = await analyzeResumeById({
      userId,
      resumeId,
      ai: mockedAi,
      cache: testCache,
    });
    assert.equal(aiCallCount, 1);
    assert.equal(saveCount, 1);
    assert.equal(first.cached, false);
    assert.ok(first.analysis.atsFeedback.estimatedCompletenessScore >= 75);
    assert.match(first.analysis.atsFeedback.methodology, /Transparent structural completeness/);

    // Second call with matching contentHash reuses persisted/cached analysis
    const second = await analyzeResumeById({
      userId,
      resumeId,
      ai: mockedAi,
      cache: testCache,
    });
    assert.equal(aiCallCount, 1);
    assert.equal(second.cached, true);

    // Unauthorized access by a different user is blocked with 403
    await assert.rejects(
      () =>
        analyzeResumeById({
          userId: new mongoose.Types.ObjectId().toString(),
          resumeId,
          ai: mockedAi,
          cache: testCache,
        }),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 403
    );

    // Malformed AI provider response fails safely
    const badAi = createAiService({
      configSource: {
        provider: 'openai',
        apiKey: 'sk-test-1234567890abcdef1234567890',
        model: 'gpt-4o-mini',
      },
      adapterDeps: {
        httpClient: async () => makeOpenAiJsonResponse('NOT_VALID_JSON_AT_ALL'),
      },
    });
    await assert.rejects(
      () =>
        analyzeResumeById({
          userId,
          resumeId,
          forceRefresh: true,
          ai: badAi,
          cache: new AiResponseCache(10),
        }),
      (err: unknown) => err instanceof AiProviderError && err.code === 'AI_RESPONSE_INVALID'
    );
  } finally {
    Resume.findById = origFindById;
  }
});

// ── Phase 2.6.4 Tests: Normalization, Extraction & Non-Overwrite Apply ─────────

test('2.6.4: Normalizes skill aliases and applies new skills without overwriting existing UserSkill records', async () => {
  assert.equal(normalizeSkillName('js'), 'JavaScript');
  assert.equal(normalizeSkillName('NodeJS'), 'Node.js');
  assert.equal(normalizeSkillName('reactjs'), 'React');
  assert.equal(normalizeSkillName('k8s'), 'Kubernetes');

  const userId = new mongoose.Types.ObjectId().toString();
  const resumeId = new mongoose.Types.ObjectId().toString();
  const existingSkillId = new mongoose.Types.ObjectId();

  const origResumeFindById = Resume.findById;
  const origProfileFindOne = Profile.findOne;
  const origProfileCreate = Profile.create;
  const origSkillFind = Skill.find;
  const origSkillFindOne = Skill.findOne;
  const origSkillCreate = Skill.create;
  const origUserSkillFind = UserSkill.find;
  const origUserSkillFindOne = UserSkill.findOne;
  const origUserSkillCreate = UserSkill.create;

  const createdUserSkills: string[] = [];

  try {
    Resume.findById = (() => ({
      select: async () => ({
        _id: new mongoose.Types.ObjectId(resumeId),
        user: new mongoose.Types.ObjectId(userId),
        fileName: 'cv.pdf',
        fileUrl: '',
        mimeType: 'application/pdf',
        parsedData: {
          rawText: 'Experienced with JS, ReactJS, Docker, and PostgreSQL for SaaS APIs.',
        },
      }),
    })) as unknown as typeof Resume.findById;

    Profile.findOne = (() => ({
      select: () => ({
        lean: async () => ({
          headline: 'Backend Dev',
          skills: ['JavaScript'],
          experience: [],
          education: [],
        }),
      }),
      skills: ['JavaScript'],
      save: async () => undefined,
    })) as unknown as typeof Profile.findOne;

    Skill.find = (() => ({
      select: () => ({
        lean: async () => [{ _id: existingSkillId, name: 'JavaScript', slug: 'javascript', aliases: ['js'] }],
      }),
    })) as unknown as typeof Skill.find;

    UserSkill.find = (() => ({
      populate: () => ({
        lean: async () => [{ skill: { name: 'JavaScript', slug: 'javascript' }, level: 'expert', isVerified: true }],
      }),
    })) as unknown as typeof UserSkill.find;

    const ai = createAiService({
      configSource: { provider: 'openai', apiKey: 'sk-test-1234567890abcdef', model: 'gpt-4o-mini' },
      adapterDeps: {
        httpClient: async () =>
          makeOpenAiJsonResponse({
            skills: [
              { name: 'js', category: 'language', suggestedLevel: 'beginner', evidence: 'Built SaaS frontend', confidence: 'high' },
              { name: 'Docker', category: 'tool', suggestedLevel: 'intermediate', evidence: 'Containerized SaaS APIs', confidence: 'high' },
            ],
          }),
      },
    });

    const extracted = await extractSkillsForSeeker({
      userId,
      resumeId,
      ai,
      cache: new AiResponseCache(20),
    });

    assert.equal(extracted.extractedSkills.length, 2);
    const jsEntry = extracted.extractedSkills.find((s) => s.canonicalName === 'JavaScript');
    const dockerEntry = extracted.extractedSkills.find((s) => s.canonicalName === 'Docker');
    assert.ok(jsEntry?.alreadyInProfile);
    assert.equal(jsEntry?.existingSkillVerified, true);
    assert.equal(dockerEntry?.alreadyInProfile, false);

    // Test safe apply: existing JavaScript must NOT be overwritten
    const fakeProfileDoc = {
      user: userId,
      skills: ['JavaScript'],
      save: async () => undefined,
    };
    Profile.findOne = (async () => fakeProfileDoc) as unknown as typeof Profile.findOne;
    Skill.findOne = (async (query: Record<string, unknown>) => {
      const ors = (query.$or ?? []) as Array<{ slug?: string }>;
      if (ors.some((item) => item.slug === 'javascript')) {
        return { _id: existingSkillId, name: 'JavaScript', slug: 'javascript' };
      }
      return null;
    }) as unknown as typeof Skill.findOne;
    Skill.create = (async (doc: { name: string; slug: string }) => ({
      _id: new mongoose.Types.ObjectId(),
      name: doc.name,
      slug: doc.slug,
    })) as unknown as typeof Skill.create;
    UserSkill.findOne = (async (q: { skill: mongoose.Types.ObjectId }) =>
      q.skill.equals(existingSkillId) ? { _id: new mongoose.Types.ObjectId(), level: 'expert' } : null) as unknown as typeof UserSkill.findOne;
    UserSkill.create = (async (doc: { skill: mongoose.Types.ObjectId; source: string }) => {
      createdUserSkills.push(doc.source);
      return doc;
    }) as unknown as typeof UserSkill.create;

    const applied = await applyExtractedSkillsToProfile({
      userId,
      skills: [
        { name: 'JavaScript', category: 'language', level: 'beginner' },
        { name: 'Docker', category: 'tool', level: 'intermediate' },
      ],
    });

    assert.equal(applied.skippedExistingCount, 1);
    assert.deepEqual(applied.skippedExistingSkills, ['JavaScript']);
    assert.equal(applied.addedCount, 1);
    assert.deepEqual(applied.addedSkills, ['Docker']);
    assert.deepEqual(createdUserSkills, ['resume']);
    assert.ok(applied.profileSkills.includes('Docker'));
  } finally {
    Resume.findById = origResumeFindById;
    Profile.findOne = origProfileFindOne;
    Profile.create = origProfileCreate;
    Skill.find = origSkillFind;
    Skill.findOne = origSkillFindOne;
    Skill.create = origSkillCreate;
    UserSkill.find = origUserSkillFind;
    UserSkill.findOne = origUserSkillFindOne;
    UserSkill.create = origUserSkillCreate;
  }
});

// ── Phase 2.6.6 Tests: Roadmap Progress & Safe Regeneration ────────────────────

test('2.6.6: Recalculates roadmap progress and preserves completed steps during safe regeneration', async () => {
  const userId = new mongoose.Types.ObjectId();
  const roadmapId = new mongoose.Types.ObjectId();
  const completedDate = new Date('2026-11-01T10:00:00Z');

  const fakeRoadmap = {
    _id: roadmapId,
    user: userId,
    title: 'Backend TypeScript Roadmap',
    targetRole: 'Backend Engineer',
    experienceLevel: 'mid',
    missingSkills: ['Docker', 'Kubernetes'],
    learningObjectives: ['Master containers'],
    estimatedTotalWeeks: 6,
    milestones: ['Deploy containerized API'],
    status: 'active' as const,
    currentStep: 1,
    progress: 0,
    steps: [
      {
        order: 1,
        title: 'Docker Fundamentals',
        type: 'course' as const,
        skillName: 'Docker',
        isCompleted: true,
        completedAt: completedDate,
      },
      {
        order: 2,
        title: 'Kubernetes Deployment',
        type: 'project' as const,
        skillName: 'Kubernetes',
        isCompleted: false,
      },
    ],
    save: async function () {
      return this;
    },
  };

  recalculateRoadmapProgress(fakeRoadmap as unknown as Parameters<typeof recalculateRoadmapProgress>[0]);
  assert.equal(fakeRoadmap.progress, 50);
  assert.equal(fakeRoadmap.currentStep, 2);
  assert.equal(fakeRoadmap.status, 'active');

  const origRoadmapFindById = LearningRoadmap.findById;
  const origCourseFind = Course.find;
  const origUserSkillFind = UserSkill.find;
  const origProfileFindOne = Profile.findOne;
  const origResumeFindOne = Resume.findOne;

  try {
    LearningRoadmap.findById = (() => ({
      populate: async () => fakeRoadmap,
    })) as unknown as typeof LearningRoadmap.findById;
    Course.find = (() => ({
      populate: () => ({
        select: () => ({
          limit: () => ({
            lean: async () => [],
          }),
        }),
      }),
    })) as unknown as typeof Course.find;
    UserSkill.find = (() => ({
      populate: () => ({ lean: async () => [{ skill: { name: 'TypeScript' }, level: 'advanced' }] }),
    })) as unknown as typeof UserSkill.find;
    Profile.findOne = (() => ({
      select: () => ({ lean: async () => ({ headline: 'Backend Dev', skills: ['Node.js'] }) }),
    })) as unknown as typeof Profile.findOne;
    Resume.findOne = (() => ({
      select: () => ({ lean: async () => null }),
    })) as unknown as typeof Resume.findOne;

    const ai = createAiService({
      configSource: { provider: 'openai', apiKey: 'sk-test-1234567890abcdef', model: 'gpt-4o-mini' },
      adapterDeps: {
        httpClient: async () =>
          makeOpenAiJsonResponse({
            title: 'Updated Backend Cloud Roadmap',
            learningObjectives: ['Deploy containers reliably'],
            estimatedTotalWeeks: 5,
            milestones: ['Ship Docker & K8s stack'],
            steps: [
              {
                order: 1,
                title: 'Docker Fundamentals',
                description: 'Build multi-stage container images.',
                type: 'course',
                skillName: 'Docker',
                estimatedHours: 8,
                topics: ['Dockerfile', 'Compose'],
                resourceSearchQuery: 'Docker multi-stage builds tutorial',
              },
              {
                order: 2,
                title: 'Kubernetes Services & Pods',
                description: 'Deploy pods and services locally.',
                type: 'project',
                skillName: 'Kubernetes',
                estimatedHours: 12,
                topics: ['Pods', 'Services'],
                resourceSearchQuery: 'Kubernetes services tutorial',
              },
              {
                order: 3,
                title: 'CI/CD Pipeline Automation',
                description: 'Automate build and test workflows.',
                type: 'reading',
                skillName: 'CI/CD',
                estimatedHours: 6,
                topics: ['GitHub Actions'],
                resourceSearchQuery: 'CI CD pipeline fundamentals',
              },
            ],
          }),
      },
    });

    const updated = await regenerateSeekerRoadmap({
      userId: userId.toString(),
      roadmapId: roadmapId.toString(),
      ai,
    });

    assert.equal(updated.steps.length, 3);
    assert.equal(updated.steps[0]?.isCompleted, true);
    assert.equal(updated.steps[1]?.isCompleted, false);
    assert.equal(updated.progress, 33);
    assert.equal(updated.steps[0]?.resourceUrl, undefined); // No fabricated external URL
    assert.equal(updated.steps[0]?.resourceSearchQuery, 'Docker multi-stage builds tutorial');
  } finally {
    LearningRoadmap.findById = origRoadmapFindById;
    Course.find = origCourseFind;
    UserSkill.find = origUserSkillFind;
    Profile.findOne = origProfileFindOne;
    Resume.findOne = origResumeFindOne;
  }
});

// ── Phase 2.6.7 & 2.6.8 Tests: Job Match Scoring & Active Recommendations ───────

test('2.6.7 & 2.6.8: Evaluates deterministic job match accurately and deduplicates active recommendations with incomplete-profile guidance', async () => {
  const seekerContext = {
    normalizedSkillSet: new Set(['typescript', 'react', 'node.js']),
    displaySkills: ['TypeScript', 'React', 'Node.js'],
    headline: 'Senior Full Stack Engineer',
    location: 'Austin, TX',
    experienceTitles: ['full stack engineer'],
    experienceYearsApprox: 5,
    educationTexts: ['bachelor computer science'],
    profileHasSubstantiveData: true,
    contextHash: 'abc123',
  };

  const jobMatch = evaluateDeterministicJobMatch(seekerContext, {
    _id: new mongoose.Types.ObjectId(),
    title: 'Full Stack Engineer',
    description: 'Build scalable web apps',
    qualifications: ['Bachelor degree in Computer Science or related field'],
    skills: [{ name: 'TypeScript' }, { name: 'React' }, { name: 'GraphQL' }],
    location: 'Austin, TX',
    locationType: 'hybrid',
    type: 'full-time',
    experienceLevel: 'mid',
  });

  assert.deepEqual(jobMatch.matchedSkills, ['TypeScript', 'React']);
  assert.deepEqual(jobMatch.missingSkills, ['GraphQL']);
  assert.ok(jobMatch.matchScore >= 75 && jobMatch.matchScore <= 100);
  assert.equal(jobMatch.breakdown.experienceScore, 20);

  const activeFilter = buildActiveJobFilter(new Date('2026-06-01T00:00:00Z'));
  assert.equal(activeFilter.status, 'active');
  assert.equal(activeFilter.isDeleted, false);

  // Test recommendation deduplication + empty profile guidance
  const dupId = new mongoose.Types.ObjectId();
  const secondId = new mongoose.Types.ObjectId();

  const origUserSkillFind = UserSkill.find;
  const origProfileFindOne = Profile.findOne;
  const origResumeFindOne = Resume.findOne;
  const origJobFind = Job.find;
  const origAppFind = Application.find;

  try {
    UserSkill.find = (() => ({
      populate: () => ({ lean: async () => [] }),
    })) as unknown as typeof UserSkill.find;
    Profile.findOne = (() => ({
      select: () => ({ lean: async () => null }),
    })) as unknown as typeof Profile.findOne;
    Resume.findOne = (() => ({
      select: () => ({ lean: async () => null }),
    })) as unknown as typeof Resume.findOne;
    Application.find = (() => ({
      select: () => ({ lean: async () => [] }),
    })) as unknown as typeof Application.find;
    Job.find = (() => ({
      populate: () => ({
        populate: () => ({
          select: () => ({
            sort: () => ({
              limit: () => ({
                lean: async () => [
                  {
                    _id: dupId,
                    title: 'Frontend Developer',
                    description: 'React UI',
                    skills: [],
                    location: 'Remote',
                    locationType: 'remote',
                    type: 'full-time',
                    experienceLevel: 'entry',
                    createdAt: new Date('2026-06-01T00:00:00Z'),
                  },
                  {
                    _id: dupId, // duplicate row should be deduped
                    title: 'Frontend Developer',
                    description: 'React UI',
                    skills: [],
                    location: 'Remote',
                    locationType: 'remote',
                    type: 'full-time',
                    experienceLevel: 'entry',
                    createdAt: new Date('2026-06-01T00:00:00Z'),
                  },
                  {
                    _id: secondId,
                    title: 'Executive CTO',
                    description: 'Executive leadership',
                    skills: [{ name: 'Board Strategy' }],
                    location: 'NYC',
                    locationType: 'on-site',
                    type: 'full-time',
                    experienceLevel: 'executive',
                    createdAt: new Date('2026-05-01T00:00:00Z'),
                  },
                ],
              }),
            }),
          }),
        }),
      }),
    })) as unknown as typeof Job.find;

    const recs = await getPersonalizedJobRecommendations({
      userId: new mongoose.Types.ObjectId().toString(),
    });

    assert.equal(recs.profileCompleteForMatching, false);
    assert.ok(recs.profileGuidance?.includes('Add skills'));
    assert.equal(recs.recommendations.length, 2); // duplicate removed
    assert.equal(recs.recommendations[0]?.jobId, dupId.toString());
  } finally {
    UserSkill.find = origUserSkillFind;
    Profile.findOne = origProfileFindOne;
    Resume.findOne = origResumeFindOne;
    Job.find = origJobFind;
    Application.find = origAppFind;
  }
});

// ── Phase 2.6.9 & 2.6.10 Tests: Chat Safety, Cache, Error Map & RBAC ───────────

test('2.6.9 & 2.6.10: Chat validates limits, isolates prompt injections, enforces ownership, maps errors safely without leaking secrets, and deduplicates cached calls', async () => {
  const userA = new mongoose.Types.ObjectId();
  const userB = new mongoose.Types.ObjectId();
  const convId = new mongoose.Types.ObjectId();

  const origConvFindById = AiConversation.findById;
  try {
    AiConversation.findById = (async () => ({
      _id: convId,
      user: userA,
      title: 'Interview Prep',
      topic: 'interview',
      messages: Array.from({ length: MAX_MESSAGES_PER_CONVERSATION }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'turn',
        createdAt: new Date(),
      })),
    })) as unknown as typeof AiConversation.findById;

    await assert.rejects(
      () => getAiConversationById(userB.toString(), convId.toString()),
      (err: unknown) => (err as { statusCode?: number }).statusCode === 403
    );

    await assert.rejects(
      () =>
        sendCareerChatMessage({
          userId: userA.toString(),
          conversationId: convId.toString(),
          message: 'Follow up question',
        }),
      /limit/i
    );
  } finally {
    AiConversation.findById = origConvFindById;
  }

  // Test error mapping masks sensitive secrets & maps status codes properly
  const secretKey = 'sk-proj-super-secret-leak-test-9999';
  const unavail = mapAiErrorToHttpDescriptor(
    new AiProviderError(`Missing key ${secretKey}`, { code: 'AI_API_KEY_MISSING', statusCode: 503 })
  );
  assert.equal(unavail.statusCode, 503);
  assert.equal(unavail.message.includes(secretKey), false);

  const timeoutDesc = mapAiErrorToHttpDescriptor(
    new AiProviderError('Timed out', { code: 'AI_TIMEOUT', statusCode: 504 })
  );
  assert.equal(timeoutDesc.statusCode, 504);

  const rateLimitDesc = mapAiErrorToHttpDescriptor(
    new AiProviderError('429', { code: 'AI_RATE_LIMITED', statusCode: 429 })
  );
  assert.equal(rateLimitDesc.statusCode, 429);

  const badOutputDesc = mapAiErrorToHttpDescriptor(
    new AiProviderError('Invalid JSON', { code: 'AI_OUTPUT_VALIDATION_FAILED', statusCode: 502 })
  );
  assert.equal(badOutputDesc.statusCode, 502);

  // Cache dedup check
  const cache = new AiResponseCache(10);
  let calls = 0;
  const compute = async () => {
    calls += 1;
    return { ok: true };
  };
  const [r1, r2] = await Promise.all([
    cache.getOrCompute('same-key', 5000, compute),
    cache.getOrCompute('same-key', 5000, compute),
  ]);
  assert.equal(calls, 1);
  assert.equal(r1.value.ok, true);
  assert.equal(r2.cacheHit, true);
});

test('2.6.11 Route Security: Enforces authentication, seeker RBAC, and validation across /api/ai/*', async () => {
  // 1. Unauthenticated request blocked with 401
  const unauthRes = await dispatchToApp('/api/ai/status');
  assert.equal(unauthRes.status, 401);

  // 2. Employer role blocked from seeker AI routes (403)
  const employerId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();
  const seekerId = new mongoose.Types.ObjectId();

  const origUserFindById = User.findById;
  try {
    User.findById = ((id: string) => ({
      select: async () => {
        if (id === employerId.toString()) {
          return {
            id: employerId.toString(),
            _id: employerId,
            name: 'Emp',
            email: 'emp@example.com',
            role: 'employer',
            isActive: true,
            isDeleted: false,
            deletedAt: null,
          };
        }
        if (id === providerId.toString()) {
          return {
            id: providerId.toString(),
            _id: providerId,
            name: 'Prov',
            email: 'prov@example.com',
            role: 'provider',
            isActive: true,
            isDeleted: false,
            deletedAt: null,
          };
        }
        return {
          id: seekerId.toString(),
          _id: seekerId,
          name: 'Seeker',
          email: 'seeker@example.com',
          role: 'seeker',
          isActive: true,
          isDeleted: false,
          deletedAt: null,
        };
      },
    })) as unknown as typeof User.findById;

    const empToken = generateToken(employerId.toString());
    const provToken = generateToken(providerId.toString());
    const seekerToken = generateToken(seekerId.toString());

    const empRes = await dispatchToApp('/api/ai/status', {
      cookie: `${AUTH_COOKIE_NAME}=${empToken}`,
    });
    assert.equal(empRes.status, 403);

    const provRes = await dispatchToApp('/api/ai/roadmaps', {
      cookie: `${AUTH_COOKIE_NAME}=${provToken}`,
    });
    assert.equal(provRes.status, 403);

    // 3. Seeker receives AI status safely without secrets
    const seekerStatus = await dispatchToApp('/api/ai/status', {
      cookie: `${AUTH_COOKIE_NAME}=${seekerToken}`,
    });
    assert.equal(seekerStatus.status, 200);
    assert.equal(seekerStatus.body.success, true);

    // 4. Invalid ObjectId & missing target inputs return 400
    const badResumeReq = await dispatchToApp('/api/ai/resume/not-an-id/analyze', {
      method: 'POST',
      cookie: `${AUTH_COOKIE_NAME}=${seekerToken}`,
      body: {},
    });
    assert.equal(badResumeReq.status, 400);

    const badGapReq = await dispatchToApp('/api/ai/skill-gap', {
      method: 'POST',
      cookie: `${AUTH_COOKIE_NAME}=${seekerToken}`,
      body: {},
    });
    assert.equal(badGapReq.status, 400);

    const emptyChatReq = await dispatchToApp('/api/ai/chat', {
      method: 'POST',
      cookie: `${AUTH_COOKIE_NAME}=${seekerToken}`,
      body: { message: '   ' },
    });
    assert.equal(emptyChatReq.status, 400);
  } finally {
    User.findById = origUserFindById;
  }
});
