/**
 * API Client for Backend Communication
 * Handles all HTTP requests to the SaaS backend
 * 
 * HTTP request wrapper with retry logic
 * Automatic JWT token injection
 * Token refresh on 401 errors
 * Request/response logging
 * Error handling
 */

import type { APIRequest, APIResponse, APIClientConfig } from '@/types/index.ts';
import { logger } from '@/utils/logger.ts';
import { TokenManager } from './token-manager.ts';

export class APIClient {
  private config: APIClientConfig;
  private tokenManager: TokenManager;

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = {
      baseURL: config.baseURL || process.env.API_BASE_URL || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
    };

    this.tokenManager = new TokenManager();
    logger.info({ baseURL: this.config.baseURL }, 'API client initialized');
  }

  /**
   * Make authenticated API request
   */
  async request<TRequest, TResponse>(
    request: APIRequest<TRequest>
  ): Promise<APIResponse<TResponse>> {
    logger.info({ method: request.method, endpoint: request.endpoint }, 'API request');

    let attempt = 0;
    let refreshed = false;
    const url = this.buildURL(request.endpoint);

    while (attempt <= this.config.retryAttempts) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(request.headers ?? {}),
        };

        if (request.requiresAuth) {
          const accessToken = await this.tokenManager.getAccessToken();
          if (!accessToken) {
            return {
              success: false,
              data: null,
              error: {
                code: 'AUTH_EXPIRED',
                message: 'Authentication required',
                details: null,
              },
              statusCode: 401,
            };
          }
          headers.Authorization = `Bearer ${accessToken}`;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        const response = await fetch(url, {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 && request.requiresAuth && !refreshed) {
          try {
            await this.tokenManager.refreshTokens();
            refreshed = true;
            attempt += 1;
            continue;
          } catch (error) {
            logger.warn({ error }, 'Token refresh failed');
          }
        }

        const statusCode = response.status;
        if (!response.ok) {
          const message = await this.extractErrorMessage(response);
          return {
            success: false,
            data: null,
            error: {
              code: 'API_ERROR',
              message: message || `Request failed with status ${statusCode}`,
              details: null,
            },
            statusCode,
          };
        }

        const data = (await response.json()) as TResponse;
        return {
          success: true,
          data,
          error: null,
          statusCode,
        };
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === 'AbortError';
        if (attempt >= this.config.retryAttempts) {
          return {
            success: false,
            data: null,
            error: {
              code: 'NETWORK_ERROR',
              message: isAbort ? 'Request timed out' : 'Network error',
              details: null,
            },
            statusCode: 0,
          };
        }
        await this.sleep(this.config.retryDelay * Math.max(1, attempt + 1));
        attempt += 1;
      }
    }

    return {
      success: false,
      data: null,
      error: {
        code: 'NETWORK_ERROR',
        message: 'Request failed after retries',
        details: null,
      },
      statusCode: 0,
    };
  }

  /**
   * GET request helper
   */
  async get<TResponse>(endpoint: string, requiresAuth = true): Promise<APIResponse<TResponse>> {
    return this.request<never, TResponse>({
      method: 'GET',
      endpoint,
      requiresAuth,
    });
  }

  /**
   * POST request helper
   */
  async post<TRequest, TResponse>(
    endpoint: string,
    body: TRequest,
    requiresAuth = true
  ): Promise<APIResponse<TResponse>> {
    return this.request<TRequest, TResponse>({
      method: 'POST',
      endpoint,
      body,
      requiresAuth,
    });
  }

  /**
   * Build full URL from endpoint
   */
  private buildURL(endpoint: string): string {
    return `${this.config.baseURL}${endpoint}`;
  }

  /**
   * Get auth header from stored tokens
   */
  private async getAuthHeader(): Promise<Record<string, string>> {
    const accessToken = await this.tokenManager.getAccessToken();
    if (!accessToken) {
      return {};
    }
    return { Authorization: `Bearer ${accessToken}` };
  }

  private async extractErrorMessage(response: Response): Promise<string | null> {
    try {
      const data = (await response.json()) as { message?: string; error?: string };
      return data.message ?? data.error ?? null;
    } catch {
      return null;
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
