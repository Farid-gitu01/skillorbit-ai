import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { afterEach, test } from 'node:test';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../src/models/user.model.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-auth-test-secret-at-least-32-chars';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_auth_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { User },
  { emailService, createEmailService },
  { register, login, logout, requestPasswordReset, resetPassword, verifyEmail, resendVerificationEmail },
  { protect, restrictTo },
  { getProfile },
  { generateToken },
  { AUTH_COOKIE_NAME, getAuthCookieOptions, getAuthCookieClearOptions },
  resetTokens,
  validators,
] = await Promise.all([
  import('../src/models/user.model.js'),
  import('../src/services/email/email.service.js'),
  import('../src/controllers/auth.controller.js'),
  import('../src/middlewares/auth.middleware.js'),
  import('../src/controllers/user.controller.js'),
  import('../src/utils/token.util.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/utils/password-reset.util.js'),
  import('../src/validators/auth.validator.js'),
]);

const originalDescriptors = new Map<object, Map<string, PropertyDescriptor | undefined>>();

function mockProperty(target: object, key: string, value: unknown): void {
  let properties = originalDescriptors.get(target);
  if (!properties) {
    properties = new Map();
    originalDescriptors.set(target, properties);
  }
  if (!properties.has(key)) properties.set(key, Object.getOwnPropertyDescriptor(target, key));
  Object.defineProperty(target, key, { configurable: true, writable: true, value });
}

afterEach(() => {
  for (const [target, properties] of originalDescriptors) {
    for (const [key, descriptor] of properties) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  }
  originalDescriptors.clear();
});

function fakeUser(overrides: Record<string, unknown> = {}): any {
  return {
    id: '507f1f77bcf86cd799439011',
    name: 'Test User',
    email: 'user@example.test',
    password: 'internal-password-hash',
    role: 'seeker',
    isActive: true,
    isDeleted: false,
    deletedAt: null,
    isEmailVerified: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    matchPassword: async (plain: string) => plain === 'CorrectPassword123',
    save: async () => undefined,
    ...overrides,
  };
}

async function invoke(
  handler: (req: any, res: any, next: any) => unknown,
  request: Record<string, any> = {}
) {
  const result: {
    statusCode: number;
    payload?: any;
    cookies: Array<unknown[]>;
    cleared: Array<unknown[]>;
    nextCalled: boolean;
    nextError?: unknown;
  } = { statusCode: 0, cookies: [], cleared: [], nextCalled: false };
  const res: any = {
    cookie: (...args: unknown[]) => { result.cookies.push(args); return res; },
    clearCookie: (...args: unknown[]) => { result.cleared.push(args); return res; },
    status: (code: number) => { result.statusCode = code; return res; },
    json: (payload: unknown) => { result.payload = payload; return res; },
  };
  await handler(request, res, (error?: unknown) => {
    result.nextCalled = error === undefined;
    result.nextError = error;
  });
  return result;
}

function setEmailService(options: {
  configured?: boolean;
  verify?: (to: string, token: string) => Promise<void>;
  reset?: (to: string, token: string) => Promise<void>;
} = {}): void {
  mockProperty(emailService, 'isConfigured', () => options.configured ?? true);
  mockProperty(emailService, 'sendVerificationEmail', options.verify ?? (async () => undefined));
  mockProperty(emailService, 'sendPasswordResetEmail', options.reset ?? (async () => undefined));
}

async function runModelSaveHook(document: InstanceType<typeof User>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    (User.schema as any).s.hooks.execPre('save', document, (error?: Error) =>
      error ? reject(error) : resolve()
    );
  });
}

test('registration validates input, normalizes email, rejects admin/extra fields', () => {
  const valid = { fullName: '  Test User  ', email: ' USER@Example.Test ', password: 'StrongPass123', role: 'seeker' };
  assert.deepEqual(validators.registerSchema.parse(valid), {
    fullName: 'Test User', email: 'user@example.test', password: 'StrongPass123', role: 'seeker',
  });
  for (const role of ['seeker', 'employer', 'provider']) {
    assert.equal(validators.registerSchema.safeParse({ ...valid, role }).success, true);
  }
  for (const input of [
    { ...valid, role: 'admin' },
    { ...valid, role: 'unknown' },
    { ...valid, email: 'not-an-email' },
    { ...valid, password: 'short' },
    { email: valid.email, password: valid.password, role: valid.role },
    { ...valid, isEmailVerified: true },
    { ...valid, unexpected: 'value' },
  ]) assert.equal(validators.registerSchema.safeParse(input).success, false);
});

