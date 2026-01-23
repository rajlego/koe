import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useVoice } from '../../hooks/useVoice';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useLLM } from '../../services/llm';
import { getAllThoughts, onThoughtsChange } from '../../sync';
import { useSettingsStore, getApiKey } from '../../store/settingsStore';
import type { Thought } from '../../models/types';
import VoiceIndicator from '../common/VoiceIndicator';
import TranscriptDisplay from '../common/TranscriptDisplay';
import ThoughtList from '../common/ThoughtList';
import SearchBar from '../common/SearchBar';
import './ControlSurface.css';

// Lazy load modals/overlays
const ThoughtHistory = lazy(() => import('../common/ThoughtHistory'));
const Settings = lazy(() => import('../Settings'));
const CharacterSelector = lazy(() => import('../CharacterSelector/CharacterSelector'));
const ConversationView = lazy(() => import('../ConversationView/ConversationView'));
const SetupWizard = lazy(() => import('../SetupWizard'));

export default function ControlSurface() {
  const { voiceState, lastTranscript, lastError, isListening, isProcessing, startListening, stopListening, clearError, debugState } = useVoice();
  const { processTranscript, isProcessing: llmProcessing, lastResponse, streamingText } = useLLM();
  const { setupCompleted, setSetupCompleted } = useSettingsStore();
  const [showHelp, setShowHelp] = useState(false);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showCharacters, setShowCharacters] = useState(false);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Show setup wizard if not completed and no Anthropic key
  const showSetupWizard = !setupCompleted && !getApiKey('anthropic');

  const handleSetupComplete = useCallback(() => {
    setSetupCompleted(true);
  }, [setSetupCompleted]);

  // Filter thoughts based on search query (searches content, type, and tags)
  const filteredThoughts = useMemo(() => {
    if (!searchQuery.trim()) return thoughts;
    const query = searchQuery.toLowerCase();
    return thoughts.filter(
      (t) =>
        t.content.toLowerCase().includes(query) ||
        t.type.toLowerCase().includes(query) ||
        (t.tags && t.tags.some((tag) => tag.toLowerCase().includes(query)))
    );
  }, [thoughts, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

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

  // Keyboard shortcuts
  useKeyboard({
    onOpenSettings: () => setShowSettings(true),
    onOpenHistory: () => setShowHistory(true),
    onToggleVoice: toggleVoice,
  });

  // Additional keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  // Process transcript when voice processing completes
  useEffect(() => {
    console.log('[ControlSurface] Voice state changed:', { voiceState, hasTranscript: !!lastTranscript, llmProcessing });
    if (voiceState === 'processing' && lastTranscript && !llmProcessing) {
      console.log('[ControlSurface] Processing transcript with LLM:', lastTranscript.slice(0, 50));
      processTranscript(lastTranscript);
    }
  }, [voiceState, lastTranscript, processTranscript, llmProcessing]);

  // Track recent actions
  useEffect(() => {
    if (lastResponse) {
      setRecentActions((prev) => [lastResponse, ...prev].slice(0, 5));
    }
  }, [lastResponse]);

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
          >
            <CharacterIcon />
          </button>
          <button
            className="history-btn"
            onClick={() => setShowHistory(true)}
            title="Thought History (Cmd+Shift+H)"
          >
            <HistoryIcon />
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings (Cmd+,)"
          >
            <SettingsIcon />
          </button>
          <button
            className="help-btn"
            onClick={() => setShowHelp(true)}
            title="Help (Cmd+/)"
          >
            <HelpIcon />
          </button>
        </div>
      </header>

      {/* Debug Panel - visible logging */}
      <div style={{
        background: '#1a1a2e',
        padding: '10px 12px',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: '#aaa',
        borderBottom: '1px solid #333',
        lineHeight: '1.6',
      }}>
        <div><strong style={{ color: '#06d6a0' }}>DEBUG PANEL</strong></div>
        <div>Listener: {debugState?.listenerAttached ? '✅ Attached' : '❌ Not attached'}</div>
        <div>Events received: {debugState?.eventsReceived || 0}</div>
        <div>Last event: {debugState?.lastEventTime || 'none'}</div>
        <div>Last text: {debugState?.lastEventText || '(none)'}</div>
        <div>Store transcript: {lastTranscript ? `"${lastTranscript.slice(0, 40)}..."` : '(empty)'}</div>
        {debugState?.errors?.length > 0 && (
          <div style={{ color: '#f66' }}>Errors: {debugState.errors.join(', ')}</div>
        )}
      </div>

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

      {/* Prominent Voice Button */}
      <div className="voice-control-section">
        <button
          className={`voice-button ${voiceState === 'listening' ? 'listening' : ''} ${voiceState === 'processing' ? 'processing' : ''}`}
          onClick={toggleVoice}
        >
          <MicrophoneIcon />
          <span className="voice-button-label">
            {voiceState === 'listening' ? 'Listening... (Esc to stop)' :
             voiceState === 'processing' ? 'Processing...' :
             'Click to speak (or press Esc)'}
          </span>
        </button>
        <VoiceIndicator state={voiceState} size="small" />
      </div>

      <main className="control-main">
        <section className="transcript-section">
          <TranscriptDisplay
            transcript={lastTranscript}
            streamingResponse={streamingText}
            isListening={isListening}
            isProcessing={isProcessing || llmProcessing}
          />
        </section>

        <section className="thoughts-section">
          <div className="thoughts-header">
            <h2 className="section-title">Thoughts</h2>
            <span className="thought-count">
              {filteredThoughts.length}{searchQuery && ` / ${thoughts.length}`}
            </span>
          </div>
          <SearchBar onSearch={handleSearch} placeholder="Search thoughts..." />
          <ThoughtList thoughts={filteredThoughts} />
        </section>

        <section className="actions-section">
          <h2 className="section-title">Recent</h2>
          <ul className="actions-list">
            {recentActions.map((action, i) => (
              <li key={i} className="action-item">{action}</li>
            ))}
            {recentActions.length === 0 && (
              <li className="action-item muted">No recent actions</li>
            )}
          </ul>
        </section>
      </main>

      <footer className="control-footer">
        <span className="status-hint">
          {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Ready'}
        </span>
        <span className="keyboard-hint">
          <kbd>Cmd+/</kbd> all shortcuts &middot; <kbd>Cmd+K</kbd> characters
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
