/**
 * DOM Watcher
 * Monitors Facebook's SPA navigation and triggers UI re-injection
 * 
 * PHASE 2 IMPLEMENTATION:
 * ✓ MutationObserver for thread view detection
 * ✓ Handle React-based navigation without full page reload
 * ✓ Detect when user switches threads
 * ✓ Debounced callbacks to prevent spam
 */

import type { ThreadContext } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';
import type { FacebookMarketplaceAdapter } from './facebook-adapter.ts';

export class DOMWatcher {
  private observer: MutationObserver | null = null;
  private currentThreadId: string | null = null;
  private lastUrl: string = '';
  private isWatching = false;
  private debounceTimer: number | null = null;
  private idleCallbackId: number | null = null;
  private onThreadDetectedCallback: ((context: ThreadContext) => void) | null = null;

  constructor(
    private onThreadDetected: (context: ThreadContext) => void,
    private adapter: FacebookMarketplaceAdapter
  ) {
    this.onThreadDetectedCallback = onThreadDetected;
    this.lastUrl = window.location.href;
  }

  /**
   * Start watching for DOM changes
   */
  start(): void {
    if (this.isWatching) {
      logger.warn('DOMWatcher already started');
      return;
    }

    logger.info('Starting DOM watcher for Facebook SPA navigation');

    // Set up MutationObserver for DOM changes
    this.observer = new MutationObserver(this.handleMutation);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Monitor URL changes (Facebook SPA navigation)
    this.monitorURLChanges();

    // Initial check for thread view
    this.checkForThread();

    this.isWatching = true;
    logger.info('DOM watcher started successfully');
  }

  /**
   * Stop watching for DOM changes
   */
  stop(): void {
    if (!this.isWatching) {
      return;
    }

    logger.info('Stopping DOM watcher');

    // Disconnect observer
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clear timers
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.idleCallbackId) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }

    this.isWatching = false;
    logger.info('DOM watcher stopped');
  }

  /**
   * Check if currently on a thread view
   */
  isOnThreadView(): boolean {
    const url = window.location.href;
    return url.includes('/marketplace/inbox/') && /\/marketplace\/inbox\/\d+/.test(url);
  }

  /**
   * Get current thread ID from DOM or URL
   */
  getCurrentThreadId(): string | null {
    return this.currentThreadId;
  }

  /**
   * Monitor URL changes using History API interception
   */
  private monitorURLChanges(): void {
    // Intercept pushState and replaceState
    const originalPushState = history.pushState.bind(history);
    const originalReplaceState = history.replaceState.bind(history);

    history.pushState = (...args): void => {
      originalPushState(...args);
      this.handleURLChange();
    };

    history.replaceState = (...args): void => {
      originalReplaceState(...args);
      this.handleURLChange();
    };

    // Listen for popstate (back/forward navigation)
    window.addEventListener('popstate', () => {
      this.handleURLChange();
    });
  }

  /**
   * Handle URL changes (SPA navigation)
   */
  private handleURLChange(): void {
    const currentUrl = window.location.href;

    if (currentUrl !== this.lastUrl) {
      logger.debug({ oldUrl: this.lastUrl, newUrl: currentUrl }, 'URL changed');
      this.lastUrl = currentUrl;

      // Debounce thread detection
      this.scheduleThreadCheck();
    }
  }

  /**
   * Handle DOM mutations (debounced)
   */
  private handleMutation = (mutations: MutationRecord[]): void => {
    // Ignore if not on thread view
    if (!this.isOnThreadView()) {
      return;
    }

    // Check if mutations include significant changes
    const hasSignificantChange = mutations.some(mutation => {
      // Check for added nodes with relevant attributes
      if (mutation.addedNodes.length > 0) {
        return Array.from(mutation.addedNodes).some(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            return (
              element.hasAttribute('role') ||
              element.hasAttribute('data-pagelet') ||
              element.querySelector('[role="textbox"]') !== null
            );
          }
          return false;
        });
      }
      return false;
    });

    if (hasSignificantChange) {
      logger.debug({ mutationCount: mutations.length }, 'Significant DOM mutations detected');
      this.scheduleThreadCheck();
    }
  };

  /**
   * Schedule thread check with debouncing
   */
  private scheduleThreadCheck(): void {
    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Debounce to prevent spam (500ms)
    this.debounceTimer = window.setTimeout(() => {
      this.checkForThread();
    }, 500);
  }

  /**
   * Check if thread view is present and extract context
   */
  private checkForThread(): void {
    try {
      // Verify we're on thread view
      if (!this.isOnThreadView()) {
        logger.debug('Not on thread view, skipping check');
        
        // Clear current thread if we navigated away
        if (this.currentThreadId !== null) {
          logger.info('Thread view lost');
          this.currentThreadId = null;
        }
        return;
      }

      // Use requestIdleCallback for non-urgent work
      if ('requestIdleCallback' in window) {
        this.idleCallbackId = requestIdleCallback(() => {
          this.performThreadDetection();
        }, { timeout: 1000 });
      } else {
        // Fallback for browsers without requestIdleCallback
        setTimeout(() => {
          this.performThreadDetection();
        }, 0);
      }

    } catch (error) {
      logger.error({ error }, 'Error checking for thread');
    }
  }

  /**
   * Perform actual thread detection and context extraction
   */
  private performThreadDetection(): void {
    try {
      // Extract thread context
      const context = this.adapter.extractThreadContext();

      if (!context) {
        logger.debug('Could not extract thread context');
        return;
      }

      // Check if this is a new thread or same thread
      const isNewThread = this.currentThreadId !== context.threadId;

      if (isNewThread) {
        logger.info({ 
          threadId: context.threadId, 
          messageCount: context.messages.length 
        }, 'Thread detected');

        this.currentThreadId = context.threadId;

        // Invoke callback
        if (this.onThreadDetectedCallback) {
          this.onThreadDetectedCallback(context);
        }
      } else {
        logger.debug({ threadId: context.threadId }, 'Same thread, no re-injection needed');
      }

    } catch (error) {
      logger.error({ error }, 'Error during thread detection');
    }
  }

  /**
   * Wait for thread view to stabilize before extraction
   */
  async waitForThreadStability(timeout: number = 3000): Promise<boolean> {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkStability = (): void => {
        const isStable = this.isOnThreadView() && 
                        this.adapter.findMessageInput() !== null;

        if (isStable) {
          logger.debug('Thread view stabilized');
          resolve(true);
          return;
        }

        if (Date.now() - startTime > timeout) {
          logger.warn('Thread view stability timeout');
          resolve(false);
          return;
        }

        setTimeout(checkStability, 100);
      };

      checkStability();
    });
  }
}
