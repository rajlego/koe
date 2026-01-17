import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/settingsStore';
import {
  speak as elevenLabsSpeak,
  speakStreaming as elevenLabsSpeakStreaming,
  stopSpeaking as elevenLabsStopSpeaking,
  isElevenLabsConfigured,
  isSpeaking as elevenLabsIsSpeaking,
} from './elevenLabs';

// Text-to-speech service
// Uses ElevenLabs when configured, falls back to macOS 'say' command or Web Speech API

export type TTSProvider = 'elevenlabs' | 'system' | 'browser';

/**
 * Get the current TTS provider based on configuration
 */
export function getCurrentProvider(): TTSProvider {
  const settings = useSettingsStore.getState();

  // If ElevenLabs is configured and user has selected a voice, use it
  if (isElevenLabsConfigured() && settings.elevenLabsVoiceId) {
    return 'elevenlabs';
  }

  // Otherwise fall back to system (Tauri) or browser
  return 'system';
}

/**
 * Speak text using the configured TTS provider
 * Uses streaming for ElevenLabs to reduce latency
 */
export async function speak(text: string): Promise<void> {
  const settings = useSettingsStore.getState();

  if (!settings.ttsEnabled) return;

  const provider = getCurrentProvider();

  try {
    switch (provider) {
      case 'elevenlabs': {
        const voiceId = settings.elevenLabsVoiceId;
        if (!voiceId) {
          throw new Error('No ElevenLabs voice selected');
        }

        // Use streaming for lower latency
        if (settings.elevenLabsStreaming !== false) {
          await elevenLabsSpeakStreaming(text, voiceId);
        } else {
          await elevenLabsSpeak(text, voiceId);
        }
        break;
      }

      case 'system':
      default: {
        await speakWithSystem(text);
        break;
      }
    }
  } catch (error) {
    console.error('TTS error:', error);

    // If ElevenLabs fails, fall back to system TTS
    if (provider === 'elevenlabs') {
      console.log('Falling back to system TTS');
      await speakWithSystem(text);
    }
  }
}

/**
 * Speak using macOS 'say' command via Tauri, falling back to Web Speech API
 */
async function speakWithSystem(text: string): Promise<void> {
  try {
    await invoke('speak_text', { text });
  } catch (error) {
    console.error('System TTS error:', error);
    // Fallback to Web Speech API if available
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }
}

/**
 * Stop any currently playing speech
 */
export function stopSpeaking(): void {
  // Stop ElevenLabs playback
  elevenLabsStopSpeaking();

  // Stop browser speech synthesis
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }

  // Tell Rust to stop if it's speaking
  invoke('stop_speaking').catch(console.error);
}

/**
 * Check if any TTS is currently speaking
 */
export function isSpeaking(): boolean {
  // Check ElevenLabs
  if (elevenLabsIsSpeaking()) {
    return true;
  }

  // Check browser speech synthesis
  if ('speechSynthesis' in window && speechSynthesis.speaking) {
    return true;
  }

  return false;
}

// Re-export ElevenLabs functions for direct access
export {
  getVoices,
  isElevenLabsConfigured,
  clearVoicesCache,
  type Voice,
  type VoiceSettings,
} from './elevenLabs';
