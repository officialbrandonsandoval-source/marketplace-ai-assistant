/**
 * Core type definitions for the Facebook Marketplace AI Assistant extension
 * All types use strict TypeScript mode - no any, no implicit nulls
 */

// ============================================================================
// Account & Authentication
// ============================================================================

export interface Account {
  id: string;
  planTier: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  accountId: string;
  email: string;
  deviceFingerprint: string;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// ============================================================================
// Facebook Marketplace Domain
// ============================================================================

export interface ThreadContext {
  threadId: string;
  listingData: ListingData | null;
  messages: Message[];
  participantName: string | null;
  lastMessageTimestamp: number;
  isRead: boolean;
}

export interface ListingData {
  id: string;
  title: string;
  price: number;
  currency: string;
  description: string;
  imageUrl: string | null;
  location: string | null;
  condition: 'new' | 'used' | 'unknown';
}

export interface Message {
  id: string;
  threadId: string;
  senderType: 'user' | 'buyer' | 'system';
  text: string;
  timestamp: number;
  isRead: boolean;
}

// ============================================================================
// AI Suggestion Domain
// ============================================================================

export interface SuggestionRequest {
  accountId: string;
  threadId: string;
  context: ThreadContext;
  preferences: UserPreferences;
}

export interface SuggestionResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  suggestion: Suggestion | null;
  error: string | null;
}

export interface Suggestion {
  id: string;
  threadId: string;
  messageText: string;
  intentScore: IntentScore;
  reasoning: string;
  generatedAt: number;
  tokensUsed: number;
}

export interface IntentScore {
  type: 'purchase' | 'negotiation' | 'inquiry' | 'spam' | 'unknown';
  confidence: number; // 0.0 - 1.0
  flags: IntentFlag[];
}

export type IntentFlag = 
  | 'urgent'
  | 'price_negotiation'
  | 'meetup_request'
  | 'contact_info_shared'
  | 'suspicious'
  | 'requires_human_review';

export interface UserPreferences {
  tone: 'professional' | 'casual' | 'friendly';
  autoIncludePrice: boolean;
  autoIncludeLocation: boolean;
  maxResponseLength: number;
}

// ============================================================================
// Action Logging & Audit
// ============================================================================

export interface ActionLog {
  id: string;
  accountId: string;
  userId: string;
  threadId: string | null;
  actionType: ActionType;
  payload: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  timestamp: number;
}

export type ActionType =
  | 'suggestion_requested'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  | 'suggestion_edited'
  | 'manual_message_sent'
  | 'thread_archived'
  | 'settings_changed';

// ============================================================================
// Rate Limiting & Circuit Breaker
// ============================================================================

export interface RateLimitStatus {
  accountId: string;
  resource: string;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface CircuitBreakerState {
  service: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureAt: number | null;
  nextAttemptAt: number | null;
}

// ============================================================================
// Extension Internal State
// ============================================================================

export interface ExtensionState {
  isAuthenticated: boolean;
  currentThread: ThreadContext | null;
  activeSuggestion: Suggestion | null;
  rateLimitStatus: RateLimitStatus | null;
  conversationGoal: string;
  uiVisible: boolean;
  error: ExtensionError | null;
}

export interface ExtensionError {
  code: ErrorCode;
  message: string;
  details: Record<string, unknown> | null;
  timestamp: number;
}

export type ErrorCode =
  | 'AUTH_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'DOM_PARSE_ERROR'
  | 'INVALID_CONTEXT'
  | 'API_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'UNKNOWN_ERROR';

// ============================================================================
// Message Passing (Background <-> Content Script)
// ============================================================================

export type MessageType =
  | 'GET_SUGGESTION'
  | 'POLL_SUGGESTION'
  | 'USE_SUGGESTION'
  | 'DISMISS_SUGGESTION'
  | 'REFRESH_TOKEN'
  | 'LOG_ACTION'
  | 'GET_RATE_LIMIT';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  payload: T;
  requestId: string;
  timestamp: number;
}

export interface ExtensionMessageResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: ExtensionError | null;
  requestId: string;
}

// ============================================================================
// DOM Selector Configuration
// ============================================================================

export interface DOMSelectors {
  messageInput: string[];
  messageList: string[];
  threadContainer: string[];
  sendButton: string[];
  listingCard: string[];
}

export interface DOMElements {
  messageInput: HTMLElement | null;
  messageList: HTMLElement | null;
  threadContainer: HTMLElement | null;
  sendButton: HTMLElement | null;
}

// ============================================================================
// API Client Types
// ============================================================================

export interface APIClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface APIRequest<T = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  endpoint: string;
  body?: T;
  headers?: Record<string, string>;
  requiresAuth: boolean;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data: T | null;
  error: APIError | null;
  statusCode: number;
}

export interface APIError {
  code: string;
  message: string;
  details: Record<string, unknown> | null;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Timestamp = number;
export type UUID = string;

// Type guard for checking if value is defined
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

// Type guard for checking ThreadContext validity
export function isValidThreadContext(context: unknown): context is ThreadContext {
  if (typeof context !== 'object' || context === null) return false;
  const ctx = context as Partial<ThreadContext>;
  return (
    typeof ctx.threadId === 'string' &&
    Array.isArray(ctx.messages) &&
    typeof ctx.lastMessageTimestamp === 'number'
  );
}
