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
import type { Suggestion } from '@/types/index.ts';

interface PanelState {
  loading: boolean;
  error: string | null;
}

interface SuggestionPayload {
  suggestedMessage: string;
  intentScore: number;
  reasoning: string;
  nextAction: 'ask_availability' | 'send_booking_link' | 'answer_question' | 'close';
}

interface SuggestionErrorPayload {
  error: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSuggestionPayload(value: unknown): value is SuggestionPayload {
  return isRecord(value) &&
    typeof value.suggestedMessage === 'string' &&
    typeof value.intentScore === 'number' &&
    typeof value.reasoning === 'string' &&
    typeof value.nextAction === 'string';
}

function isSuggestionErrorPayload(value: unknown): value is SuggestionErrorPayload {
  return isRecord(value) && typeof value.error === 'string';
}

function getGoalLabel(goal: string): string {
  switch (goal) {
    case 'sell_item':
      return 'Sell Item';
    case 'book_appointment':
      return 'Book Appointment';
    case 'close_deal':
      return 'Close the Deal';
    case 'general_assistance':
      return 'General Help';
    default:
      return goal;
  }
}

function shouldShowUpgrade(errorMessage: string | null): boolean {
  if (!errorMessage) return false;
  const lowered = errorMessage.toLowerCase();
  return lowered.includes('upgrade your plan') || lowered.includes('plan_upgrade_required');
}

export function AssistantPanel(): h.JSX.Element {
  // Connect to Zustand store
  const isAuthenticated = useStore(state => state.isAuthenticated);
  const currentThread = useStore(state => state.currentThread);
  const activeSuggestion = useStore(state => state.activeSuggestion);
  const rateLimitStatus = useStore(state => state.rateLimitStatus);
  const conversationGoal = useStore(state => state.conversationGoal);
  const setConversationGoal = useStore(state => state.setConversationGoal);
  const setActiveSuggestion = useStore(state => state.setActiveSuggestion);
  const clearError = useStore(state => state.clearError);

  // Local UI state
  const [state, setState] = useState<PanelState>({
    loading: false,
    error: null,
  });
  const [customInstructions, setCustomInstructions] = useState<string>('');
  const [savedPresetId, setSavedPresetId] = useState<string>('');
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) {
        return;
      }

      if (!event.data || typeof event.data.type !== 'string') {
        return;
      }

      if (event.data.type === 'SUGGESTION_READY' && isSuggestionPayload(event.data.payload)) {
        const suggestion: Suggestion = {
          id: `suggestion-${Date.now()}`,
          threadId: currentThread?.threadId ?? 'unknown',
          messageText: event.data.payload.suggestedMessage,
          intentScore: {
            type: 'unknown',
            confidence: event.data.payload.intentScore,
            flags: [],
          },
          reasoning: event.data.payload.reasoning,
          generatedAt: Date.now(),
          tokensUsed: 0,
        };

        setActiveSuggestion(suggestion);
        setState({ loading: false, error: null });
        return;
      }

