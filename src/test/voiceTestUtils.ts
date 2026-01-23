import { invoke } from '@tauri-apps/api/core';

/**
 * Test utilities for voice features - allows testing without actual audio
 */

/**
 * Emit a simulated transcript event from Rust
 * This triggers the same event flow as real voice input
 */
export async function emitTestTranscript(text: string): Promise<void> {
  console.log('[Test] Emitting test transcript:', text);
  await invoke('test_emit_transcript', { text });
}

/**
 * Run a full voice flow test
 */
export async function runVoiceFlowTest(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Emit a test transcript
    await emitTestTranscript('This is a test transcript from the automated test system.');
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
