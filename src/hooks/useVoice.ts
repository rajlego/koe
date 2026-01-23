import { useEffect, useCallback, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore, getApiKey } from '../store/settingsStore';
import { sounds } from '../services/sounds';
import type { VoiceState } from '../models/types';

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
  const { setVoiceState, setLastTranscript, setLastError, voiceState, lastTranscript, lastError } = useWindowStore();

  // Debug state for visible logging
  const [debugState, setDebugState] = useState<DebugState>({
    listenerAttached: false,
    eventsReceived: 0,
    lastEventTime: null,
    lastEventText: null,
    errors: [],
  });
  const eventsReceivedRef = useRef(0);

  // Configure Whisper with OpenAI API key from settings
  // Re-runs when API keys change (e.g., after setup wizard or settings update)
  useEffect(() => {
    const openaiKey = getApiKey('openai');
    console.log('Configuring Whisper with API key:', openaiKey ? 'present' : 'not set');

    invoke('configure_whisper', {
      apiKey: openaiKey || null,
      useLocal: false,
      modelPath: null,
    }).catch((err) => {
      console.error('Failed to configure Whisper:', err);
    });
  }, [apiKeys]); // Re-run when API keys change

  // Sync audio device setting to backend when it changes
  useEffect(() => {
    invoke('set_audio_device', { deviceName: audioInputDevice }).catch((err) => {
      console.error('Failed to set audio device:', err);
    });
  }, [audioInputDevice]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!voiceEnabled) {
      setLastError('Voice is disabled. Enable it in settings (Cmd+Shift+V).');
      return;
    }

    try {
      setLastError(null); // Clear previous errors
      setVoiceState('listening');
      sounds.listeningStart();
      await invoke('start_voice_capture');
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
        const unlistenTranscript = await listen<TranscriptEvent>('voice:transcript', (event) => {
          eventsReceivedRef.current += 1;
          const { text, isFinal } = event.payload;
          console.log('[Voice] Transcript received:', text.slice(0, 50));

          if (mounted) {
            setDebugState(prev => ({
              ...prev,
              eventsReceived: eventsReceivedRef.current,
              lastEventTime: new Date().toLocaleTimeString(),
              lastEventText: text.slice(0, 50),
            }));
            setLastTranscript(text);

            if (isFinal) {
              sounds.processingStart();
              setVoiceState('processing');
            }
          }
        });

        const unlistenState = await listen<VoiceState>('voice:state', (event) => {
          if (mounted) {
            setVoiceState(event.payload);
          }
        });

        const unlistenError = await listen<string>('voice:error', (event) => {
          console.error('[Voice] Error:', event.payload);
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
          console.log('[Voice] All listeners attached successfully');
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
        console.error('[Voice] Failed to setup listeners:', err);
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
  }, [setVoiceState, setLastTranscript, setLastError]);

  // Clear error
  const clearError = useCallback(() => {
    setLastError(null);
    if (voiceState === 'error') {
      setVoiceState('idle');
    }
  }, [setLastError, setVoiceState, voiceState]);

  return {
    voiceState,
    lastTranscript,
    lastError,
    startListening,
    stopListening,
    clearError,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
    debugState, // Expose debug state for visible debugging
  };
}
