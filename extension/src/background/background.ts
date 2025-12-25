/**
 * Background Service Worker Entry Point
 * Manifest V3 service worker - responsible for:
 * - API communication with backend
 * - JWT token management (access + refresh)
 * - Message passing coordination
 * - Persistent storage management
 */

import type { ThreadContext } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

// Service worker state (reset on worker restart)
interface ServiceWorkerState {
  isAuthenticated: boolean;
  tokenRefreshInProgress: boolean;
}

const state: ServiceWorkerState = {
  isAuthenticated: false,
  tokenRefreshInProgress: false,
};

const API_BASE_URL = 'https://marketplace-ai-assistant.onrender.com';

interface SuggestionRequest {
  threadId: string;
  fbThreadId: string;
  listingId: string | null;
  listingTitle: string | null;
  listingPrice: string | null;
  listingUrl: string | null;
  messages: Array<{
    senderId: string;
    text: string;
    timestamp: number;
    isUser: boolean;
  }>;
}

interface SuggestionResponse {
  suggestedMessage: string;
  intentScore: number;
  reasoning: string;
  nextAction: 'ask_availability' | 'send_booking_link' | 'answer_question' | 'close';
}

type SuggestionPayload = SuggestionRequest | ThreadContext;

type BackgroundMessage =
  | { type: 'LOGIN_SUCCESS'; payload: { accessToken: string; refreshToken: string } }
  | { type: 'REQUEST_SUGGESTION'; payload: SuggestionPayload }
  | { type: 'LOGOUT' };

type BackgroundResponse =
  | { success: true }
  | { success: false; error: string }
  | SuggestionResponse
  | { error: string };

/**
 * Service worker installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  logger.info({ reason: details.reason }, 'Extension installed/updated');

  if (details.reason === 'install') {
    // First time installation
    logger.info('First time installation - opening onboarding');
    // TODO Phase 3: Open onboarding/login page
  } else if (details.reason === 'update') {
    logger.info({ previousVersion: details.previousVersion }, 'Extension updated');
  }
});

/**
 * Service worker activation
 * Check authentication status on startup
 */
chrome.runtime.onStartup.addListener(async () => {
  logger.info('Service worker starting up');

  try {
    const jwt = await getJwt();
    state.isAuthenticated = Boolean(jwt);
    logger.info({ isAuthenticated: state.isAuthenticated }, 'Auth status checked on startup');
  } catch (error) {
    logger.error({ error }, 'Error checking authentication on startup');
  }
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
    if (isLoginSuccessMessage(message)) {
      saveJwt(message.payload.accessToken, message.payload.refreshToken)
        .then(() => sendResponse({ success: true }))
        .catch((error: Error) =>
          sendResponse({
            success: false,
            error: error.message,
          })
        );
      return true;
    }

    if (isRequestSuggestionMessage(message)) {
      handleSuggestionRequest(message.payload)
        .then((response) => sendResponse(response))
        .catch((error: Error) => sendResponse({ error: error.message }));
      return true;
    }

    if (isLogoutMessage(message)) {
      clearJwt()
        .then(() => sendResponse({ success: true }))
        .catch((error: Error) =>
          sendResponse({
            success: false,
            error: error.message,
          })
        );
      return true;
    }

    sendResponse({ success: false, error: 'Unknown message type' });
    return true;
  }
);

/**
 * JWT Storage (chrome.storage.local only, NEVER exposed to content scripts)
 */
async function saveJwt(accessToken: string, refreshToken: string): Promise<void> {
  await chrome.storage.local.set({
    jwt: accessToken,
    refresh_jwt: refreshToken,
    jwt_expires_at: Date.now() + 3600000,
  });
  state.isAuthenticated = true;
}

async function getJwt(): Promise<string | null> {
  const result = await chrome.storage.local.get(['jwt', 'jwt_expires_at']);

  if (!result.jwt) return null;

  if (result.jwt_expires_at && Date.now() > result.jwt_expires_at) {
    await clearJwt();
    return null;
  }

  return result.jwt as string;
}

