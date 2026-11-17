import {
  type AiUsageBucketSummary,
  type AiUsageRecord,
  type AiUsageSummary,
  type AiUsageTracker,
} from './ai.types.js';

const DEFAULT_MAX_HISTORY_ENTRIES = 500;

function sanitizeUsageEntry(entry: AiUsageRecord): AiUsageRecord {
  const sanitizedTokens = entry.tokenUsage
    ? {
        ...(typeof entry.tokenUsage.inputTokens === 'number'
          ? { inputTokens: Math.max(0, entry.tokenUsage.inputTokens) }
          : {}),
        ...(typeof entry.tokenUsage.outputTokens === 'number'
          ? { outputTokens: Math.max(0, entry.tokenUsage.outputTokens) }
          : {}),
        ...(typeof entry.tokenUsage.totalTokens === 'number'
          ? { totalTokens: Math.max(0, entry.tokenUsage.totalTokens) }
          : {}),
      }
    : undefined;

  return {
    requestId: entry.requestId.slice(0, 128),
    feature: entry.feature.slice(0, 80),
    ...(entry.promptId ? { promptId: entry.promptId.slice(0, 80) } : {}),
    ...(entry.promptVersion ? { promptVersion: entry.promptVersion.slice(0, 32) } : {}),
    provider: entry.provider.slice(0, 64),
    model: entry.model.slice(0, 128),
    timestamp: entry.timestamp,
    durationMs: Math.max(0, Math.round(entry.durationMs)),
    status: entry.status,
    ...(entry.errorCode ? { errorCode: entry.errorCode.slice(0, 64) } : {}),
    ...(sanitizedTokens && Object.keys(sanitizedTokens).length > 0
      ? { tokenUsage: sanitizedTokens }
      : {}),
  };
}

function updateBucket(
  buckets: Record<string, AiUsageBucketSummary>,
  key: string,
  entry: AiUsageRecord,
  tokens: number
): void {
  const existing = buckets[key] ?? {
    requests: 0,
    successCount: 0,
    failureCount: 0,
    totalDurationMs: 0,
    totalTokens: 0,
  };

  existing.requests += 1;
  if (entry.status === 'success') {
    existing.successCount += 1;
  } else {
    existing.failureCount += 1;
  }
  existing.totalDurationMs += entry.durationMs;
  existing.totalTokens += tokens;
  buckets[key] = existing;
}

/**
 * Lightweight bounded in-memory AI telemetry tracker.
 * Stores non-sensitive execution metadata only (never stores prompts, responses, or keys).
 */
export class InMemoryAiUsageTracker implements AiUsageTracker {
  private readonly maxEntries: number;
  private readonly records: AiUsageRecord[] = [];
  private summary: AiUsageSummary;

  constructor(maxEntries = DEFAULT_MAX_HISTORY_ENTRIES) {
    this.maxEntries = Math.max(10, Math.min(maxEntries, 5_000));
    this.summary = this.createEmptySummary();
  }

  private createEmptySummary(): AiUsageSummary {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalDurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      byFeature: {},
      byProvider: {},
    };
  }

  record(entry: AiUsageRecord): void {
    const safeEntry = sanitizeUsageEntry(entry);

    if (this.records.length >= this.maxEntries) {
      this.records.shift();
    }
    this.records.push(safeEntry);

    const inputTokens = safeEntry.tokenUsage?.inputTokens ?? 0;
    const outputTokens = safeEntry.tokenUsage?.outputTokens ?? 0;
    const totalTokens =
      safeEntry.tokenUsage?.totalTokens ?? inputTokens + outputTokens;

    this.summary.totalRequests += 1;
    if (safeEntry.status === 'success') {
      this.summary.successCount += 1;
    } else {
      this.summary.failureCount += 1;
    }
    this.summary.totalDurationMs += safeEntry.durationMs;
    this.summary.totalInputTokens += inputTokens;
    this.summary.totalOutputTokens += outputTokens;
    this.summary.totalTokens += totalTokens;

    updateBucket(this.summary.byFeature, safeEntry.feature, safeEntry, totalTokens);
    updateBucket(this.summary.byProvider, safeEntry.provider, safeEntry, totalTokens);
  }

  getSummary(): AiUsageSummary {
    const byFeature: Record<string, AiUsageBucketSummary> = {};
    for (const [k, v] of Object.entries(this.summary.byFeature)) {
      byFeature[k] = { ...v };
    }
    const byProvider: Record<string, AiUsageBucketSummary> = {};
    for (const [k, v] of Object.entries(this.summary.byProvider)) {
      byProvider[k] = { ...v };
    }

    return {
      ...this.summary,
      byFeature,
      byProvider,
    };
  }

  getRecent(limit = 50): ReadonlyArray<AiUsageRecord> {
    const count = Math.max(1, Math.min(limit, this.maxEntries));
    return this.records.slice(-count).map((item) => ({ ...item }));
  }

  clear(): void {
    this.records.length = 0;
    this.summary = this.createEmptySummary();
  }
}

export class NoopAiUsageTracker implements AiUsageTracker {
  record(_entry: AiUsageRecord): void {
    // Intentionally a no-op
  }

  getSummary(): AiUsageSummary {
    return {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      totalDurationMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      byFeature: {},
      byProvider: {},
    };
  }

  getRecent(): ReadonlyArray<AiUsageRecord> {
    return [];
  }
}
