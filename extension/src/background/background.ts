/**
 * Background Service Worker Entry Point
 * Manifest V3 service worker - responsible for:
 * - API communication with backend
 * - JWT token management (access + refresh)
 * - Message passing coordination
 * - Persistent storage management
 */

import { logger } from '@/utils/logger.ts';

// Service worker state (reset on worker restart)
interface ServiceWorkerState {
  isAuthenticated: boolean;
}

const state: ServiceWorkerState = {
  isAuthenticated: false,
};

const API_BASE_URL = 'https://marketplace-ai-assistant.onrender.com';
const UPGRADE_URL = 'mailto:support@marketplace-ai-assistant.com?subject=Upgrade%20Request';

interface SuggestionResponse {
  suggestedMessage: string;
  intentScore: number;
  reasoning: string;
  nextAction: 'ask_availability' | 'send_booking_link' | 'answer_question' | 'close';
}

interface SuggestionJobResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  suggestion: SuggestionResponse | null;
  error: string | null;
  updatedAt: string;
}

type BackgroundMessage =
  | { type: 'LOGIN_SUCCESS'; payload: { accessToken: string; deviceFingerprint?: string } }
  | { type: 'REQUEST_SUGGESTION'; payload: unknown }
  | { type: 'OPEN_UPGRADE_URL' };

type BackgroundResponse =
  | SuggestionResponse
  | { success: true }
  | { success: false; error: string }
  | { error: string };

/**
 * Service worker installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  logger.info({ reason: details.reason }, 'Extension installed/updated');
  void initializeAuthentication();
});

/**
 * Service worker activation
 */
chrome.runtime.onStartup.addListener(async () => {
  logger.info('Service worker starting up');
  const accessToken = await getAccessToken();
  state.isAuthenticated = Boolean(accessToken);
});

