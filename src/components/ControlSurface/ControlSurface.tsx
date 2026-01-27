import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useVoice } from '../../hooks/useVoice';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useLLM } from '../../services/llm';
import { getAllThoughts, onThoughtsChange } from '../../sync';
import { useSettingsStore, getApiKey } from '../../store/settingsStore';
import { useWindowStore } from '../../store/windowStore';
import type { Thought } from '../../models/types';
import ThoughtList from '../common/ThoughtList';
import './ControlSurface.css';

// Lazy load modals/overlays
const ThoughtHistory = lazy(() => import('../common/ThoughtHistory'));
const Settings = lazy(() => import('../Settings'));
const CharacterSelector = lazy(() => import('../CharacterSelector/CharacterSelector'));
const ConversationView = lazy(() => import('../ConversationView/ConversationView'));
const SetupWizard = lazy(() => import('../SetupWizard'));

export default function ControlSurface() {
  const { voiceState, lastTranscript, accumulatedTranscript, lastError, isListening, isDictating, dictationTargetWindowId, startListening, stopListening, clearError, clearTranscript, debugState } = useVoice();
  const { processTranscript, isProcessing: llmProcessing, lastResponse, streamingText } = useLLM();
  const { setupCompleted, setSetupCompleted } = useSettingsStore();
  const [showHelp, setShowHelp] = useState(false);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);

  // Show setup wizard if not completed and no Anthropic key
  const showSetupWizard = !setupCompleted && !getApiKey('anthropic');

  const handleSetupComplete = useCallback(() => {
    setSetupCompleted(true);
  }, [setSetupCompleted]);

  const handleSelectCharacter = useCallback((characterId: string) => {
    setActiveCharacterId(characterId);
    setShowCharacters(false);
  }, []);

  // Toggle voice on/off
  const toggleVoice = useCallback(() => {
    if (voiceState === 'listening') {
      stopListening();
    } else {
      startListening();
    }
  }, [voiceState, startListening, stopListening]);

  // Manual send: user explicitly sends accumulated transcript to LLM
  const handleSend = useCallback(() => {
    if (!accumulatedTranscript.trim() || llmProcessing) return;
    if (isListening) stopListening();
    processTranscript(accumulatedTranscript);
    clearTranscript();
  }, [accumulatedTranscript, llmProcessing, isListening, stopListening, processTranscript, clearTranscript]);

  // Keyboard shortcuts
  useKeyboard({
    onOpenSettings: () => setShowSettings(true),
    onOpenHistory: () => setShowHistory(true),
    onToggleVoice: toggleVoice,
  });

  // Additional keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter: Send accumulated transcript to LLM
      if (e.key === 'Enter' && !e.metaKey && !e.shiftKey && !e.altKey) {
        if (accumulatedTranscript.trim() && !llmProcessing) {
          e.preventDefault();
          handleSend();
        }
      }
      // Cmd+K: Characters
      if (e.metaKey && e.key === 'k') {
        e.preventDefault();
        setShowCharacters(true);
      }
      // Cmd+? or Cmd+/: Help
      if (e.metaKey && (e.key === '?' || e.key === '/')) {
        e.preventDefault();
        setShowHelp(prev => !prev);
      }
      // Cmd+D: Toggle debug panel
      if (e.metaKey && e.key === 'd') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [accumulatedTranscript, llmProcessing, handleSend]);

  // Listen for open-settings custom event (from other components)
  useEffect(() => {
    const handleOpenSettings = () => setShowSettings(true);
    window.addEventListener('open-settings', handleOpenSettings);
    return () => window.removeEventListener('open-settings', handleOpenSettings);
  }, []);

  // Load and subscribe to thoughts
  useEffect(() => {
    setThoughts(getAllThoughts());
    const unsubscribe = onThoughtsChange(setThoughts);
    return unsubscribe;
  }, []);

  // If a character is active, show conversation view
  if (activeCharacterId) {
    return (
      <Suspense fallback={<div className="loading">Loading conversation...</div>}>
        <ConversationView
          characterId={activeCharacterId}
          onClose={() => setActiveCharacterId(null)}
        />
      </Suspense>
    );
  }

  // Show setup wizard on first launch
  if (showSetupWizard) {
    return (
      <Suspense fallback={<div className="loading">Loading...</div>}>
        <SetupWizard onComplete={handleSetupComplete} />
      </Suspense>
    );
  }

  return (
    <div className="control-surface">
      <Suspense fallback={null}>
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
        {showHistory && <ThoughtHistory thoughts={thoughts} onClose={() => setShowHistory(false)} />}
        {showCharacters && (
          <CharacterSelector
            onSelectCharacter={handleSelectCharacter}
            onClose={() => setShowCharacters(false)}
          />
        )}
      </Suspense>

      {/* Help Overlay */}
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <header className="help-header">
              <h2>Keyboard Shortcuts</h2>
              <button className="help-close" onClick={() => setShowHelp(false)}>&times;</button>
            </header>
            <div className="help-content">
              <section className="help-section">
                <h3>Voice</h3>
                <div className="shortcut-row"><kbd>Esc</kbd><span>Start/Stop voice input</span></div>
                <div className="shortcut-row"><kbd>Cmd+Shift+V</kbd><span>Enable/Disable voice</span></div>
              </section>
              <section className="help-section">
                <h3>Navigation</h3>
                <div className="shortcut-row"><kbd>Cmd+K</kbd><span>Open characters</span></div>
                <div className="shortcut-row"><kbd>Cmd+,</kbd><span>Open settings</span></div>
                <div className="shortcut-row"><kbd>Cmd+Shift+H</kbd><span>View history</span></div>
                <div className="shortcut-row"><kbd>Cmd+/</kbd><span>Show this help</span></div>
              </section>
              <section className="help-section">
                <h3>Actions</h3>
                <div className="shortcut-row"><kbd>Cmd+N</kbd><span>New thought</span></div>
                <div className="shortcut-row"><kbd>Cmd+W</kbd><span>Close window</span></div>
                <div className="shortcut-row"><kbd>Cmd+Z</kbd><span>Undo</span></div>
              </section>
            </div>
          </div>
        </div>
      )}

      <header className="control-header">
        <h1 className="app-title">Koe</h1>
        <div className="header-actions">
          <button
            className="characters-btn"
            onClick={() => setShowCharacters(true)}
            title="Characters (Cmd+K)"
            aria-label="Open characters"
          >
            <CharacterIcon />
          </button>
          <button
            className="history-btn"
            onClick={() => setShowHistory(true)}
            title="Thought History (Cmd+Shift+H)"
            aria-label="View thought history"
          >
            <HistoryIcon />
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings (Cmd+,)"
            aria-label="Open settings"
          >
            <SettingsIcon />
          </button>
          <button
            className="help-btn"
            onClick={() => setShowHelp(true)}
            title="Help (Cmd+/)"
            aria-label="Show help"
          >
            <HelpIcon />
          </button>
        </div>
      </header>

      {/* Dictation Mode Indicator */}
      {isDictating && (
        <div className="dictation-banner">
          <span className="dictation-icon">🎙️</span>
          <span className="dictation-text">
            DICTATING to W{dictationTargetWindowId ? useWindowStore.getState().getDisplayId(dictationTargetWindowId) : '?'}
          </span>
          <span className="dictation-hint">Say "stop dictating" to exit</span>
        </div>
      )}

      {/* Debug Panel - collapsible (Cmd+D) */}
      {showDebug && (
        <div style={{
          background: '#1a1a2e',
          padding: '10px 12px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: '#aaa',
          borderBottom: '1px solid #333',
          lineHeight: '1.6',
        }}>
          <div>
            <strong style={{ color: '#06d6a0' }}>DEBUG PANEL</strong>
            <span style={{ color: '#666', marginLeft: 8 }}>(Cmd+D to hide)</span>
          </div>
          <div>Listener: {debugState?.listenerAttached ? '✅ Attached' : '❌ Not attached'}</div>
          <div>Events received: {debugState?.eventsReceived || 0}</div>
          <div>Last event: {debugState?.lastEventTime || 'none'}</div>
          <div>Last text: {debugState?.lastEventText || '(none)'}</div>
          <div>Store transcript: {lastTranscript ? `"${lastTranscript.slice(0, 40)}..."` : '(empty)'}</div>
          <div>Voice mode: {isDictating ? '🎤 DICTATE' : '⚡ COMMAND'}</div>
          {debugState?.errors?.length > 0 && (
            <div style={{ color: '#f66' }}>Errors: {debugState.errors.join(', ')}</div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {lastError && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{lastError}</span>
          <button className="error-dismiss" onClick={clearError} title="Dismiss">
            ×
          </button>
        </div>
      )}

      {/* Main content: transcript hero area */}
      <main className="control-main">
        <section className="transcript-hero">
          {accumulatedTranscript ? (
            <div className="transcript-text">{accumulatedTranscript}</div>
          ) : streamingText ? (
            <div className="transcript-text streaming">{streamingText}</div>
          ) : lastResponse ? (
            <div className="transcript-response">{lastResponse}</div>
          ) : (
            <div className="transcript-placeholder">
              {isListening ? 'Listening... just speak.' : 'Press Esc to start speaking.'}
            </div>
          )}
        </section>

        {/* Voice + Send controls */}
        <div className="voice-send-bar">
          <button
            className={`voice-toggle ${isListening ? 'listening' : ''}`}
            onClick={toggleVoice}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            <MicrophoneIcon />
            <span>{isListening ? 'Listening' : 'Speak'}</span>
          </button>

          {accumulatedTranscript.trim() && (
            <>
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={llmProcessing}
                aria-label="Send to Koe"
              >
                Send
                <kbd>↵</kbd>
              </button>
              <button
                className="clear-btn"
                onClick={clearTranscript}
                aria-label="Clear transcript"
                title="Clear"
              >
                ×
              </button>
            </>
          )}

          {llmProcessing && <span className="processing-indicator">Processing...</span>}
        </div>

        {/* Thoughts - compact */}
        {thoughts.length > 0 && (
          <section className="thoughts-section">
            <div className="thoughts-header">
              <h2 className="section-title">Thoughts</h2>
              <span className="thought-count">{thoughts.length}</span>
            </div>
            <ThoughtList thoughts={thoughts} />
          </section>
        )}
      </main>

      <footer className="control-footer">
        <span className="keyboard-hint">
          <kbd>Esc</kbd> speak &middot; <kbd>Enter</kbd> send &middot; <kbd>Cmd+/</kbd> help
        </span>
      </footer>
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l2 2" />
    </svg>
  );
}

function CharacterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" />
      <path d="M3 14c0-3 2.5-5 5-5s5 2 5 5" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M6 6c0-1.1.9-2 2-2s2 .9 2 2c0 1-1 1.5-1.5 2-.25.25-.5.5-.5 1" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" />
    </svg>
  );
}

function MicrophoneIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1c0 3.87 3.13 7 7 7s7-3.13 7-7v-1" />
      <path d="M12 18v4M8 22h8" />
    </svg>
  );
}
