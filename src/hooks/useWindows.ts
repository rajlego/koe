import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { useCallback } from 'react';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';
import { saveWindowState, removeWindowState } from '../sync';
import type { WindowState, PositionPreset, ViewMode } from '../models/types';

// Get screen-relative position from preset
function getPositionFromPreset(
  preset: PositionPreset,
  width: number,
  height: number
): { x: number; y: number } {
  // These are approximate - in practice you'd query actual screen size
  const screenWidth = 1920;
  const screenHeight = 1080;
  const padding = 50;

  switch (preset) {
    case 'center':
      return {
        x: (screenWidth - width) / 2,
        y: (screenHeight - height) / 2,
      };
    case 'top-left':
      return { x: padding, y: padding };
    case 'top-right':
      return { x: screenWidth - width - padding, y: padding };
    case 'bottom-left':
      return { x: padding, y: screenHeight - height - padding };
    case 'bottom-right':
      return { x: screenWidth - width - padding, y: screenHeight - height - padding };
    case 'left':
      return { x: padding, y: (screenHeight - height) / 2 };
    case 'right':
      return { x: screenWidth - width - padding, y: (screenHeight - height) / 2 };
    default:
      return { x: 100, y: 100 };
  }
}

export function useWindows() {
  const { registerWindow, unregisterWindow, setActiveWindow } = useWindowStore();
  const customPositions = useSettingsStore((s) => s.customPositions);

  const createThoughtWindow = useCallback(
    async (
      thoughtId: string,
      options?: {
        position?: PositionPreset | { x: number; y: number };
        width?: number;
        height?: number;
        viewMode?: ViewMode;
      }
    ) => {
      const width = options?.width ?? 400;
      const height = options?.height ?? 300;

      // Resolve position
      let position: { x: number; y: number };
      if (!options?.position) {
        position = getPositionFromPreset('center', width, height);
      } else if (typeof options.position === 'string') {
        // Check custom positions first
        const custom = customPositions.find((p) => p.name === options.position);
        if (custom) {
          position = { x: custom.x, y: custom.y };
        } else {
          position = getPositionFromPreset(options.position as PositionPreset, width, height);
        }
      } else {
        position = options.position;
      }

      const windowId = `thought-${thoughtId}-${Date.now()}`;

      try {
        const webview = new WebviewWindow(windowId, {
          url: `/thought/${thoughtId}`,
          title: 'Thought',
          width,
          height,
          x: position.x,
          y: position.y,
          decorations: true,
          transparent: false,
          alwaysOnTop: false,
          focus: true,
        });

        // Wait for window creation
        await new Promise<void>((resolve, reject) => {
          webview.once('tauri://created', () => {
            console.log(`Window ${windowId} created`);
            resolve();
          });
          webview.once('tauri://error', (e) => {
            console.error(`Failed to create window ${windowId}:`, e);
            reject(e);
          });
        });

        // Register in local store
        const windowState: WindowState = {
          id: windowId,
          thoughtId,
          x: position.x,
          y: position.y,
          width,
          height,
          viewMode: options?.viewMode ?? 'full',
        };
        registerWindow(windowState);

        // Persist to YJS
        saveWindowState(windowState);

        // Set as active
        setActiveWindow(windowId);

        return windowId;
      } catch (error) {
        console.error('Failed to create thought window:', error);
        throw error;
      }
    },
    [registerWindow, setActiveWindow, customPositions]
  );

  const closeThoughtWindow = useCallback(
    async (windowId: string) => {
      try {
        const webview = await WebviewWindow.getByLabel(windowId);
        if (webview) {
          await webview.close();
        }
        unregisterWindow(windowId);
        removeWindowState(windowId);
      } catch (error) {
        console.error('Failed to close window:', error);
      }
    },
    [unregisterWindow]
  );

  const moveWindow = useCallback(
    async (windowId: string, position: PositionPreset | { x: number; y: number }) => {
      try {
        const webview = await WebviewWindow.getByLabel(windowId);
        if (!webview) return;

        const size = await webview.innerSize();
        let newPosition: { x: number; y: number };

        if (typeof position === 'string') {
          const custom = customPositions.find((p) => p.name === position);
          if (custom) {
            newPosition = { x: custom.x, y: custom.y };
          } else {
            newPosition = getPositionFromPreset(position as PositionPreset, size.width, size.height);
          }
        } else {
          newPosition = position;
        }

        await webview.setPosition(new PhysicalPosition(newPosition.x, newPosition.y));

        // Update store and sync
        useWindowStore.getState().updateWindowPosition(windowId, newPosition.x, newPosition.y);
      } catch (error) {
        console.error('Failed to move window:', error);
      }
    },
    [customPositions]
  );

  const focusWindow = useCallback(async (windowId: string) => {
    try {
      const webview = await WebviewWindow.getByLabel(windowId);
      if (webview) {
        await webview.setFocus();
        setActiveWindow(windowId);
      }
    } catch (error) {
      console.error('Failed to focus window:', error);
    }
  }, [setActiveWindow]);

  return {
    createThoughtWindow,
    closeThoughtWindow,
    moveWindow,
    focusWindow,
  };
}
