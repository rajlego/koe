import { useEffect, useCallback, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore, getApiKey } from '../store/settingsStore';
import { getThought, updateThought } from '../sync';
import { sounds } from '../services/sounds';
import { logger } from '../services/logger';
import type { VoiceState } from '../models/types';

// Punctuation commands for dictation mode
const PUNCTUATION_MAP: Record<string, string> = {
  'period': '.',
  'full stop': '.',
  'comma': ',',
  'question mark': '?',
  'exclamation mark': '!',
  'exclamation point': '!',
  'colon': ':',
  'semicolon': ';',
  'dash': '—',
  'hyphen': '-',
  'open quote': '"',
  'close quote': '"',
  'open paren': '(',
  'close paren': ')',
  'new line': '\n',
  'new paragraph': '\n\n',
};

// Commands that exit dictation mode
const EXIT_COMMANDS = ['stop dictating', 'command mode', 'hey koe', 'hey co', 'hey coe'];

// Debug state for visible logging
interface DebugState {
  listenerAttached: boolean;
  eventsReceived: number;
  lastEventTime: string | null;
  lastEventText: string | null;
  errors: string[];
}

interface TranscriptEvent {
  text: string;
  isFinal: boolean;
}

// Voice hook - always listens for events regardless of voiceEnabled setting
export function useVoice() {
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const audioInputDevice = useSettingsStore((s) => s.audioInputDevice);
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const transcriptionProvider = useSettingsStore((s) => s.transcriptionProvider);
  const transcriptionModel = useSettingsStore((s) => s.transcriptionModel);
  const {
    setVoiceState,
    setLastTranscript,
    setLastError,
    setVoiceMode,
    voiceState,
    lastTranscript,
    lastError,
    voiceMode,
    dictationTargetWindowId,
  } = useWindowStore();

  // Accumulated transcript - builds up as user speaks
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('');

  // Debug state for visible logging
  const [debugState, setDebugState] = useState<DebugState>({
    listenerAttached: false,
    eventsReceived: 0,
    lastEventTime: null,
    lastEventText: null,
    errors: [],
  });
  const eventsReceivedRef = useRef(0);

  // Configure Whisper with API keys and provider settings
  // Re-runs when API keys or transcription settings change
  useEffect(() => {
    const openaiKey = getApiKey('openai');
    const groqKey = getApiKey('groq');
    console.log('Configuring Whisper: provider=%s, model=%s, openai=%s, groq=%s',
      transcriptionProvider, transcriptionModel || '(default)',
      openaiKey ? 'present' : 'not set',
      groqKey ? 'present' : 'not set');

    invoke('configure_whisper', {
      apiKey: openaiKey || null,
      useLocal: false,
      modelPath: null,
      provider: transcriptionProvider,
      model: transcriptionModel || null,
      groqApiKey: groqKey || null,
    }).catch((err) => {
      console.error('Failed to configure Whisper:', err);
    });
  }, [apiKeys, transcriptionProvider, transcriptionModel]);

  // Sync audio device setting to backend when it changes
  useEffect(() => {
    invoke('set_audio_device', { deviceName: audioInputDevice }).catch((err) => {
      console.error('Failed to set audio device:', err);
    });
  }, [audioInputDevice]);

  // Auto-start voice capture on mount if voice is enabled
  useEffect(() => {
    if (voiceEnabled) {
      logger.info('[Voice] Auto-starting voice capture on mount');
      invoke('start_voice_capture').then(() => {
        setVoiceState('listening');
        logger.info('[Voice] Auto-start succeeded');
      }).catch((err) => {
        logger.info('[Voice] Auto-start failed: ' + err);
      });
    }
    // Cleanup on unmount
    return () => {
      invoke('stop_voice_capture').catch(() => {});
    };
  }, []); // Only on mount

  // Start listening
  const startListening = useCallback(async () => {
    logger.info(`[Voice] startListening called. voiceEnabled=${voiceEnabled}`);
    if (!voiceEnabled) {
      setLastError('Voice is disabled. Enable it in settings (Cmd+Shift+V).');
      logger.info('[Voice] startListening aborted - voice disabled');
      return;
    }

    try {
      setLastError(null); // Clear previous errors
      setVoiceState('listening');
      sounds.listeningStart();
      logger.info('[Voice] Calling invoke start_voice_capture...');
      await invoke('start_voice_capture');
      logger.info('[Voice] start_voice_capture succeeded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Failed to start voice capture:', errorMessage);
      setLastError(`Failed to start voice capture: ${errorMessage}`);
      sounds.error();
      setVoiceState('error');
    }
  }, [voiceEnabled, setVoiceState, setLastError]);

  // Stop listening
  const stopListening = useCallback(async () => {
    try {
      sounds.listeningStop();
      await invoke('stop_voice_capture');
      setVoiceState('idle');
    } catch (error) {
      console.error('Failed to stop voice capture:', error);
    }
  }, [setVoiceState]);

  // Listen for transcript events from Rust backend
  // IMPORTANT: Always attach listeners regardless of voiceEnabled setting
  // voiceEnabled only controls whether user can START capture, not whether we listen
  useEffect(() => {
    let mounted = true;

    const setupListeners = async () => {
      try {
        logger.info('[Voice] Setting up event listeners...');

        const unlistenTranscript = await listen<TranscriptEvent>('voice:transcript', (event) => {
          eventsReceivedRef.current += 1;
          const { text, isFinal } = event.payload;
          logger.info('[Voice] Transcript received:', text.slice(0, 50));

          if (mounted) {
            setDebugState(prev => ({
              ...prev,
              eventsReceived: eventsReceivedRef.current,
              lastEventTime: new Date().toLocaleTimeString(),
              lastEventText: text.slice(0, 50),
            }));

            // Get current state
            const currentState = useWindowStore.getState();
            const currentVoiceMode = currentState.voiceMode;
            const targetWindowId = currentState.dictationTargetWindowId;

            // Check for exit commands in dictation mode
            if (currentVoiceMode === 'dictate') {
              const lowerText = text.toLowerCase().trim();
              if (EXIT_COMMANDS.some(cmd => lowerText.includes(cmd))) {
                logger.info('[Voice] Exiting dictation mode');
                setVoiceMode('command', null);
                setLastTranscript(text);
                sounds.success();
                return;
              }

              // Handle dictation: append text to target thought
              if (targetWindowId && isFinal) {
                const window = currentState.openWindows.get(targetWindowId);
                if (window) {
                  const thought = getThought(window.thoughtId);
                  if (thought) {
                    // Process punctuation commands
                    let processedText = text;
                    for (const [cmd, replacement] of Object.entries(PUNCTUATION_MAP)) {
                      const regex = new RegExp(`\\b${cmd}\\b`, 'gi');
                      processedText = processedText.replace(regex, replacement);
                    }

                    // Append with space (or directly if punctuation at end of thought)
                    const lastChar = thought.content.slice(-1);
                    const separator = lastChar && !'\n.!?'.includes(lastChar) ? ' ' : '';
                    const newContent = thought.content + separator + processedText;

                    updateThought(window.thoughtId, { content: newContent });
                    logger.info('[Voice] Appended to thought in dictation mode');
                    sounds.success();
                  }
                }
              }

              // Don't set transcript or trigger LLM processing in dictation mode
              return;
            }

            // Command mode: accumulate transcript (don't auto-send to LLM)
            setLastTranscript(text);

            if (isFinal) {
              // Append to running transcript instead of triggering LLM
              setAccumulatedTranscript(prev => prev + (prev ? ' ' : '') + text);
              // Stay in listening state - user will explicitly send when ready
            }
          }
        });

        const unlistenState = await listen<VoiceState>('voice:state', (event) => {
          logger.info('[Voice] State event:', event.payload);
          if (mounted) {
            setVoiceState(event.payload);
          }
        });

        const unlistenError = await listen<string>('voice:error', (event) => {
          logger.error('[Voice] Error event:', event.payload);
          if (mounted && event.payload && !event.payload.includes('stopped')) {
            setDebugState(prev => ({
              ...prev,
              errors: [...prev.errors.slice(-4), event.payload],
            }));
            setLastError(event.payload);
            setVoiceState('error');
          }
        });

        if (mounted) {
          setDebugState(prev => ({ ...prev, listenerAttached: true }));
          logger.info('[Voice] All listeners attached successfully');
        }

        // Return cleanup function
        return () => {
          mounted = false;
          unlistenTranscript();
          unlistenState();
          unlistenError();
          invoke('stop_voice_capture').catch(() => {});
        };
      } catch (err) {
        logger.error('[Voice] Failed to setup listeners:', String(err));
        if (mounted) {
          setDebugState(prev => ({
            ...prev,
            errors: [...prev.errors, `Setup failed: ${err}`],
          }));
        }
      }
    };

    // Set initial state
    setVoiceState('idle');

    let cleanup: (() => void) | undefined;
    setupListeners().then(fn => {
      cleanup = fn;
    });

    return () => {
      mounted = false;
      cleanup?.();
    };
  }, [setVoiceState, setLastTranscript, setLastError, setVoiceMode]);

  // Clear error
  const clearError = useCallback(() => {
    setLastError(null);
    if (voiceState === 'error') {
      setVoiceState('idle');
    }
  }, [setLastError, setVoiceState, voiceState]);

  // Clear accumulated transcript
  const clearTranscript = useCallback(() => {
    setAccumulatedTranscript('');
    setLastTranscript('');
  }, [setLastTranscript]);

  return {
    voiceState,
    lastTranscript,
    accumulatedTranscript,
    lastError,
    voiceMode,
    dictationTargetWindowId,
    startListening,
    stopListening,
    clearError,
    clearTranscript,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    isDictating: voiceMode === 'dictate',
    debugState,
  };
}