/**
 * Message handler from content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: BackgroundResponse) => void
  ): boolean => {
    try {
      if (isLoginSuccessMessage(message)) {
        storeAccessToken(message.payload.accessToken, message.payload.deviceFingerprint)
          .then(() => sendResponse({ success: true }))
          .catch((error: Error) => sendResponse({ success: false, error: error.message }));
        return true;
      }

      if (isRequestSuggestionMessage(message)) {
        handleSuggestionRequest(message.payload)
          .then((response) => sendResponse(response))
          .catch((error: Error) => sendResponse({ error: error.message }));
        return true;
      }

      if (isOpenUpgradeMessage(message)) {
        if (!chrome.tabs || !chrome.tabs.create) {
          sendResponse({ success: false, error: 'Upgrade URL unavailable' });
          return true;
        }

        chrome.tabs.create({ url: UPGRADE_URL }, () => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            const errMessage = lastError.message || 'Failed to open upgrade URL';
            sendResponse({ success: false, error: errMessage });
          } else {
            sendResponse({ success: true });
          }
        });
        return true;
      }

      sendResponse({ success: false, error: 'Unknown message type' });
      return true;
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      sendResponse({ success: false, error: messageText });
      return false;
    }
  }
);

async function initializeAuthentication(): Promise<void> {
  try {
    const deviceFingerprint = await getOrCreateDeviceFingerprint();
    const accessToken = await loginDevice(deviceFingerprint);
    await storeAccessToken(accessToken, deviceFingerprint);
    state.isAuthenticated = true;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize authentication');
  }
}

async function loginDevice(deviceFingerprint: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceFingerprint }),
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `Login failed: ${response.status}`);
  }

  const data = (await response.json()) as { accessToken?: string };
  if (!data.accessToken) {
    throw new Error('Login failed: accessToken missing');
  }

  return data.accessToken;
}

async function handleSuggestionRequest(payload: unknown): Promise<SuggestionResponse> {
  if (!isRecord(payload)) {
    throw new Error('Invalid suggestion payload');
  }

  const conversationGoal = typeof payload.conversationGoal === 'string'
    ? payload.conversationGoal
    : 'general_assistance';
  const requestPayload = {
    ...payload,
    conversationGoal,
  };

  let accessToken = await getAccessTokenOrLogin();
  let jobResult: SuggestionJobResult;

  try {
    jobResult = await createSuggestionJob(accessToken, requestPayload);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
      await clearAccessToken();
      state.isAuthenticated = false;
      accessToken = await getAccessTokenOrLogin();
      jobResult = await createSuggestionJob(accessToken, requestPayload);
    } else {
      throw error;
    }
  }

  if (jobResult.status === 'failed') {
    throw new Error(jobResult.error || 'Suggestion request failed');
  }

  if (jobResult.status === 'completed' && jobResult.suggestion) {
    return jobResult.suggestion;
  }

  try {
    return await pollSuggestionResult(accessToken, jobResult.jobId);
  } catch (error) {
    if (error instanceof Error && error.message === 'AUTH_EXPIRED') {
      await clearAccessToken();
      state.isAuthenticated = false;
      accessToken = await getAccessTokenOrLogin();
      return await pollSuggestionResult(accessToken, jobResult.jobId);
    }
    throw error;
  }
}

async function getAccessTokenOrLogin(): Promise<string> {
  const existingToken = await getAccessToken();
  if (existingToken) {
    return existingToken;
  }

  const deviceFingerprint = await getOrCreateDeviceFingerprint();
  const accessToken = await loginDevice(deviceFingerprint);
  await storeAccessToken(accessToken, deviceFingerprint);
  state.isAuthenticated = true;
  return accessToken;
}

async function extractErrorMessage(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as { message?: string; error?: string };
    return data.message ?? data.error ?? null;
  } catch {
    return null;
  }
}

async function createSuggestionJob(
  accessToken: string,
  payload: Record<string, unknown>
): Promise<SuggestionJobResult> {
  const response = await fetch(`${API_BASE_URL}/suggest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `API error: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!isSuggestionJobResult(data)) {
    throw new Error('Invalid suggestion job response');
  }

  return data;
}

async function fetchSuggestionStatus(
  accessToken: string,
  jobId: string
): Promise<SuggestionJobResult> {
  const response = await fetch(`${API_BASE_URL}/suggest/${jobId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error('AUTH_EXPIRED');
  }

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message || `API error: ${response.status}`);
  }

  const data = (await response.json()) as unknown;
  if (!isSuggestionJobResult(data)) {
    throw new Error('Invalid suggestion status response');
  }

  return data;
}

async function pollSuggestionResult(
  accessToken: string,
  jobId: string
): Promise<SuggestionResponse> {
  const pollIntervalMs = 1000;
  const timeoutMs = 60_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await fetchSuggestionStatus(accessToken, jobId);

    if (result.status === 'completed') {
      if (result.suggestion) {
        return result.suggestion;
      }
      throw new Error('Suggestion missing from completed job');
    }

    if (result.status === 'failed') {
      throw new Error(result.error || 'Suggestion generation failed');
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Suggestion timed out');
}

async function getAccessToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(['access_token']);
  return typeof result.access_token === 'string' ? result.access_token : null;
}

async function storeAccessToken(accessToken: string, deviceFingerprint?: string): Promise<void> {
  const payload: Record<string, string> = { access_token: accessToken };
  if (deviceFingerprint) {
    payload.device_fingerprint = deviceFingerprint;
  }
  await chrome.storage.local.set(payload);
}

async function clearAccessToken(): Promise<void> {
  await chrome.storage.local.remove(['access_token']);
}

async function getOrCreateDeviceFingerprint(): Promise<string> {
  const result = await chrome.storage.local.get(['device_fingerprint']);
  const existing = result.device_fingerprint;

  if (typeof existing === 'string' && existing.length >= 10) {
    return existing;
  }

  const fingerprint = crypto.randomUUID();
  await chrome.storage.local.set({ device_fingerprint: fingerprint });
  return fingerprint;
}

function isSuggestionResponse(value: unknown): value is SuggestionResponse {
  return isRecord(value) &&
    typeof value.suggestedMessage === 'string' &&
    typeof value.intentScore === 'number' &&
    typeof value.reasoning === 'string' &&
    typeof value.nextAction === 'string';
}

function isSuggestionJobResult(value: unknown): value is SuggestionJobResult {
  return isRecord(value) &&
    typeof value.jobId === 'string' &&
    typeof value.status === 'string' &&
    (value.suggestion === null || isSuggestionResponse(value.suggestion)) &&
    (value.error === null || typeof value.error === 'string');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLoginSuccessMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'LOGIN_SUCCESS' }> {
  return isRecord(message) &&
    message.type === 'LOGIN_SUCCESS' &&
    isRecord(message.payload) &&
    typeof message.payload.accessToken === 'string';
}

function isRequestSuggestionMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'REQUEST_SUGGESTION' }> {
  return isRecord(message) &&
    message.type === 'REQUEST_SUGGESTION' &&
    'payload' in message;
}

function isOpenUpgradeMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'OPEN_UPGRADE_URL' }> {
  return isRecord(message) && message.type === 'OPEN_UPGRADE_URL';
}

logger.info('Background service worker loaded');
