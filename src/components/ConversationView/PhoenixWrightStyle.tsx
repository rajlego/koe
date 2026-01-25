import { useState, useEffect, useRef, useCallback } from 'react';
import type { Character } from '../../models/character';
import type { Message } from './ConversationView';

interface PhoenixWrightStyleProps {
  character: Character;
  messages: Message[];
  inputText: string;
  isTyping: boolean;
  streamingText: string;
  portraitUrl?: string;
  isGeneratingPortrait: boolean;
  isSpeaking: boolean;
  isListening?: boolean;
  voiceTranscript?: string;
  error: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onInputChange: (text: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onStopSpeaking: () => void;
  onCancel: () => void;
  onToggleVoice?: () => void;
  onClose?: () => void;
}

export default function PhoenixWrightStyle({
  character,
  messages,
  inputText,
  isTyping,
  streamingText,
  portraitUrl,
  isGeneratingPortrait,
  isSpeaking,
  isListening,
  voiceTranscript,
  error,
  messagesEndRef,
  onInputChange,
  onSubmit,
  onKeyDown,
  onStopSpeaking,
  onCancel,
  onToggleVoice,
  onClose,
}: PhoenixWrightStyleProps) {
  // Typewriter effect state
  const [displayedText, setDisplayedText] = useState('');
  const [isTypewriting, setIsTypewriting] = useState(false);
  const [lastProcessedMessageId, setLastProcessedMessageId] = useState<string | null>(null);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the last character message for display
  const lastCharacterMessage = messages.filter((m) => m.role === 'character').pop();
  const textToDisplay = streamingText || lastCharacterMessage?.content || '';
  const currentMessageId = lastCharacterMessage?.id || null;

  // Typewriter effect for character messages
  useEffect(() => {
    if (!textToDisplay) {
      setDisplayedText('');
      setIsTypewriting(false);
      return;
    }

    // If streaming, show text directly
    if (streamingText) {
      setDisplayedText(streamingText);
      setIsTypewriting(true);
      return;
    }

    // Check if this is a new message using ID (handles duplicate content)
    if (currentMessageId === lastProcessedMessageId) {
      return;
    }

    setLastProcessedMessageId(currentMessageId);
    setDisplayedText('');
    setIsTypewriting(true);

    let charIndex = 0;
    const text = textToDisplay;

    // Clear any existing interval
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
    }, 30); // 30ms per character for readable typewriter effect

    return () => {
      if (typewriterRef.current) {
        clearInterval(typewriterRef.current);
      }
    };
  }, [textToDisplay, currentMessageId, lastProcessedMessageId, streamingText]);

  // Skip typewriter effect on click
  const handleSkipTypewriter = useCallback(() => {
    if (isTypewriting && typewriterRef.current) {
      clearInterval(typewriterRef.current);
      setDisplayedText(textToDisplay);
      setIsTypewriting(false);
    }
  }, [isTypewriting, textToDisplay]);

  // Focus input when ready
  useEffect(() => {
    if (!isTyping && !isTypewriting) {
      inputRef.current?.focus();
    }
  }, [isTyping, isTypewriting]);

  // Check if it's the user's turn to speak
  const isUserTurn = !isTyping && !isTypewriting && !isSpeaking;

  return (
    <div className="pw-container">
      {/* Courtroom-style background */}
      <div className="pw-background">
        <div className="pw-bg-pattern" />
      </div>

      {/* Back button */}
      {onClose && (
        <button className="pw-back-btn" onClick={onClose} title="Back (Cmd+W)">
          <BackIcon />
          <span>Back</span>
        </button>
      )}

      {/* Character Portrait */}
      <div className="pw-portrait-area">
        {isGeneratingPortrait ? (
          <div className="pw-portrait-loading">
            <div className="loading-spinner" />
            <span>Generating portrait...</span>
          </div>
        ) : portraitUrl ? (
          <img
            src={portraitUrl}
            alt={character.name}
            className={`pw-portrait ${isSpeaking ? 'speaking' : ''}`}
          />
        ) : (
          <div className="pw-portrait-placeholder">
            <span className="portrait-initial">{character.name[0]}</span>
          </div>
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <button className="pw-stop-speaking" onClick={onStopSpeaking}>
            Stop Speaking
          </button>
        )}
      </div>

      {/* Dialogue Area */}
      <div className="pw-dialogue-area" onClick={handleSkipTypewriter}>
        {/* Character Name Plate */}
        <div
          className="pw-nameplate"
          style={{ '--accent': character.appearance.accentColor || '#06d6a0' } as React.CSSProperties}
        >
          <span className="pw-name">{character.name}</span>
        </div>

        {/* Dialogue Box */}
        <div className="pw-dialogue-box" aria-live="polite" aria-label="Character dialogue">
          {error ? (
            <div className="pw-error">
              <span>Error: {error}</span>
              <button onClick={onCancel}>Dismiss</button>
            </div>
          ) : isTyping && !streamingText ? (
            <div className="pw-thinking">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </div>
          ) : displayedText ? (
            <p className="pw-text">
              {displayedText}
              {isTypewriting && <span className="pw-cursor">|</span>}
            </p>
          ) : (
            <p className="pw-text pw-intro">
              <em>"{character.description || `I am ${character.name}. How may I help you?`}"</em>
            </p>
          )}
        </div>

        {/* Message History Indicator */}
        {messages.length > 0 && (
          <div className="pw-history-indicator">
            {messages.length} message{messages.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* User Input Area */}
      {isUserTurn && (
        <div className="pw-input-area">
          {/* Voice listening indicator */}
          {isListening && (
            <div className="pw-voice-listening">
              <div className="pw-voice-indicator">
                <span className="pulse-ring" />
                <MicIcon />
              </div>
              <span className="pw-voice-text">
                {voiceTranscript || 'Listening...'}
              </span>
            </div>
          )}
          <form onSubmit={onSubmit} className="pw-input-form">
            {onToggleVoice && (
              <button
                type="button"
                className={`pw-voice-btn ${isListening ? 'listening' : ''}`}
                onClick={onToggleVoice}
                title={isListening ? 'Stop listening (Esc)' : 'Start voice input (Esc)'}
              >
                <MicIcon />
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={isListening ? 'Listening...' : 'Type or speak your response...'}
              className="pw-input"
              autoFocus
              disabled={isListening}
            />
            <button
              type="submit"
              className="pw-submit-btn"
              disabled={!inputText.trim() || isListening}
            >
              Present
            </button>
          </form>
          <div className="pw-hint">
            Press <kbd>Esc</kbd> to speak, <kbd>Enter</kbd> to send
          </div>
        </div>
      )}

      {/* Cancel button during processing */}
      {isTyping && (
        <button className="pw-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10v1c0 3.87 3.13 7 7 7s7-3.13 7-7v-1" />
      <path d="M12 18v4M8 22h8" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}
