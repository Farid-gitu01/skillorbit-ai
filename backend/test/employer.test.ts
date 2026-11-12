import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-employer-test-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_employer_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { calculateOrganizationCompletion, escapeRegex },
  {
    upsertOrganizationSchema,
    createJobSchema,
    updateJobSchema,
    updateJobStatusSchema,
    employerJobsQuerySchema,
    employerApplicationsQuerySchema,
    updateApplicationStatusSchema,
    updateApplicationNoteSchema,
    employerCandidatesQuerySchema,
  },
  { Job },
  { Application },
  { Resume },
  { Profile },
  { getJobById },
  { getApplicationById },
  { downloadResume },
  { getPublicProfile },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/employer.util.js'),
  import('../src/validators/employer.validator.js'),
  import('../src/models/Job.model.js'),
  import('../src/models/Application.model.js'),
  import('../src/models/Resume.model.js'),
  import('../src/models/Profile.model.js'),
  import('../src/controllers/job.controller.js'),
  import('../src/controllers/application.controller.js'),
  import('../src/controllers/resume.controller.js'),
  import('../src/controllers/profile.controller.js'),
]);

async function dispatchToApp(
  path: string,
  method = 'GET',
  options?: { body?: unknown; headers?: Record<string, string> }
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const rawBody = options?.body !== undefined ? JSON.stringify(options.body) : null;
    const reqStream = new Readable({
      read() {
        if (rawBody !== null) {
          this.push(rawBody);
        }
        this.push(null);
      },
    }) as any;

    const headers: Record<string, string> = {
      origin: 'http://localhost:5173',
      ...(rawBody !== null ? { 'content-type': 'application/json' } : {}),
      ...(options?.headers ?? {}),
    };

    reqStream.method = method;
    reqStream.url = path;
    reqStream.headers = headers;
    reqStream.rawHeaders = [];

    const mockSocket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as any;
    mockSocket.remoteAddress = '127.0.0.1';
    reqStream.socket = mockSocket;
    reqStream.connection = mockSocket;
    reqStream.ip = '127.0.0.1';

    const resHeaders = new Headers();
    const chunks: Buffer[] = [];
    let statusCode = 200;

    const mockRes = new EventEmitter() as any;
    mockRes.statusCode = statusCode;
    mockRes.headersSent = false;
    mockRes.socket = mockSocket;
    mockRes.connection = mockSocket;

    mockRes.setHeader = (name: string, value: string | string[]) => {
      if (Array.isArray(value)) {
        for (const v of value) resHeaders.append(name, v);
      } else {
        resHeaders.set(name, value);
      }
      return mockRes;
    };
    mockRes.getHeader = (name: string) => resHeaders.get(name);
    mockRes.removeHeader = (name: string) => resHeaders.delete(name);
    mockRes.hasHeader = (name: string) => resHeaders.has(name);
    mockRes.writeHead = (code: number) => {
      statusCode = code;
      mockRes.statusCode = code;
      return mockRes;
    };
    mockRes.write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };
    mockRes.end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      mockRes.headersSent = true;
      resolve(
        new Response(Buffer.concat(chunks), {
          status: mockRes.statusCode ?? statusCode,
          headers: resHeaders,
        })
      );
    };

    app(reqStream, mockRes, (err: unknown) => {
      if (err) reject(err);
    });
  });
}

function createMockRes(): {
  res: any;
  getStatus: () => number;
  getBody: () => any;
} {
  let statusCode = 200;
  let body: any = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  };
  return {
    res,
    getStatus: () => statusCode,
    getBody: () => body,
  };
}

test('calculateOrganizationCompletion computes accurate percentage and missing fields', () => {
  const emptyResult = calculateOrganizationCompletion(null);
  assert.equal(emptyResult.percentage, 0);
  assert.equal(emptyResult.missingFields.length, 9);

  const partial = calculateOrganizationCompletion({
    name: 'Acme Robotics',
    location: 'Austin, TX',
    description: 'Building intelligent factory automation tools.',
  });
  assert.equal(partial.percentage, 45);
  assert.ok(!partial.missingFields.includes('Organization Name'));
  assert.ok(partial.missingFields.includes('Company Logo'));

  const full = calculateOrganizationCompletion({
    name: 'Acme Robotics',
    industry: 'Robotics',
    size: '51-200',
    location: 'Austin, TX',
    description: 'Building intelligent factory automation tools for modern logistics.',
    websiteUrl: 'https://acmerobotics.example.com',
    logoUrl: 'https://cdn.example.com/logo.png',
    contactEmail: 'talent@acmerobotics.example.com',
    socialLinks: {
      linkedin: 'https://linkedin.com/company/acme-robotics',
    },
  });
  assert.equal(full.percentage, 100);
  assert.deepEqual(full.missingFields, []);
});

