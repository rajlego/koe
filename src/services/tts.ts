import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/settingsStore';

// Text-to-speech service
// Uses macOS 'say' command via Tauri for simplicity
// Can be replaced with ElevenLabs or other TTS services

export async function speak(text: string): Promise<void> {
  const ttsEnabled = useSettingsStore.getState().ttsEnabled;
  if (!ttsEnabled) return;

  try {
    await invoke('speak_text', { text });
  } catch (error) {
    console.error('TTS error:', error);
    // Fallback to Web Speech API if available
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.1;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
  // Also tell Rust to stop if it's speaking
  invoke('stop_speaking').catch(console.error);
}
