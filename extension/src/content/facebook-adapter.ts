/**
 * Facebook DOM Adapter
 * Extracts thread context and manages interaction with Facebook's DOM
 * 
 * PHASE 2 IMPLEMENTATION:
 * ✓ Extract thread context from Marketplace inbox
 * ✓ Find message input element with fallback selectors
 * ✓ Insert draft message text (NEVER auto-send)
 * ✓ Handle selector fallbacks when Facebook changes DOM
 */

import type { ThreadContext, ListingData, Message, DOMElements } from '@/types/index.ts';
import { logger } from '@/utils/content-logger.ts';

export class FacebookMarketplaceAdapter {
  private selectors = {
    messageInput: [
      'div[contenteditable="true"][role="textbox"]',
      'div[aria-label*="message" i][contenteditable="true"]',
      '[contenteditable="true"][aria-label]',
    ],
    messageList: [
      '[role="log"]',
      'div[data-pagelet*="MessageList"]',
      '[aria-label*="Messages" i]',
    ],
    threadContainer: [
      '[role="main"] [data-pagelet^="Marketplace"]',
      '[data-pagelet*="ThreadView"]',
      'div[role="main"]',
    ],
    sendButton: [
      'div[aria-label*="Send" i]',
      '[role="button"][aria-label*="Send"]',
      'button[type="submit"]',
    ],
    listingCard: [
      '[data-visualcompletion="ignore-dynamic"]',
      'a[href*="/marketplace/item/"]',
      '[data-pagelet*="Listing"]',
    ],
    messageItem: [
      'div[role="row"]',
      '[data-scope="messages_table"]',
    ],
    messageText: [
      'div[dir="auto"]',
      'span[dir="auto"]',
    ],
  };

  /**
   * Extract current thread context from DOM
   * Returns null if not on a valid thread page or parsing fails
   */
  extractThreadContext(): ThreadContext | null {
    try {
      logger.info('Extracting thread context from Facebook DOM');

      const threadId = this.getThreadId();
      if (!threadId) {
        logger.warn('Could not extract thread ID from URL');
        return null;
      }

      const listingData = this.extractListingData();
      const messages = this.extractMessages();
      const participantName = this.extractParticipantName();
      const lastMessageTimestamp = messages.length > 0 && messages[messages.length - 1]
        ? messages[messages.length - 1]!.timestamp
        : Date.now();

      const context: ThreadContext = {
        threadId,
        listingData,
        messages,
        participantName,
        lastMessageTimestamp,
        isRead: true, // Assume read if we're viewing it
      };

      logger.info({ threadId, messageCount: messages.length }, 'Thread context extracted successfully');
      return context;

    } catch (error) {
      logger.error({ error }, 'Failed to extract thread context');
      return null;
    }
  }

  /**
   * Find message input element
   * Tries multiple selectors for resilience
   */
  findMessageInput(): HTMLElement | null {
    try {
      logger.debug('Finding message input element');

      for (const selector of this.selectors.messageInput) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element && element.isContentEditable) {
          logger.debug({ selector }, 'Message input found');
          return element;
        }
      }

