import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-integration-test-secret-32c';
process.env.JWT_EXPIRES_IN = '10m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_integration_test';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { AUTH_COOKIE_NAME },
  { generateToken },
  { User },
  { Profile },
  { Resume },
  { Job },
  { Application },
  { Course },
  { Organization },
  { AuditLog },
  { Notification },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/utils/token.util.js'),
  import('../src/models/user.model.js'),
  import('../src/models/Profile.model.js'),
  import('../src/models/Resume.model.js'),
  import('../src/models/Job.model.js'),
  import('../src/models/Application.model.js'),
  import('../src/models/Course.model.js'),
  import('../src/models/Organization.model.js'),
  import('../src/models/AuditLog.model.js'),
  import('../src/models/Notification.model.js'),
]);

function makeChain(result: any) {
  const chain: any = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    limit: () => chain,
    skip: () => chain,
    where: () => chain,
    equals: () => chain,
    lean: async () => result,
    then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
    catch: (reject: any) => Promise.resolve(result).catch(reject),
  };
  return chain;
}

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
          this.push(Buffer.from(rawBody, 'utf8'));
        }
        this.push(null);
      },
    }) as any;

    const headers: Record<string, string> = {
      origin: 'http://localhost:5173',
      ...(rawBody !== null
        ? {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(rawBody, 'utf8').toString(),
          }
        : {}),
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
      const effectiveCode = mockRes.statusCode ?? statusCode;
      resolve(
        new Response(effectiveCode === 204 ? null : Buffer.concat(chunks), {
          status: effectiveCode,
          headers: resHeaders,
        })
      );
    };

    app(reqStream, mockRes, (err: unknown) => {
      if (err) reject(err);
    });
  });
}

