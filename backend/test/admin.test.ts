import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-admin-test-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_admin_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { AUTH_COOKIE_NAME },
  { generateToken },
  {
    formatAdminAuditEntry,
    isProtectedAdminTarget,
    resolveVerificationStatus,
    sanitizeAdminUser,
    sanitizeAuditChanges,
  },
  {
    adminAuditLogsQuerySchema,
    adminUsersQuerySchema,
    moderateCourseSchema,
    moderateJobSchema,
    reviewVerificationSchema,
    updateUserStatusSchema,
  },
  { AuditLog },
  { Course },
  { Job },
  { Notification },
  { Organization },
  { Profile },
  { User },
  { getAdminDashboard, getAdminUserById, listAdminUsers, updateAdminUserStatus },
  {
    listAdminAuditLogs,
    moderateAdminCourse,
    moderateAdminJob,
    reviewAdminVerification,
  },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/utils/token.util.js'),
  import('../src/utils/admin.util.js'),
  import('../src/validators/admin.validator.js'),
  import('../src/models/AuditLog.model.js'),
  import('../src/models/Course.model.js'),
  import('../src/models/Job.model.js'),
  import('../src/models/Notification.model.js'),
  import('../src/models/Organization.model.js'),
  import('../src/models/Profile.model.js'),
  import('../src/models/user.model.js'),
  import('../src/controllers/admin.controller.js'),
  import('../src/controllers/admin-moderation.controller.js'),
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
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
  };
  return { res, getStatus: () => statusCode, getBody: () => body };
}

function makeChain(result: unknown) {
  const chain: any = {
    select: () => chain,
    populate: () => chain,
    sort: () => chain,
    skip: () => chain,
    limit: () => chain,
    lean: async () => result,
  };
  return chain;
}

