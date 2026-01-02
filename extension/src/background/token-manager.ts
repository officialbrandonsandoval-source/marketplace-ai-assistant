/**
 * Token Manager
 * Manages JWT access and refresh tokens
 * 
 * Stores tokens securely in chrome.storage.local
 * Checks token expiration and refreshes when needed
 */

import type { AuthTokens } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';

const DEFAULT_TOKEN_TTL_MS = 10 * 60 * 1000;

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

    const existing = await this.getTokens();
    if (!existing?.refreshToken) {
      throw new Error('Refresh token missing');
    }

    const response = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3000'}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: existing.refreshToken }),
    });

    if (!response.ok) {
      const message = await this.extractErrorMessage(response);
      throw new Error(message || `Refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as { accessToken?: string };
    if (!data.accessToken) {
      throw new Error('Refresh failed: accessToken missing');
    }

    const expiresAt = this.getJwtExpiry(data.accessToken) ?? (Date.now() + DEFAULT_TOKEN_TTL_MS);
    const tokens: AuthTokens = {
      accessToken: data.accessToken,
      refreshToken: existing.refreshToken,
      expiresAt,
    };

    await this.setTokens(tokens);
    return tokens;
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

  private getJwtExpiry(token: string): number | null {
    const payload = this.decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') {
      return null;
    }
    return payload.exp * 1000;
  }

  private decodeJwtPayload(token: string): { exp?: number } | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    try {
      const payload = parts[1] ?? '';
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = atob(normalized);
      const data = JSON.parse(decoded) as { exp?: number };
      return data;
    } catch {
      return null;
    }
  }

  private async extractErrorMessage(response: Response): Promise<string | null> {
    try {
      const data = (await response.json()) as { message?: string; error?: string };
      return data.message ?? data.error ?? null;
    } catch {
      return null;
    }
  }
}
