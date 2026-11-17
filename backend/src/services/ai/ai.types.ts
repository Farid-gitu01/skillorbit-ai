/**
 * Provider-independent AI service contracts and configuration types.
 */

export const BUILTIN_AI_PROVIDERS = ['openai', 'openai-compatible', 'anthropic', 'gemini'] as const;

export type BuiltinAiProvider = (typeof BUILTIN_AI_PROVIDERS)[number];

/**
 * Provider identifier string. Built-in adapters cover `openai`, `openai-compatible`,
 * `anthropic`, and `gemini`; custom adapters may also be registered via AiProviderRegistry.
 */
export type AiProviderName = BuiltinAiProvider | (string & {});

export type AiMessageRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiMessageRole;
  content: string;
}

export interface AiCompletionRequest {
  messages: AiChatMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  requestId?: string;
  feature?: string;
  maxOutputChars?: number;
}

export interface AiTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AiCompletionResponse {
  provider: string;
  model: string;
  content: string;
  finishReason?: string;
  usage?: AiTokenUsage;
  latencyMs: number;
  requestId?: string;
}

export interface AiConnectionCheckResult {
  connected: boolean;
  provider: string;
  latencyMs: number;
  modelCount?: number;
}

export type AiReadinessState =
  | 'configured'
  | 'ready'
  | 'api_key_missing'
  | 'invalid_configuration'
  | 'unavailable'
  | 'timed_out';

export interface AiHealthReport {
  status: AiReadinessState;
  configured: boolean;
  available: boolean;
  connected: boolean | null;
  provider: string | null;
  modelConfigured: boolean;
  checkedAt: string;
  latencyMs?: number;
  message: string;
}

export interface RawAiConfigInput {
  provider?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number | string;
  maxRetries?: number | string;
}

export interface AiProviderConfig {
  provider: string;
  apiKey: string;
  model?: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries: number;
}

export type AiConfigStatus =
  | 'configured'
  | 'unconfigured'
  | 'api_key_missing'
  | 'invalid_configuration';

export type AiConfigIssueCode =
  | 'AI_NOT_CONFIGURED'
  | 'AI_API_KEY_MISSING'
  | 'AI_UNSUPPORTED_PROVIDER'
  | 'AI_INVALID_CONFIGURATION';

export type AiConfigInspection =
  | {
      status: 'configured';
      provider: string;
      modelConfigured: boolean;
      config: AiProviderConfig;
    }
  | {
      status: 'unconfigured' | 'api_key_missing' | 'invalid_configuration';
      provider: string | null;
      modelConfigured: boolean;
      code: AiConfigIssueCode;
      message: string;
      issues?: Array<{ field: string; message: string }>;
    };

export type AiHttpClient = typeof fetch;

export type SleepFn = (delayMs: number) => Promise<void>;

export interface AiAdapterDependencies {
  httpClient?: AiHttpClient;
  sleep?: SleepFn;
}

export interface AiProviderAdapter {
  readonly provider: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
  checkConnection(options?: { timeoutMs?: number }): Promise<AiConnectionCheckResult>;
}

export interface AiExecutionMetadata {
  requestId: string;
  feature: string;
  promptId?: string;
  promptVersion?: string;
  provider: string;
  model: string;
  timestamp: string;
  durationMs: number;
  finishReason?: string;
  usage?: AiTokenUsage;
}

export interface AiTextExecutionResult {
  content: string;
  metadata: AiExecutionMetadata;
}

export interface AiStructuredExecutionResult<TData> {
  data: TData;
  rawContentLength: number;
  metadata: AiExecutionMetadata;
}

export interface AiUsageRecord {
  requestId: string;
  feature: string;
  promptId?: string;
  promptVersion?: string;
  provider: string;
  model: string;
  timestamp: string;
  durationMs: number;
  status: 'success' | 'failure';
  errorCode?: string;
  tokenUsage?: AiTokenUsage;
}

export interface AiUsageBucketSummary {
  requests: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  totalTokens: number;
}

export interface AiUsageSummary {
  totalRequests: number;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  byFeature: Record<string, AiUsageBucketSummary>;
  byProvider: Record<string, AiUsageBucketSummary>;
}

export interface AiUsageTracker {
  record(entry: AiUsageRecord): Promise<void> | void;
  getSummary?(): AiUsageSummary;
  getRecent?(limit?: number): ReadonlyArray<AiUsageRecord>;
  clear?(): void;
}