test('admin routes reject unauthenticated calls with 401 and non-admin roles with 403', async () => {
  const sampleId = new mongoose.Types.ObjectId().toString();

  const endpoints: Array<{ method: string; path: string; body?: unknown }> = [
    { method: 'GET', path: '/api/admin/dashboard' },
    { method: 'GET', path: '/api/admin/stats' },
    { method: 'GET', path: '/api/admin/users' },
    { method: 'GET', path: `/api/admin/users/${sampleId}` },
    { method: 'PATCH', path: `/api/admin/users/${sampleId}/status`, body: { isActive: false, reason: 'Policy violation' } },
    { method: 'GET', path: '/api/admin/employers' },
    { method: 'GET', path: '/api/admin/providers' },
    { method: 'GET', path: '/api/admin/verifications' },
    { method: 'PATCH', path: `/api/admin/verifications/${sampleId}`, body: { status: 'verified', reason: 'Verified tax doc' } },
    { method: 'GET', path: '/api/admin/jobs' },
    { method: 'PATCH', path: `/api/admin/jobs/${sampleId}/moderate`, body: { moderationStatus: 'flagged', reason: 'Needs clarification' } },
    { method: 'GET', path: '/api/admin/courses' },
    { method: 'PATCH', path: `/api/admin/courses/${sampleId}/moderate`, body: { moderationStatus: 'flagged', reason: 'Needs clarification' } },
    { method: 'GET', path: '/api/admin/audit-logs' },
  ];

  for (const endpoint of endpoints) {
    const unauth = await dispatchToApp(endpoint.path, endpoint.method, { body: endpoint.body });
    assert.equal(unauth.status, 401, `Expected 401 for unauth ${endpoint.method} ${endpoint.path}`);
  }

  const origFindById = User.findById;
  let activeRole: 'seeker' | 'employer' | 'provider' = 'seeker';
  const actorId = new mongoose.Types.ObjectId();

  (User as any).findById = () => ({
    select: async () => ({
      _id: actorId,
      id: String(actorId),
      name: 'Non Admin',
      email: 'user@example.com',
      role: activeRole,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  try {
    const token = generateToken(String(actorId));
    for (const role of ['seeker', 'employer', 'provider'] as const) {
      activeRole = role;
      for (const endpoint of endpoints) {
        const forbidden = await dispatchToApp(endpoint.path, endpoint.method, {
          body: endpoint.body,
          headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
        });
        assert.equal(
          forbidden.status,
          403,
          `Expected 403 for ${role} on ${endpoint.method} ${endpoint.path}`
        );
      }
    }
  } finally {
    (User as any).findById = origFindById;
  }
});

test('admin audit-logs endpoint exposes no mutating methods and preserves immutability', async () => {
  const actorId = new mongoose.Types.ObjectId();
  const sampleLogId = new mongoose.Types.ObjectId().toString();
  const origFindById = User.findById;

  (User as any).findById = () => ({
    select: async () => ({
      _id: actorId,
      id: String(actorId),
      name: 'Admin User',
      email: 'admin@skillorbit.test',
      role: 'admin',
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  try {
    const token = generateToken(String(actorId));
    for (const reqSpec of [
      { method: 'POST', path: '/api/admin/audit-logs', body: { action: 'FAKE' } },
      { method: 'PUT', path: `/api/admin/audit-logs/${sampleLogId}`, body: { action: 'TAMPER' } },
      { method: 'PATCH', path: `/api/admin/audit-logs/${sampleLogId}`, body: { action: 'TAMPER' } },
      { method: 'DELETE', path: `/api/admin/audit-logs/${sampleLogId}` },
    ]) {
      const response = await dispatchToApp(reqSpec.path, reqSpec.method, {
        body: reqSpec.body,
        headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
      });
      assert.equal(response.status, 404, `Audit log ${reqSpec.method} ${reqSpec.path} must not exist`);
    }
  } finally {
    (User as any).findById = origFindById;
  }
});

test('admin validators reject invalid ObjectIds, privilege escalation payloads, and missing reasons', async () => {
  const actorId = new mongoose.Types.ObjectId();
  const origFindById = User.findById;

  (User as any).findById = () => ({
    select: async () => ({
      _id: actorId,
      id: String(actorId),
      name: 'Admin One',
      email: 'admin1@skillorbit.test',
      role: 'admin',
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  try {
    const token = generateToken(String(actorId));
    const badIdResp = await dispatchToApp('/api/admin/users/not-an-object-id', 'GET', {
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });
    assert.equal(badIdResp.status, 400);

    const validId = new mongoose.Types.ObjectId().toString();
    const escalationResp = await dispatchToApp(`/api/admin/users/${validId}/status`, 'PATCH', {
      body: { isActive: true, role: 'admin' },
      headers: { cookie: `${AUTH_COOKIE_NAME}=${token}` },
    });
    assert.equal(escalationResp.status, 400);
  } finally {
    (User as any).findById = origFindById;
  }

  assert.equal(updateUserStatusSchema.safeParse({ isActive: false }).success, false);
  assert.equal(updateUserStatusSchema.safeParse({ isActive: false, reason: 'ok' }).success, false);
  assert.equal(
    updateUserStatusSchema.safeParse({ isActive: false, reason: 'Spam policy breach' }).success,
    true
  );
  assert.equal(
    updateUserStatusSchema.safeParse({ isActive: true, permissions: ['root'] }).success,
    false
  );

  assert.equal(reviewVerificationSchema.safeParse({ status: 'verified', reason: 'no' }).success, false);
  assert.equal(
    reviewVerificationSchema.safeParse({ status: 'verified', reason: 'Verified registration ID' }).success,
    true
  );
  assert.equal(
    moderateJobSchema.safeParse({ moderationStatus: 'rejected', reason: 'Misleading compensation info' }).success,
    true
  );
  assert.equal(
    moderateCourseSchema.safeParse({ moderationStatus: 'flagged', reason: 'Needs syllabus update' }).success,
    true
  );
  assert.equal(adminUsersQuerySchema.safeParse({ role: 'employer', status: 'suspended' }).success, true);
  assert.equal(adminAuditLogsQuerySchema.safeParse({ actorRole: 'admin', limit: '20' }).success, true);
});

test('admin sanitization utilities strip password hashes, tokens, and secrets', () => {
  const safeUser = sanitizeAdminUser({
    _id: new mongoose.Types.ObjectId(),
    name: 'Test Seeker',
    email: 'seeker@example.com',
    role: 'seeker',
    isActive: true,
    isEmailVerified: true,
    password: '$2b$10$secretHashValue',
    passwordResetTokenHash: 'deadbeef',
    emailVerificationTokenHash: 'cafebabe',
  });

  assert.ok(safeUser);
  assert.equal('password' in (safeUser as any), false);
  assert.equal('passwordResetTokenHash' in (safeUser as any), false);
  assert.equal('emailVerificationTokenHash' in (safeUser as any), false);

  const safeAudit = sanitizeAuditChanges({
    targetEmail: 'seeker@example.com',
    password: 'SecretPassword',
    passwordResetTokenHash: 'hash123',
    token: 'rawToken',
    nested: { secret: 'hideMe', reason: 'Manual review' },
  });
  assert.deepEqual(safeAudit, {
    targetEmail: 'seeker@example.com',
    nested: { reason: 'Manual review' },
  });

  const formatted = formatAdminAuditEntry({
    _id: new mongoose.Types.ObjectId(),
    action: 'ADMIN_USER_SUSPENDED',
    actorRole: 'admin',
    resource: 'User',
    changes: { targetEmail: 'bad@user.com', reason: 'Abuse', password: 'never' },
    createdAt: new Date(),
  });
  assert.equal(formatted.title, 'User account suspended');
  assert.equal('password' in (formatted.changes ?? {}), false);

  assert.equal(resolveVerificationStatus({ isVerified: true }), 'verified');
  assert.equal(resolveVerificationStatus({ isVerified: false, verificationStatus: 'rejected' }), 'rejected');
  assert.equal(resolveVerificationStatus({ isVerified: false }), 'pending');
});

test('admin cannot suspend self or protected admin accounts, and can suspend non-admin accounts safely', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const otherAdminId = new mongoose.Types.ObjectId();
  const seekerId = new mongoose.Types.ObjectId();

  assert.equal(isProtectedAdminTarget({ _id: adminId, role: 'admin' }, String(adminId)).blocked, true);
  assert.equal(isProtectedAdminTarget({ _id: otherAdminId, role: 'admin' }, String(adminId)).blocked, true);
  assert.equal(isProtectedAdminTarget({ _id: seekerId, role: 'seeker' }, String(adminId)).blocked, false);

  const origFindById = User.findById;
  const origAuditCreate = AuditLog.create;
  const origNotifCreate = Notification.create;

  let auditRecord: any = null;
  let notifRecord: any = null;
  let savedCount = 0;

  const targetMock: any = {
    _id: adminId,
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    isActive: true,
    isDeleted: false,
    async save() {
      savedCount += 1;
      return this;
    },
    toObject() {
      return { ...this };
    },
  };

  (User as any).findById = () => ({
    select: async () => targetMock,
  });
  (AuditLog as any).create = async (doc: unknown) => {
    auditRecord = doc;
    return doc;
  };
  (Notification as any).create = async (doc: unknown) => {
    notifRecord = doc;
    return doc;
  };

  try {
    // Self-modification blocked
    const selfRes = createMockRes();
    await updateAdminUserStatus(
      {
        userId: String(adminId),
        params: { id: String(adminId) },
        body: { isActive: false, reason: 'Attempt self lock' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      selfRes.res
    );
    assert.equal(selfRes.getStatus(), 403);
    assert.equal(selfRes.getBody().code, 'SELF_MODIFICATION_FORBIDDEN');
    assert.equal(savedCount, 0);

    // Other admin target blocked
    targetMock._id = otherAdminId;
    targetMock.role = 'admin';
    const otherAdminRes = createMockRes();
    await updateAdminUserStatus(
      {
        userId: String(adminId),
        params: { id: String(otherAdminId) },
        body: { isActive: false, reason: 'Attempt admin lock' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      otherAdminRes.res
    );
    assert.equal(otherAdminRes.getStatus(), 403);
    assert.equal(otherAdminRes.getBody().code, 'PROTECTED_ADMIN_ACCOUNT');
    assert.equal(savedCount, 0);

    // Seeker target succeeds
    targetMock._id = seekerId;
    targetMock.role = 'seeker';
    targetMock.email = 'seeker@example.com';
    const suspendRes = createMockRes();
    await updateAdminUserStatus(
      {
        userId: String(adminId),
        params: { id: String(seekerId) },
        body: { isActive: false, reason: 'Automated spam postings' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      suspendRes.res
    );
    assert.equal(suspendRes.getStatus(), 200);
    assert.equal(savedCount, 1);
    assert.equal(suspendRes.getBody().data.user.isActive, false);
    assert.equal(suspendRes.getBody().data.user.suspensionReason, 'Automated spam postings');
    assert.equal(auditRecord?.action, 'ADMIN_USER_SUSPENDED');
    assert.equal(auditRecord?.actorRole, 'admin');
    assert.equal(notifRecord?.type, 'admin_action');
  } finally {
    (User as any).findById = origFindById;
    (AuditLog as any).create = origAuditCreate;
    (Notification as any).create = origNotifCreate;
  }
});

test('admin user detail, dashboard, organization verification, job & course moderation, and audit listing work with safe projections', async () => {
  const adminId = new mongoose.Types.ObjectId();
  const seekerId = new mongoose.Types.ObjectId();
  const ownerId = new mongoose.Types.ObjectId();
  const orgId = new mongoose.Types.ObjectId();
  const jobId = new mongoose.Types.ObjectId();
  const courseId = new mongoose.Types.ObjectId();

  const origUserCount = User.countDocuments;
  const origUserFind = User.find;
  const origUserFindOne = User.findOne;
  const origJobCount = Job.countDocuments;
  const origJobFindOne = Job.findOne;
  const origJobFindById = Job.findById;
  const origCourseCount = Course.countDocuments;
  const origCourseFindOne = Course.findOne;
  const origCourseFindById = Course.findById;
  const origAppCount = (await import('../src/models/Application.model.js')).Application.countDocuments;
  const origOrgCount = Organization.countDocuments;
  const origOrgFind = Organization.find;
  const origOrgFindOne = Organization.findOne;
  const origOrgFindById = Organization.findById;
  const origNotifCount = Notification.countDocuments;
  const origNotifFind = Notification.find;
  const origNotifCreate = Notification.create;
  const origAuditFind = AuditLog.find;
  const origAuditCount = AuditLog.countDocuments;
  const origAuditCreate = AuditLog.create;
  const origProfileFindOne = Profile.findOne;
  const origResumeCount = (await import('../src/models/Resume.model.js')).Resume.countDocuments;
  const { Application } = await import('../src/models/Application.model.js');
  const { Resume } = await import('../src/models/Resume.model.js');

  const recordedAudits: any[] = [];
  const sentNotifs: any[] = [];

  (AuditLog as any).create = async (doc: unknown) => {
    recordedAudits.push(doc);
    return doc;
  };
  (Notification as any).create = async (doc: unknown) => {
    sentNotifs.push(doc);
    return doc;
  };

  try {
    // 1. Dashboard stats
    (User as any).countDocuments = async () => 12;
    (Job as any).countDocuments = async () => 8;
    (Course as any).countDocuments = async () => 5;
    (Application as any).countDocuments = async () => 20;
    (Organization as any).countDocuments = async () => 4;
    (Notification as any).countDocuments = async () => 2;
    (User as any).find = () => makeChain([
      { _id: seekerId, name: 'Recent User', email: 'recent@example.com', role: 'seeker', isActive: true, password: 'secret' },
    ]);
    (Organization as any).find = () => makeChain([
      { _id: orgId, name: 'Pending Tech', type: 'employer', isVerified: false, owner: { _id: ownerId, name: 'Owner', email: 'owner@tech.com', role: 'employer' } },
    ]);
    (AuditLog as any).find = () => makeChain([
      { _id: new mongoose.Types.ObjectId(), action: 'ADMIN_USER_SUSPENDED', actorRole: 'admin', resource: 'User', createdAt: new Date() },
    ]);
    (Notification as any).find = () => makeChain([]);

    const dashRes = createMockRes();
    await getAdminDashboard({ userId: String(adminId) } as any, dashRes.res);
    assert.equal(dashRes.getStatus(), 200);
    assert.equal(dashRes.getBody().data.stats.totalUsers, 12);
    assert.equal(dashRes.getBody().data.recentUsers.length, 1);
    assert.equal('password' in dashRes.getBody().data.recentUsers[0], false);

    // 2. List users safe projection
    (User as any).countDocuments = async () => 1;
    const usersRes = createMockRes();
    await listAdminUsers({ query: {} } as any, usersRes.res);
    assert.equal(usersRes.getStatus(), 200);
    assert.equal(usersRes.getBody().data.users.length, 1);
    assert.equal('password' in usersRes.getBody().data.users[0], false);

    // 3. Get user detail
    (User as any).findOne = () => makeChain({
      _id: seekerId,
      name: 'Recent User',
      email: 'recent@example.com',
      role: 'seeker',
      isActive: true,
      password: 'hidden',
    });
    (Profile as any).findOne = () => makeChain({ headline: 'Engineer', skills: [], experience: [], education: [] });
    (Resume as any).countDocuments = async () => 2;
    (Application as any).countDocuments = async () => 3;
    const userDetailRes = createMockRes();
    await getAdminUserById({ params: { id: String(seekerId) } } as any, userDetailRes.res);
    assert.equal(userDetailRes.getStatus(), 200);
    assert.equal(userDetailRes.getBody().data.roleSummary.resumesCount, 2);
    assert.equal('password' in userDetailRes.getBody().data.user, false);

    // 4. Organization verification
    const orgDoc: any = {
      _id: orgId,
      owner: ownerId,
      name: 'Pending Tech',
      type: 'employer',
      isVerified: false,
      verificationStatus: 'pending',
      verificationHistory: [],
      async save() {
        return this;
      },
    };
    (Organization as any).findOne = async () => orgDoc;
    (Organization as any).findById = () => makeChain({
      ...orgDoc,
      owner: { _id: ownerId, name: 'Owner', email: 'owner@tech.com', role: 'employer' },
    });
    const verifyRes = createMockRes();
    await reviewAdminVerification(
      {
        userId: String(adminId),
        params: { orgId: String(orgId) },
        body: { status: 'verified', reason: 'Verified registration filings' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      verifyRes.res
    );
    assert.equal(verifyRes.getStatus(), 200);
    assert.equal(orgDoc.isVerified, true);
    assert.equal(orgDoc.verificationStatus, 'verified');
    assert.equal(orgDoc.verificationHistory.length, 1);

    // 5. Job moderation forces closed when rejected
    const jobDoc: any = {
      _id: jobId,
      employer: ownerId,
      title: 'Suspicious Role',
      status: 'active',
      moderationStatus: 'approved',
      moderationHistory: [],
      async save() {
        return this;
      },
    };
    (Job as any).findOne = async () => jobDoc;
    (Job as any).findById = () => makeChain({
      ...jobDoc,
      employer: { _id: ownerId, name: 'Owner', email: 'owner@tech.com', role: 'employer' },
    });
    const jobModRes = createMockRes();
    await moderateAdminJob(
      {
        userId: String(adminId),
        params: { id: String(jobId) },
        body: { moderationStatus: 'rejected', status: 'active', reason: 'Violates compensation rules' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      jobModRes.res
    );
    assert.equal(jobModRes.getStatus(), 200);
    assert.equal(jobDoc.moderationStatus, 'rejected');
    assert.equal(jobDoc.status, 'closed');

    // 6. Course moderation forces archived when rejected
    const courseDoc: any = {
      _id: courseId,
      provider: ownerId,
      title: 'Outdated Bootcamp',
      status: 'published',
      moderationStatus: 'approved',
      moderationHistory: [],
      async save() {
        return this;
      },
    };
    (Course as any).findOne = async () => courseDoc;
    (Course as any).findById = () => makeChain({
      ...courseDoc,
      provider: { _id: ownerId, name: 'Owner', email: 'owner@tech.com', role: 'provider' },
    });
    const courseModRes = createMockRes();
    await moderateAdminCourse(
      {
        userId: String(adminId),
        params: { id: String(courseId) },
        body: { moderationStatus: 'rejected', reason: 'Misleading certification claim' },
        ip: '127.0.0.1',
        get: () => 'test-agent',
      } as any,
      courseModRes.res
    );
    assert.equal(courseModRes.getStatus(), 200);
    assert.equal(courseDoc.moderationStatus, 'rejected');
    assert.equal(courseDoc.status, 'archived');

    // 7. Read-only audit logs listing
    (AuditLog as any).countDocuments = async () => 1;
    const logsRes = createMockRes();
    await listAdminAuditLogs({ query: {} } as any, logsRes.res);
    assert.equal(logsRes.getStatus(), 200);
    assert.equal(logsRes.getBody().data.logs.length, 1);

    assert.equal(recordedAudits.length, 3);
    assert.equal(sentNotifs.length, 3);
  } finally {
    (User as any).countDocuments = origUserCount;
    (User as any).find = origUserFind;
    (User as any).findOne = origUserFindOne;
    (Job as any).countDocuments = origJobCount;
    (Job as any).findOne = origJobFindOne;
    (Job as any).findById = origJobFindById;
    (Course as any).countDocuments = origCourseCount;
    (Course as any).findOne = origCourseFindOne;
    (Course as any).findById = origCourseFindById;
    (Application as any).countDocuments = origAppCount;
    (Organization as any).countDocuments = origOrgCount;
    (Organization as any).find = origOrgFind;
    (Organization as any).findOne = origOrgFindOne;
    (Organization as any).findById = origOrgFindById;
    (Notification as any).countDocuments = origNotifCount;
    (Notification as any).find = origNotifFind;
    (Notification as any).create = origNotifCreate;
    (AuditLog as any).find = origAuditFind;
    (AuditLog as any).countDocuments = origAuditCount;
    (AuditLog as any).create = origAuditCreate;
    (Profile as any).findOne = origProfileFindOne;
    (Resume as any).countDocuments = origResumeCount;
  }
});

test('models index preserves exact 13 capitalized Mongoose models without duplication', async () => {
  const models = await import('../src/models/index.js');
  assert.equal(Object.keys(models).filter((key) => /^[A-Z]/.test(key)).length, 13);
});
