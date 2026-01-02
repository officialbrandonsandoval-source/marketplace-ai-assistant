/**
 * Content Script Entry Point
 * Runs on Facebook Marketplace pages - responsible for:
 * - DOM monitoring and thread detection
 * - UI injection via Shadow DOM
 * - Context extraction and message passing to background
 * 
 * PHASE 2 IMPLEMENTATION:
 * ✓ Initialize Facebook adapter, DOM watcher, UI injector
 * ✓ Handle thread detection and UI injection
 * ✓ Process draft insertion messages
 * ✓ Graceful cleanup on navigation
 */

import type { ThreadContext, ExtensionMessage, ExtensionMessageResponse } from '@/types/index.ts';
import { logger } from '@/utils/content-logger.ts';
import { FacebookMarketplaceAdapter } from './facebook-adapter.ts';
import { DOMWatcher } from './dom-watcher.ts';
import { UIInjector } from './ui-injector.ts';
import { useStore } from '@/store/use-store.ts';

interface SuggestionResponse {
  suggestedMessage: string;
  intentScore: number;
  reasoning: string;
  nextAction: 'ask_availability' | 'send_booking_link' | 'answer_question' | 'close';
}

interface SuggestionRequest {
  threadId: string;
  fbThreadId: string;
  listingTitle: string | null;
  listingPrice: string | null;
  listingUrl: string | null;
  conversationGoal: string;
  customInstructions?: string;
  savedPresetId?: string;
  messages: Array<{
    senderId: string;
    text: string;
    timestamp: number;
    isUser: boolean;
  }>;
}

interface SuggestionErrorResponse {
  error: string;
}

type SuggestionResult = SuggestionResponse | SuggestionErrorResponse;

interface SuggestionControls {
  conversationGoal?: string;
  customInstructions?: string;
  savedPresetId?: string;
}


// Global state flag to prevent multiple initializations
let isInitialized = false;

// Module-level instances
let adapter: FacebookMarketplaceAdapter;
let watcher: DOMWatcher;
let injector: UIInjector;

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

    // Initialize Facebook adapter
    adapter = new FacebookMarketplaceAdapter();
    logger.info('Facebook adapter initialized');

    // Initialize UI injector
    injector = new UIInjector();
    logger.info('UI injector initialized');

    // Initialize DOM watcher with callback
    watcher = new DOMWatcher(handleThreadDetected, adapter);
    watcher.start();
    logger.info('DOM watcher started');

    // Set up message listeners
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);
    window.addEventListener('message', handleWindowMessage);
    logger.info('Message listeners registered');

    // Set authentication status based on stored token
    const tokenResult = await chrome.storage.local.get(['access_token']);
    useStore.getState().setAuthenticated(typeof tokenResult.access_token === 'string');

    isInitialized = true;
    logger.info('Content script initialization complete');

  } catch (error) {
    logger.error({ error }, 'Failed to initialize content script');
    // Don't throw - fail gracefully to avoid breaking the page
  }
}

/**
 * Handle thread detection from DOM watcher
 */
function handleThreadDetected(context: ThreadContext): void {
  try {
    logger.info({ 
      threadId: context.threadId,
      messageCount: context.messages.length,
      hasListing: context.listingData !== null
    }, 'Thread detected, injecting UI');

    // Update store with current thread
    useStore.getState().setCurrentThread(context);

    // Inject or re-inject UI
    if (injector.isUIInjected()) {
      logger.debug('Re-injecting UI for new thread');
      injector.reinject();
    } else {
      injector.inject();
    }

    // Make UI visible
    useStore.getState().setUIVisible(true);

  } catch (error) {
    logger.error({ error }, 'Error handling thread detection');
  }
}

/**
 * Handle messages from window (UI to content script communication)
 */
function handleWindowMessage(event: MessageEvent): void {
  // Only accept messages from same origin
  if (event.origin !== window.location.origin) {
    return;
  }

  if (!event.data || typeof event.data.type !== 'string') {
    return;
  }

  // Check for our custom message types
  if (event.data.type === 'CLAUDE_USE_DRAFT') {
    try {
      const { message } = event.data.payload;
      
      logger.info({ messageLength: message.length }, 'Inserting draft message');
      adapter.insertDraftMessage(message);

      // Highlight send button
      highlightSendButton();

    } catch (error) {
      logger.error({ error }, 'Failed to insert draft message');
    }
    return;
  }

  if (event.data.type === 'REQUEST_SUGGESTION_FROM_UI') {
    if (!adapter) {
      window.postMessage({
        type: 'SUGGESTION_ERROR',
        payload: { error: 'Adapter not initialized' },
      }, '*');
      return;
    }

    const threadContext = adapter.extractThreadContext();
    if (!threadContext) {
      window.postMessage({
        type: 'SUGGESTION_ERROR',
        payload: { error: 'Could not extract thread context' },
      }, '*');
      return;
    }

    const controls = extractSuggestionControls(event.data.payload);
    void requestSuggestion(threadContext, controls);
  }

  if (event.data.type === 'OPEN_UPGRADE_URL') {
    chrome.runtime.sendMessage({ type: 'OPEN_UPGRADE_URL' }).catch((error) => {
      logger.error({ error }, 'Failed to open upgrade URL');
    });
  }
}

