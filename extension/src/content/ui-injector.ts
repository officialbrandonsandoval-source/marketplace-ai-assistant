/**
 * UI Injector
 * Creates Shadow DOM and mounts Preact UI panel
 * 
 * PHASE 2 IMPLEMENTATION REQUIRED:
 * - Create Shadow DOM container for CSS isolation
 * - Mount Preact root inside Shadow DOM
 * - Position panel relative to Facebook's message input
 * - Handle cleanup and re-injection on navigation
 */

import { render } from 'preact';
import { logger } from '@/utils/logger.ts';
import { AssistantPanel } from '@/ui/AssistantPanel.tsx';

export class UIInjector {
  private shadowRoot: ShadowRoot | null = null;
  private containerElement: HTMLElement | null = null;
  private isInjected = false;

  /**
   * Inject UI panel into Facebook page
   * Uses Shadow DOM for CSS isolation
   */
  inject(): void {
    if (this.isInjected) {
      logger.warn('UI already injected');
      return;
    }

    try {
      logger.info('Injecting AI Assistant UI panel');

      // TODO Phase 2: Implement injection logic
      // - Find insertion point in Facebook DOM
      // - Create container element
      // - Attach Shadow DOM
      // - Mount Preact component
      // - Position panel appropriately

      this.isInjected = true;
      logger.info('UI injection complete');
    } catch (error) {
      logger.error({ error }, 'Failed to inject UI');
      throw error;
    }
  }

  /**
   * Remove injected UI from page
   */
  remove(): void {
    if (!this.isInjected) {
      return;
    }

    logger.info('Removing AI Assistant UI panel');

    try {
      // Unmount Preact component
      if (this.shadowRoot) {
        render(null, this.shadowRoot);
      }

      // Remove container from DOM
      if (this.containerElement && this.containerElement.parentNode) {
        this.containerElement.parentNode.removeChild(this.containerElement);
      }

      this.shadowRoot = null;
      this.containerElement = null;
      this.isInjected = false;

      logger.info('UI removal complete');
    } catch (error) {
      logger.error({ error }, 'Error removing UI');
    }
  }

  /**
   * Re-inject UI (useful after navigation)
   */
  reinject(): void {
    logger.info('Re-injecting UI after navigation');
    this.remove();
    this.inject();
  }

  /**
   * Check if UI is currently injected
   */
  isUIInjected(): boolean {
    return this.isInjected;
  }

  /**
   * Create Shadow DOM container
   */
  private createShadowContainer(): ShadowRoot {
    // TODO Phase 2: Create and attach Shadow DOM
    // - Create host element
    // - Attach shadow root (mode: 'open')
    // - Inject CSS for styling (scoped to shadow DOM)
    
    throw new Error('Not implemented (Phase 2)');
  }

  /**
   * Find insertion point in Facebook DOM
   */
  private findInsertionPoint(): HTMLElement | null {
    // TODO Phase 2: Find appropriate place to inject UI
    // - Look for message input container
    // - Ensure it's visible and stable
    
    return null;
  }

  /**
   * Mount Preact component inside Shadow DOM
   */
  private mountComponent(): void {
    if (!this.shadowRoot) {
      throw new Error('Shadow root not initialized');
    }

    // TODO Phase 2: Render Preact component
    // render(<AssistantPanel />, this.shadowRoot);
    
    logger.info('Preact component mounted (placeholder)');
  }
}
