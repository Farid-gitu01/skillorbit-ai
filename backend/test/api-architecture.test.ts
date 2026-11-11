import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-api-architecture-test-secret';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_route_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const { default: app } = await import('../src/app.js');
let server: Server;
let baseUrl: string;

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});

after(async () => {
  if (server?.listening) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('central /api routing preserves health and every implemented auth endpoint', async () => {
  const health = await fetch(`${baseUrl}/health`);
  assert.ok(health.status === 200 || health.status === 503);
  const healthBody = await health.json() as { success: boolean; data?: { app: string; database: string }; code?: string };
  if (health.status === 200) {
    assert.equal(healthBody.success, true);
    assert.equal(healthBody.data?.app, 'SkillOrbit AI');
    assert.ok(typeof healthBody.data?.database === 'string');
  } else {
    assert.equal(healthBody.success, false);
    assert.equal(healthBody.code, 'SERVICE_UNAVAILABLE');
  }

  const authPublicRoutes = [
    ['/register', { fullName: 'x' }],
    ['/login', { email: 'bad' }],
    ['/forgot-password', {}],
    ['/reset-password', {}],
    ['/verify-email', {}],
    ['/resend-verification', {}],
  ] as const;
  for (const [path, body] of authPublicRoutes) {
    const response = await fetch(`${baseUrl}/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400, `${path} should be routed to its validator`);
  }

  const unexpectedField = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.test', password: 'anything', role: 'admin' }),
  });
  assert.equal(unexpectedField.status, 400);
  const validationBody = await unexpectedField.json() as {
    success: boolean;
    message: string;
    code: string;
    errors: Array<{ field: string; message: string }>;
  };
  assert.equal(validationBody.success, false);
  assert.equal(validationBody.message, 'Login validation failed');
  assert.equal(validationBody.code, 'VALIDATION_ERROR');
  assert.ok(validationBody.errors.some((error) => error.field === 'role'));

  const malformedJson = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email":',
  });
  assert.equal(malformedJson.status, 400);
  assert.deepEqual(await malformedJson.json(), {
    success: false,
    message: 'Malformed request body',
    code: 'MALFORMED_REQUEST',
  });

  const logout = await fetch(`${baseUrl}/auth/logout`, { method: 'POST' });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie') ?? '', /skillorbit_access/);
});

test('protected user route and unknown routes retain their expected behavior', async () => {
  const me = await fetch(`${baseUrl}/users/me`);
  assert.equal(me.status, 401);
  assert.deepEqual(await me.json(), {
    success: false,
    message: 'Authentication required',
    code: 'AUTHENTICATION_REQUIRED',
  });

  const unknown = await fetch(`${baseUrl}/not-a-real-module?token=sensitive-test-token`);
  assert.equal(unknown.status, 404);
  const unknownBody = await unknown.json() as { success: boolean; message: string; code: string };
  assert.deepEqual(unknownBody, {
    success: false,
    message: 'Route not found: GET /api/not-a-real-module',
    code: 'ROUTE_NOT_FOUND',
  });
  assert.ok(!JSON.stringify(unknownBody).includes('sensitive-test-token'));

  const noFakeJobsRoute = await fetch(`${baseUrl}/jobs`);
  assert.equal(noFakeJobsRoute.status, 404);
});