test('registration creates safe account, hashes verification token, emails it, and sets cookie', async () => {
  let createFields: any;
  let sentToken = '';
  setEmailService({ configured: true, verify: async (_to, token) => { sentToken = token; } });
  mockProperty(User, 'exists', async () => null);
  mockProperty(User, 'create', async (fields: any) => {
    createFields = fields;
    return fakeUser({ id: '507f1f77bcf86cd799439011', name: fields.name, email: fields.email, role: fields.role });
  });
  const response = await invoke(register, {
    body: { fullName: 'Test User', email: 'user@example.test', password: 'StrongPass123', role: 'seeker' },
  });
  await new Promise((resolve) => setImmediate(resolve));
    assert.equal(response.statusCode, 201);
    assert.equal(response.payload.success, true);
  assert.equal(createFields.isEmailVerified, false);
  assert.match(sentToken, /^[a-f\d]{64}$/i);
  assert.equal(createFields.emailVerificationTokenHash, resetTokens.hashPasswordResetToken(sentToken));
  assert.notEqual(createFields.emailVerificationTokenHash, sentToken);
  assert.ok(createFields.emailVerificationExpiresAt.getTime() > Date.now());
  assert.equal(response.cookies[0]?.[0], AUTH_COOKIE_NAME);
  assert.equal((response.cookies[0]?.[2] as any).httpOnly, true);
  assert.ok(!JSON.stringify(response.payload).includes(sentToken));
  assert.ok(!JSON.stringify(response.payload).includes('internal-password-hash'));
  assert.ok(!JSON.stringify(response.payload).includes('emailVerificationTokenHash'));
  assert.deepEqual(Object.keys(response.payload.data.user).sort(), ['_id', 'createdAt', 'email', 'name', 'role', 'updatedAt'].sort());
});

test('registration handles duplicate email and verification-delivery failure safely', async () => {
  mockProperty(User, 'exists', async () => ({ _id: 'existing' }));
  const conflict = await invoke(register, { body: { fullName: 'Test User', email: 'user@example.test', password: 'StrongPass123', role: 'seeker' } });
  assert.equal(conflict.statusCode, 409);

  const warnings: string[] = [];
  const oldWarn = console.warn;
  console.warn = (message?: unknown) => { warnings.push(String(message)); };
  try {
    setEmailService({ configured: true, verify: async () => { throw new Error('mock SMTP error contains secret'); } });
    mockProperty(User, 'exists', async () => null);
    mockProperty(User, 'create', async (fields: any) => fakeUser({ name: fields.name, email: fields.email, role: fields.role }));
    const failedDelivery = await invoke(register, {
      body: { fullName: 'Test User', email: 'user@example.test', password: 'StrongPass123', role: 'seeker' },
    });
    assert.equal(failedDelivery.statusCode, 201);
    assert.match(failedDelivery.payload.message, /delivery is unavailable/i);
    assert.ok(!JSON.stringify(failedDelivery.payload).includes('secret'));
    assert.ok(warnings.every((message) => !message.includes('secret')));
  } finally {
    console.warn = oldWarn;
  }
});

test('login validates strictly and authenticates safe eligible users with the configured cookie', async () => {
  assert.deepEqual(validators.loginSchema.parse({ email: ' USER@example.test ', password: 'x' }), {
    email: 'user@example.test', password: 'x',
  });
  for (const invalid of [
    { email: 'bad', password: 'x' },
    { email: 'user@example.test' },
    { email: 'user@example.test', password: '' },
    { email: 'user@example.test', password: 'x', role: 'admin' },
  ]) assert.equal(validators.loginSchema.safeParse(invalid).success, false);

  const user = fakeUser({ isEmailVerified: false });
  let selectedPassword = false;
  mockProperty(User, 'findOne', () => ({ select: async (selection: string) => {
    selectedPassword = selection === '+password';
    return user;
  } }));
  const response = await invoke(login, { body: { email: user.email, password: 'CorrectPassword123' } });
  assert.equal(response.statusCode, 200);
  assert.equal(selectedPassword, true);
  assert.ok(user.lastLoginAt instanceof Date);
  assert.equal(response.cookies[0]?.[0], AUTH_COOKIE_NAME);
  const cookie = response.cookies[0]?.[2] as any;
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.sameSite, 'lax');
  assert.equal(cookie.path, '/');
  assert.equal(cookie.secure, false);
  assert.ok(cookie.maxAge > 0);
  assert.ok(!JSON.stringify(response.payload).includes('internal-password-hash'));
  assert.ok(!JSON.stringify(response.payload).includes(String(response.cookies[0]?.[1])));
  assert.equal(response.payload.data.user.role, 'seeker');
});

