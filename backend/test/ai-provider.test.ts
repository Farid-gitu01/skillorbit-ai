import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { Duplex, Readable } from 'node:stream';
import { test } from 'node:test';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'skillorbit-ai-provider-test-secret-32c';
process.env.JWT_EXPIRES_IN = '5m';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/skillorbit_ai_config_test';
process.env.AI_PROVIDER = 'test';
process.env.AI_API_KEY = 'test-only';

const [
  { default: app },
  { AUTH_COOKIE_NAME },
  { generateToken },
  { User },
  aiModule,
] = await Promise.all([
  import('../src/app.js'),
  import('../src/utils/auth-cookie.util.js'),
  import('../src/utils/token.util.js'),
  import('../src/models/user.model.js'),
  import('../src/services/ai/index.js'),
]);

const {
  AiProviderError,
  AiProviderRegistry,
  AnthropicProviderAdapter,
  OpenAiProviderAdapter,
  analyzeResume,
  createAiHealthService,
  createAiService,
  getSkillGap,
  inspectAiConfig,
  redactAiSecrets,
  resolveAiConfig,
} = aiModule;

function makeJsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

async function dispatchToApp(
  path: string,
  method = 'GET',
  options?: { headers?: Record<string, string> }
): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const reqStream = new Readable({
      read() {
        this.push(null);
      },
    }) as any;

    reqStream.method = method;
    reqStream.url = path;
    reqStream.headers = {
      origin: 'http://localhost:5173',
      ...(options?.headers ?? {}),
    };
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

test('AI config inspection distinguishes valid config, missing API key, unsupported provider, and invalid configuration', () => {
  const unconfigured = inspectAiConfig({});
  assert.equal(unconfigured.status, 'unconfigured');
  assert.equal('code' in unconfigured ? unconfigured.code : undefined, 'AI_NOT_CONFIGURED');

  const missingKey = inspectAiConfig({ provider: 'openai', model: 'gpt-4o-mini' });
  assert.equal(missingKey.status, 'api_key_missing');
  assert.equal('code' in missingKey ? missingKey.code : undefined, 'AI_API_KEY_MISSING');

  const unsupported = inspectAiConfig({ provider: 'unsupported-vendor', apiKey: 'sk-test-secret-123456' });
  assert.equal(unsupported.status, 'invalid_configuration');
  assert.equal('code' in unsupported ? unsupported.code : undefined, 'AI_UNSUPPORTED_PROVIDER');

  const missingGatewayUrl = inspectAiConfig({
    provider: 'openai-compatible',
    apiKey: 'sk-gateway-secret-1234',
  });
  assert.equal(missingGatewayUrl.status, 'invalid_configuration');

  const invalidCases = [
    { provider: 'openai', apiKey: 'sk-secret-12345678', baseUrl: 'ftp://bad-scheme.example' },
    { provider: 'openai', apiKey: 'sk-secret-12345678', baseUrl: 'https://user:pass@api.openai.com/v1' },
    { provider: 'openai', apiKey: 'sk-secret-12345678', timeoutMs: 100 },
    { provider: 'openai', apiKey: 'sk-secret-12345678', timeoutMs: Number.NaN },
    { provider: 'openai', apiKey: 'sk-secret-12345678', maxRetries: 10 },
  ];
  for (const invalidInput of invalidCases) {
    const inspected = inspectAiConfig(invalidInput);
    assert.equal(inspected.status, 'invalid_configuration');
    assert.ok(!JSON.stringify(inspected).includes('sk-secret-12345678'));
  }

  const validOpenAi = resolveAiConfig({
    provider: ' OpenAI ',
    apiKey: 'sk-valid-secret-key-9999',
    model: 'configured-model',
    timeoutMs: 12000,
    maxRetries: 2,
  });
  assert.equal(validOpenAi.provider, 'openai');
  assert.equal(validOpenAi.baseUrl, 'https://api.openai.com/v1');
  assert.equal(validOpenAi.model, 'configured-model');
  assert.equal(validOpenAi.timeoutMs, 12000);
  assert.equal(validOpenAi.maxRetries, 2);

  const validAnthropic = resolveAiConfig({
    provider: 'anthropic',
    apiKey: 'sk-ant-valid-secret-9999',
  });
  assert.equal(validAnthropic.provider, 'anthropic');
  assert.equal(validAnthropic.baseUrl, 'https://api.anthropic.com/v1');
});

