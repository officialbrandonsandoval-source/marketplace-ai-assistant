/**
 * UI Injector
 * Creates Shadow DOM and mounts Preact UI panel
 * 
 * PHASE 2 IMPLEMENTATION:
 * ✓ Create Shadow DOM container for CSS isolation
 * ✓ Mount Preact root inside Shadow DOM
 * ✓ Position panel relative to Facebook's UI
 * ✓ Handle cleanup and re-injection on navigation
 */

import { render, h } from 'preact';
import { logger } from '@/utils/content-logger.ts';
import { AssistantPanel } from '@/ui/AssistantPanel.tsx';

const CONTAINER_ID = 'claude-assistant-root';
const PULSE_ANIMATION_ID = 'claude-pulse-animation';
const POSITION_STORAGE_KEY = 'assistant_panel_position_v1';

export class UIInjector {
  private shadowRoot: ShadowRoot | null = null;
  private containerElement: HTMLElement | null = null;
  private isInjected = false;
  private cleanupDragListeners: (() => void) | null = null;

  /**
   * Inject UI panel into Facebook page
   * Uses Shadow DOM for CSS isolation
   */
  inject(): void {
    if (this.isInjected) {
      logger.warn('UI already injected, skipping');
      return;
    }

    try {
      logger.info('Injecting AI Assistant UI panel');

      // Inject into document.body so the panel can be available on any Facebook page.
      const anchor = this.findAnchor();
      if (!anchor) {
        logger.error('Could not find suitable anchor point for UI injection');
        return;
      }

      // Create container element
      this.containerElement = document.createElement('div');
      this.containerElement.id = CONTAINER_ID;
      this.containerElement.style.cssText = `
        position: fixed;
        right: 16px;
        bottom: 16px;
        width: 380px;
        max-width: calc(100vw - 32px);
        z-index: 2147483647;
      `;

      // Attach Shadow DOM for CSS isolation
      this.shadowRoot = this.containerElement.attachShadow({ mode: 'open' });

      // Inject scoped styles
      this.injectStyles();

      // Mount Preact component into Shadow DOM using createElement API
      render(h(AssistantPanel, null), this.shadowRoot);

      // Enable dragging and restore last position
      this.enableDragging();
      void this.restorePosition();

      // Insert into Facebook's DOM
      anchor.appendChild(this.containerElement);

      this.isInjected = true;
      logger.info({ anchorType: anchor.tagName }, 'UI injection complete');

    } catch (error) {
      logger.error({ error }, 'Failed to inject UI');
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

      if (this.cleanupDragListeners) {
        this.cleanupDragListeners();
        this.cleanupDragListeners = null;
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
    
    // Small delay to ensure DOM is stable
    setTimeout(() => {
      this.inject();
    }, 100);
  }

  /**
   * Check if UI is currently injected
   */
  isUIInjected(): boolean {
    return this.isInjected;
  }

  /**
   * Find anchor point for UI injection
   * Tries multiple strategies in priority order
   */
  private findAnchor(): HTMLElement | null {
    try {
      if (document.body) {
        return document.body;
      }

      // Strategy 1: Find message composer area (most reliable)
      const composerAnchor = this.findComposerAnchor();
      if (composerAnchor) {
        logger.debug('Using composer area as anchor');
        return composerAnchor;
      }

      // Strategy 2: Find right sidebar
      const sidebarAnchor = this.findSidebarAnchor();
      if (sidebarAnchor) {
        logger.debug('Using sidebar as anchor');
        return sidebarAnchor;
      }

      // Strategy 3: Find thread container
      const threadContainer = document.querySelector<HTMLElement>('[role="main"]');
      if (threadContainer) {
        logger.debug('Using thread container as anchor');
        return threadContainer;
      }

      logger.warn('No suitable anchor found');
      return null;

    } catch (error) {
      logger.error({ error }, 'Error finding anchor point');
      return null;
    }
  }

  /**
   * Find message composer area (preferred anchor)
   */
  private findComposerAnchor(): HTMLElement | null {
    const selectors = [
      '[role="textbox"][contenteditable="true"]',
      'div[aria-label*="message" i]',
    ];

    for (const selector of selectors) {
      const composer = document.querySelector<HTMLElement>(selector);
      if (composer) {
        // Get parent container for insertion
        let parent = composer.parentElement;
        
        // Walk up to find suitable container
        let depth = 0;
        while (parent && depth < 5) {
          if (parent.tagName === 'DIV' && parent.offsetHeight > 100) {
            return parent.parentElement || parent;
          }
          parent = parent.parentElement;
          depth++;
        }
      }
    }

    return null;
  }

  /**
   * Find right sidebar (alternative anchor)
   */
  private findSidebarAnchor(): HTMLElement | null {
    const selectors = [
      '[role="complementary"]',
      'aside',
      '[data-pagelet*="RightRail"]',
    ];

    for (const selector of selectors) {
      const sidebar = document.querySelector<HTMLElement>(selector);
      if (sidebar && sidebar.offsetWidth > 200) {
        return sidebar;
      }
    }

    return null;
  }

  /**
   * Inject scoped styles into Shadow DOM
   */
  private injectStyles(): void {
    if (!this.shadowRoot) {
      return;
    }

    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');

      :host {
        display: block;
        font-family: 'Space Grotesk', 'Avenir Next', 'Helvetica Neue', sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #050505;
        max-height: 70vh;
        overflow: auto;
      }

      * {
        box-sizing: border-box;
      }

      /* Assistant Panel Container */
      .assistant-panel {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
        max-width: 100%;
      }

      /* Panel Header */
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 10px 12px;
        border-radius: 10px;
        background: linear-gradient(120deg, #e0f2fe 0%, #fff7ed 100%);
        border: 1px solid #dbeafe;
        cursor: grab;
        user-select: none;
      }

      :host([data-dragging="true"]) .panel-header {
        cursor: grabbing;
      }

      .panel-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
        color: #0f172a;
        letter-spacing: -0.02em;
      }

      .status-badge {
        font-size: 10px;
        padding: 3px 10px;
        border-radius: 999px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        border: 1px solid transparent;
      }

      .status-badge.ready {
        background: #d1fae5;
        color: #065f46;
        border-color: #6ee7b7;
      }

      .status-badge.loading {
        background: #fef3c7;
        color: #92400e;
        border-color: #fcd34d;
      }

      .status-badge.error {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
      }

      /* Button Styles */
      button {
        font-family: inherit;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      button.primary {
        background: #0EA5E9;
        color: white;
      }

      button.primary:hover:not(:disabled) {
        background: #0284c7;
      }

      button.secondary {
        background: #f3f4f6;
        color: #374151;
      }

      button.secondary:hover:not(:disabled) {
        background: #e5e7eb;
      }

      button.danger {
        background: #fee2e2;
        color: #991b1b;
      }

      button.danger:hover:not(:disabled) {
        background: #fecaca;
      }

      /* Loading Spinner */
      .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid #e5e7eb;
        border-top-color: #0EA5E9;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* Intent Score Badge */
      .intent-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
      }

      .intent-badge.high {
        background: #d1fae5;
        color: #065f46;
      }

      .intent-badge.medium {
        background: #fef3c7;
        color: #92400e;
      }

      .intent-badge.low {
        background: #fee2e2;
        color: #991b1b;
      }

      /* Suggestion Text */
      .suggestion-text {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        padding: 12px;
        margin: 12px 0;
        font-size: 14px;
        line-height: 1.6;
        color: #111827;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      /* Action Buttons Container */
      .actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .actions button {
        flex: 1;
      }

      /* Error Message */
      .error-message {
        background: #fee2e2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        padding: 12px;
        margin: 12px 0;
        color: #991b1b;
        font-size: 13px;
      }

      /* Character Count */
      .char-count {
        font-size: 11px;
        color: #6b7280;
        text-align: right;
        margin-top: 4px;
      }

      .char-count.warning {
        color: #d97706;
      }

      /* Pulse Animation for Send Button Highlight */
      @keyframes pulse {
        0%, 100% {
          opacity: 1;
        }
        50% {
          opacity: 0.7;
        }
      }
    `;

    this.shadowRoot.appendChild(styleElement);
  }

  private enableDragging(): void {
    if (!this.containerElement || !this.shadowRoot) {
      return;
    }

    const container = this.containerElement;
    const root = this.shadowRoot;

    let isDragging = false;
    let startClientX = 0;
    let startClientY = 0;
    let startLeft = 0;
    let startTop = 0;

    let windowMoveListener: ((event: PointerEvent) => void) | null = null;
    let windowUpListener: ((event: PointerEvent) => void) | null = null;

    const clamp = (value: number, min: number, max: number): number => {
      return Math.min(max, Math.max(min, value));
    };

    const isHeaderDragStart = (event: PointerEvent): boolean => {
      const path = event.composedPath();
      return path.some((node) => {
        return node instanceof HTMLElement && node.classList.contains('panel-header');
      });
    };

    const onPointerMove = (event: PointerEvent): void => {
      if (!isDragging) return;

      const dx = event.clientX - startClientX;
      const dy = event.clientY - startClientY;

      const rect = container.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width;
      const maxTop = window.innerHeight - rect.height;

      const nextLeft = clamp(startLeft + dx, 0, Math.max(0, maxLeft));
      const nextTop = clamp(startTop + dy, 0, Math.max(0, maxTop));

      container.style.left = `${nextLeft}px`;
      container.style.top = `${nextTop}px`;
    };

    const onPointerUp = async (): Promise<void> => {
      if (!isDragging) return;
      isDragging = false;
      document.documentElement.style.userSelect = '';
      container.removeAttribute('data-dragging');

      if (windowMoveListener) {
        window.removeEventListener('pointermove', windowMoveListener);
        windowMoveListener = null;
      }
      if (windowUpListener) {
        window.removeEventListener('pointerup', windowUpListener);
        window.removeEventListener('pointercancel', windowUpListener);
        windowUpListener = null;
      }

      try {
        const left = parseFloat(container.style.left);
        const top = parseFloat(container.style.top);
        if (!Number.isNaN(left) && !Number.isNaN(top)) {
          await chrome.storage.local.set({
            [POSITION_STORAGE_KEY]: { left, top },
          });
        }
      } catch (error) {
        logger.debug({ error }, 'Failed to persist panel position');
      }
    };

    const onPointerDown = (event: Event): void => {
      const pointerEvent = event as PointerEvent;

      // Only allow left-click / primary pointer to start dragging.
      if (typeof pointerEvent.button === 'number' && pointerEvent.button !== 0) {
        return;
      }

      if (!isHeaderDragStart(pointerEvent)) {
        return;
      }

      pointerEvent.preventDefault();

      const rect = container.getBoundingClientRect();

      // Switch from right/bottom anchoring to explicit left/top once the user drags.
      container.style.right = '';
      container.style.bottom = '';
      container.style.left = `${rect.left}px`;
      container.style.top = `${rect.top}px`;

      isDragging = true;
      startClientX = pointerEvent.clientX;
      startClientY = pointerEvent.clientY;
      startLeft = rect.left;
      startTop = rect.top;

      document.documentElement.style.userSelect = 'none';
      container.setAttribute('data-dragging', 'true');
      container.setPointerCapture(pointerEvent.pointerId);

      // Track move/up at window level so releasing anywhere drops the panel.
      windowMoveListener = (moveEvent: PointerEvent) => onPointerMove(moveEvent);
      windowUpListener = (_upEvent: PointerEvent) => {
        void onPointerUp();
      };
      window.addEventListener('pointermove', windowMoveListener);
      window.addEventListener('pointerup', windowUpListener);
      window.addEventListener('pointercancel', windowUpListener);
    };

    root.addEventListener('pointerdown', onPointerDown);

    this.cleanupDragListeners = () => {
      root.removeEventListener('pointerdown', onPointerDown);
      if (windowMoveListener) {
        window.removeEventListener('pointermove', windowMoveListener);
        windowMoveListener = null;
      }
      if (windowUpListener) {
        window.removeEventListener('pointerup', windowUpListener);
        window.removeEventListener('pointercancel', windowUpListener);
        windowUpListener = null;
      }
    };
  }

  private async restorePosition(): Promise<void> {
    if (!this.containerElement) {
      return;
    }

    try {
      const stored = await chrome.storage.local.get([POSITION_STORAGE_KEY]);
      const value = stored[POSITION_STORAGE_KEY] as unknown;
      if (!value || typeof value !== 'object') {
        return;
      }

      const position = value as { left?: unknown; top?: unknown };
      if (typeof position.left !== 'number' || typeof position.top !== 'number') {
        return;
      }

      // Apply and clamp into viewport.
      const rect = this.containerElement.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - rect.width);
      const maxTop = Math.max(0, window.innerHeight - rect.height);

      const left = Math.min(maxLeft, Math.max(0, position.left));
      const top = Math.min(maxTop, Math.max(0, position.top));

      this.containerElement.style.right = '';
      this.containerElement.style.bottom = '';
      this.containerElement.style.left = `${left}px`;
      this.containerElement.style.top = `${top}px`;
    } catch (error) {
      logger.debug({ error }, 'Failed to restore panel position');
    }
  }
}
