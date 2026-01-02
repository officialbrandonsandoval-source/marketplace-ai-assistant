import { redis } from '../redis/client.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerSnapshot {
  state: CircuitState;
  failureCount: number;
  lastFailureAt: number | null;
  nextAttemptAt: number | null;
}

const CIRCUIT_KEY = 'claude:circuit';
const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 30_000;
const HALF_OPEN_MAX_FAILURES = 1;
const STATE_TTL_SECONDS = 120;

function getDefaultState(): CircuitBreakerSnapshot {
  return {
    state: 'closed',
    failureCount: 0,
    lastFailureAt: null,
    nextAttemptAt: null,
  };
}

async function loadState(): Promise<CircuitBreakerSnapshot> {
  const raw = await redis.get(CIRCUIT_KEY);
  if (!raw) {
    return getDefaultState();
  }
  try {
    const parsed = JSON.parse(raw) as CircuitBreakerSnapshot;
    if (
      (parsed.state === 'closed' || parsed.state === 'open' || parsed.state === 'half_open') &&
      typeof parsed.failureCount === 'number'
    ) {
      return parsed;
    }
  } catch {
    // Ignore invalid JSON
  }
  return getDefaultState();
}

async function saveState(state: CircuitBreakerSnapshot): Promise<void> {
  await redis.set(CIRCUIT_KEY, JSON.stringify(state), 'EX', STATE_TTL_SECONDS);
}

export async function assertCircuitClosed(): Promise<void> {
  const now = Date.now();
  const state = await loadState();

  if (state.state === 'open') {
    if (state.nextAttemptAt && now >= state.nextAttemptAt) {
      await saveState({
        ...state,
        state: 'half_open',
        nextAttemptAt: null,
      });
      return;
    }
    throw new Error('CLAUDE_CIRCUIT_OPEN');
  }
}

export async function recordSuccess(): Promise<void> {
  const state = await loadState();
  if (state.state !== 'closed' || state.failureCount !== 0) {
    await saveState({
      state: 'closed',
      failureCount: 0,
      lastFailureAt: null,
      nextAttemptAt: null,
    });
  }
}

export async function recordFailure(): Promise<void> {
  const now = Date.now();
  const state = await loadState();
  const failureCount = state.failureCount + 1;

  if (state.state === 'half_open' && failureCount >= HALF_OPEN_MAX_FAILURES) {
    await saveState({
      state: 'open',
      failureCount,
      lastFailureAt: now,
      nextAttemptAt: now + OPEN_DURATION_MS,
    });
    return;
  }

  if (failureCount >= FAILURE_THRESHOLD) {
    await saveState({
      state: 'open',
      failureCount,
      lastFailureAt: now,
      nextAttemptAt: now + OPEN_DURATION_MS,
    });
    return;
  }

  await saveState({
    state: 'closed',
    failureCount,
    lastFailureAt: now,
    nextAttemptAt: null,
  });
}