test('Backend starts cleanly when AI_PROVIDER or AI_API_KEY are missing or AI numeric config is malformed', () => {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', "await import('./src/config/env.ts')"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://127.0.0.1:27017/skillorbit-no-ai-test',
        JWT_SECRET: 'skillorbit-child-startup-secret-at-least-32',
        AI_PROVIDER: '',
        AI_API_KEY: '',
        AI_TIMEOUT_MS: 'not-a-number',
        AI_MAX_RETRIES: '',
        SMTP_HOST: '',
        SMTP_PORT: '',
        SMTP_SECURE: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        EMAIL_FROM: '',
      },
      encoding: 'utf8',
    }
  );
  assert.equal(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /AI_PROVIDER and\/or AI_API_KEY are not set/);
});

test('Provider registry selects built-in adapters, rejects unknown providers, and supports custom adapters', async () => {
  const registry = new AiProviderRegistry();
  const openAiAdapter = registry.createAdapter({
    provider: 'openai',
    apiKey: 'sk-test-secret-1234',
    baseUrl: 'https://api.openai.com/v1',
    timeoutMs: 5000,
    maxRetries: 0,
  });
  assert.ok(openAiAdapter instanceof OpenAiProviderAdapter);

  const compatAdapter = registry.createAdapter({
    provider: 'openai-compatible',
    apiKey: 'sk-test-secret-1234',
    baseUrl: 'https://gateway.example.test/v1',
    timeoutMs: 5000,
    maxRetries: 0,
  });
  assert.ok(compatAdapter instanceof OpenAiProviderAdapter);

  const anthropicAdapter = registry.createAdapter({
    provider: 'anthropic',
    apiKey: 'sk-ant-secret-1234',
    baseUrl: 'https://api.anthropic.com/v1',
    timeoutMs: 5000,
    maxRetries: 0,
  });
  assert.ok(anthropicAdapter instanceof AnthropicProviderAdapter);

  assert.throws(
    () =>
      registry.createAdapter({
        provider: 'unknown',
        apiKey: 'sk-test-secret-1234',
        baseUrl: 'https://example.test',
        timeoutMs: 5000,
        maxRetries: 0,
      }),
    (err: unknown) => err instanceof AiProviderError && err.code === 'AI_UNSUPPORTED_PROVIDER'
  );

  registry.register('custom-echo', (config) => ({
    provider: config.provider,
    async checkConnection() {
      return { connected: true, provider: config.provider, latencyMs: 1 };
    },
    async complete(req) {
      return {
        provider: config.provider,
        model: req.model ?? config.model ?? 'custom-model',
        content: 'echo-ok',
        latencyMs: 1,
      };
    },
  }));

  const customService = createAiService({
    registry,
    configSource: {
      provider: 'custom-echo',
      apiKey: 'custom-key-123456',
      model: 'custom-v1',
      baseUrl: 'https://custom.example.test/v1',
    },
  });
  const customReply = await customService.complete({
    messages: [{ role: 'user', content: 'ping' }],
  });
  assert.equal(customReply.provider, 'custom-echo');
  assert.equal(customReply.content, 'echo-ok');
});