async function clearJwt(): Promise<void> {
  await chrome.storage.local.remove(['jwt', 'refresh_jwt', 'jwt_expires_at']);
  state.isAuthenticated = false;
}

async function handleSuggestionRequest(payload: SuggestionPayload): Promise<SuggestionResponse> {
  let jwt = await getJwt();

  if (!jwt) {
    await loginWithDeviceFingerprint();
    jwt = await getJwt();
  }

  if (!jwt) {
    throw new Error('Not authenticated. Please log in.');
  }

  const request = normalizeSuggestionPayload(payload);

  try {
    const response = await fetch(`${API_BASE_URL}/suggest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify(request),
    });

    if (response.status === 401) {
      await clearJwt();
      throw new Error('Session expired. Please log in again.');
    }

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please upgrade your plan or try again later.');
    }

    if (!response.ok) {
      let errorMessage = `API error: ${response.status}`;
      try {
        const errorData = (await response.json()) as { message?: string };
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch {
        // Ignore JSON parse failures for non-JSON responses
      }
      throw new Error(errorMessage);
    }

    const data = (await response.json()) as unknown;
    if (!isSuggestionResponse(data)) {
      throw new Error('Invalid suggestion response from backend');
    }

    if (data.suggestedMessage.trim() === 'Phase 3 stub: Backend connected successfully!') {
      throw new Error('Backend returned placeholder response');
    }

    return data;
  } catch (error) {
    logger.error({ error }, '[Background] Suggestion request failed');
    throw error;
  }
}

async function loginWithDeviceFingerprint(): Promise<void> {
  const deviceFingerprint = await getOrCreateDeviceFingerprint();

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deviceFingerprint }),
  });

  if (!response.ok) {
    let errorMessage = `Login failed: ${response.status}`;
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse failures for non-JSON responses
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as { accessToken?: string; refreshToken?: string };
  if (!data.accessToken || !data.refreshToken) {
    throw new Error('Login failed: missing tokens');
  }

  await saveJwt(data.accessToken, data.refreshToken);
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

function normalizeSuggestionPayload(payload: SuggestionPayload): SuggestionRequest {
  if (isSuggestionRequest(payload)) {
    return payload;
  }

  const listing = payload.listingData;
  const listingId = listing?.id ?? null;
  const listingUrl = listingId && /^\d+$/.test(listingId)
    ? `https://www.facebook.com/marketplace/item/${listingId}`
    : null;

  return {
    threadId: payload.threadId,
    fbThreadId: payload.threadId,
    listingId,
    listingTitle: listing?.title ?? null,
    listingPrice: listing ? String(listing.price) : null,
    listingUrl,
    messages: payload.messages.map((message) => ({
      senderId: message.senderType,
      text: message.text,
      timestamp: message.timestamp,
      isUser: message.senderType === 'user',
    })),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuggestionRequest(payload: SuggestionPayload): payload is SuggestionRequest {
  return isRecord(payload) &&
    typeof payload.threadId === 'string' &&
    typeof payload.fbThreadId === 'string' &&
    ('listingId' in payload) &&
    Array.isArray(payload.messages);
}

function isSuggestionResponse(value: unknown): value is SuggestionResponse {
  return isRecord(value) &&
    typeof value.suggestedMessage === 'string' &&
    typeof value.intentScore === 'number' &&
    typeof value.reasoning === 'string' &&
    typeof value.nextAction === 'string';
}

function isLoginSuccessMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'LOGIN_SUCCESS' }> {
  return isRecord(message) &&
    message.type === 'LOGIN_SUCCESS' &&
    isRecord(message.payload) &&
    typeof message.payload.accessToken === 'string' &&
    typeof message.payload.refreshToken === 'string';
}

function isRequestSuggestionMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'REQUEST_SUGGESTION' }> {
  return isRecord(message) &&
    message.type === 'REQUEST_SUGGESTION' &&
    'payload' in message;
}

function isLogoutMessage(message: unknown): message is Extract<BackgroundMessage, { type: 'LOGOUT' }> {
  return isRecord(message) && message.type === 'LOGOUT';
}

logger.info('Background service worker loaded');
