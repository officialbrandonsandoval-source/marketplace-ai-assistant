/**
 * AI Assistant Panel Component
 * Main UI component injected into Facebook Marketplace
 * 
 * PHASE 2 IMPLEMENTATION REQUIRED:
 * - Display AI-generated suggestion
 * - Show intent score indicator
 * - Action buttons: "Use Reply", "Edit Draft", "Dismiss"
 * - Loading/error states
 * - Booking widget (Phase 5)
 */

import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { Suggestion, ExtensionState } from '@/types/index.ts';

interface AssistantPanelProps {
  // TODO Phase 2: Define props from parent/injector
}

export function AssistantPanel(props: AssistantPanelProps): h.JSX.Element {
  const [state, setState] = useState<ExtensionState>({
    isAuthenticated: false,
    currentThread: null,
    activeSuggestion: null,
    rateLimitStatus: null,
    uiVisible: true,
    error: null,
  });

  useEffect(() => {
    // TODO Phase 2: Connect to Zustand store
    // TODO Phase 2: Subscribe to state updates
    // TODO Phase 2: Request suggestion on mount if authenticated
  }, []);

  const handleUseSuggestion = (): void => {
    // TODO Phase 2: Send message to content script to insert draft
  };

  const handleDismiss = (): void => {
    // TODO Phase 2: Hide panel and clear suggestion
  };

  const handleEditDraft = (): void => {
    // TODO Phase 2: Insert draft with edit mode enabled
  };

  // TODO Phase 2: Implement actual UI
  return (
    <div className="assistant-panel">
      <div className="panel-header">
        <h3>AI Assistant</h3>
        <span className="status">Phase 2 - UI Not Implemented</span>
      </div>
      
      <div className="panel-content">
        <p>Suggestion will appear here</p>
        
        {/* TODO Phase 2: Show loading spinner when fetching */}
        {/* TODO Phase 2: Show error message if failed */}
        {/* TODO Phase 2: Show suggestion with intent score */}
        {/* TODO Phase 2: Show action buttons */}
      </div>

      <style>{`
        .assistant-panel {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: white;
          border: 1px solid #e4e6eb;
          border-radius: 8px;
          padding: 16px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          max-width: 400px;
        }
        
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }
        
        .status {
          font-size: 12px;
          color: #65676b;
        }
        
        .panel-content {
          color: #050505;
        }
      `}</style>
    </div>
  );
}