test('OpenAI and Anthropic adapters execute mocked completions and connection checks with proper headers and zero leaks', async () => {
  const openAiCalls: Array<{ url: string; method?: string; auth?: string; body?: unknown }> = [];
  const openAiSecret = 'sk-openai-live-mock-secret-9876';

  const openAiService = createAiService({
    configSource: {
      provider: 'openai',
      apiKey: openAiSecret,
      model: 'model-from-config',
      timeoutMs: 5000,
      maxRetries: 0,
    },
    adapterDeps: {
      httpClient: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        openAiCalls.push({
          url: String(input),
          method: init?.method,
          auth: headers.get('authorization') ?? undefined,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });
        if (String(input).endsWith('/models')) {
          return makeJsonResponse(200, { data: [{ id: 'model-from-config' }] });
        }
        return makeJsonResponse(200, {
          model: 'model-from-config',
          choices: [{ message: { content: 'Structured OpenAI test response' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        });
      }) as typeof fetch,
    },
  });

  const openAiResult = await openAiService.complete({
    messages: [{ role: 'user', content: 'Hello provider' }],
    requestId: 'req-openai-1',
  });
  assert.equal(openAiResult.provider, 'openai');
  assert.equal(openAiResult.content, 'Structured OpenAI test response');
  assert.equal(openAiResult.usage?.totalTokens, 15);
  assert.equal(openAiCalls[0]?.auth, `Bearer ${openAiSecret}`);

  const anthropicCalls: Array<{
    url: string;
    apiKeyHeader?: string;
    versionHeader?: string;
    body?: Record<string, unknown>;
  }> = [];
  const anthropicSecret = 'sk-ant-mock-secret-654321';

  const anthropicService = createAiService({
    configSource: {
      provider: 'anthropic',
      apiKey: anthropicSecret,
      model: 'anthropic-configured-model',
      timeoutMs: 5000,
      maxRetries: 0,
    },
    adapterDeps: {
      httpClient: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        anthropicCalls.push({
          url: String(input),
          apiKeyHeader: headers.get('x-api-key') ?? undefined,
          versionHeader: headers.get('anthropic-version') ?? undefined,
          body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined,
        });
        if (String(input).endsWith('/models')) {
          return makeJsonResponse(200, { data: [{ id: 'anthropic-configured-model' }] });
        }
        return makeJsonResponse(200, {
          model: 'anthropic-configured-model',
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Anthropic test response' }],
          usage: { input_tokens: 12, output_tokens: 6 },
        });
      }) as typeof fetch,
    },
  });

  const anthropicResult = await anthropicService.complete({
    messages: [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Ping' },
    ],
  });
  assert.equal(anthropicResult.provider, 'anthropic');
  assert.equal(anthropicResult.content, 'Anthropic test response');
  assert.equal(anthropicResult.usage?.totalTokens, 18);
  assert.equal(anthropicCalls[0]?.apiKeyHeader, anthropicSecret);
  assert.equal(anthropicCalls[0]?.versionHeader, '2023-06-01');
  assert.equal(anthropicCalls[0]?.body?.system, 'Be concise.');
  assert.deepEqual(anthropicCalls[0]?.body?.messages, [{ role: 'user', content: 'Ping' }]);
});

