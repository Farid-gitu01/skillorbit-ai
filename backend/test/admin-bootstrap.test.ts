import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-bootstrap-admin-test-secret-32c';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_bootstrap_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { AUTH_COOKIE_NAME },
  { bootstrapFirstAdmin },
  { login },
  { User },
  { AuditLog },
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/scripts/admin-bootstrap.core.js'),
  import('../src/controllers/auth.controller.js'),
  import('../src/models/user.model.js'),
  import('../src/models/AuditLog.model.js'),
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
        if (rawBody !== null) this.push(Buffer.from(rawBody, 'utf8'));
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

test('bootstrapFirstAdmin creates the first admin with bcrypt-hashed password, exact role, and audit entry', async () => {
  const secretPlaintext = 'SuperSecretAdminPass!2026';
  const savedDocs: Array<InstanceType<typeof User>> = [];
  const recordedAudits: Array<Record<string, unknown>> = [];

  const result = await bootstrapFirstAdmin(
    {
      name: '  Farid Admin  ',
      email: 'ADMIN@SkillOrbit.AI ',
      password: secretPlaintext,
    },
    {
      hasExistingAdmin: async () => false,
      hasExistingEmail: async () => false,
      createAdminUser: async (payload) => {
        const doc = new User(payload);
        await new Promise<void>((resolve, reject) => {
          (User.schema as any).s.hooks.execPre('save', doc, (err?: Error) =>
            err ? reject(err) : resolve()
          );
        });
        savedDocs.push(doc);
        return doc as any;
      },
      verifyStoredPasswordHash: async () => savedDocs[0]?.password,
      writeAuditLog: async (entry) => {
        recordedAudits.push(entry);
      },
    }
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.user.name, 'Farid Admin');
  assert.equal(result.user.email, 'admin@skillorbit.ai');
  assert.equal(result.user.role, 'admin');
  assert.equal(result.user.isActive, true);
  assert.equal(result.user.isEmailVerified, true);
  assert.equal('password' in result.user, false);

  const persistedDoc = savedDocs[0];
  assert.ok(persistedDoc);
  assert.notEqual(persistedDoc.password, secretPlaintext);
  assert.match(persistedDoc.password, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await bcrypt.compare(secretPlaintext, persistedDoc.password), true);
  assert.equal(await persistedDoc.matchPassword(secretPlaintext), true);

  const capturedAudit = recordedAudits[0];
  assert.ok(capturedAudit);
  assert.equal(capturedAudit.action, 'SYSTEM_FIRST_ADMIN_BOOTSTRAPPED');
  assert.equal(JSON.stringify(capturedAudit).includes(secretPlaintext), false);
});

test('bootstrapFirstAdmin blocks duplicate Admin creation and refuses to modify existing user emails', async () => {
  let createCalls = 0;

  const duplicateAdmin = await bootstrapFirstAdmin(
    {
      name: 'Second Admin',
      email: 'second@skillorbit.ai',
      password: 'ValidPassword123!',
    },
    {
      hasExistingAdmin: async () => true,
      createAdminUser: async () => {
        createCalls += 1;
        throw new Error('Should not be invoked');
      },
    }
  );

  assert.equal(duplicateAdmin.ok, false);
  if (!duplicateAdmin.ok) {
    assert.equal(duplicateAdmin.code, 'ADMIN_ALREADY_EXISTS');
  }
  assert.equal(createCalls, 0);

  const existingUserCollision = await bootstrapFirstAdmin(
    {
      name: 'Existing Seeker',
      email: 'seeker@skillorbit.ai',
      password: 'ValidPassword123!',
    },
    {
      hasExistingAdmin: async () => false,
      hasExistingEmail: async () => true,
      createAdminUser: async () => {
        createCalls += 1;
        throw new Error('Should not be invoked');
      },
    }
  );

  assert.equal(existingUserCollision.ok, false);
  if (!existingUserCollision.ok) {
    assert.equal(existingUserCollision.code, 'EMAIL_ALREADY_EXISTS');
  }
  assert.equal(createCalls, 0);
});

