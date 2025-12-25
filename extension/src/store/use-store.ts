/**
 * Zustand Store for Extension State
 * Manages global state across content script and UI components
 * 
 * PHASE 2 IMPLEMENTATION REQUIRED:
 * - Authentication state
 * - Current thread context
 * - Active suggestion
 * - Rate limit status
 * - UI visibility
 * - Error handling
 */

import { create } from 'zustand';
import type { ExtensionState, ThreadContext, Suggestion, RateLimitStatus, ExtensionError } from '@/types/index.ts';

interface ExtensionStore extends ExtensionState {
  // Actions
  setAuthenticated: (isAuthenticated: boolean) => void;
  setCurrentThread: (thread: ThreadContext | null) => void;
  setActiveSuggestion: (suggestion: Suggestion | null) => void;
  setRateLimitStatus: (status: RateLimitStatus | null) => void;
  setConversationGoal: (goal: string) => void;
  setUIVisible: (visible: boolean) => void;
  setError: (error: ExtensionError | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState: ExtensionState = {
  isAuthenticated: false,
  currentThread: null,
  activeSuggestion: null,
  rateLimitStatus: null,
  conversationGoal: 'general_assistance',
  uiVisible: false,
  error: null,
};

export const useStore = create<ExtensionStore>((set) => ({
  ...initialState,

  setAuthenticated: (isAuthenticated) => 
    set({ isAuthenticated }),

  setCurrentThread: (currentThread) => 
    set({ currentThread }),

  setActiveSuggestion: (activeSuggestion) => 
    set({ activeSuggestion }),

  setRateLimitStatus: (rateLimitStatus) => 
    set({ rateLimitStatus }),

  setConversationGoal: (conversationGoal) =>
    set({ conversationGoal }),

  setUIVisible: (uiVisible) => 
    set({ uiVisible }),

  setError: (error) => 
    set({ error }),

  clearError: () => 
    set({ error: null }),

  reset: () => 
    set(initialState),
}));

// TODO Phase 2: Add selectors for derived state
// Example: export const selectHasSuggestion = (state: ExtensionStore) => state.activeSuggestion !== null;