      // XPath fallback
      const xpathResult = document.evaluate(
        '//div[@contenteditable="true" and @aria-label]',
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      if (xpathResult.singleNodeValue) {
        logger.debug('Message input found via XPath');
        return xpathResult.singleNodeValue as HTMLElement;
      }

      logger.warn('Message input element not found');
      return null;

    } catch (error) {
      logger.error({ error }, 'Error finding message input');
      return null;
    }
  }

  /**
   * Find Send button element (for highlighting only, NEVER click)
   */
  findSendButton(): HTMLElement | null {
    try {
      for (const selector of this.selectors.sendButton) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element) {
          logger.debug({ selector }, 'Send button found');
          return element;
        }
      }

      logger.warn('Send button not found');
      return null;

    } catch (error) {
      logger.error({ error }, 'Error finding send button');
      return null;
    }
  }

  /**
   * Find all DOM elements needed for UI injection
   */
  findDOMElements(): DOMElements {
    return {
      messageInput: this.findMessageInput(),
      messageList: this.findElement(this.selectors.messageList),
      threadContainer: this.findElement(this.selectors.threadContainer),
      sendButton: this.findSendButton(),
    };
  }

  /**
   * Insert draft message text into input field
   * NEVER auto-clicks send button - user must explicitly send
   */
  insertDraftMessage(text: string): void {
    try {
      logger.info({ textLength: text.length }, 'Inserting draft message (user must click Send)');

      const input = this.findMessageInput();
      if (!input) {
        logger.error('Cannot insert draft: message input not found');
        return;
      }

      // Focus the input
      input.focus();

      // Method 1: Try execCommand (preferred for Facebook's event handling)
      const success = document.execCommand('insertText', false, text);
      
      if (!success) {
        // Method 2: Fallback to direct content manipulation
        logger.debug('execCommand failed, using direct manipulation');
        input.textContent = text;

        // Trigger input event for React to detect change
        const inputEvent = new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          data: text,
        });
        input.dispatchEvent(inputEvent);
      }

      // Highlight send button as visual indicator
      this.highlightSendButton();

      logger.info('Draft message inserted successfully');

    } catch (error) {
      logger.error({ error }, 'Failed to insert draft message');
    }
  }

  /**
   * Highlight send button to indicate user action required
   * Visual indicator only - NEVER clicks the button
   */
  private highlightSendButton(): void {
    try {
      const sendButton = this.findSendButton();
      if (!sendButton) {
        return;
      }

      // Apply temporary visual highlight
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

    } catch (error) {
      logger.debug({ error }, 'Could not highlight send button');
    }
  }

  /**
   * Extract listing data from listing card in thread
   */
  private extractListingData(): ListingData | null {
    try {
      const listingCard = this.findElement(this.selectors.listingCard);
      if (!listingCard) {
        logger.debug('No listing card found in thread');
        return null;
      }

      // Extract listing URL
      const linkElement = listingCard.querySelector<HTMLAnchorElement>('a[href*="/marketplace/item/"]');
      const listingUrl = linkElement?.href || null;
      
      // Extract listing ID from URL
      const listingIdMatch = listingUrl?.match(/\/marketplace\/item\/(\d+)/);
      const listingId = listingIdMatch?.[1] || null;

      // Extract title
      const titleElement = listingCard.querySelector('span[dir="auto"]') as HTMLElement;
      const title = titleElement?.textContent?.trim() || 'Unknown Listing';

      // Extract price
      const priceElement = Array.from(listingCard.querySelectorAll('span')).find(el => 
        /^\$[\d,]+/.test(el.textContent || '')
      );
      const priceText = priceElement?.textContent?.trim();
      const priceMatch = priceText?.match(/\$?([\d,]+)/);
      const price = priceMatch && priceMatch[1] ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0;

      // Extract image
      const imageElement = listingCard.querySelector<HTMLImageElement>('img');
      const imageUrl = imageElement?.src || null;

      const listingData: ListingData = {
        id: listingId || `unknown-${Date.now()}`,
        title,
        price,
        currency: 'USD',
        description: '',
        imageUrl,
        location: null,
        condition: 'unknown',
      };

      logger.debug({ listingId, title }, 'Listing data extracted');
      return listingData;

    } catch (error) {
      logger.warn({ error }, 'Failed to extract listing data');
      return null;
    }
  }

  /**
   * Extract messages from thread DOM
   */
  private extractMessages(): Message[] {
    try {
      const messageList = this.findElement(this.selectors.messageList);
      if (!messageList) {
        logger.debug('Message list not found');
        return [];
      }

      const messageItems = Array.from(
        messageList.querySelectorAll<HTMLElement>(this.selectors.messageItem.join(','))
      );

      const messages: Message[] = [];
      const threadId = this.getThreadId() || 'unknown';

      for (const item of messageItems) {
        try {
          // Find message text
          const textElement = item.querySelector<HTMLElement>(
            this.selectors.messageText.join(',')
          );
          const text = textElement?.textContent?.trim();
          
          if (!text) continue;

          // Determine sender (heuristic: check if message is right-aligned)
          const isUser = this.isUserMessage(item);

          // Extract timestamp (fallback to current time if not found)
          const timestamp = this.extractTimestamp(item) || Date.now();

          const message: Message = {
            id: `msg-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
            threadId,
            senderType: isUser ? 'user' : 'buyer',
            text,
            timestamp,
            isRead: true,
          };

          messages.push(message);

        } catch (error) {
          logger.debug({ error }, 'Skipping malformed message');
        }
      }

      logger.debug({ count: messages.length }, 'Messages extracted');
      return messages;

    } catch (error) {
      logger.warn({ error }, 'Failed to extract messages');
      return [];
    }
  }

  /**
   * Determine if message is from current user (heuristic)
   */
  private isUserMessage(messageElement: HTMLElement): boolean {
    // Check for right-alignment or user-specific classes
    const computedStyle = window.getComputedStyle(messageElement);
    const isRightAligned = computedStyle.textAlign === 'right' || 
                          computedStyle.justifyContent === 'flex-end';
    
    // Check for color indicators (Facebook often uses blue for user messages)
    const hasUserColor = messageElement.querySelector('[style*="background"]') !== null;
    
    return isRightAligned || hasUserColor;
  }

  /**
   * Extract timestamp from message element
   */
  private extractTimestamp(messageElement: HTMLElement): number | null {
    try {
      // Look for time element or timestamp attribute
      const timeElement = messageElement.querySelector('time');
      if (timeElement) {
        const datetime = timeElement.getAttribute('datetime');
        if (datetime) {
          return new Date(datetime).getTime();
        }
      }

      // Fallback: look for relative time text and convert
      const timeText = messageElement.textContent?.match(/(\d+)\s*(min|hour|day)s?\s*ago/i);
      if (timeText && timeText[1] && timeText[2]) {
        const value = parseInt(timeText[1]);
        const unit = timeText[2].toLowerCase();
        
        const now = Date.now();
        if (unit.startsWith('min')) return now - (value * 60 * 1000);
        if (unit.startsWith('hour')) return now - (value * 60 * 60 * 1000);
        if (unit.startsWith('day')) return now - (value * 24 * 60 * 60 * 1000);
      }

      return null;

    } catch (error) {
      return null;
    }
  }

  /**
   * Extract participant name from thread
   */
  private extractParticipantName(): string | null {
    try {
      // Look for participant name in thread header
      const headerSelectors = [
        '[role="banner"] h1',
        '[role="banner"] span[dir="auto"]',
        'h2[dir="auto"]',
      ];

      for (const selector of headerSelectors) {
        const element = document.querySelector<HTMLElement>(selector);
        const name = element?.textContent?.trim();
        if (name && name.length > 0 && name.length < 100) {
          logger.debug({ name }, 'Participant name found');
          return name;
        }
      }

      logger.debug('Participant name not found');
      return null;

    } catch (error) {
      logger.debug({ error }, 'Error extracting participant name');
      return null;
    }
  }

  /**
   * Get thread ID from URL or DOM
   */
  private getThreadId(): string | null {
    try {
      // Extract from Messenger URL: /messages/t/123456789
      const messengerMatch = window.location.pathname.match(/\/messages\/t\/(\d+)/);
      if (messengerMatch && messengerMatch[1]) {
        return messengerMatch[1];
      }

      // Extract from URL hash: /marketplace/inbox/123456789
      const urlMatch = window.location.pathname.match(/\/marketplace\/inbox\/(\d+)/);
      if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
      }

      // Fallback: Extract from data attributes
      const threadContainer = this.findElement(this.selectors.threadContainer);
      const threadId = threadContainer?.getAttribute('data-thread-id') ||
                      threadContainer?.getAttribute('id')?.replace(/[^\d]/g, '');

      return threadId || null;

    } catch (error) {
      logger.error({ error }, 'Failed to extract thread ID');
      return null;
    }
  }

  /**
   * Generic element finder with selector fallback
   */
  private findElement(selectors: string[]): HTMLElement | null {
    try {
      for (const selector of selectors) {
        const element = document.querySelector<HTMLElement>(selector);
        if (element) {
          return element;
        }
      }
      return null;
    } catch (error) {
      logger.debug({ error }, 'Error finding element');
      return null;
    }
  }

  /**
   * Verify DOM stability before extraction
   * Facebook uses React - wait for hydration
   */
  async waitForDOMStability(): Promise<void> {
    try {
      logger.debug('Waiting for DOM stability');

      // Wait for message input to be present (key indicator)
      await this.waitForElement(this.selectors.messageInput, 5000);

      // Additional wait for React hydration
      await new Promise(resolve => setTimeout(resolve, 500));

      logger.debug('DOM appears stable');

    } catch (error) {
      logger.warn({ error }, 'DOM stability check failed');
    }
  }

  /**
   * Wait for element to appear in DOM
   */
  private waitForElement(selectors: string[], timeout: number): Promise<HTMLElement> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkElement = (): void => {
        const element = this.findElement(selectors);
        
        if (element) {
          resolve(element);
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error('Element wait timeout'));
          return;
        }

        setTimeout(checkElement, 100);
      };

      checkElement();
    });
  }
}