async function requestSuggestion(
  threadContext: ThreadContext,
  controls?: SuggestionControls
): Promise<void> {
  try {
    const payload = buildSuggestionPayload(threadContext, controls);
    const response = (await chrome.runtime.sendMessage({
      type: 'REQUEST_SUGGESTION',
      payload,
    })) as SuggestionResult;

    if (!isRecord(response)) {
      window.postMessage({
        type: 'SUGGESTION_ERROR',
        payload: { error: 'Invalid response from background' },
      }, '*');
      return;
    }

    if ('error' in response && typeof response.error === 'string') {
      window.postMessage({
        type: 'SUGGESTION_ERROR',
        payload: { error: response.error },
      }, '*');
      return;
    }

    if (!isSuggestionResponse(response)) {
      window.postMessage({
        type: 'SUGGESTION_ERROR',
        payload: { error: 'Malformed suggestion response' },
      }, '*');
      return;
    }

    window.postMessage({
      type: 'SUGGESTION_READY',
      payload: response,
    }, '*');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to request suggestion';
    logger.error({ error }, 'Failed to request suggestion');
    window.postMessage({
      type: 'SUGGESTION_ERROR',
      payload: { error: message },
    }, '*');
  }
}

function buildSuggestionPayload(
  threadContext: ThreadContext,
  controls?: SuggestionControls
): SuggestionRequest {
  const listing = threadContext.listingData;
  const listingId = listing?.id ?? null;
  const listingUrl = listingId && /^\d+$/.test(listingId)
    ? `https://www.facebook.com/marketplace/item/${listingId}`
    : null;
  const conversationGoal = controls?.conversationGoal?.trim() || 'general_assistance';
  const customInstructions = controls?.customInstructions?.trim() || undefined;
  const savedPresetId = controls?.savedPresetId?.trim() || undefined;

  return {
    threadId: threadContext.threadId,
    fbThreadId: threadContext.threadId,
    listingTitle: listing?.title ?? null,
    listingPrice: listing ? String(listing.price) : null,
    listingUrl,
    conversationGoal,
    customInstructions,
    savedPresetId,
    messages: threadContext.messages.map((message) => ({
      senderId: message.senderType,
      text: message.text,
      timestamp: message.timestamp,
      isUser: message.senderType === 'user',
    })),
  };
}

function extractSuggestionControls(payload: unknown): SuggestionControls | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const controls: SuggestionControls = {};

  if (typeof payload.conversationGoal === 'string') {
    controls.conversationGoal = payload.conversationGoal;
  }

  if (typeof payload.customInstructions === 'string') {
    controls.customInstructions = payload.customInstructions;
  }

  if (typeof payload.savedPresetId === 'string') {
    controls.savedPresetId = payload.savedPresetId;
  }

  return controls;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuggestionResponse(value: unknown): value is SuggestionResponse {
  return isRecord(value) &&
    typeof value.suggestedMessage === 'string' &&
    typeof value.intentScore === 'number' &&
    typeof value.reasoning === 'string' &&
    typeof value.nextAction === 'string';
}

/**
 * Highlight Facebook's send button to indicate user action required
 */
function highlightSendButton(): void {
  try {
    const sendButton = adapter.findSendButton();
    if (sendButton) {
      const originalOutline = sendButton.style.outline;
      const originalAnimation = sendButton.style.animation;

      sendButton.style.outline = '3px solid #10B981';
      sendButton.style.animation = 'pulse 1s ease-in-out 3';

      // Add pulse animation if not already present
      if (!document.getElementById('claude-pulse-animation')) {
        const style = document.createElement('style');
        style.id = 'claude-pulse-animation';
        style.textContent = `
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `;
        document.head.appendChild(style);
      }

      // Remove highlight after 3 seconds
      setTimeout(() => {
        sendButton.style.outline = originalOutline;
        sendButton.style.animation = originalAnimation;
      }, 3000);
    }
  } catch (error) {
    logger.debug({ error }, 'Could not highlight send button');
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
  const isMarketplaceInbox = url.includes('facebook.com/marketplace') &&
    (url.includes('/inbox') || url.includes('/you/selling'));
  const isMessengerThread = url.includes('facebook.com/messages/t/');
  return isMarketplaceInbox || isMessengerThread;
}

/**
 * Handle messages from background script
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
        // Phase 3: Forward to backend API
        sendResponse({
          success: false,
          data: null,
          error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Phase 3 feature - backend not yet implemented',
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
  try {
    logger.info('Cleaning up content script');

    if (watcher) {
      watcher.stop();
    }

    if (injector) {
      injector.remove();
    }

    // Reset store
    useStore.getState().reset();

    isInitialized = false;
    logger.info('Cleanup complete');

  } catch (error) {
    logger.error({ error }, 'Error during cleanup');
  }
}

// Initialize on load
initialize().catch((error) => {
  logger.error({ error }, 'Fatal error during content script initialization');
});

// Cleanup on unload
window.addEventListener('beforeunload', cleanup);
