import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVoice } from './useVoice';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';

// Mock Tauri API
const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Mock Tauri event listener
const mockListenCallbacks: Record<string, (event: { payload: unknown }) => void> = {};
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((eventName: string, callback: (event: { payload: unknown }) => void) => {
    mockListenCallbacks[eventName] = callback;
    return Promise.resolve(() => {
      delete mockListenCallbacks[eventName];
    });
  }),
}));

// Mock sounds
vi.mock('../services/sounds', () => ({
  sounds: {
    listeningStart: vi.fn(),
    listeningStop: vi.fn(),
    processingStart: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useVoice', () => {
  beforeEach(() => {
    // Reset stores
    useWindowStore.setState({
      voiceState: 'idle',
      lastTranscript: '',
      lastError: null,
    });
    useSettingsStore.setState({
      voiceEnabled: true,
    });
    vi.clearAllMocks();
    // Clear listen callbacks
    Object.keys(mockListenCallbacks).forEach(key => delete mockListenCallbacks[key]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should return idle voice state initially', () => {
      const { result } = renderHook(() => useVoice());

      expect(result.current.voiceState).toBe('idle');
      expect(result.current.isListening).toBe(false);
      expect(result.current.isProcessing).toBe(false);
    });

    it('should return empty transcript initially', () => {
      const { result } = renderHook(() => useVoice());

      expect(result.current.lastTranscript).toBe('');
    });
  });

  describe('startListening', () => {
    it('should invoke start_voice_capture when called', async () => {
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.startListening();
      });

      expect(mockInvoke).toHaveBeenCalledWith('start_voice_capture');
    });

    it('should set voice state to listening', async () => {
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.startListening();
      });

      expect(result.current.voiceState).toBe('listening');
      expect(result.current.isListening).toBe(true);
    });

    it('should NOT start if voiceEnabled is false', async () => {
      useSettingsStore.setState({ voiceEnabled: false });
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.startListening();
      });

      expect(mockInvoke).not.toHaveBeenCalledWith('start_voice_capture');
      expect(result.current.voiceState).toBe('idle');
    });

    it('should play listening start sound', async () => {
      const { sounds } = await import('../services/sounds');
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.startListening();
      });

      expect(sounds.listeningStart).toHaveBeenCalled();
    });

    it('should set error state if invoke fails', async () => {
      const { sounds } = await import('../services/sounds');

      const { result } = renderHook(() => useVoice());

      // Wait a tick for the hook to initialize (configure_whisper call)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Now set up the rejection for the next invoke call (start_voice_capture)
      mockInvoke.mockRejectedValueOnce(new Error('Microphone access denied'));

      await act(async () => {
        await result.current.startListening();
      });

      expect(result.current.voiceState).toBe('error');
      expect(sounds.error).toHaveBeenCalled();
    });
  });

  describe('stopListening', () => {
    it('should invoke stop_voice_capture when called', async () => {
      const { result } = renderHook(() => useVoice());

      // Start first
      await act(async () => {
        await result.current.startListening();
      });

      // Then stop
      await act(async () => {
        await result.current.stopListening();
      });

      expect(mockInvoke).toHaveBeenCalledWith('stop_voice_capture');
    });

    it('should set voice state to idle', async () => {
      const { result } = renderHook(() => useVoice());

      // Start first
      await act(async () => {
        await result.current.startListening();
      });

      expect(result.current.voiceState).toBe('listening');

      // Then stop
      await act(async () => {
        await result.current.stopListening();
      });

      expect(result.current.voiceState).toBe('idle');
      expect(result.current.isListening).toBe(false);
    });

    it('should play listening stop sound', async () => {
      const { sounds } = await import('../services/sounds');
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.stopListening();
      });

      expect(sounds.listeningStop).toHaveBeenCalled();
    });
  });

  describe('transcript events', () => {
    it('should update transcript when voice:transcript event received', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:transcript']).toBeDefined();
      });

      // Simulate transcript event
      act(() => {
        mockListenCallbacks['voice:transcript']?.({
          payload: { text: 'Hello world', isFinal: false },
        });
      });

      expect(result.current.lastTranscript).toBe('Hello world');
    });

    it('should set processing state when final transcript received', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { sounds } = await import('../services/sounds');
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:transcript']).toBeDefined();
      });

      // Simulate final transcript event
      act(() => {
        mockListenCallbacks['voice:transcript']?.({
          payload: { text: 'Final message', isFinal: true },
        });
      });

      expect(result.current.voiceState).toBe('processing');
      expect(result.current.isProcessing).toBe(true);
      expect(sounds.processingStart).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should set error state when voice:error event received', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:error']).toBeDefined();
      });

      // Simulate error event
      act(() => {
        mockListenCallbacks['voice:error']?.({
          payload: 'Microphone error',
        });
      });

      expect(result.current.voiceState).toBe('error');
    });

    it('should store error message for display', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:error']).toBeDefined();
      });

      // Simulate error event
      act(() => {
        mockListenCallbacks['voice:error']?.({
          payload: 'Microphone access denied',
        });
      });

      expect(result.current.lastError).toBe('Microphone access denied');
    });

    it('should clear error when clearError is called', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:error']).toBeDefined();
      });

      // Simulate error event
      act(() => {
        mockListenCallbacks['voice:error']?.({
          payload: 'Some error',
        });
      });

      expect(result.current.lastError).toBe('Some error');
      expect(result.current.voiceState).toBe('error');

      // Clear error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.lastError).toBeNull();
      expect(result.current.voiceState).toBe('idle');
    });

    it('should NOT set error state for stopped message', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { result } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:error']).toBeDefined();
      });

      // Simulate error with "stopped" in message (should be ignored)
      act(() => {
        mockListenCallbacks['voice:error']?.({
          payload: 'Voice capture stopped',
        });
      });

      // Should NOT change to error state
      expect(result.current.voiceState).toBe('idle');
      expect(result.current.lastError).toBeNull();
    });

    it('should set error when voice is disabled and start is attempted', async () => {
      useSettingsStore.setState({ voiceEnabled: false });
      const { result } = renderHook(() => useVoice());

      await act(async () => {
        await result.current.startListening();
      });

      expect(result.current.lastError).toContain('Voice is disabled');
    });
  });

  describe('cleanup', () => {
    it('should clean up event listeners on unmount', async () => {
      useSettingsStore.setState({ voiceEnabled: true });
      const { unmount } = renderHook(() => useVoice());

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(mockListenCallbacks['voice:transcript']).toBeDefined();
      });

      unmount();

      // Give time for cleanup
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify stop_voice_capture was called on cleanup
      expect(mockInvoke).toHaveBeenCalledWith('stop_voice_capture');
    });
  });
});