function makeAuthCookie(userId: string): string {
  const token = generateToken(userId);
  return `${AUTH_COOKIE_NAME}=${token}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2.7.1 — Frontend & Backend Integration Checks
// ─────────────────────────────────────────────────────────────────────────────

test('Phase 2.7.1: GET /api/health reflects database connection state accurately', async () => {
  const origReadyState = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

  try {
    // 1. When DB is connected (readyState = 1) -> 200 ok
    Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
    const resHealthy = await dispatchToApp('/api/health');
    assert.equal(resHealthy.status, 200);
    const jsonHealthy = (await resHealthy.json()) as any;
    assert.equal(jsonHealthy.success, true);
    assert.equal(jsonHealthy.data.status, 'ok');
    assert.equal(jsonHealthy.data.database, 'connected');

    // 2. When DB is disconnected (readyState = 0) -> 503 degraded
    Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
    const resDegraded = await dispatchToApp('/api/health');
    assert.equal(resDegraded.status, 503);
    const jsonDegraded = (await resDegraded.json()) as any;
    assert.equal(jsonDegraded.code, 'SERVICE_UNAVAILABLE');
  } finally {
    if (origReadyState) {
      Object.defineProperty(mongoose.connection, 'readyState', origReadyState);
    }
  }
});

test('Phase 2.7.1: CORS preflight from configured client origin sets allow-credentials and headers', async () => {
  const res = await dispatchToApp('/api/auth/login', 'OPTIONS', {
    headers: {
      origin: 'http://localhost:5173',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:5173');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('Phase 2.7.1: Prohibited HTTP methods (TRACE) return 405 Method Not Allowed', async () => {
  const res = await dispatchToApp('/api/health', 'TRACE');
  assert.equal(res.status, 405);
  const json = (await res.json()) as any;
  assert.equal(json.success, false);
  assert.equal(json.code, 'METHOD_NOT_ALLOWED');
});

test('Phase 2.7.1: Unknown endpoints return standardized 404 envelope', async () => {
  const res = await dispatchToApp('/api/unknown-endpoint-xyz');
  assert.equal(res.status, 404);
  const json = (await res.json()) as any;
  assert.equal(json.success, false);
  assert.equal(json.code, 'ROUTE_NOT_FOUND');
  assert.ok(json.message);
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2.7.2 — Core Feature Testing Across All 4 Roles
// ─────────────────────────────────────────────────────────────────────────────

test('Phase 2.7.2: Authentication — Registration, Login, Session Restore, and Logout Flow', async () => {
  const seekerId = new mongoose.Types.ObjectId();
  const email = `seeker-${Date.now()}@skillorbit.test`;

  // 1. Public registration rejects 'admin' role
  const adminRegRes = await dispatchToApp('/api/auth/register', 'POST', {
    body: {
      fullName: 'Sneaky Admin',
      email: 'admin@attack.test',
      password: 'Password123',
      role: 'admin',
    },
  });
  assert.equal(adminRegRes.status, 400);

  // 2. Mock User model methods for clean registration and login testing
  const origFindOne = User.findOne;
  const origCreate = User.create;
  const origFindById = User.findById;
  const origExists = User.exists;

  try {
    (User as any).exists = async () => false;

    const fakeSeeker = {
      _id: seekerId,
      id: String(seekerId),
      name: 'Jane Seeker',
      email,
      role: 'seeker',
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      isEmailVerified: true,
      matchPassword: async (p: string) => p === 'ValidPassword123',
      save: async () => {},
    };

    (User as any).findOne = (query: any) => {
      if (query?.email === email) {
        return makeChain(fakeSeeker);
      }
      return makeChain(null);
    };

    (User as any).findById = () => makeChain({
      _id: seekerId,
      id: String(seekerId),
      name: 'Jane Seeker',
      email,
      role: 'seeker',
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Login with invalid password returns 401
    const badLoginRes = await dispatchToApp('/api/auth/login', 'POST', {
      body: { email, password: 'WrongPassword' },
    });
    assert.equal(badLoginRes.status, 401);
    const badLoginJson = (await badLoginRes.json()) as any;
    assert.equal(badLoginJson.code, 'INVALID_CREDENTIALS');

    // 4. Login with valid password returns 200 and sets HttpOnly cookie
    const goodLoginRes = await dispatchToApp('/api/auth/login', 'POST', {
      body: { email, password: 'ValidPassword123' },
    });
    assert.equal(goodLoginRes.status, 200);
    const setCookie = goodLoginRes.headers.get('set-cookie') ?? '';
    assert.ok(setCookie.includes(AUTH_COOKIE_NAME));

    // 5. Session restore via GET /api/users/me returns authenticated user without password hash
    const cookie = makeAuthCookie(String(seekerId));
    const meRes = await dispatchToApp('/api/users/me', 'GET', {
      headers: { cookie },
    });
    assert.equal(meRes.status, 200);
    const meJson = (await meRes.json()) as any;
    assert.equal(meJson.success, true);
    assert.equal(meJson.data.user.email, email);
    assert.equal('password' in meJson.data.user, false);

    // 6. Logout clears cookie
    const logoutRes = await dispatchToApp('/api/auth/logout', 'POST', {
      headers: { cookie },
    });
    assert.equal(logoutRes.status, 200);
    const clearCookie = logoutRes.headers.get('set-cookie') ?? '';
    assert.ok(clearCookie.includes(`${AUTH_COOKIE_NAME}=;`));
  } finally {
    User.findOne = origFindOne;
    User.create = origCreate;
    User.findById = origFindById;
    User.exists = origExists;
  }
});

test('Phase 2.7.2: Seeker Dashboard and Profile integration', async () => {
  const seekerId = new mongoose.Types.ObjectId();
  const cookie = makeAuthCookie(String(seekerId));

  const origUserFindById = User.findById;
  const origProfileFindOne = Profile.findOne;
  const origResumeFind = Resume.find;
  const origResumeCount = Resume.countDocuments;
  const origAppFind = Application.find;
  const origAppCount = Application.countDocuments;
  const origJobFind = Job.find;
  const origNotifFind = Notification.find;

  (User as any).findById = () => makeChain({
    _id: seekerId,
    id: String(seekerId),
    name: 'Seeker One',
    email: 'seeker1@example.com',
    role: 'seeker',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  (Profile as any).findOne = () => makeChain({
    headline: 'Senior Fullstack Engineer',
    skills: ['TypeScript', 'Node.js', 'React'],
    location: 'Remote',
    savedJobs: [],
  });

  (Resume as any).find = () => makeChain([
    { _id: new mongoose.Types.ObjectId(), fileName: 'resume.pdf', isPrimary: true },
  ]);
  (Resume as any).countDocuments = async () => 1;

  (Application as any).find = () => makeChain([]);
  (Application as any).countDocuments = async () => 2;

  (Job as any).find = () => makeChain([]);
  (Notification as any).find = () => makeChain([]);

  try {
    const dashRes = await dispatchToApp('/api/seeker/dashboard', 'GET', {
      headers: { cookie },
    });
    assert.equal(dashRes.status, 200);
    const dashJson = (await dashRes.json()) as any;
    assert.equal(dashJson.success, true);
    assert.ok(dashJson.data.applicationStats !== undefined);
  } finally {
    User.findById = origUserFindById;
    Profile.findOne = origProfileFindOne;
    Resume.find = origResumeFind;
    Resume.countDocuments = origResumeCount;
    Application.find = origAppFind;
    Application.countDocuments = origAppCount;
    Job.find = origJobFind;
    Notification.find = origNotifFind;
  }
});

test('Phase 2.7.2: Employer Dashboard and Job Creation integration', async () => {
  const employerId = new mongoose.Types.ObjectId();
  const cookie = makeAuthCookie(String(employerId));

  const origUserFindById = User.findById;
  const origOrgFindOne = Organization.findOne;
  const origJobCount = Job.countDocuments;
  const origJobFind = Job.find;
  const origAppCount = Application.countDocuments;
  const origNotifFind = Notification.find;
  const origNotifCount = Notification.countDocuments;
  const origAuditFind = AuditLog.find;

  (User as any).findById = () => makeChain({
    _id: employerId,
    id: String(employerId),
    name: 'Employer Corp',
    email: 'corp@example.com',
    role: 'employer',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  (Organization as any).findOne = () => makeChain({
    _id: new mongoose.Types.ObjectId(),
    name: 'Employer Corp',
    website: 'https://corp.example.com',
    industry: 'Technology',
    isVerified: true,
    verificationStatus: 'verified',
  });

  (Job as any).countDocuments = async () => 5;
  (Job as any).find = () => makeChain([]);
  (Application as any).countDocuments = async () => 12;
  (Notification as any).find = () => makeChain([]);
  (Notification as any).countDocuments = async () => 0;
  (AuditLog as any).find = () => makeChain([]);

  try {
    const dashRes = await dispatchToApp('/api/employer/dashboard', 'GET', {
      headers: { cookie },
    });
    assert.equal(dashRes.status, 200);
    const dashJson = (await dashRes.json()) as any;
    assert.equal(dashJson.success, true);
    assert.ok(dashJson.data.jobStats !== undefined);
  } finally {
    User.findById = origUserFindById;
    Organization.findOne = origOrgFindOne;
    Job.countDocuments = origJobCount;
    Job.find = origJobFind;
    Application.countDocuments = origAppCount;
    Notification.find = origNotifFind;
    Notification.countDocuments = origNotifCount;
    AuditLog.find = origAuditFind;
  }
});

test('Phase 2.7.2: Provider Dashboard and Course Offering integration', async () => {
  const providerId = new mongoose.Types.ObjectId();
  const cookie = makeAuthCookie(String(providerId));

  const origUserFindById = User.findById;
  const origOrgFindOne = Organization.findOne;
  const origCourseCount = Course.countDocuments;
  const origCourseFind = Course.find;
  const origNotifFind = Notification.find;
  const origNotifCount = Notification.countDocuments;
  const origAuditFind = AuditLog.find;

  (User as any).findById = () => makeChain({
    _id: providerId,
    id: String(providerId),
    name: 'Skill Academy',
    email: 'academy@example.com',
    role: 'provider',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  (Organization as any).findOne = () => makeChain({
    _id: new mongoose.Types.ObjectId(),
    name: 'Skill Academy',
    type: 'training-provider',
    isVerified: true,
    verificationStatus: 'verified',
  });

  (Course as any).countDocuments = async () => 3;
  (Course as any).find = () => makeChain([]);
  (Notification as any).find = () => makeChain([]);
  (Notification as any).countDocuments = async () => 0;
  (AuditLog as any).find = () => makeChain([]);

  try {
    const dashRes = await dispatchToApp('/api/provider/dashboard', 'GET', {
      headers: { cookie },
    });
    assert.equal(dashRes.status, 200);
    const dashJson = (await dashRes.json()) as any;
    assert.equal(dashJson.success, true);
    assert.ok(dashJson.data.courseStats !== undefined);
  } finally {
    User.findById = origUserFindById;
    Organization.findOne = origOrgFindOne;
    Course.countDocuments = origCourseCount;
    Course.find = origCourseFind;
    Notification.find = origNotifFind;
    Notification.countDocuments = origNotifCount;
    AuditLog.find = origAuditFind;
  }
});

test('Phase 2.7.2: Admin Dashboard and User Moderation integration', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const targetSeekerId = new mongoose.Types.ObjectId();
  const cookie = makeAuthCookie(String(adminId));

  const origUserFindById = User.findById;
  const origUserCount = User.countDocuments;
  const origJobCount = Job.countDocuments;
  const origCourseCount = Course.countDocuments;
  const origOrgCount = Organization.countDocuments;
  const origAppCount = Application.countDocuments;
  const origNotifCount = Notification.countDocuments;
  const origAuditCreate = AuditLog.create;
  const origAuditFind = AuditLog.find;
  const origUserFind = User.find;
  const origOrgFind = Organization.find;
  const origNotifFind = Notification.find;

  (User as any).findById = (id: any) => {
    const isTarget = String(id) === String(targetSeekerId);
    return makeChain({
      _id: isTarget ? targetSeekerId : adminId,
      id: String(isTarget ? targetSeekerId : adminId),
      name: isTarget ? 'Seeker Target' : 'Platform Admin',
      email: isTarget ? 'seeker@test.com' : 'admin@skillorbit.ai',
      role: isTarget ? 'seeker' : 'admin',
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  (User as any).countDocuments = async () => 25;
  (Job as any).countDocuments = async () => 10;
  (Course as any).countDocuments = async () => 6;
  (Organization as any).countDocuments = async () => 8;
  (Application as any).countDocuments = async () => 40;
  (Notification as any).countDocuments = async () => 5;

  (User as any).find = () => makeChain([]);
  (Organization as any).find = () => makeChain([]);
  (AuditLog as any).find = () => makeChain([]);
  (Notification as any).find = () => makeChain([]);
  (AuditLog as any).create = async (doc: any) => doc;

  try {
    const dashRes = await dispatchToApp('/api/admin/dashboard', 'GET', {
      headers: { cookie },
    });
    assert.equal(dashRes.status, 200);
    const dashJson = (await dashRes.json()) as any;
    assert.equal(dashJson.success, true);
    assert.equal(dashJson.data.stats.totalUsers, 25);
  } finally {
    User.findById = origUserFindById;
    User.countDocuments = origUserCount;
    Job.countDocuments = origJobCount;
    Course.countDocuments = origCourseCount;
    Organization.countDocuments = origOrgCount;
    Application.countDocuments = origAppCount;
    Notification.countDocuments = origNotifCount;
    AuditLog.create = origAuditCreate;
    AuditLog.find = origAuditFind;
    User.find = origUserFind;
    Organization.find = origOrgFind;
    Notification.find = origNotifFind;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2.7.3 — Authentication & Role Access Verification
// ─────────────────────────────────────────────────────────────────────────────

test('Phase 2.7.3: Unauthenticated requests to protected endpoints return 401 AUTHENTICATION_REQUIRED', async () => {
  const protectedEndpoints = [
    '/api/users/me',
    '/api/seeker/dashboard',
    '/api/employer/dashboard',
    '/api/provider/dashboard',
    '/api/admin/dashboard',
    '/api/resumes/me',
    '/api/profiles/me',
    '/api/applications/me',
  ];

  for (const endpoint of protectedEndpoints) {
    const res = await dispatchToApp(endpoint);
    assert.equal(res.status, 401, `Expected 401 on unauthenticated ${endpoint}`);
    const json = (await res.json()) as any;
    assert.equal(json.code, 'AUTHENTICATION_REQUIRED');
  }
});

test('Phase 2.7.3: Role Isolation — Cross-role dashboard access returns 403 FORBIDDEN', async () => {
  const seekerId = new mongoose.Types.ObjectId();
  const employerId = new mongoose.Types.ObjectId();
  const providerId = new mongoose.Types.ObjectId();

  const origFindById = User.findById;

  let currentMode: 'seeker' | 'employer' | 'provider' = 'seeker';

  (User as any).findById = () => {
    const id =
      currentMode === 'seeker'
        ? seekerId
        : currentMode === 'employer'
        ? employerId
        : providerId;
    return makeChain({
      _id: id,
      id: String(id),
      name: `User ${currentMode}`,
      email: `${currentMode}@test.com`,
      role: currentMode,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
    });
  };

  try {
    // 1. Seeker attempts employer, provider, and admin portals -> 403
    currentMode = 'seeker';
    const seekerCookie = makeAuthCookie(String(seekerId));

    const sToEmp = await dispatchToApp('/api/employer/dashboard', 'GET', {
      headers: { cookie: seekerCookie },
    });
    assert.equal(sToEmp.status, 403);
    assert.equal(((await sToEmp.json()) as any).code, 'FORBIDDEN');

    const sToProv = await dispatchToApp('/api/provider/dashboard', 'GET', {
      headers: { cookie: seekerCookie },
    });
    assert.equal(sToProv.status, 403);

    const sToAdmin = await dispatchToApp('/api/admin/dashboard', 'GET', {
      headers: { cookie: seekerCookie },
    });
    assert.equal(sToAdmin.status, 403);

    // 2. Employer attempts seeker, provider, and admin portals -> 403
    currentMode = 'employer';
    const employerCookie = makeAuthCookie(String(employerId));

    const eToSeek = await dispatchToApp('/api/seeker/dashboard', 'GET', {
      headers: { cookie: employerCookie },
    });
    assert.equal(eToSeek.status, 403);

    const eToAdmin = await dispatchToApp('/api/admin/dashboard', 'GET', {
      headers: { cookie: employerCookie },
    });
    assert.equal(eToAdmin.status, 403);

    // 3. Provider attempts seeker, employer, and admin portals -> 403
    currentMode = 'provider';
    const providerCookie = makeAuthCookie(String(providerId));

    const pToSeek = await dispatchToApp('/api/seeker/dashboard', 'GET', {
      headers: { cookie: providerCookie },
    });
    assert.equal(pToSeek.status, 403);

    const pToEmp = await dispatchToApp('/api/employer/dashboard', 'GET', {
      headers: { cookie: providerCookie },
    });
    assert.equal(pToEmp.status, 403);

    const pToAdmin = await dispatchToApp('/api/admin/dashboard', 'GET', {
      headers: { cookie: providerCookie },
    });
    assert.equal(pToAdmin.status, 403);
  } finally {
    User.findById = origFindById;
  }
});

test('Phase 2.7.3: Token Tampering & Expiration — Invalid tokens rejected with 401 INVALID_AUTHENTICATION', async () => {
  // Tampered signature
  const tamperedToken = `${generateToken('507f1f77bcf86cd799439011')}-tampered`;
  const tamperedRes = await dispatchToApp('/api/users/me', 'GET', {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${tamperedToken}` },
  });
  assert.equal(tamperedRes.status, 401);
  assert.equal(((await tamperedRes.json()) as any).code, 'INVALID_AUTHENTICATION');

  // Expired token
  const expiredToken = jwt.sign(
    { id: '507f1f77bcf86cd799439011' },
    process.env.JWT_SECRET as string,
    { expiresIn: -10 }
  );
  const expiredRes = await dispatchToApp('/api/users/me', 'GET', {
    headers: { cookie: `${AUTH_COOKIE_NAME}=${expiredToken}` },
  });
  assert.equal(expiredRes.status, 401);
  assert.equal(((await expiredRes.json()) as any).code, 'INVALID_AUTHENTICATION');
});

test('Phase 2.7.3: Privilege Escalation & Admin Self-Suspension Defenses', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const cookie = makeAuthCookie(String(adminId));

  const origFindById = User.findById;

  (User as any).findById = () => makeChain({
    _id: adminId,
    id: String(adminId),
    name: 'Admin Master',
    email: 'admin@skillorbit.ai',
    role: 'admin',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
  });

  try {
    // Admin attempting to suspend themselves is blocked (403 SELF_MODIFICATION_FORBIDDEN)
    const selfSuspendRes = await dispatchToApp(
      `/api/admin/users/${String(adminId)}/status`,
      'PATCH',
      {
        body: { isActive: false, reason: 'Trying to deactivate self' },
        headers: { cookie },
      }
    );
    assert.equal(selfSuspendRes.status, 403);
    const json = (await selfSuspendRes.json()) as any;
    assert.equal(json.code, 'SELF_MODIFICATION_FORBIDDEN');
  } finally {
    User.findById = origFindById;
  }
});
