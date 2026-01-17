// ElevenLabs Text-to-Speech Service
// Provides voice synthesis using ElevenLabs API with caching and streaming support

import { getApiKey as getStoredApiKey } from '../store/settingsStore';

const API_BASE = 'https://api.elevenlabs.io/v1';

// Types
export interface Voice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  preview_url?: string;
  labels?: Record<string, string>;
}

export interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

// Default voice settings optimized for natural speech
const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.5,
  use_speaker_boost: true,
};

// Cache for voices list (expires after 5 minutes)
let voicesCache: Voice[] | null = null;
let voicesCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Audio playback state
let currentAudio: HTMLAudioElement | null = null;
let currentAbortController: AbortController | null = null;

/**
 * Get the ElevenLabs API key from settings (with env fallback)
 */
function getApiKey(): string | undefined {
  const key = getStoredApiKey('elevenLabs');
  return key || undefined;
}

/**
 * Check if ElevenLabs is configured
 */
export function isElevenLabsConfigured(): boolean {
  const apiKey = getApiKey();
  return Boolean(apiKey && apiKey.length > 0);
}

/**
 * List available voices from ElevenLabs
 * Results are cached for 5 minutes to reduce API calls
 */
export async function getVoices(): Promise<Voice[]> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Return cached voices if still valid
  const now = Date.now();
  if (voicesCache && now - voicesCacheTime < CACHE_DURATION) {
    return voicesCache;
  }

  const response = await fetch(`${API_BASE}/voices`, {
    method: 'GET',
    headers: {
      'xi-api-key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch voices: ${response.status} ${error}`);
  }

  const data = await response.json();
  voicesCache = data.voices as Voice[];
  voicesCacheTime = now;

  return voicesCache;
}

/**
 * Clear the voices cache (useful after adding custom voices)
 */
export function clearVoicesCache(): void {
  voicesCache = null;
  voicesCacheTime = 0;
}

/**
 * Generate and play speech from text using a specified voice
 * Downloads the full audio before playing
 */
export async function speak(
  text: string,
  voiceId: string,
  settings: Partial<VoiceSettings> = {}
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Stop any currently playing audio
  stopSpeaking();

  const abortController = new AbortController();
  currentAbortController = abortController;

  const mergedSettings = { ...DEFAULT_VOICE_SETTINGS, ...settings };

  const response = await fetch(`${API_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: mergedSettings,
    }),
    signal: abortController.signal,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to generate speech: ${response.status} ${error}`);
  }

  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };

    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      reject(new Error(`Audio playback error: ${e}`));
    };

    audio.play().catch((e) => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      reject(e);
    });
  });
}

/**
 * Stream audio as it generates for lower latency
 * Uses chunked transfer for real-time playback
 */
export async function speakStreaming(
  text: string,
  voiceId: string,
  settings: Partial<VoiceSettings> = {}
): Promise<void> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured');
  }

  // Stop any currently playing audio
  stopSpeaking();

  const abortController = new AbortController();
  currentAbortController = abortController;

  const mergedSettings = { ...DEFAULT_VOICE_SETTINGS, ...settings };

  const response = await fetch(
    `${API_BASE}/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: mergedSettings,
        optimize_streaming_latency: 3, // Optimize for lower latency
      }),
      signal: abortController.signal,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to stream speech: ${response.status} ${error}`);
  }

  // Use MediaSource API for streaming playback
  if ('MediaSource' in window && MediaSource.isTypeSupported('audio/mpeg')) {
    return playWithMediaSource(response, abortController.signal);
  } else {
    // Fallback: collect chunks and play as blob
    return playAsBlob(response, abortController.signal);
  }
}

/**
 * Play streaming audio using MediaSource API
 */
async function playWithMediaSource(
  response: Response,
  signal: AbortSignal
): Promise<void> {
  const mediaSource = new MediaSource();
  const audio = new Audio();
  currentAudio = audio;
  audio.src = URL.createObjectURL(mediaSource);

  return new Promise((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', async () => {
      try {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        const reader = response.body?.getReader();

        if (!reader) {
          throw new Error('No response body');
        }

        let playStarted = false;

        const processChunk = async (): Promise<void> => {
          const { done, value } = await reader.read();

          if (signal.aborted) {
            reader.cancel();
            return;
          }

          if (done) {
            if (mediaSource.readyState === 'open') {
              sourceBuffer.addEventListener('updateend', () => {
                if (mediaSource.readyState === 'open') {
                  mediaSource.endOfStream();
                }
              }, { once: true });
            }
            return;
          }

          // Wait for buffer to be ready if needed
          if (sourceBuffer.updating) {
            await new Promise<void>((r) => {
              sourceBuffer.addEventListener('updateend', () => r(), { once: true });
            });
          }

          sourceBuffer.appendBuffer(value);

          // Start playback after first chunk
          if (!playStarted) {
            playStarted = true;
            audio.play().catch(reject);
          }

          // Continue processing
          await processChunk();
        };

        await processChunk();

        audio.onended = () => {
          URL.revokeObjectURL(audio.src);
          currentAudio = null;
          resolve();
        };

        audio.onerror = (e) => {
          URL.revokeObjectURL(audio.src);
          currentAudio = null;
          reject(new Error(`Audio playback error: ${e}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Fallback: collect all chunks and play as blob
 */
async function playAsBlob(
  response: Response,
  signal: AbortSignal
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (signal.aborted) {
      reader.cancel();
      return;
    }

    if (done) break;
    chunks.push(value);
  }

  const blob = new Blob(chunks, { type: 'audio/mpeg' });
  const audioUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      resolve();
    };

    audio.onerror = (e) => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      reject(new Error(`Audio playback error: ${e}`));
    };

    audio.play().catch((e) => {
      URL.revokeObjectURL(audioUrl);
      currentAudio = null;
      reject(e);
    });
  });
}

/**
 * Stop any currently playing audio
 */
export function stopSpeaking(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    // Clean up object URL if it exists
    if (currentAudio.src.startsWith('blob:')) {
      URL.revokeObjectURL(currentAudio.src);
    }
    currentAudio = null;
  }
}

/**
 * Check if audio is currently playing
 */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Get the current playback progress (0-1)
 */
export function getPlaybackProgress(): number {
  if (!currentAudio || currentAudio.duration === 0) {
    return 0;
  }
  return currentAudio.currentTime / currentAudio.duration;
}