      if (event.data.type === 'SUGGESTION_ERROR' && isSuggestionErrorPayload(event.data.payload)) {
        setActiveSuggestion(null);
        setState({ loading: false, error: event.data.payload.error });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentThread, setActiveSuggestion]);

  useEffect(() => {
    let isMounted = true;

    void chrome.storage.local.get(['conversation_goal']).then((result) => {
      if (!isMounted) return;
      const storedGoal = result.conversation_goal;
      if (typeof storedGoal === 'string' && storedGoal.length > 0) {
        setConversationGoal(storedGoal);
      }
    }).catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [setConversationGoal]);

  useEffect(() => {
    void chrome.storage.local.set({ conversation_goal: conversationGoal }).catch(() => undefined);
  }, [conversationGoal]);

  /**
   * Request AI suggestion from background script
   */
  const handleGenerateSuggestion = (): void => {
    if (!currentThread) {
      setState({ loading: false, error: 'No active thread detected' });
      return;
    }

    setState({ loading: true, error: null });
    clearError();
    setActiveSuggestion(null);

    // Trigger suggestion request via content script
    window.postMessage({
      type: 'REQUEST_SUGGESTION_FROM_UI',
      payload: {
        conversationGoal,
        customInstructions: customInstructions.trim() || undefined,
        savedPresetId: savedPresetId.trim() || undefined,
      },
    }, '*');
  };

  const handleUpgrade = (): void => {
    window.postMessage({ type: 'OPEN_UPGRADE_URL' }, '*');
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: '999px' }}>
              Goal: {getGoalLabel(conversationGoal)}
            </span>
            <span class="status-badge loading">Generating...</span>
          </div>
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
    const showUpgrade = shouldShowUpgrade(state.error);
    const controls = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          What are you trying to accomplish?
          <select
            value={conversationGoal}
            onChange={(event) => setConversationGoal((event.target as HTMLSelectElement).value)}
            style={{ width: '100%', marginTop: '4px' }}
          >
            <option value="general_assistance">General Help</option>
            <option value="sell_item">Sell Item</option>
            <option value="book_appointment">Book Appointment</option>
            <option value="close_deal">Close the Deal</option>
          </select>
        </label>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          Custom instructions (Pro)
          <textarea
            value={customInstructions}
            onInput={(event) => setCustomInstructions((event.target as HTMLTextAreaElement).value)}
            rows={3}
            placeholder="Optional: guidance for the assistant"
            style={{ width: '100%', marginTop: '4px' }}
          />
        </label>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          Saved preset ID (Pro)
          <input
            value={savedPresetId}
            onInput={(event) => setSavedPresetId((event.target as HTMLInputElement).value)}
            placeholder="Optional preset id"
            style={{ width: '100%', marginTop: '4px' }}
          />
        </label>
      </div>
    );

    return (
      <div class="assistant-panel">
        <div class="panel-header">
          <h3>AI Assistant</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: '999px' }}>
              Goal: {getGoalLabel(conversationGoal)}
            </span>
            <span class="status-badge error">Error</span>
          </div>
        </div>
        {controls}
        <div class="error-message">{state.error}</div>
        <div class="actions">
          <button 
            class="secondary" 
            onClick={() => setState({ loading: false, error: null })}
          >
            Dismiss
          </button>
          {showUpgrade && (
            <button class="secondary" onClick={handleUpgrade}>
              Upgrade
            </button>
          )}
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
            <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: '999px' }}>
              Goal: {getGoalLabel(conversationGoal)}
            </span>
            <span class={`intent-badge ${intentBadge.className}`}>
              {intentBadge.label}
            </span>
            <span class="status-badge ready">Ready</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', color: '#374151' }}>
              What are you trying to accomplish?
              <select
                value={conversationGoal}
                onChange={(event) => setConversationGoal((event.target as HTMLSelectElement).value)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <option value="general_assistance">General Help</option>
                <option value="sell_item">Sell Item</option>
                <option value="book_appointment">Book Appointment</option>
                <option value="close_deal">Close the Deal</option>
              </select>
            </label>
            <label style={{ fontSize: '12px', color: '#374151' }}>
              Custom instructions (Pro)
              <textarea
                value={customInstructions}
                onInput={(event) => setCustomInstructions((event.target as HTMLTextAreaElement).value)}
                rows={3}
                placeholder="Optional: guidance for the assistant"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </label>
            <label style={{ fontSize: '12px', color: '#374151' }}>
              Saved preset ID (Pro)
              <input
                value={savedPresetId}
                onInput={(event) => setSavedPresetId((event.target as HTMLInputElement).value)}
                placeholder="Optional preset id"
                style={{ width: '100%', marginTop: '4px' }}
              />
            </label>
          </div>
          <div class="suggestion-text">{activeSuggestion.messageText}</div>
          <div class="suggestion-reasoning">{activeSuggestion.reasoning}</div>
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', background: '#F3F4F6', color: '#374151', padding: '2px 6px', borderRadius: '999px' }}>
            Goal: {getGoalLabel(conversationGoal)}
          </span>
          <span class="status-badge ready">Ready</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          What are you trying to accomplish?
          <select
            value={conversationGoal}
            onChange={(event) => setConversationGoal((event.target as HTMLSelectElement).value)}
            style={{ width: '100%', marginTop: '4px' }}
          >
            <option value="general_assistance">General Help</option>
            <option value="sell_item">Sell Item</option>
            <option value="book_appointment">Book Appointment</option>
            <option value="close_deal">Close the Deal</option>
          </select>
        </label>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          Custom instructions (Pro)
          <textarea
            value={customInstructions}
            onInput={(event) => setCustomInstructions((event.target as HTMLTextAreaElement).value)}
            rows={3}
            placeholder="Optional: guidance for the assistant"
            style={{ width: '100%', marginTop: '4px' }}
          />
        </label>
        <label style={{ fontSize: '12px', color: '#374151' }}>
          Saved preset ID (Pro)
          <input
            value={savedPresetId}
            onInput={(event) => setSavedPresetId((event.target as HTMLInputElement).value)}
            placeholder="Optional preset id"
            style={{ width: '100%', marginTop: '4px' }}
          />
        </label>
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
