import { useState, useCallback, useEffect, useRef } from 'react';
import { useCharacterStore } from '../../store/characterStore';
import { speak, stopSpeaking, isSpeaking, isElevenLabsConfigured } from '../../services/elevenLabs';
import { generateCharacterPortrait, isImageGenAvailable } from '../../services/imageGen';
import { getApiKey } from '../../store/settingsStore';
// Character type is used via useCharacterStore
import PhoenixWrightStyle from './PhoenixWrightStyle';
import VisualNovelStyle from './VisualNovelStyle';
import ChatBubbleStyle from './ChatBubbleStyle';
import './ConversationView.css';

// Helper to get Anthropic API key from settings
const getAnthropicKey = () => getApiKey('anthropic');

export type ConversationDesign = 'phoenix-wright' | 'visual-novel' | 'chat-bubble';

export interface Message {
  id: string;
  role: 'user' | 'character';
  content: string;
  timestamp: string;
}

interface ConversationViewProps {
  characterId: string;
  onClose: () => void;
  initialDesign?: ConversationDesign;
}

export default function ConversationView({
  characterId,
  onClose,
  initialDesign = 'phoenix-wright',
}: ConversationViewProps) {
  const { getCharacter, updateCharacter } = useCharacterStore();
  const character = getCharacter(characterId);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [currentDesign, setCurrentDesign] = useState<ConversationDesign>(initialDesign);
  const [portraitUrl, setPortraitUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPortrait, setIsGeneratingPortrait] = useState(false);
  const [isSpeakingState, setIsSpeakingState] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load character portrait
  useEffect(() => {
    if (!character) return;

    // Use cached portrait if available
    if (character.appearance.portraitUrl) {
      setPortraitUrl(character.appearance.portraitUrl);
      return;
    }

    // Generate portrait if image generation is available
    if (isImageGenAvailable() && character.appearance.description) {
      setIsGeneratingPortrait(true);
      generateCharacterPortrait(
        character.appearance.description,
        character.appearance.artStyle
      )
        .then((base64) => {
          setPortraitUrl(base64);
          // Cache the portrait
          updateCharacter(characterId, {
            appearance: { ...character.appearance, portraitUrl: base64 },
          });
        })
        .catch((err) => {
          console.error('Failed to generate portrait:', err);
        })
        .finally(() => {
          setIsGeneratingPortrait(false);
        });
    }
  }, [character, characterId, updateCharacter]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  // Send message to character via Claude API
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !character) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
      setIsTyping(true);
      setStreamingText('');
      setError(null);

      try {
        abortRef.current = new AbortController();

        // Get API key
        const apiKey = getAnthropicKey();
        if (!apiKey) {
          throw new Error('Anthropic API key not configured. Set it in Settings.');
        }

        // Build conversation history for context
        const conversationHistory = messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        }));

        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            system: character.systemPrompt,
            stream: true,
            messages: [
              ...conversationHistory,
              { role: 'user', content: text.trim() },
            ],
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  fullText += event.delta.text;
                  setStreamingText(fullText);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }

        // Add character response
        const characterMessage: Message = {
          id: crypto.randomUUID(),
          role: 'character',
          content: fullText,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, characterMessage]);
        setStreamingText('');
        setIsTyping(false);

        // Speak the response if ElevenLabs is configured
        if (isElevenLabsConfigured() && character.voiceSettings.voiceId) {
          setIsSpeakingState(true);
          try {
            await speak(fullText, character.voiceSettings.voiceId, {
              stability: character.voiceSettings.stability,
              similarity_boost: character.voiceSettings.similarityBoost,
              style: character.voiceSettings.style,
              use_speaker_boost: character.voiceSettings.useSpeakerBoost,
            });
          } catch (err) {
            console.error('TTS error:', err);
          } finally {
            setIsSpeakingState(false);
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setIsTyping(false);
          setStreamingText('');
          return;
        }
        console.error('Chat error:', err);
        setError((err as Error).message);
        setIsTyping(false);
        setStreamingText('');
      }
    },
    [character, messages]
  );

  // Handle input submission
  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      sendMessage(inputText);
    },
    [inputText, sendMessage]
  );

  // Handle key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  // Stop speaking
  const handleStopSpeaking = useCallback(() => {
    stopSpeaking();
    setIsSpeakingState(false);
  }, []);

  // Cancel current request
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsTyping(false);
    setStreamingText('');
  }, []);

  // Cycle through designs
  const cycleDesign = useCallback(() => {
    const designs: ConversationDesign[] = ['phoenix-wright', 'visual-novel', 'chat-bubble'];
    const currentIndex = designs.indexOf(currentDesign);
    const nextIndex = (currentIndex + 1) % designs.length;
    setCurrentDesign(designs[nextIndex]);
  }, [currentDesign]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTyping) {
          handleCancel();
        } else if (isSpeaking()) {
          handleStopSpeaking();
        } else {
          onClose();
        }
      } else if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        cycleDesign();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isTyping, handleCancel, handleStopSpeaking, onClose, cycleDesign]);

  if (!character) {
    return (
      <div className="conversation-view">
        <div className="conversation-error">
          <p>Character not found</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  // Common props for all design styles
  const designProps = {
    character,
    messages,
    inputText,
    isTyping,
    streamingText,
    portraitUrl,
    isGeneratingPortrait,
    isSpeaking: isSpeakingState,
    error,
    messagesEndRef,
    onInputChange: setInputText,
    onSubmit: handleSubmit,
    onKeyDown: handleKeyDown,
    onStopSpeaking: handleStopSpeaking,
    onCancel: handleCancel,
  };

  return (
    <div className="conversation-view" data-design={currentDesign}>
      {/* Design Switcher */}
      <div className="design-switcher">
        <button
          className={`design-btn ${currentDesign === 'phoenix-wright' ? 'active' : ''}`}
          onClick={() => setCurrentDesign('phoenix-wright')}
          title="Phoenix Wright Style"
        >
          PW
        </button>
        <button
          className={`design-btn ${currentDesign === 'visual-novel' ? 'active' : ''}`}
          onClick={() => setCurrentDesign('visual-novel')}
          title="Visual Novel Style"
        >
          VN
        </button>
        <button
          className={`design-btn ${currentDesign === 'chat-bubble' ? 'active' : ''}`}
          onClick={() => setCurrentDesign('chat-bubble')}
          title="Chat Bubble Style"
        >
          CB
        </button>
        <button className="close-btn" onClick={onClose} title="Close (Esc)">
          &times;
        </button>
      </div>

      {/* Render selected design */}
      {currentDesign === 'phoenix-wright' && <PhoenixWrightStyle {...designProps} />}
      {currentDesign === 'visual-novel' && <VisualNovelStyle {...designProps} />}
      {currentDesign === 'chat-bubble' && <ChatBubbleStyle {...designProps} />}
    </div>
  );
}
