/**
 * Content Script Entry Point
 * Runs on Facebook Marketplace pages - responsible for:
 * - DOM monitoring and thread detection
 * - UI injection via Shadow DOM
 * - Context extraction and message passing to background
 */

import type { ThreadContext, ExtensionMessage, ExtensionMessageResponse } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

// Global state flag to prevent multiple initializations
let isInitialized = false;

/**
 * Main initialization function
 * Called when content script loads on Marketplace page
 */
async function initialize(): Promise<void> {
  if (isInitialized) {
    logger.warn('Content script already initialized, skipping');
    return;
  }

  try {
    logger.info('Initializing Facebook Marketplace AI Assistant content script');

    // Wait for page to be ready
    await waitForPageReady();

    // Verify we're on a valid Marketplace page
    if (!isMarketplaceMessagesPage()) {
      logger.info('Not on Marketplace messages page, content script idle');
      return;
    }

    // TODO Phase 2: Initialize DOM watcher
    // const domWatcher = new DOMWatcher();
    // domWatcher.start();

    // TODO Phase 2: Initialize Facebook adapter
    // const adapter = new FacebookAdapter();

    // TODO Phase 2: Set up message listener from background
    // chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    isInitialized = true;
    logger.info('Content script initialization complete');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize content script');
    // Don't throw - fail gracefully to avoid breaking the page
  }
}

/**
 * Wait for page DOM to be fully loaded and stable
 */
async function waitForPageReady(): Promise<void> {
  if (document.readyState === 'complete') {
    return;
  }

  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

/**
 * Check if current URL is Facebook Marketplace messages page
 */
function isMarketplaceMessagesPage(): boolean {
  const url = window.location.href;
  return url.includes('facebook.com/marketplace') && 
         (url.includes('/inbox') || url.includes('/you/selling'));
}

/**
 * Handle messages from background script
 * TODO Phase 2: Implement full message handling
 */
function handleBackgroundMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtensionMessageResponse) => void
): boolean {
  logger.debug({ messageType: message.type }, 'Received message from background');

  try {
    // Handle different message types
    switch (message.type) {
      case 'GET_SUGGESTION':
        // TODO Phase 2: Extract thread context and request suggestion
        sendResponse({
          success: false,
          data: null,
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Phase 2 feature',
            details: null,
            timestamp: Date.now(),
          },
          requestId: message.requestId,
        });
        break;

      default:
        sendResponse({
          success: false,
          data: null,
          error: {
            code: 'UNKNOWN_ERROR',
            message: `Unknown message type: ${message.type}`,
            details: null,
            timestamp: Date.now(),
          },
          requestId: message.requestId,
        });
    }
  } catch (error) {
    logger.error({ error, messageType: message.type }, 'Error handling background message');
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
  }

  // Return true to indicate async response
  return true;
}

/**
 * Cleanup function for extension unload/disable
 */
function cleanup(): void {
  logger.info('Cleaning up content script');
  // TODO Phase 2: Remove injected UI, disconnect observers, etc.
  isInitialized = false;
}

// Initialize on load
initialize().catch((error) => {
  logger.error({ error }, 'Fatal error during content script initialization');
});

// Cleanup on unload
window.addEventListener('beforeunload', cleanup);