test('login gives generic failures for unknown email, bad password, and ineligible accounts', async () => {
  let currentUser: any;
  mockProperty(User, 'findOne', () => ({ select: async () => currentUser }));
  currentUser = null;
  const unknown = await invoke(login, { body: { email: 'unknown@example.test', password: 'CorrectPassword123' } });
  currentUser = fakeUser({ matchPassword: async () => false });
  const incorrect = await invoke(login, { body: { email: 'user@example.test', password: 'wrong' } });
  assert.equal(unknown.statusCode, 401);
  assert.equal(unknown.payload.message, incorrect.payload.message);
  for (const state of [
    { isActive: false },
    { isDeleted: true },
    { deletedAt: new Date() },
  ]) {
    currentUser = fakeUser(state);
    const blocked = await invoke(login, { body: { email: 'user@example.test', password: 'CorrectPassword123' } });
    assert.equal(blocked.statusCode, 401);
    assert.equal(blocked.payload.message, unknown.payload.message);
    assert.equal(blocked.cookies.length, 0);
  }
});

test('logout is idempotent and clears the authentication cookie with matching scope', async () => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await invoke(logout);
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.success, true);
    assert.equal(response.cleared[0]?.[0], AUTH_COOKIE_NAME);
    assert.deepEqual(response.cleared[0]?.[1], getAuthCookieClearOptions());
  }
  const token = generateToken('507f1f77bcf86cd799439011');
  const setOptions = getAuthCookieOptions(token);
  const clearOptions = getAuthCookieClearOptions();
  for (const key of ['path', 'secure', 'sameSite', 'httpOnly']) assert.equal((clearOptions as any)[key], (setOptions as any)[key]);
});

