import { useRef, useEffect } from 'react';
import type { Character } from '../../models/character';
import type { Message } from './ConversationView';

interface ChatBubbleStyleProps {
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

export default function ChatBubbleStyle({
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
  onKeyDown: _onKeyDown,
  onStopSpeaking,
  onCancel,
  onToggleVoice,
  onClose,
}: ChatBubbleStyleProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Focus input
  useEffect(() => {
    if (!isTyping) {
      inputRef.current?.focus();
    }
  }, [isTyping]);

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="cb-container">
      {/* Header */}
      <div
        className="cb-header"
        style={{ '--accent': character.appearance.accentColor || '#06d6a0' } as React.CSSProperties}
      >
        {onClose && (
          <button className="cb-back-btn" onClick={onClose} title="Back (Cmd+W)">
            <BackIcon />
          </button>
        )}
        <div className="cb-header-avatar">
          {isGeneratingPortrait ? (
            <div className="cb-avatar-loading">
              <div className="loading-spinner-small" />
            </div>
          ) : portraitUrl ? (
            <img src={portraitUrl} alt={character.name} className="cb-avatar" />
          ) : (
            <div className="cb-avatar-placeholder">
              {character.name[0]}
            </div>
          )}
          {isSpeaking && <div className="cb-speaking-indicator" />}
        </div>
        <div className="cb-header-info">
          <h2 className="cb-header-name">{character.name}</h2>
          <span className="cb-header-status">
            {isTyping ? 'Typing...' : isSpeaking ? 'Speaking...' : 'Online'}
          </span>
        </div>
        {isSpeaking && (
          <button className="cb-stop-btn" onClick={onStopSpeaking} title="Stop speaking">
            <StopIcon />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="cb-messages" ref={messagesContainerRef} aria-live="polite" aria-label="Conversation messages">
        {/* Welcome message if no messages */}
        {messages.length === 0 && !isTyping && (
          <div className="cb-welcome">
            <div className="cb-welcome-avatar">
              {portraitUrl ? (
                <img src={portraitUrl} alt={character.name} />
              ) : (
                <span>{character.name[0]}</span>
              )}
            </div>
            <h3>{character.name}</h3>
            <p>{character.description || 'Start a conversation!'}</p>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const showAvatar =
            !isUser &&
            (index === 0 || messages[index - 1].role === 'user');

          return (
            <div
              key={message.id}
              className={`cb-message ${isUser ? 'user' : 'character'}`}
            >
              {!isUser && showAvatar && (
                <div className="cb-message-avatar">
                  {portraitUrl ? (
                    <img src={portraitUrl} alt={character.name} />
                  ) : (
                    <span>{character.name[0]}</span>
                  )}
                </div>
              )}
              <div className={`cb-bubble ${isUser ? 'user' : 'character'}`}>
                <p className="cb-bubble-text">{message.content}</p>
                <span className="cb-bubble-time">{formatTime(message.timestamp)}</span>
              </div>
            </div>
          );
        })}

        {/* Streaming response */}
        {streamingText && (
          <div className="cb-message character">
            <div className="cb-message-avatar">
              {portraitUrl ? (
                <img src={portraitUrl} alt={character.name} />
              ) : (
                <span>{character.name[0]}</span>
              )}
            </div>
            <div className="cb-bubble character streaming">
              <p className="cb-bubble-text">{streamingText}</p>
              <span className="cb-typing-cursor" />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {isTyping && !streamingText && (
          <div className="cb-message character">
            <div className="cb-message-avatar">
              {portraitUrl ? (
                <img src={portraitUrl} alt={character.name} />
              ) : (
                <span>{character.name[0]}</span>
              )}
            </div>
            <div className="cb-bubble character">
              <div className="cb-typing-indicator">
                <span className="cb-typing-dot" />
                <span className="cb-typing-dot" />
                <span className="cb-typing-dot" />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="cb-error">
            <span>Error: {error}</span>
            <button onClick={onCancel}>Dismiss</button>
          </div>
        )}

        {/* Voice waveform during speaking */}
        {isSpeaking && (
          <div className="cb-waveform">
            <VoiceWaveform />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="cb-input-area">
        {/* Voice listening indicator */}
        {isListening && (
          <div className="cb-voice-listening">
            <div className="cb-voice-indicator">
              <span className="pulse-ring" />
              <MicIcon />
            </div>
            <span className="cb-voice-text">
              {voiceTranscript || 'Listening...'}
            </span>
          </div>
        )}
        <form onSubmit={onSubmit} className="cb-input-form">
          {onToggleVoice && (
            <button
              type="button"
              className={`cb-voice-btn ${isListening ? 'listening' : ''}`}
              onClick={onToggleVoice}
              title={isListening ? 'Stop listening (Esc)' : 'Start voice input (Esc)'}
            >
              <MicIcon />
            </button>
          )}
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder={isListening ? 'Listening...' : `Message ${character.name}...`}
            className="cb-input"
            rows={1}
            disabled={isListening}
          />
          <button
            type="submit"
            className="cb-send-btn"
            disabled={!inputText.trim() || isTyping || isListening}
          >
            <SendIcon />
          </button>
        </form>
        {isTyping && (
          <button className="cb-cancel-btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

// Voice waveform visualization
function VoiceWaveform() {
  return (
    <div className="waveform-container">
      <div className="waveform-label">Speaking</div>
      <div className="waveform-bars">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="waveform-bar"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// Icon components
function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.5 10L17.5 2.5L10 17.5L8.75 11.25L2.5 10Z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="4" y="4" width="8" height="8" rx="1" />
    </svg>
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
