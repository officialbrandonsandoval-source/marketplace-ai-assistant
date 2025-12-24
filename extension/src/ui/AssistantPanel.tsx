/**
 * AI Assistant Panel Component
 * Main UI component injected into Facebook Marketplace
 * 
 * PHASE 2 IMPLEMENTATION:
 * ✓ Display AI-generated suggestion
 * ✓ Show intent score indicator
 * ✓ Action buttons: "Generate Reply", "Use Reply", "Dismiss"
 * ✓ Loading/error states
 * ✓ Character count display
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { useStore } from '@/store/use-store.ts';
import type { ExtensionMessage, ExtensionMessageResponse, Suggestion } from '@/types/index.ts';

interface PanelState {
  loading: boolean;
  error: string | null;
}

export function AssistantPanel(): h.JSX.Element {
  // Connect to Zustand store
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const currentThread = useStore(state => state.currentThread);
  const activeSuggestion = useStore(state => state.activeSuggestion);
  const rateLimitStatus = useStore(state => state.rateLimitStatus);
  const setActiveSuggestion = useStore(state => state.setActiveSuggestion);
  const clearError = useStore(state => state.clearError);

  // Local UI state
  const [state, setState] = useState<PanelState>({
    loading: false,
    error: null,
  });

  /**
   * Request AI suggestion from background script
   */
  const handleGenerateSuggestion = async (): Promise<void> => {
    if (!currentThread) {
      setState({ loading: false, error: 'No active thread detected' });
      return;
    }

    setState({ loading: true, error: null });
    clearError();

    try {
      // Send message to background script to request suggestion
      const message: ExtensionMessage = {
        type: 'GET_SUGGESTION',
        payload: {
          threadContext: currentThread,
        },
        requestId: `req-${Date.now()}`,
        timestamp: Date.now(),
      };

      const response = await chrome.runtime.sendMessage<
        ExtensionMessage,
        ExtensionMessageResponse<{ suggestion: Suggestion }>
      >(message);

      if (response.success && response.data) {
        setActiveSuggestion(response.data.suggestion);
        setState({ loading: false, error: null });
      } else {
        setState({ 
          loading: false, 
          error: response.error?.message || 'Failed to generate suggestion' 
        });
      }

    } catch (error) {
      console.error('[Claude] Failed to request suggestion:', error);
      setState({ 
        loading: false, 
        error: 'Failed to communicate with background script' 
      });
    }
  };

  /**
   * Insert draft message into Facebook's composer
   */
  const handleUseDraft = (): void => {
    if (!activeSuggestion) {
      return;
    }

    try {
      // Send message to content script to insert draft
      window.postMessage({
        type: 'CLAUDE_USE_DRAFT',
        payload: { message: activeSuggestion.messageText },
      }, '*');

      console.log('[Claude] Draft insertion requested');

    } catch (error) {
      console.error('[Claude] Failed to insert draft:', error);
      setState(prev => ({ 
        ...prev, 
        error: 'Failed to insert draft message' 
      }));
    }
  };

  /**
   * Dismiss current suggestion
   */
  const handleDismiss = (): void => {
    setActiveSuggestion(null);
    setState({ loading: false, error: null });
  };

  /**
   * Get intent badge color and label
   */
  const getIntentBadge = (confidence: number): { className: string; label: string } => {
    if (confidence >= 0.8) {
      return { className: 'high', label: 'High Interest' };
    } else if (confidence >= 0.5) {
      return { className: 'medium', label: 'Moderate Interest' };
    } else {
      return { className: 'low', label: 'Low Intent' };
    }
  };

  /**
   * Calculate character count warning
   */
  const getCharCountClass = (length: number): string => {
    return length > 200 ? 'warning' : '';
  };

  // Render loading state
  if (state.loading) {
    return (
      <div class="assistant-panel">
        <div class="panel-header">
          <h3>AI Assistant</h3>
          <span class="status-badge loading">Generating...</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0' }}>
          <span class="spinner"></span>
          <span>Claude is analyzing the conversation...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (state.error) {
    return (
      <div class="assistant-panel">
        <div class="panel-header">
          <h3>AI Assistant</h3>
          <span class="status-badge error">Error</span>
        </div>
        <div class="error-message">{state.error}</div>
        <div class="actions">
          <button 
            class="secondary" 
            onClick={() => setState({ loading: false, error: null })}
          >
            Dismiss
          </button>
          <button 
            class="primary" 
            onClick={handleGenerateSuggestion}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Render suggestion display
  if (activeSuggestion) {
    const intentBadge = getIntentBadge(activeSuggestion.intentScore.confidence);
    const charCount = activeSuggestion.messageText.length;

    return (
      <div class="assistant-panel">
        <div class="panel-header">
          <h3>AI Assistant</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span class={`intent-badge ${intentBadge.className}`}>
              {intentBadge.label}
            </span>
            <span class="status-badge ready">Ready</span>
          </div>
        </div>

        <div>
          <div class="suggestion-text">{activeSuggestion.messageText}</div>
          <div class={`char-count ${getCharCountClass(charCount)}`}>
            {charCount} characters {charCount > 200 && '(consider shortening)'}
          </div>
        </div>

        <div class="actions">
          <button 
            class="secondary" 
            onClick={handleDismiss}
          >
            Dismiss
          </button>
          <button 
            class="primary" 
            onClick={handleUseDraft}
          >
            Insert into Chat
          </button>
        </div>
      </div>
    );
  }

  // Render initial state (ready to generate)
  return (
    <div class="assistant-panel">
      <div class="panel-header">
        <h3>AI Assistant</h3>
        <span class="status-badge ready">Ready</span>
      </div>

      <div style={{ marginBottom: '12px', color: '#6b7280', fontSize: '13px' }}>
        {currentThread 
          ? `Analyzing ${currentThread.messages.length} message${currentThread.messages.length !== 1 ? 's' : ''} in this thread`
          : 'Waiting for thread detection...'}
      </div>

      {rateLimitStatus && rateLimitStatus.remaining === 0 && (
        <div class="error-message">
          Rate limit reached. Resets at {new Date(rateLimitStatus.resetAt).toLocaleTimeString()}
        </div>
      )}

      <div class="actions">
        <button 
          class="primary" 
          onClick={handleGenerateSuggestion}
          disabled={!currentThread || !isAuthenticated || (rateLimitStatus?.remaining === 0)}
        >
          {!isAuthenticated 
            ? 'Not Authenticated' 
            : !currentThread 
            ? 'No Thread Detected'
            : 'Generate Reply'}
        </button>
      </div>
    </div>
  );
}