test('escapeRegex neutralizes regex metacharacters safely', () => {
  assert.equal(escapeRegex('C++ (Senior).*'), 'C\\+\\+ \\(Senior\\)\\.\\*');
});

test('upsertOrganizationSchema validates URLs, emails, and strict keys', () => {
  const valid = upsertOrganizationSchema.safeParse({
    name: 'SkillOrbit Labs',
    industry: 'Software & AI',
    size: '11-50',
    founded: 2022,
    location: 'San Francisco, CA',
    description: 'AI career intelligence platform.',
    websiteUrl: 'https://skillorbit.example.com',
    logoUrl: 'https://skillorbit.example.com/logo.png',
    contactEmail: 'Talent@SkillOrbit.Example.COM',
    contactPhone: '+1-415-555-0199',
    socialLinks: {
      linkedin: 'https://linkedin.com/company/skillorbit',
      github: '',
    },
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.contactEmail, 'talent@skillorbit.example.com');
    assert.equal(valid.data.socialLinks?.github, undefined);
  }

  const xssUrl = upsertOrganizationSchema.safeParse({
    name: 'Bad Org',
    websiteUrl: 'javascript:alert(1)',
  });
  assert.equal(xssUrl.success, false);

  const extraField = upsertOrganizationSchema.safeParse({
    name: 'Strict Org',
    owner: '507f1f77bcf86cd799439011',
  });
  assert.equal(extraField.success, false);
});

test('createJobSchema and updateJobSchema enforce field limits, salary bounds, and defaults', () => {
  const validDraft = createJobSchema.safeParse({
    title: 'Senior TypeScript Engineer',
    description: 'Lead backend API architecture and distributed AI services across the platform.',
    responsibilities: ['Design REST APIs', 'Mentor junior engineers'],
    qualifications: ['4+ years TypeScript', 'MongoDB indexing experience'],
    skills: ['TypeScript', 'Node.js', 'MongoDB'],
    location: 'Remote',
    locationType: 'remote',
    type: 'full-time',
    experienceLevel: 'senior',
    openings: 2,
    salary: {
      min: 120000,
      max: 165000,
      currency: 'usd',
      isPublic: true,
    },
  });
  assert.equal(validDraft.success, true);
  if (validDraft.success) {
    assert.equal(validDraft.data.status, 'draft');
    assert.equal(validDraft.data.salary?.currency, 'USD');
    assert.equal(validDraft.data.openings, 2);
  }

  const invertedSalary = createJobSchema.safeParse({
    title: 'Backend Engineer',
    description: 'Build reliable backend microservices and event pipelines for SkillOrbit.',
    locationType: 'hybrid',
    type: 'full-time',
    experienceLevel: 'mid',
    salary: {
      min: 180000,
      max: 120000,
      currency: 'USD',
      isPublic: true,
    },
  });
  assert.equal(invertedSalary.success, false);

  const invalidStatusOnCreate = createJobSchema.safeParse({
    title: 'Closed On Create',
    description: 'Should not allow creating already expired or closed jobs directly.',
    locationType: 'on-site',
    type: 'contract',
    experienceLevel: 'lead',
    status: 'closed',
  });
  assert.equal(invalidStatusOnCreate.success, false);

  const validUpdate = updateJobSchema.safeParse({
    title: 'Staff TypeScript Engineer',
    description: 'Own platform scalability, API security, and observability across teams.',
    locationType: 'remote',
    type: 'full-time',
    experienceLevel: 'lead',
    status: 'closed',
  });
  assert.equal(validUpdate.success, true);

  assert.equal(updateJobStatusSchema.safeParse({ status: 'active' }).success, true);
  assert.equal(updateJobStatusSchema.safeParse({ status: 'expired' }).success, false);
});

