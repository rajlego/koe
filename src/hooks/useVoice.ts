import { useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';
import { sounds } from '../services/sounds';
import type { VoiceState } from '../models/types';

// OpenAI API key for Whisper transcription
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

interface TranscriptEvent {
  text: string;
  isFinal: boolean;
}

export function useVoice() {
  const voiceEnabled = useSettingsStore((s) => s.voiceEnabled);
  const { setVoiceState, setLastTranscript, voiceState, lastTranscript } = useWindowStore();
  const configuredRef = useRef(false);

  // Configure Whisper on mount
  useEffect(() => {
    if (configuredRef.current) return;
    configuredRef.current = true;

    // Configure Whisper with OpenAI API key
    invoke('configure_whisper', {
      apiKey: OPENAI_API_KEY || null,
      useLocal: false,
      modelPath: null,
    }).catch((err) => {
      console.error('Failed to configure Whisper:', err);
    });
  }, []);

  // Start listening
  const startListening = useCallback(async () => {
    if (!voiceEnabled) return;

    try {
      setVoiceState('listening');
      sounds.listeningStart();
      await invoke('start_voice_capture');
    } catch (error) {
      console.error('Failed to start voice capture:', error);
      sounds.error();
      setVoiceState('error');
    }
  }, [voiceEnabled, setVoiceState]);

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
  useEffect(() => {
    if (!voiceEnabled) return;

    const unlistenTranscript = listen<TranscriptEvent>('voice:transcript', (event) => {
      const { text, isFinal } = event.payload;
      setLastTranscript(text);

      if (isFinal) {
        sounds.processingStart();
        setVoiceState('processing');
        // The LLM service will pick up the transcript
      }
    });

    const unlistenState = listen<VoiceState>('voice:state', (event) => {
      setVoiceState(event.payload);
    });

    const unlistenError = listen<string>('voice:error', (event) => {
      console.error('Voice error:', event.payload);
      setVoiceState('error');
    });

    // Auto-start listening when voice is enabled
    startListening();

    return () => {
      unlistenTranscript.then((fn) => fn());
      unlistenState.then((fn) => fn());
      unlistenError.then((fn) => fn());
      stopListening();
    };
  }, [voiceEnabled, setVoiceState, setLastTranscript, startListening, stopListening]);

  return {
    voiceState,
    lastTranscript,
    startListening,
    stopListening,
    isListening: voiceState === 'listening',
    isProcessing: voiceState === 'processing',
  };
}
