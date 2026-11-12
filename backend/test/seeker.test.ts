import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Duplex, Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-seeker-test-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_seeker_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { calculateProfileCompletion },
  { updateProfileSchema },
  { getJobsQuerySchema },
  { applyJobSchema },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/controllers/profile.controller.js'),
  import('../src/validators/profile.validator.js'),
  import('../src/validators/job.validator.js'),
  import('../src/validators/application.validator.js'),
]);

async function dispatchToApp(path: string, method = 'GET'): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const reqStream = new Readable({
      read() {
        this.push(null);
      },
    }) as any;

    reqStream.method = method;
    reqStream.url = path;
    reqStream.headers = {};
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

    try {
      (app as any).handle(reqStream, mockRes, (err: unknown) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

test('Profile Completion: Computes 100% when all sections and resume exist', () => {
  const result = calculateProfileCompletion(
    {
      headline: 'Senior Software Engineer',
      bio: 'Building scalable web platforms',
      location: 'San Francisco, CA',
      experience: [{ title: 'Engineer', company: 'Tech Corp', startDate: new Date() }],
      education: [{ institution: 'MIT' }],
      skills: ['TypeScript', 'React', 'Node.js'],
    },
    { name: 'Jane Doe', email: 'jane@example.com' },
    true
  );

  assert.equal(result.percentage, 100);
  assert.deepEqual(result.missingFields, []);
});

test('Profile Completion: Reports missing fields accurately when partially filled', () => {
  const result = calculateProfileCompletion(
    {
      headline: 'Frontend Developer',
      bio: '',
      location: '',
      experience: [],
      education: [],
      skills: ['React'],
    },
    { name: 'Jane Doe', email: 'jane@example.com' },
    false
  );

  // User info (15) + Headline (15) + Skills (10) = 40%
  assert.equal(result.percentage, 40);
  assert.ok(result.missingFields.includes('Professional Bio'));
  assert.ok(result.missingFields.includes('Work Experience'));
  assert.ok(result.missingFields.includes('Resume Upload'));
});

test('Profile Validator: Accepts valid profile update fields and rejects invalid URLs', () => {
  const valid = updateProfileSchema.safeParse({
    headline: 'Full Stack Developer',
    availability: 'immediate',
    skills: ['React', 'Node.js'],
    linkedinUrl: 'https://linkedin.com/in/janedoe',
  });
  assert.equal(valid.success, true);

  const invalid = updateProfileSchema.safeParse({
    linkedinUrl: 'not-a-valid-url',
  });
  assert.equal(invalid.success, false);
});

test('Job Validator: Coerces pagination defaults and validates filter enums', () => {
  const valid = getJobsQuerySchema.safeParse({
    q: 'React',
    locationType: 'remote',
    type: 'full-time',
    page: '2',
    limit: '15',
  });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.page, 2);
    assert.equal(valid.data.limit, 15);
    assert.equal(valid.data.sort, 'newest');
  }

  const invalid = getJobsQuerySchema.safeParse({
    locationType: 'mars-orbit',
  });
  assert.equal(invalid.success, false);
});

test('Application Validator: Validates required jobId and coverLetter length', () => {
  const valid = applyJobSchema.safeParse({
    jobId: '60d5ec49f1a2c8b1f4c12345',
    coverLetter: 'Excited to apply for this opportunity.',
  });
  assert.equal(valid.success, true);

  const missingJob = applyJobSchema.safeParse({
    coverLetter: 'No job ID',
  });
  assert.equal(missingJob.success, false);
});

test('Seeker Protected Routes: Rejects unauthenticated requests with 401 AUTHENTICATION_REQUIRED', async () => {
  const protectedEndpoints = [
    '/api/profiles/me',
    '/api/resumes/me',
    '/api/jobs/recommended',
    '/api/jobs/saved',
    '/api/applications/me',
    '/api/notifications',
    '/api/seeker/dashboard',
  ];

  for (const endpoint of protectedEndpoints) {
    const res = await dispatchToApp(endpoint, 'GET');
    assert.equal(res.status, 401, `Expected 401 for ${endpoint}`);
    const body = await res.json() as { success: boolean; code: string };
    assert.equal(body.success, false);
    assert.equal(body.code, 'AUTHENTICATION_REQUIRED');
  }
});
