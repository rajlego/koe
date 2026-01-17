import { describe, it, expect, beforeEach } from 'vitest';
import { useWindowStore } from './windowStore';
import type { WindowState } from '../models/types';

describe('windowStore', () => {
  beforeEach(() => {
    useWindowStore.setState({
      activeThoughtId: null,
      activeWindowId: null,
      voiceState: 'idle',
      lastTranscript: '',
      openWindows: new Map(),
    });
  });

  describe('active state', () => {
    it('should have no active thought initially', () => {
      expect(useWindowStore.getState().activeThoughtId).toBeNull();
    });

    it('should set active thought', () => {
      useWindowStore.getState().setActiveThought('thought-123');
      expect(useWindowStore.getState().activeThoughtId).toBe('thought-123');
    });

    it('should set active window', () => {
      useWindowStore.getState().setActiveWindow('window-456');
      expect(useWindowStore.getState().activeWindowId).toBe('window-456');
    });
  });

  describe('voice state', () => {
    it('should start with idle voice state', () => {
      expect(useWindowStore.getState().voiceState).toBe('idle');
    });

    it('should update voice state', () => {
      useWindowStore.getState().setVoiceState('listening');
      expect(useWindowStore.getState().voiceState).toBe('listening');

      useWindowStore.getState().setVoiceState('processing');
      expect(useWindowStore.getState().voiceState).toBe('processing');
    });

    it('should update last transcript', () => {
      useWindowStore.getState().setLastTranscript('hello world');
      expect(useWindowStore.getState().lastTranscript).toBe('hello world');
    });
  });

  describe('window management', () => {
    const mockWindow: WindowState = {
      id: 'window-1',
      thoughtId: 'thought-1',
      x: 100,
      y: 200,
      width: 400,
      height: 300,
      viewMode: 'full',
    };

    it('should register a window', () => {
      useWindowStore.getState().registerWindow(mockWindow);

      const windows = useWindowStore.getState().openWindows;
      expect(windows.size).toBe(1);
      expect(windows.get('window-1')).toEqual(mockWindow);
    });

    it('should unregister a window', () => {
      useWindowStore.getState().registerWindow(mockWindow);
      useWindowStore.getState().unregisterWindow('window-1');

      expect(useWindowStore.getState().openWindows.size).toBe(0);
    });

    it('should update window position', () => {
      useWindowStore.getState().registerWindow(mockWindow);
      useWindowStore.getState().updateWindowPosition('window-1', 500, 600);

      const window = useWindowStore.getState().openWindows.get('window-1');
      expect(window?.x).toBe(500);
      expect(window?.y).toBe(600);
    });

    it('should update window size', () => {
      useWindowStore.getState().registerWindow(mockWindow);
      useWindowStore.getState().updateWindowSize('window-1', 800, 600);

      const window = useWindowStore.getState().openWindows.get('window-1');
      expect(window?.width).toBe(800);
      expect(window?.height).toBe(600);
    });

    it('should handle updating non-existent window gracefully', () => {
      useWindowStore.getState().updateWindowPosition('non-existent', 100, 100);
      expect(useWindowStore.getState().openWindows.size).toBe(0);
    });
  });
});
