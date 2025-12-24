/**
 * Background Service Worker Entry Point
 * Manifest V3 service worker - responsible for:
 * - API communication with backend
 * - JWT token management (access + refresh)
 * - Message passing coordination
 * - Persistent storage management
 */

import type {
  AuthTokens,
  ExtensionMessage,
  ExtensionMessageResponse,
  APIResponse,
} from '@/types/index.ts';
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
    const tokens = await getStoredTokens();
    if (tokens && !isTokenExpired(tokens)) {
      state.isAuthenticated = true;
      logger.info('User authenticated on startup');
    } else {
      state.isAuthenticated = false;
      logger.info('No valid authentication on startup');
    }
  } catch (error) {
    logger.error({ error }, 'Error checking authentication on startup');
  }
});

/**
 * Message handler from content scripts
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessageResponse) => void
  ): boolean => {
    logger.debug({ messageType: message.type }, 'Received message from content script');

    // Handle message asynchronously
    handleContentMessage(message)
      .then((response) => sendResponse(response))
      .catch((error) => {
        logger.error({ error, messageType: message.type }, 'Error handling message');
        sendResponse({
          success: false,
          data: null,
          error: {
            code: 'UNKNOWN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
            details: null,
            timestamp: Date.now(),
          },
          requestId: message.requestId,
        });
      });

    // Return true to indicate async response
    return true;
  }
);

/**
 * Handle messages from content script
 * TODO Phase 3: Implement full message routing
 */
async function handleContentMessage(
  message: ExtensionMessage
): Promise<ExtensionMessageResponse> {
  switch (message.type) {
    case 'GET_SUGGESTION':
      // TODO Phase 3: Call API to request suggestion
      return {
        success: false,
        data: null,
        error: {
          code: 'API_ERROR',
          message: 'Phase 3 feature - API client not implemented',
          details: null,
          timestamp: Date.now(),
        },
        requestId: message.requestId,
      };

    case 'REFRESH_TOKEN':
      return await handleTokenRefresh(message);

    default:
      return {
        success: false,
        data: null,
        error: {
          code: 'UNKNOWN_ERROR',
          message: `Unknown message type: ${message.type}`,
          details: null,
          timestamp: Date.now(),
        },
        requestId: message.requestId,
      };
  }
}

/**
 * Handle token refresh request
 * TODO Phase 3: Implement actual refresh logic with backend
 */
async function handleTokenRefresh(
  message: ExtensionMessage
): Promise<ExtensionMessageResponse> {
  if (state.tokenRefreshInProgress) {
    return {
      success: false,
      data: null,
      error: {
        code: 'AUTH_EXPIRED',
        message: 'Token refresh already in progress',
        details: null,
        timestamp: Date.now(),
      },
      requestId: message.requestId,
    };
  }

  try {
    state.tokenRefreshInProgress = true;

    // TODO Phase 3: Implement actual refresh logic
    logger.info('Token refresh requested (not implemented)');

    return {
      success: false,
      data: null,
      error: {
        code: 'API_ERROR',
        message: 'Phase 3 feature - token refresh not implemented',
        details: null,
        timestamp: Date.now(),
      },
      requestId: message.requestId,
    };
  } finally {
    state.tokenRefreshInProgress = false;
  }
}

/**
 * Get stored authentication tokens
 */
async function getStoredTokens(): Promise<AuthTokens | null> {
  try {
    const result = await chrome.storage.local.get('authTokens');
    return (result.authTokens as AuthTokens) || null;
  } catch (error) {
    logger.error({ error }, 'Error retrieving stored tokens');
    return null;
  }
}

/**
 * Store authentication tokens
 */
async function storeTokens(tokens: AuthTokens): Promise<void> {
  try {
    await chrome.storage.local.set({ authTokens: tokens });
    state.isAuthenticated = true;
    logger.info('Tokens stored successfully');
  } catch (error) {
    logger.error({ error }, 'Error storing tokens');
    throw error;
  }
}

/**
 * Check if token is expired
 */
function isTokenExpired(tokens: AuthTokens): boolean {
  const now = Date.now();
  const bufferMs = 60 * 1000; // 1 minute buffer
  return tokens.expiresAt - bufferMs < now;
}

/**
 * Clear stored tokens (logout)
 */
async function clearTokens(): Promise<void> {
  try {
    await chrome.storage.local.remove('authTokens');
    state.isAuthenticated = false;
    logger.info('Tokens cleared');
  } catch (error) {
    logger.error({ error }, 'Error clearing tokens');
    throw error;
  }
}

logger.info('Background service worker loaded');
