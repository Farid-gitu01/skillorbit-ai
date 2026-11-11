import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, test } from 'node:test';
import { Duplex, Readable } from 'node:stream';
import { EventEmitter } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-api-architecture-test-secret';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_route_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const { default: app } = await import('../src/app.js');
let server: Server;
let baseUrl: string;

async function dispatchToApp(url: string, init?: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  const rawBody = init?.body ? String(init.body) : undefined;

  return new Promise<Response>((resolve, reject) => {
    const reqStream = new Readable({
      read() {
        if (rawBody) this.push(Buffer.from(rawBody, 'utf8'));
        this.push(null);
      },
    }) as any;

    reqStream.method = method;
    reqStream.url = parsed.pathname + parsed.search;
    reqStream.headers = {};
    reqStream.rawHeaders = [];
    headers.forEach((val, key) => {
      const lower = key.toLowerCase();
      reqStream.headers[lower] = val;
      reqStream.rawHeaders.push(key, val);
    });

    if (rawBody && !reqStream.headers['content-length']) {
      const len = Buffer.byteLength(rawBody, 'utf8').toString();
      reqStream.headers['content-length'] = len;
      reqStream.rawHeaders.push('Content-Length', len);
    }

    const mockSocket = new Duplex({
      read() {},
      write(_chunk, _encoding, callback) {
        callback();
      },
    }) as any;
    mockSocket.remoteAddress = '127.0.0.1';
    mockSocket.encrypted = false;
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

    mockRes.writeHead = (code: number, messageOrHeaders?: any, maybeHeaders?: any) => {
      statusCode = code;
      mockRes.statusCode = code;
      const hdrs = typeof messageOrHeaders === 'object' ? messageOrHeaders : maybeHeaders;
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          mockRes.setHeader(k, v as any);
        }
      }
      return mockRes;
    };

    mockRes.write = (chunk: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    mockRes.end = (chunk?: any) => {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      mockRes.headersSent = true;
      const bodyBuffer = Buffer.concat(chunks);
      const response = new Response(bodyBuffer, {
        status: mockRes.statusCode ?? statusCode,
        statusText: '',
        headers: resHeaders,
      });
      resolve(response);
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

const originalFetch = globalThis.fetch;
before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api`;

  globalThis.fetch = async (input: any, init?: any) => {
    try {
      return await originalFetch(input, init);
    } catch (err: any) {
      if (err?.code === 'EACCES' || err?.cause?.code === 'EACCES' || err?.message?.includes('fetch failed')) {
        return await dispatchToApp(String(input), init);
      }
      throw err;
    }
  };
});

after(async () => {
  globalThis.fetch = originalFetch;
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
