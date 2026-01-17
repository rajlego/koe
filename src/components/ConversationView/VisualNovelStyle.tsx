import { useState, useEffect, useRef, useCallback } from 'react';
import type { Character } from '../../models/character';
import type { Message } from './ConversationView';

interface VisualNovelStyleProps {
  character: Character;
  messages: Message[];
  inputText: string;
  isTyping: boolean;
  streamingText: string;
  portraitUrl?: string;
  isGeneratingPortrait: boolean;
  isSpeaking: boolean;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (text: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onStopSpeaking: () => void;
  onCancel: () => void;
}

export default function VisualNovelStyle({
  character,
  messages,
  inputText,
  isTyping,
  streamingText,
  portraitUrl,
  isGeneratingPortrait,
  isSpeaking,
  error,
  messagesEndRef,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStopSpeaking,
  onCancel,
}: VisualNovelStyleProps) {
  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  const [isTypewriting, setIsTypewriting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  // Get the last character message for display
  const lastCharacterMessage = messages.filter((m) => m.role === 'character').pop();
  const textToDisplay = streamingText || lastCharacterMessage?.content || '';

  // Typewriter effect
  useEffect(() => {
    if (!textToDisplay) {
      setDisplayedText('');
      setIsTypewriting(false);
      return;
    }

    if (streamingText) {
      setDisplayedText(streamingText);
      setIsTypewriting(true);
      return;
    }

    // Only animate new messages
    const isNewMessage = displayedText !== textToDisplay;
    if (!isNewMessage) return;

    setDisplayedText('');
    setIsTypewriting(true);

    let charIndex = 0;
    const text = textToDisplay;

    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
    }

    typewriterRef.current = setInterval(() => {
      if (charIndex < text.length) {
        setDisplayedText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        if (typewriterRef.current) {
          clearInterval(typewriterRef.current);
        }
        setIsTypewriting(false);
      }
    }, 25);

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, [textToDisplay]);

  // Skip typewriter on click
  const handleSkipTypewriter = useCallback(() => {
    if (isTypewriting && typewriterRef.current) {
      clearInterval(typewriterRef.current);
      setDisplayedText(textToDisplay);
      setIsTypewriting(false);
    }
  }, [isTypewriting, textToDisplay]);

  // Toggle history
  const toggleHistory = useCallback(() => {
    setShowHistory((prev) => !prev);
  }, []);

  // Scroll history to bottom
  useEffect(() => {
    if (showHistory && historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [showHistory, messages]);

  // Focus input when ready
  useEffect(() => {
    if (!isTyping && !isTypewriting && !showHistory) {
      inputRef.current?.focus();
    }
  }, [isTyping, isTypewriting, showHistory]);

  const isUserTurn = !isTyping && !isTypewriting && !isSpeaking;

  return (
    <div className="vn-container">
      {/* Background Scene */}
      <div className="vn-background">
        <div className="vn-gradient" />
        <div className="vn-particles">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="vn-particle" style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
        </div>
      </div>

      {/* Character Sprite */}
      <div className="vn-sprite-area">
        {isGeneratingPortrait ? (
          <div className="vn-sprite-loading">
            <div className="loading-spinner" />
          </div>
        ) : portraitUrl ? (
          <img
            src={portraitUrl}
            alt={character.name}
            className={`vn-sprite ${isSpeaking ? 'speaking' : ''}`}
          />
        ) : (
          <div className="vn-sprite-placeholder">
            <div className="sprite-silhouette">
              <span>{character.name[0]}</span>
            </div>
          </div>
        )}
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="vn-history-overlay" onClick={toggleHistory}>
          <div className="vn-history-panel" onClick={(e) => e.stopPropagation()}>
            <div className="vn-history-header">
              <h3>Conversation History</h3>
              <button onClick={toggleHistory}>&times;</button>
            </div>
            <div className="vn-history-content" ref={historyRef}>
              {messages.map((msg) => (
                <div key={msg.id} className={`vn-history-message ${msg.role}`}>
                  <span className="vn-history-role">
                    {msg.role === 'user' ? 'You' : character.name}:
                  </span>
                  <p>{msg.content}</p>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="vn-history-empty">No messages yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Box */}
      <div className="vn-textbox-area" onClick={handleSkipTypewriter}>
        {/* Character Name */}
        <div
          className="vn-name-tag"
          style={{ '--accent': character.appearance.accentColor || '#06d6a0' } as React.CSSProperties}
        >
          {character.name}
        </div>

        {/* Text Box */}
        <div className="vn-textbox">
          {error ? (
            <div className="vn-error">
              <p>Error: {error}</p>
              <button onClick={onCancel}>Dismiss</button>
            </div>
          ) : isTyping && !streamingText ? (
            <div className="vn-loading">
              <span>{character.name} is thinking</span>
              <span className="loading-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </div>
          ) : displayedText ? (
            <p className="vn-text">
              {displayedText}
              {isTypewriting && <span className="vn-cursor" />}
            </p>
          ) : (
            <p className="vn-text vn-intro">
              {character.description || `*${character.name} awaits your message*`}
            </p>
          )}

          {/* Continue indicator */}
          {!isTyping && !isTypewriting && displayedText && (
            <div className="vn-continue">
              <span>Click to continue</span>
              <span className="vn-arrow">&#9660;</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="vn-controls">
          <button className="vn-control-btn" onClick={toggleHistory} title="History">
            <HistoryIcon />
          </button>
          {isSpeaking && (
            <button className="vn-control-btn" onClick={onStopSpeaking} title="Stop Voice">
              <StopIcon />
            </button>
          )}
        </div>
      </div>

      {/* User Input */}
      {isUserTurn && (
        <div className="vn-input-area">
          <form onSubmit={onSubmit} className="vn-input-form">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Your response..."
              className="vn-input"
              autoFocus
            />
            <button
              type="submit"
              className="vn-submit-btn"
              disabled={!inputText.trim()}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Cancel during processing */}
      {isTyping && (
        <button className="vn-cancel-btn" onClick={onCancel}>
          <CancelIcon /> Skip
        </button>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

// Icon components
function HistoryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4h12M2 8h12M2 12h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="1" />
    </svg>
  );
}

function CancelIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 3l8 8M11 3l-8 8" />
    </svg>
  );
}
