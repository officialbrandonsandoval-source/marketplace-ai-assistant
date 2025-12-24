/**
 * Token Manager
 * Manages JWT access and refresh tokens
 * 
 * PHASE 3 IMPLEMENTATION REQUIRED:
 * - Store tokens securely in chrome.storage.local
 * - Check token expiration
 * - Automatic refresh when expired
 * - Clear tokens on logout
 */

import type { AuthTokens } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

export class TokenManager {
  private static STORAGE_KEY = 'authTokens';
  private refreshPromise: Promise<AuthTokens> | null = null;

  /**
   * Get stored tokens
   */
  async getTokens(): Promise<AuthTokens | null> {
    try {
      const result = await chrome.storage.local.get(TokenManager.STORAGE_KEY);
      const tokens = result[TokenManager.STORAGE_KEY] as AuthTokens | undefined;
      
      if (!tokens) {
        return null;
      }

      // Check if expired
      if (this.isExpired(tokens)) {
        logger.info('Tokens expired');
        return null;
      }

      return tokens;
    } catch (error) {
      logger.error({ error }, 'Error getting tokens');
      return null;
    }
  }

  /**
   * Store new tokens
   */
  async setTokens(tokens: AuthTokens): Promise<void> {
    try {
      await chrome.storage.local.set({
        [TokenManager.STORAGE_KEY]: tokens,
      });
      logger.info('Tokens stored');
    } catch (error) {
      logger.error({ error }, 'Error storing tokens');
      throw error;
    }
  }

  /**
   * Clear stored tokens (logout)
   */
  async clearTokens(): Promise<void> {
    try {
      await chrome.storage.local.remove(TokenManager.STORAGE_KEY);
      logger.info('Tokens cleared');
    } catch (error) {
      logger.error({ error }, 'Error clearing tokens');
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * TODO Phase 3: Implement actual refresh logic
   */
  async refreshTokens(): Promise<AuthTokens> {
    // Prevent multiple simultaneous refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.doRefresh();

    try {
      const tokens = await this.refreshPromise;
      return tokens;
    } finally {
      this.refreshPromise = null;
    }
  }

  /**
   * Perform token refresh
   */
  private async doRefresh(): Promise<AuthTokens> {
    logger.info('Refreshing tokens');

    // TODO Phase 3: Call backend /auth/refresh endpoint
    // - Get current refresh token
    // - POST to /api/v1/auth/refresh
    // - Store new tokens
    // - Return new tokens

    throw new Error('Token refresh not implemented (Phase 3)');
  }

  /**
   * Check if tokens are expired
   */
  private isExpired(tokens: AuthTokens): boolean {
    const now = Date.now();
    const bufferMs = 60 * 1000; // 1 minute buffer
    return tokens.expiresAt - bufferMs < now;
  }

  /**
   * Get access token (refresh if needed)
   */
  async getAccessToken(): Promise<string | null> {
    const tokens = await this.getTokens();
    
    if (!tokens) {
      return null;
    }

    // Refresh if close to expiration
    if (this.isExpired(tokens)) {
      try {
        const newTokens = await this.refreshTokens();
        return newTokens.accessToken;
      } catch (error) {
        logger.error({ error }, 'Token refresh failed');
        return null;
      }
    }

    return tokens.accessToken;
  }
}
