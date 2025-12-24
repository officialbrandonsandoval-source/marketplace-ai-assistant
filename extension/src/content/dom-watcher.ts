/**
 * DOM Watcher
 * Monitors Facebook's SPA navigation and triggers UI re-injection
 * 
 * PHASE 2 IMPLEMENTATION REQUIRED:
 * - MutationObserver for thread view detection
 * - Handle React-based navigation without full page reload
 * - Detect when user switches threads
 * - Trigger UI re-injection on navigation
 */

import { logger } from '@/utils/logger.ts';

export class DOMWatcher {
  private observer: MutationObserver | null = null;
  private currentThreadId: string | null = null;
  private isWatching = false;

  /**
   * Start watching for DOM changes
   */
  start(): void {
    if (this.isWatching) {
      logger.warn('DOMWatcher already started');
      return;
    }

    logger.info('Starting DOM watcher for Facebook SPA navigation');

    // TODO Phase 2: Implement MutationObserver
    // - Watch for URL changes (pushState/replaceState)
    // - Watch for thread container changes
    // - Detect thread switches
    // - Trigger callbacks on navigation

    this.isWatching = true;
  }

  /**
   * Stop watching for DOM changes
   */
  stop(): void {
    if (!this.isWatching) {
      return;
    }

    logger.info('Stopping DOM watcher');

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.isWatching = false;
  }

  /**
   * Check if watcher detected a thread view
   */
  isOnThreadView(): boolean {
    // TODO Phase 2: Implement thread view detection
    return false;
  }

  /**
   * Get current thread ID from DOM or URL
   */
  getCurrentThreadId(): string | null {
    // TODO Phase 2: Extract thread ID
    return this.currentThreadId;
  }

  /**
   * Register callback for thread navigation
   */
  onThreadChange(callback: (threadId: string) => void): void {
    // TODO Phase 2: Implement event emission
    logger.debug('Thread change callback registered (not implemented)');
  }

  /**
   * Handle URL changes (SPA navigation)
   */
  private handleURLChange(): void {
    // TODO Phase 2: Detect URL change via history API
    const currentUrl = window.location.href;
    logger.debug({ url: currentUrl }, 'URL changed');
  }

  /**
   * Handle DOM mutations
   */
  private handleMutation(mutations: MutationRecord[]): void {
    // TODO Phase 2: Process mutations
    // - Check for thread view appearance
    // - Detect thread ID changes
    // - Trigger UI re-injection if needed
    
    logger.debug({ mutationCount: mutations.length }, 'DOM mutations detected (not processed)');
  }
}