test('bootstrapFirstAdmin enforces existing project email and password validation rules', async () => {
  let createCalls = 0;
  const noopCreate = async () => {
    createCalls += 1;
    throw new Error('Should not be invoked');
  };

  const invalidCases = [
    { name: 'Admin', email: 'not-an-email', password: 'ValidPassword123!' },
    { name: 'Admin', email: 'admin@skillorbit.ai', password: 'short' },
    { name: 'Admin', email: 'admin@skillorbit.ai', password: 'A'.repeat(73) },
    { name: 'X', email: 'admin@skillorbit.ai', password: 'ValidPassword123!' },
  ];

  for (const badInput of invalidCases) {
    const res = await bootstrapFirstAdmin(badInput, {
      hasExistingAdmin: async () => false,
      hasExistingEmail: async () => false,
      createAdminUser: noopCreate,
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.code, 'VALIDATION_ERROR');
    }
  }
  assert.equal(createCalls, 0);
});

test('bootstrapped Admin can log in normally, access Admin routes, while public admin signup and non-admins remain rejected', async () => {
  const adminPassword = 'BootstrapLoginPass#2026';
  const adminDoc = new User({
    name: 'First Admin',
    email: 'first.admin@skillorbit.ai',
    password: adminPassword,
    role: 'admin',
    isActive: true,
    isEmailVerified: true,
    isDeleted: false,
  });

  await new Promise<void>((resolve, reject) => {
    (User.schema as any).s.hooks.execPre('save', adminDoc, (err?: Error) =>
      err ? reject(err) : resolve()
    );
  });

  // Public registration endpoint must STILL reject role='admin'
  const publicSignup = await dispatchToApp('/api/auth/register', 'POST', {
    body: {
      fullName: 'Malicious Admin',
      email: 'evil@skillorbit.ai',
      password: 'ValidPassword123!',
      role: 'admin',
    },
  });
  assert.equal(publicSignup.status, 400);

  // Admin login succeeds cleanly through normal login controller
  const origFindOne = User.findOne;
  const origFindById = User.findById;

  (User as any).findOne = () => ({
    select: async () => {
      adminDoc.save = (async () => adminDoc) as any;
      return adminDoc;
    },
  });

  let issuedCookie = '';
  try {
    let loginStatus = 200;
    let loginPayload: any = null;
    const cookiesSet: string[] = [];
    const mockRes: any = {
      status(code: number) {
        loginStatus = code;
        return this;
      },
      json(body: unknown) {
        loginPayload = body;
        return this;
      },
      cookie(name: string, val: string) {
        cookiesSet.push(`${name}=${val}`);
        return this;
      },
    };

    await login(
      {
        body: { email: 'first.admin@skillorbit.ai', password: adminPassword },
      } as any,
      mockRes,
      ((err: unknown) => {
        if (err) throw err;
      }) as any
    );

    assert.equal(loginStatus, 200);
    assert.equal(loginPayload.data.user.role, 'admin');
    assert.equal(cookiesSet.length, 1);
    assert.ok(cookiesSet[0].startsWith(`${AUTH_COOKIE_NAME}=`));
    issuedCookie = cookiesSet[0];
  } finally {
    (User as any).findOne = origFindOne;
  }

  // Verified Admin cookie accesses protected Admin route, while non-admin role gets 403
  const seekerId = new mongoose.Types.ObjectId();
  let lookupMode: 'admin' | 'seeker' = 'admin';
  (User as any).findById = () => ({
    select: async () =>
      lookupMode === 'admin'
        ? {
            _id: adminDoc._id,
            id: adminDoc.id,
            name: adminDoc.name,
            email: adminDoc.email,
            role: 'admin',
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
        : {
            _id: seekerId,
            id: String(seekerId),
            name: 'Regular Seeker',
            email: 'seeker@skillorbit.ai',
            role: 'seeker',
            isActive: true,
            isDeleted: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
  });

  const origAuditFind = AuditLog.find;
  const origAuditCount = AuditLog.countDocuments;
  const makeAuditChain = () => ({
    populate: () => makeAuditChain(),
    sort: () => makeAuditChain(),
    skip: () => makeAuditChain(),
    limit: () => makeAuditChain(),
    lean: async () => [],
  });
  (AuditLog as any).find = () => makeAuditChain();
  (AuditLog as any).countDocuments = async () => 0;

  try {
    lookupMode = 'seeker';
    const forbiddenResp = await dispatchToApp('/api/admin/audit-logs', 'GET', {
      headers: { cookie: issuedCookie },
    });
    assert.equal(forbiddenResp.status, 403);

    lookupMode = 'admin';
    const adminResp = await dispatchToApp('/api/admin/audit-logs', 'GET', {
      headers: { cookie: issuedCookie },
    });
    assert.equal(adminResp.status, 200);
  } finally {
    (User as any).findById = origFindById;
    (AuditLog as any).find = origAuditFind;
    (AuditLog as any).countDocuments = origAuditCount;
  }
});
