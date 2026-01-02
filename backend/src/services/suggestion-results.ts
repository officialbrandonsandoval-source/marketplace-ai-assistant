import { redis } from '../redis/client.js';
import type { SuggestionResponse } from '../types/index.js';

export type SuggestionJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface SuggestionJobResult {
  jobId: string;
  status: SuggestionJobStatus;
  suggestion: SuggestionResponse | null;
  error: string | null;
  updatedAt: string;
}

const RESULT_TTL_SECONDS = 60 * 60 * 24;

export function suggestionResultKey(accountId: string, jobId: string): string {
  return `suggestion:${accountId}:${jobId}`;
}

export async function setSuggestionResult(
  accountId: string,
  jobId: string,
  result: SuggestionJobResult
): Promise<void> {
  const key = suggestionResultKey(accountId, jobId);
  await redis.set(key, JSON.stringify(result), 'EX', RESULT_TTL_SECONDS);
}

export async function getSuggestionResult(
  accountId: string,
  jobId: string
): Promise<SuggestionJobResult | null> {
  const key = suggestionResultKey(accountId, jobId);
  const raw = await redis.get(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SuggestionJobResult;
    if (
      typeof parsed.jobId !== 'string' ||
      typeof parsed.status !== 'string' ||
      typeof parsed.updatedAt !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