test('Adapters handle authentication failures, timeouts, rate limits with bounded retries, and unavailability without leaking keys', async () => {
  const secretKey = 'sk-super-secret-do-not-leak-1122';
  const capturedLogs: string[] = [];
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    capturedLogs.push(args.map(String).join(' '));
  };

  try {
    // 1. Auth failure (401) must not retry and must never leak secretKey
    let authAttempts = 0;
    const authFailService = createAiService({
      configSource: {
        provider: 'openai',
        apiKey: secretKey,
        model: 'configured-model',
        maxRetries: 3,
      },
      adapterDeps: {
        sleep: async () => {},
        httpClient: (async () => {
          authAttempts += 1;
          return makeJsonResponse(401, { error: { message: `Invalid API key ${secretKey}` } });
        }) as typeof fetch,
      },
    });

    await assert.rejects(
      () => authFailService.complete({ messages: [{ role: 'user', content: 'hi' }] }),
      (err: unknown) =>
        err instanceof AiProviderError &&
        err.code === 'AI_AUTHENTICATION_FAILED' &&
        !JSON.stringify(err.toSafeJSON()).includes(secretKey)
    );
    assert.equal(authAttempts, 1);

    // 2. Timeout triggers AbortController -> AI_TIMEOUT
    const timeoutService = createAiService({
      configSource: {
        provider: 'openai',
        apiKey: secretKey,
        model: 'configured-model',
        timeoutMs: 500,
        maxRetries: 0,
      },
      adapterDeps: {
        httpClient: ((_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          })) as typeof fetch,
      },
    });

    await assert.rejects(
      () => timeoutService.complete({ messages: [{ role: 'user', content: 'slow' }] }),
      (err: unknown) => err instanceof AiProviderError && err.code === 'AI_TIMEOUT'
    );

    // 3. Rate limit (429) retries strictly up to maxRetries then succeeds, or fails cleanly when exhausted
    let rateAttempts = 0;
    const rateRecoverService = createAiService({
      configSource: {
        provider: 'openai',
        apiKey: secretKey,
        model: 'configured-model',
        maxRetries: 1,
      },
      adapterDeps: {
        sleep: async () => {},
        httpClient: (async () => {
          rateAttempts += 1;
          if (rateAttempts === 1) {
            return makeJsonResponse(429, { error: 'rate limit' }, { 'retry-after': '0' });
          }
          return makeJsonResponse(200, {
            choices: [{ message: { content: 'Recovered after rate limit' } }],
          });
        }) as typeof fetch,
      },
    });
    const recovered = await rateRecoverService.complete({ messages: [{ role: 'user', content: 'retry' }] });
    assert.equal(recovered.content, 'Recovered after rate limit');
    assert.equal(rateAttempts, 2);

    let exhaustedAttempts = 0;
    const rateExhaustedService = createAiService({
      configSource: {
        provider: 'openai',
        apiKey: secretKey,
        model: 'configured-model',
        maxRetries: 2,
      },
      adapterDeps: {
        sleep: async () => {},
        httpClient: (async () => {
          exhaustedAttempts += 1;
          return makeJsonResponse(429, { error: 'still rate limited' });
        }) as typeof fetch,
      },
    });
    await assert.rejects(
      () => rateExhaustedService.complete({ messages: [{ role: 'user', content: 'fail' }] }),
      (err: unknown) => err instanceof AiProviderError && err.code === 'AI_RATE_LIMITED'
    );
    assert.equal(exhaustedAttempts, 3);

    // 4. Provider 503 / unreachable -> AI_PROVIDER_UNAVAILABLE
    const unavailableService = createAiService({
      configSource: {
        provider: 'anthropic',
        apiKey: secretKey,
        model: 'configured-model',
        maxRetries: 0,
      },
      adapterDeps: {
        httpClient: (async () => makeJsonResponse(503, { error: 'overloaded' })) as typeof fetch,
      },
    });
    await assert.rejects(
      () => unavailableService.complete({ messages: [{ role: 'user', content: 'check' }] }),
      (err: unknown) => err instanceof AiProviderError && err.code === 'AI_PROVIDER_UNAVAILABLE'
    );

    // 5. Missing config / missing key service handles calls gracefully
    const unconfiguredService = createAiService({ configSource: {} });
    assert.equal(unconfiguredService.isConfigured(), false);
    assert.equal(unconfiguredService.getReadiness().status, 'unavailable');
    await assert.rejects(
      () => unconfiguredService.complete({ messages: [{ role: 'user', content: 'check' }] }),
      (err: unknown) => err instanceof AiProviderError && err.code === 'AI_NOT_CONFIGURED'
    );

    // Verify secret redaction utility & absence in logs
    const redacted = redactAiSecrets(
      `Authorization: Bearer ${secretKey} failed at https://api.test?api_key=abc123`,
      [secretKey]
    );
    assert.equal(redacted.includes(secretKey), false);
    assert.equal(redacted.includes('abc123'), false);
    assert.equal(capturedLogs.join('\n').includes(secretKey), false);
  } finally {
    console.error = origError;
  }
});

