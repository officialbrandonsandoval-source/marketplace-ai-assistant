interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface SuggestionCacheOptions {
  ttlMs: number;
  maxEntries: number;
}

export class SuggestionCache<T> {
  private readonly entries = new Map<string, CacheEntry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();

  constructor(private readonly options: SuggestionCacheOptions) {}

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + this.options.ttlMs,
    });
    this.evictOldestEntries();
  }

  getOrCreate(key: string, factory: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached) {
      return Promise.resolve(cached);
    }

    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const request = factory()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }

  clear(): void {
    this.entries.clear();
    this.inFlight.clear();
  }

  private evictOldestEntries(): void {
    while (this.entries.size > this.options.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (!oldestKey) {
        return;
      }
      this.entries.delete(oldestKey);
    }
  }
}

export function stableSuggestionCacheKey(payload: Record<string, unknown>): string {
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageTimestamp = isRecord(lastMessage) && typeof lastMessage.timestamp === 'number'
    ? lastMessage.timestamp
    : null;

  return JSON.stringify({
    threadId: asString(payload.threadId),
    listingTitle: asString(payload.listingTitle),
    listingPrice: asString(payload.listingPrice),
    listingUrl: asString(payload.listingUrl),
    conversationGoal: asString(payload.conversationGoal),
    quickQuestion: asString(payload.quickQuestion),
    customInstructions: asString(payload.customInstructions),
    savedPresetId: asString(payload.savedPresetId),
    messageCount: messages.length,
    lastMessageTimestamp,
  });
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
