import { useEffect, useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useVoice } from '../../hooks/useVoice';
import { useKeyboard } from '../../hooks/useKeyboard';
import { useLLM } from '../../services/llm';
import { getAllThoughts, onThoughtsChange } from '../../sync';
import type { Thought } from '../../models/types';
import VoiceIndicator from '../common/VoiceIndicator';
import TranscriptDisplay from '../common/TranscriptDisplay';
import ThoughtList from '../common/ThoughtList';
import SearchBar from '../common/SearchBar';
import './ControlSurface.css';

// Lazy load modals/overlays
const ThoughtHistory = lazy(() => import('../common/ThoughtHistory'));
const Settings = lazy(() => import('../Settings'));

export default function ControlSurface() {
  const { voiceState, lastTranscript, isListening, isProcessing } = useVoice();
  const { processTranscript, isProcessing: llmProcessing, lastResponse, streamingText } = useLLM();
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [recentActions, setRecentActions] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Keyboard shortcuts
  useKeyboard({
    onOpenSettings: () => setShowSettings(true),
    onOpenHistory: () => setShowHistory(true),
  });

  // Load and subscribe to thoughts
  useEffect(() => {
    setThoughts(getAllThoughts());
    const unsubscribe = onThoughtsChange(setThoughts);
    return unsubscribe;
  }, []);

  // Process transcript when voice processing completes
  useEffect(() => {
    if (voiceState === 'processing' && lastTranscript && !llmProcessing) {
      processTranscript(lastTranscript);
    }
  }, [voiceState, lastTranscript, processTranscript, llmProcessing]);

  // Track recent actions
  useEffect(() => {
    if (lastResponse) {
      setRecentActions((prev) => [lastResponse, ...prev].slice(0, 5));
    }
  }, [lastResponse]);

  return (
    <div className="control-surface">
      <Suspense fallback={null}>
        {showSettings && <Settings onClose={() => setShowSettings(false)} />}
        {showHistory && <ThoughtHistory thoughts={thoughts} onClose={() => setShowHistory(false)} />}
      </Suspense>

      <header className="control-header">
        <h1 className="app-title">Koe</h1>
        <div className="header-actions">
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
          <VoiceIndicator state={voiceState} />
        </div>
      </header>

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
          <kbd>Esc</kbd> voice &middot; <kbd>Cmd+N</kbd> new &middot; <kbd>Cmd+,</kbd> settings
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