test('AI health service distinguishes readiness states, caches live probes, and preserves stub exports', async () => {
  const secretKey = 'sk-health-secret-998877';

  assert.equal(createAiHealthService({ configSource: {} }).getStatus().status, 'unavailable');
  assert.equal(
    createAiHealthService({ configSource: { provider: 'openai' } }).getStatus().status,
    'api_key_missing'
  );
  assert.equal(
    createAiHealthService({ configSource: { provider: 'bad-provider', apiKey: secretKey } }).getStatus()
      .status,
    'invalid_configuration'
  );

  let probeCount = 0;
  let fakeNow = 1_000_000;
  const cachedHealth = createAiHealthService({
    configSource: {
      provider: 'openai',
      apiKey: secretKey,
      model: 'configured-model',
      timeoutMs: 2000,
    },
    cacheTtlMs: 30_000,
    now: () => fakeNow,
    adapterDeps: {
      httpClient: (async () => {
        probeCount += 1;
        return makeJsonResponse(200, { data: [{ id: 'model-a' }] });
      }) as typeof fetch,
    },
  });

  // Config-only check makes zero network calls
  const configOnly = await cachedHealth.checkHealth({ verifyConnection: false });
  assert.equal(configOnly.status, 'configured');
  assert.equal(configOnly.connected, null);
  assert.equal(probeCount, 0);

  // Live probe verifies connectivity and caches within TTL
  const ready = await cachedHealth.checkHealth({ verifyConnection: true });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.connected, true);
  assert.equal(ready.available, true);
  assert.equal(probeCount, 1);

  const cachedAgain = await cachedHealth.checkHealth({ verifyConnection: true });
  assert.equal(cachedAgain.status, 'ready');
  assert.equal(probeCount, 1);
  assert.equal(JSON.stringify(cachedAgain).includes(secretKey), false);
  assert.equal(JSON.stringify(cachedAgain).includes('https://'), false);

  // Timeout health state
  const timedOutHealth = createAiHealthService({
    configSource: {
      provider: 'openai',
      apiKey: secretKey,
      timeoutMs: 500,
    },
    cacheTtlMs: 0,
    adapterDeps: {
      httpClient: ((_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const abortErr = new Error('timeout');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        })) as typeof fetch,
    },
  });
  const timeoutReport = await timedOutHealth.checkHealth({ verifyConnection: true });
  assert.equal(timeoutReport.status, 'timed_out');
  assert.equal(timeoutReport.connected, false);
  assert.equal(timeoutReport.available, false);

  // Existing business feature stubs remain safe no-ops in Phase 2.6.1
  assert.deepEqual(await analyzeResume('Sample resume text'), {});
  assert.deepEqual(await getSkillGap(['TypeScript'], ['Node.js']), []);
});

test('GET /api/admin/ai/health enforces Admin RBAC and returns sanitized non-secret payload', async () => {
  const unauthResp = await dispatchToApp('/api/admin/ai/health');
  assert.equal(unauthResp.status, 401);

  const seekerId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  let mode: 'seeker' | 'admin' = 'seeker';
  const origFindById = User.findById;

  (User as any).findById = () => ({
    select: async () => ({
      _id: mode === 'admin' ? adminId : seekerId,
      id: String(mode === 'admin' ? adminId : seekerId),
      name: mode === 'admin' ? 'Admin' : 'Seeker',
      email: mode === 'admin' ? 'admin@skillorbit.ai' : 'seeker@skillorbit.ai',
      role: mode,
      isActive: true,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  });

  try {
    mode = 'seeker';
    const seekerCookie = `${AUTH_COOKIE_NAME}=${generateToken(String(seekerId))}`;
    const forbiddenResp = await dispatchToApp('/api/admin/ai/health', 'GET', {
      headers: { cookie: seekerCookie },
    });
    assert.equal(forbiddenResp.status, 403);

    mode = 'admin';
    const adminCookie = `${AUTH_COOKIE_NAME}=${generateToken(String(adminId))}`;
    const adminResp = await dispatchToApp('/api/admin/ai/health', 'GET', {
      headers: { cookie: adminCookie },
    });
    assert.equal(adminResp.status, 200);
    const json = (await adminResp.json()) as {
      success: boolean;
      data?: { ai?: Record<string, unknown> };
    };
    assert.equal(json.success, true);
    assert.ok(json.data?.ai);
    assert.equal('apiKey' in json.data.ai, false);
    assert.equal('baseUrl' in json.data.ai, false);
    assert.equal(JSON.stringify(json).includes('test-only'), false);
  } finally {
    (User as any).findById = origFindById;
  }
});
