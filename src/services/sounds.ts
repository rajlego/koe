// Sound feedback for voice interactions
// Uses Web Audio API for low-latency, subtle audio cues

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

// Play a simple tone
function playTone(
  frequency: number,
  duration: number,
  volume: number = 0.1,
  type: OscillatorType = 'sine'
): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  } catch (e) {
    // Audio not available, fail silently
  }
}

// Play two tones in sequence
function playChord(
  frequencies: number[],
  duration: number,
  volume: number = 0.1
): void {
  frequencies.forEach((freq, i) => {
    setTimeout(() => playTone(freq, duration, volume), i * 50);
  });
}

// === Sound Effects ===

// Voice started listening - gentle rising tone
export function playListeningStart(): void {
  playTone(440, 0.1, 0.08); // A4
  setTimeout(() => playTone(523, 0.1, 0.08), 50); // C5
}

// Voice stopped listening - gentle falling tone
export function playListeningStop(): void {
  playTone(523, 0.1, 0.08); // C5
  setTimeout(() => playTone(440, 0.1, 0.08), 50); // A4
}

// Processing started - quick blip
export function playProcessingStart(): void {
  playTone(660, 0.05, 0.05); // E5
}

// Action completed successfully - pleasant chord
export function playSuccess(): void {
  playChord([523, 659, 784], 0.15, 0.06); // C5, E5, G5
}

// Error occurred - low tone
export function playError(): void {
  playTone(220, 0.2, 0.1, 'triangle'); // A3
}

// Thought created - soft pop
export function playThoughtCreated(): void {
  playTone(880, 0.08, 0.05); // A5
}

// Window moved - subtle swoosh (quick frequency sweep)
export function playWindowMoved(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(400, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  } catch (e) {
    // Audio not available
  }
}

// Undo action - reverse sound
export function playUndo(): void {
  playTone(600, 0.05, 0.05);
  setTimeout(() => playTone(500, 0.05, 0.05), 30);
  setTimeout(() => playTone(400, 0.05, 0.05), 60);
}

// Notification/alert - two-tone chime
export function playNotification(): void {
  playTone(587, 0.1, 0.08); // D5
  setTimeout(() => playTone(784, 0.15, 0.08), 100); // G5
}

// Sound settings
let soundsEnabled = true;

export function setSoundsEnabled(enabled: boolean): void {
  soundsEnabled = enabled;
}

export function areSoundsEnabled(): boolean {
  return soundsEnabled;
}

// Wrapper that checks if sounds are enabled
export function withSoundCheck<T extends (...args: Parameters<T>) => void>(
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    if (soundsEnabled) {
      fn(...args);
    }
  }) as T;
}

// Export wrapped versions that respect the enabled setting
export const sounds = {
  listeningStart: () => soundsEnabled && playListeningStart(),
  listeningStop: () => soundsEnabled && playListeningStop(),
  processingStart: () => soundsEnabled && playProcessingStart(),
  success: () => soundsEnabled && playSuccess(),
  error: () => soundsEnabled && playError(),
  thoughtCreated: () => soundsEnabled && playThoughtCreated(),
  windowMoved: () => soundsEnabled && playWindowMoved(),
  undo: () => soundsEnabled && playUndo(),
  notification: () => soundsEnabled && playNotification(),
};