test('password reset is generic, stores only a hash, emails token, consumes once, and hashes new password', async () => {
  let storedHash: string | undefined;
  let storedExpiry: Date | undefined;
  let rawToken = '';
  let accountExists = true;
  setEmailService({ configured: true, reset: async (_to, token) => { rawToken = token; } });
  const document = new User({ name: 'Test User', email: 'user@example.test', password: 'OldPassword123', role: 'seeker' });
  Object.defineProperty(document, 'save', {
    configurable: true,
    value: async function () { await runModelSaveHook(this as InstanceType<typeof User>); },
  });
  mockProperty(User, 'findOneAndUpdate', async (filter: any, update: any) => {
    if (update?.$set?.passwordResetTokenHash) {
      if (!accountExists) return null;
      storedHash = update.$set.passwordResetTokenHash;
      storedExpiry = update.$set.passwordResetExpiresAt;
      return { email: 'user@example.test' };
    }
    if (filter?.passwordResetTokenHash) {
      if (filter.passwordResetTokenHash !== storedHash || !storedExpiry || storedExpiry <= filter.passwordResetExpiresAt.$gt) return null;
      storedHash = undefined;
      storedExpiry = undefined;
      return document;
    }
    return null;
  });
  const existing = await invoke(requestPasswordReset, { body: { email: 'user@example.test' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(existing.statusCode, 200);
  assert.ok(rawToken);
  assert.equal(storedHash, resetTokens.hashPasswordResetToken(rawToken));
  assert.notEqual(storedHash, rawToken);
  assert.ok(storedExpiry && storedExpiry.getTime() > Date.now());
  assert.ok(!JSON.stringify(existing.payload).includes(rawToken));
  assert.ok(!JSON.stringify(existing.payload).includes('passwordResetTokenHash'));

  accountExists = false;
  const nonexistent = await invoke(requestPasswordReset, { body: { email: 'nobody@example.test' } });
  assert.equal(nonexistent.statusCode, existing.statusCode);
  assert.deepEqual(nonexistent.payload, existing.payload);

  const completed = await invoke(resetPassword, { body: { token: rawToken, newPassword: 'NewStrongPassword123' } });
  assert.equal(completed.statusCode, 200);
  assert.equal(storedHash, undefined);
  assert.equal(storedExpiry, undefined);
  assert.equal(await bcrypt.compare('NewStrongPassword123', document.password), true);
  assert.ok(!JSON.stringify(completed.payload).includes('NewStrongPassword123'));
  assert.ok(!JSON.stringify(completed.payload).includes(rawToken));
  const reused = await invoke(resetPassword, { body: { token: rawToken, newPassword: 'AnotherStrongPassword123' } });
  assert.equal(reused.statusCode, 400);
  storedHash = resetTokens.hashPasswordResetToken('a'.repeat(64));
  storedExpiry = new Date(Date.now() - 1);
  const expired = await invoke(resetPassword, { body: { token: 'a'.repeat(64), newPassword: 'AnotherStrongPassword123' } });
  assert.equal(expired.statusCode, 400);
});

test('reset email delivery failure remains generic and does not leak mail errors', async () => {
  const oldWarn = console.warn;
  console.warn = () => undefined;
  try {
    setEmailService({ configured: true, reset: async () => { throw new Error('SMTP password leak'); } });
    mockProperty(User, 'findOneAndUpdate', async () => ({ email: 'user@example.test' }));
    const response = await invoke(requestPasswordReset, { body: { email: 'user@example.test' } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.message, 'If an account exists, reset instructions can be sent.');
    assert.ok(!JSON.stringify(response.payload).includes('SMTP password leak'));
  } finally {
    console.warn = oldWarn;
  }
});

test('email verification and resend use hash-only one-time tokens and generic outcomes', async () => {
  let storedHash: string | undefined;
  let storedExpiry: Date | undefined;
  let userExists = true;
  let sentToken = '';
  setEmailService({ configured: true, verify: async (_to, token) => { sentToken = token; } });
  const document = fakeUser();
  mockProperty(User, 'findOneAndUpdate', async (filter: any, update: any) => {
    if (update?.$set?.emailVerificationTokenHash) {
      if (!userExists) return null;
      storedHash = update.$set.emailVerificationTokenHash;
      storedExpiry = update.$set.emailVerificationExpiresAt;
      return document;
    }
    if (filter?.emailVerificationTokenHash) {
      if (filter.emailVerificationTokenHash !== storedHash || !storedExpiry || storedExpiry <= filter.emailVerificationExpiresAt.$gt) return null;
      storedHash = undefined;
      storedExpiry = undefined;
      return document;
    }
    return null;
  });

  userExists = false;
  const absent = await invoke(resendVerificationEmail, { body: { email: 'nobody@example.test' } });
  userExists = true;
  const resent = await invoke(resendVerificationEmail, { body: { email: 'user@example.test' } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(absent.payload, resent.payload);
  assert.ok(sentToken);
  assert.equal(storedHash, resetTokens.hashPasswordResetToken(sentToken));
  assert.notEqual(storedHash, sentToken);
  assert.ok(storedExpiry && storedExpiry.getTime() > Date.now());
  assert.ok(!JSON.stringify(resent.payload).includes(sentToken));

  const verified = await invoke(verifyEmail, { body: { token: sentToken } });
  assert.equal(verified.statusCode, 200);
  assert.equal(storedHash, undefined);
  assert.equal(storedExpiry, undefined);
  const reused = await invoke(verifyEmail, { body: { token: sentToken } });
  assert.equal(reused.statusCode, 400);
  storedHash = resetTokens.hashPasswordResetToken('b'.repeat(64));
  storedExpiry = new Date(Date.now() - 1);
  assert.equal((await invoke(verifyEmail, { body: { token: 'b'.repeat(64) } })).statusCode, 400);
});

test('SMTP email service uses mock transport and reports delivery errors without swallowing them', async () => {
  const messages: any[] = [];
  const service = createEmailService({ sendMail: async (message: any) => { messages.push(message); return { messageId: 'mock' }; } } as any, 'SkillOrbit <noreply@example.test>', 'https://frontend.example.test');
  await service.sendVerificationEmail('user@example.test', 'c'.repeat(64));
  await service.sendPasswordResetEmail('user@example.test', 'd'.repeat(64));
  assert.equal(messages.length, 2);
  assert.match(messages[0].html, /verify-email\?token=/);
  assert.match(messages[1].html, /reset-password\?token=/);
  assert.equal(messages[0].to, 'user@example.test');
  const failed = createEmailService({ sendMail: async () => { throw new Error('mock delivery failure'); } } as any, 'from@example.test');
  await assert.rejects(() => failed.sendVerificationEmail('user@example.test', 'e'.repeat(64)));
  assert.equal(createEmailService(null, undefined).isConfigured(), false);
});

test('protect authenticates cookies, rejects bad tokens/accounts, and trusts only database identity', async () => {
  let currentUser: any = fakeUser({ role: 'seeker' });
  let selected = '';
  mockProperty(User, 'findById', () => ({ select: async (projection: string) => { selected = projection; return currentUser; } }));
  const token = generateToken('507f1f77bcf86cd799439011');
  const request: any = { cookies: { [AUTH_COOKIE_NAME]: token }, headers: {}, userRole: 'admin', authUser: { role: 'admin' } };
  const accepted = await invoke(protect, request);
  assert.equal(accepted.nextCalled, true);
  assert.equal(request.userRole, 'seeker');
  assert.equal(request.authUser.role, 'seeker');
  assert.ok(!selected.includes('password'));
  assert.ok(!JSON.stringify(request.authUser).includes('internal-password-hash'));

  const invalidTokens = [
    undefined,
    'not-a-token',
    jwt.sign({ id: '507f1f77bcf86cd799439011' }, 'a-different-test-secret-with-enough-length', { algorithm: 'HS256', expiresIn: 60 }),
    jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: -1 }),
    jwt.sign({ id: 'bad-id' }, process.env.JWT_SECRET!, { algorithm: 'HS256', expiresIn: 60 }),
    jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_SECRET!, { algorithm: 'HS256' }),
  ];
  const signed = generateToken('507f1f77bcf86cd799439011').split('.');
  signed[1] = `${signed[1]![0] === 'a' ? 'b' : 'a'}${signed[1]!.slice(1)}`;
  invalidTokens.push(signed.join('.'));
  for (const invalid of invalidTokens) {
    const rejected = await invoke(protect, { cookies: invalid ? { [AUTH_COOKIE_NAME]: invalid } : {}, headers: {} });
    assert.equal(rejected.statusCode, 401);
  }
  currentUser = null;
  assert.equal((await invoke(protect, { cookies: { [AUTH_COOKIE_NAME]: token } })).statusCode, 401);
  for (const state of [{ isActive: false }, { isDeleted: true }, { deletedAt: new Date() }]) {
    currentUser = fakeUser(state);
    assert.equal((await invoke(protect, { cookies: { [AUTH_COOKIE_NAME]: token } })).statusCode, 401);
  }
});

test('RBAC supports every role and multiple roles with correct 401/403 semantics', async () => {
  for (const role of ['seeker', 'employer', 'provider', 'admin']) {
    const allowed = await invoke(restrictTo(role as UserRole, 'admin'), { authUser: { role } });
    assert.equal(allowed.nextCalled, true);
  }
  assert.equal((await invoke(restrictTo('admin'), {})).statusCode, 401);
  assert.equal((await invoke(restrictTo('admin'), { authUser: { role: 'seeker' } })).statusCode, 403);
  assert.equal((await invoke(restrictTo('admin'), { authUser: { role: 'admin' } })).nextCalled, true);
  assert.equal((await invoke(restrictTo('seeker', 'provider'), { authUser: { role: 'provider' } })).nextCalled, true);
});

test('current-user response and model fields exclude sensitive token/password data without adding models', async () => {
  const safe = fakeUser();
  const response = await invoke(getProfile, { authUser: {
    id: safe.id, name: safe.name, email: safe.email, role: safe.role,
    createdAt: safe.createdAt, updatedAt: safe.updatedAt,
  } });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(Object.keys(response.payload.data.user).sort(), ['_id', 'createdAt', 'email', 'name', 'role', 'updatedAt'].sort());
  for (const field of ['password', 'passwordResetTokenHash', 'emailVerificationTokenHash']) {
    assert.equal((User.schema.path(field) as any).options.select, false);
  }
  const models = await import('../src/models/index.js');
  assert.equal(Object.keys(models).filter((key) => /^[A-Z]/.test(key)).length, 13);
});

test('existing bcrypt pre-save hook hashes once for newly assigned passwords', async () => {
  const user = new User({ name: 'Test User', email: 'bcrypt@example.test', password: 'NewPassword123', role: 'seeker' });
  const plaintext = user.password;
  await new Promise<void>((resolve, reject) => {
    (User.schema as any).s.hooks.execPre('save', user, (error?: Error) => error ? reject(error) : resolve());
  });
  assert.notEqual(user.password, plaintext);
  assert.equal(await bcrypt.compare(plaintext, user.password), true);
});

test('production environment requires valid SMTP settings; development may omit them', () => {
  const common = {
    ...process.env,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/isolated-test-only',
    JWT_SECRET: 'skillorbit-child-test-secret-at-least-32-chars',
    JWT_EXPIRES_IN: '5m',
    AI_PROVIDER: 'test',
    AI_API_KEY: 'test-only',
    SMTP_HOST: '', SMTP_PORT: '', SMTP_SECURE: '', SMTP_USER: '', SMTP_PASS: '', EMAIL_FROM: '',
  };
  const run = (env: NodeJS.ProcessEnv, script = "await import('./src/config/env.ts')") => spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', script],
    { cwd: process.cwd(), env, encoding: 'utf8' }
  );
  assert.equal(run({ ...common, NODE_ENV: 'development' }).status, 0);
  const weakSecret = run({ ...common, NODE_ENV: 'development', JWT_SECRET: 'not-strong' });
  assert.notEqual(weakSecret.status, 0);
  assert.ok(!`${weakSecret.stdout}${weakSecret.stderr}`.includes('not-strong'));
  assert.notEqual(run({ ...common, NODE_ENV: 'development', SMTP_HOST: 'smtp.example.test' }).status, 0);
  assert.notEqual(run({ ...common, NODE_ENV: 'production' }).status, 0);
  const productionEnv = {
    ...common, NODE_ENV: 'production', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '465',
    SMTP_USER: 'test-user', SMTP_PASS: 'test-password', EMAIL_FROM: 'noreply@example.test',
  };
  assert.equal(run(productionEnv).status, 0);
  const productionCookie = run(productionEnv,
    "const { generateToken } = await import('./src/utils/token.util.ts'); const { getAuthCookieOptions } = await import('./src/utils/auth-cookie.util.ts'); if (!getAuthCookieOptions(generateToken('507f1f77bcf86cd799439011')).secure) process.exit(1);");
  assert.equal(productionCookie.status, 0);
});

test('cookie CORS and browser token-storage configuration remain secure', async () => {
  const appSource = await readFile(new URL('../src/app.ts', import.meta.url), 'utf8');
  const frontendSource = await readFile(new URL('../../frontend/src/services/api.ts', import.meta.url), 'utf8');
  const authRouteSource = await readFile(new URL('../src/routes/index.ts', import.meta.url), 'utf8');
  const authRoutesSource = await readFile(new URL('../src/routes/auth.routes.ts', import.meta.url), 'utf8');
  assert.match(appSource, /credentials:\s*true/);
  assert.match(appSource, /origin:\s*IS_PRODUCTION\s*\?\s*CLIENT_URL/);
  assert.match(appSource, /cookieParser\(\)/);
  assert.match(appSource, /morgan\.token\('safe-path'/);
  assert.match(appSource, /:safe-path/);
  assert.doesNotMatch(appSource, /morgan\('(?:combined|dev)'\)/);
  assert.match(frontendSource, /withCredentials:\s*true/);
  assert.doesNotMatch(frontendSource, /localStorage|sessionStorage/);
  assert.match(authRouteSource, /max:\s*20/);
  assert.match(authRoutesSource, /max:\s*5/);
  assert.match(authRoutesSource, /skipSuccessfulRequests:\s*false/);
});
