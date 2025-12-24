/**
 * Facebook DOM Adapter
 * Extracts thread context and manages interaction with Facebook's DOM
 * 
 * PHASE 2 IMPLEMENTATION REQUIRED:
 * - Extract thread context from Marketplace inbox
 * - Find message input element
 * - Insert draft message text (never auto-send)
 * - Handle selector fallbacks (XPath, ARIA) when Facebook changes DOM
 */

import type { ThreadContext, ListingData, Message, DOMElements } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

export class FacebookAdapter {
  private selectors = {
    // TODO: Move these to backend config in Phase 3
    messageInput: [
      '[contenteditable="true"][role="textbox"]',
      'div[aria-label*="message" i]',
    ],
    messageList: [
      '[role="log"]',
      'div[data-pagelet*="MessageList"]',
    ],
    threadContainer: [
      '[data-pagelet*="ThreadView"]',
      'div[role="main"]',
    ],
    sendButton: [
      '[aria-label*="send" i]',
      'div[role="button"][aria-label*="Send"]',
    ],
    listingCard: [
      '[data-pagelet*="Listing"]',
      'a[href*="/marketplace/item/"]',
    ],
  };

  /**
   * Extract current thread context from DOM
   * Returns null if not on a valid thread page or parsing fails
   */
  extractThreadContext(): ThreadContext | null {
    logger.info('Extracting thread context from Facebook DOM');
    
    // TODO Phase 2: Implement extraction logic
    // - Parse thread ID from URL or data attributes
    // - Extract listing data from listing card
    // - Parse message history
    // - Get participant name
    // - Determine read status
    
    logger.warn('extractThreadContext not implemented (Phase 2)');
    return null;
  }

  /**
   * Find message input element
   * Tries multiple selectors for resilience
   */
  findMessageInput(): HTMLElement | null {
    logger.debug('Finding message input element');
    
    // TODO Phase 2: Implement selector fallback logic
    // Try each selector in order, return first match
    
    return null;
  }

  /**
   * Find all DOM elements needed for UI injection
   */
  findDOMElements(): DOMElements {
    // TODO Phase 2: Implement multi-selector fallback for each element
    
    return {
      messageInput: null,
      messageList: null,
      threadContainer: null,
      sendButton: null,
    };
  }

  /**
   * Insert draft message text into input field
   * NEVER auto-clicks send button - user must explicitly send
   */
  insertDraftMessage(text: string): void {
    logger.info('Inserting draft message (user must click Send)');
    
    // TODO Phase 2: Implement draft insertion
    // - Find message input
    // - Set contenteditable text content
    // - Trigger input events for Facebook to recognize change
    // - Highlight Send button (visual indicator only, no click)
    
    logger.warn({ textLength: text.length }, 'insertDraftMessage not implemented (Phase 2)');
  }

  /**
   * Extract listing data from listing card in thread
   */
  private extractListingData(): ListingData | null {
    // TODO Phase 2: Parse listing details
    return null;
  }

  /**
   * Extract messages from thread DOM
   */
  private extractMessages(): Message[] {
    // TODO Phase 2: Parse message history
    return [];
  }

  /**
   * Get thread ID from URL or DOM
   */
  private getThreadId(): string | null {
    // TODO Phase 2: Extract thread identifier
    return null;
  }

  /**
   * Verify DOM stability before extraction
   * Facebook uses React - wait for hydration
   */
  async waitForDOMStability(): Promise<void> {
    // TODO Phase 2: Implement stability check
    // - Wait for key elements to be present
    // - Wait for React hydration
    // - Use MutationObserver to detect stability
    
    logger.debug('Waiting for DOM stability');
  }
}