test('employer application, job, and candidate query/mutation validators behave strictly', () => {
  const validJobsQuery = employerJobsQuerySchema.safeParse({ status: 'active', sort: 'applicants' });
  assert.equal(validJobsQuery.success, true);

  const validAppsQuery = employerApplicationsQuerySchema.safeParse({
    jobId: '507f1f77bcf86cd799439011',
    status: 'shortlisted',
    sort: 'match_desc',
  });
  assert.equal(validAppsQuery.success, true);

  const badStatus = updateApplicationStatusSchema.safeParse({ status: 'withdrawn' });
  assert.equal(badStatus.success, false);

  const validShortlist = updateApplicationStatusSchema.safeParse({
    status: 'shortlisted',
    employerNote: 'Strong portfolio and clean system design experience.',
  });
  assert.equal(validShortlist.success, true);

  assert.equal(updateApplicationNoteSchema.safeParse({ employerNote: 'Schedule interview.' }).success, true);
  assert.equal(
    employerCandidatesQuerySchema.safeParse({ shortlistedOnly: 'true', limit: '20' }).success,
    true
  );
});

test('All employer-only API endpoints require authentication (401)', async () => {
  const endpoints: Array<[string, string, unknown?]> = [
    ['/api/employer/dashboard', 'GET'],
    ['/api/employer/organization', 'GET'],
    ['/api/employer/organization', 'PUT', { name: 'Acme' }],
    ['/api/employer/candidates', 'GET'],
    ['/api/employer/candidates/507f1f77bcf86cd799439011', 'GET'],
    ['/api/jobs/skills?q=react', 'GET'],
    ['/api/jobs/employer', 'GET'],
    ['/api/jobs', 'POST', { title: 'Test' }],
    ['/api/jobs/507f1f77bcf86cd799439011', 'PUT', { title: 'Test' }],
    ['/api/jobs/507f1f77bcf86cd799439011/status', 'PATCH', { status: 'active' }],
    ['/api/jobs/507f1f77bcf86cd799439011', 'DELETE'],
    ['/api/applications/employer', 'GET'],
    ['/api/applications/507f1f77bcf86cd799439011/status', 'PATCH', { status: 'shortlisted' }],
    ['/api/applications/507f1f77bcf86cd799439011/note', 'PATCH', { employerNote: 'Hi' }],
  ];

  for (const [path, method, body] of endpoints) {
    const res = await dispatchToApp(path, method, body ? { body } : undefined);
    assert.equal(res.status, 401, `${method} ${path} should return 401 without token`);
  }
});

test('getJobById hides draft jobs from anonymous viewers and other employers', async () => {
  const ownerId = new mongoose.Types.ObjectId();
  const otherEmployerId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();

  const originalFindOne = Job.findOne;
  const originalProfileFindOne = Profile.findOne;
  (Job as any).findOne = () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: jobId,
      employer: ownerId,
      title: 'Confidential Role',
      status: 'draft',
      isDeleted: false,
    }),
  });
  (Profile as any).findOne = () => ({
    select() {
      return this;
    },
    lean: async () => null,
  });

  try {
    const anon = createMockRes();
    await getJobById({ params: { id: String(jobId) } } as any, anon.res);
    assert.equal(anon.getStatus(), 404);

    const otherEmployer = createMockRes();
    await getJobById(
      { params: { id: String(jobId) }, userId: String(otherEmployerId), userRole: 'employer' } as any,
      otherEmployer.res
    );
    assert.equal(otherEmployer.getStatus(), 404);

    const owner = createMockRes();
    await getJobById(
      { params: { id: String(jobId) }, userId: String(ownerId), userRole: 'employer' } as any,
      owner.res
    );
    assert.equal(owner.getStatus(), 200);
    assert.equal(owner.getBody().data.job.title, 'Confidential Role');
  } finally {
    Job.findOne = originalFindOne;
    Profile.findOne = originalProfileFindOne;
  }
});

test('getApplicationById blocks an employer from viewing another employer application', async () => {
  const realOwnerId = new mongoose.Types.ObjectId();
  const attackerEmployerId = new mongoose.Types.ObjectId();
  const seekerId = new mongoose.Types.ObjectId();
  const appId = new mongoose.Types.ObjectId();

  const originalFindById = Application.findById;
  (Application as any).findById = () => ({
    populate() {
      return this;
    },
    lean: async () => ({
      _id: appId,
      seeker: { _id: seekerId, name: 'Jane Seeker', email: 'jane@example.com' },
      job: { _id: new mongoose.Types.ObjectId(), employer: realOwnerId, title: 'Secret Role' },
      status: 'pending',
    }),
  });

  try {
    const mock = createMockRes();
    await getApplicationById(
      {
        params: { id: String(appId) },
        userId: String(attackerEmployerId),
        userRole: 'employer',
      } as any,
      mock.res
    );
    assert.equal(mock.getStatus(), 403);
    assert.equal(mock.getBody().code, 'FORBIDDEN');
  } finally {
    Application.findById = originalFindById;
  }
});

test('downloadResume blocks employer when candidate has no non-withdrawn application for employer jobs', async () => {
  const seekerId = new mongoose.Types.ObjectId();
  const employerId = new mongoose.Types.ObjectId();
  const resumeId = new mongoose.Types.ObjectId();

  const originalResumeFindOne = Resume.findOne;
  const originalJobFind = Job.find;
  const originalAppExists = Application.exists;

  (Resume as any).findOne = () => ({
    lean: async () => ({
      _id: resumeId,
      user: seekerId,
      fileName: 'cv.pdf',
      filePath: 'resumes/cv.pdf',
      mimeType: 'application/pdf',
      isDeleted: false,
      isPrimary: true,
    }),
  });
  (Job as any).find = () => ({
    select() {
      return this;
    },
    lean: async () => [{ _id: new mongoose.Types.ObjectId() }],
  });
  (Application as any).exists = async () => null;

  try {
    const mock = createMockRes();
    await downloadResume(
      {
        params: { id: String(resumeId) },
        userId: String(employerId),
        userRole: 'employer',
      } as any,
      mock.res
    );
    assert.equal(mock.getStatus(), 403);
    assert.equal(mock.getBody().code, 'FORBIDDEN');
  } finally {
    Resume.findOne = originalResumeFindOne;
    Job.find = originalJobFind;
    Application.exists = originalAppExists;
  }
});

test('getPublicProfile strips private contact info and savedJobs from unprivileged callers', async () => {
  const seekerId = new mongoose.Types.ObjectId();
  const employerId = new mongoose.Types.ObjectId();
  const originalProfileFindOne = Profile.findOne;
  const originalJobFind = Job.find;
  const originalAppExists = Application.exists;

  let selectedProjection = '';
  let populatedSelect = '';

  (Profile as any).findOne = () => ({
    select(fields: string) {
      selectedProjection = fields;
      return this;
    },
    populate(_path: string, fields: string) {
      populatedSelect = fields;
      return this;
    },
    lean: async () => ({
      _id: new mongoose.Types.ObjectId(),
      user: {
        _id: seekerId,
        name: 'Jane Seeker',
        role: 'seeker',
        ...(populatedSelect.includes('email') ? { email: 'private@example.com' } : {}),
      },
      headline: 'Full-Stack Developer',
      ...(selectedProjection.includes('-phone') ? {} : { phone: '+1-555-0100' }),
      ...(selectedProjection.includes('-savedJobs') ? {} : { savedJobs: [new mongoose.Types.ObjectId()] }),
      skills: ['React', 'Node.js'],
    }),
  });

  (Job as any).find = () => ({
    select() {
      return this;
    },
    lean: async () => [{ _id: new mongoose.Types.ObjectId() }],
  });

  try {
    const anonMock = createMockRes();
    await getPublicProfile({ params: { id: String(seekerId) } } as any, anonMock.res);
    assert.equal(anonMock.getStatus(), 200);
    assert.equal(selectedProjection, '-savedJobs -phone');
    assert.equal(populatedSelect, 'name role');
    const returned = anonMock.getBody().data.profile;
    assert.equal(returned.phone, undefined);
    assert.equal(returned.savedJobs, undefined);
    assert.equal(returned.user.email, undefined);
    assert.equal(returned.user.name, 'Jane Seeker');

    (Application as any).exists = async () => ({ _id: new mongoose.Types.ObjectId() });
    const employerMock = createMockRes();
    await getPublicProfile(
      { params: { id: String(seekerId) }, userId: String(employerId), userRole: 'employer' } as any,
      employerMock.res
    );
    assert.equal(employerMock.getStatus(), 200);
    assert.equal(selectedProjection, '-savedJobs');
    assert.equal(populatedSelect, 'name email role');
    assert.equal(employerMock.getBody().data.profile.savedJobs, undefined);
    assert.equal(employerMock.getBody().data.profile.user.email, 'private@example.com');
  } finally {
    Profile.findOne = originalProfileFindOne;
    Job.find = originalJobFind;
    Application.exists = originalAppExists;
  }
});
