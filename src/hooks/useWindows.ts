import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { PhysicalPosition } from '@tauri-apps/api/dpi';
import { useCallback } from 'react';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';
import { saveWindowState, removeWindowState } from '../sync';
import type { WindowState, PositionPreset, ViewMode } from '../models/types';

// Snap configuration
const SNAP_THRESHOLD = 20; // pixels within which snapping occurs
const EDGE_PADDING = 10;   // padding from screen edges

// Default screen dimensions (will be overridden if we can query actual size)
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;

interface SnapZone {
  x?: number;
  y?: number;
  type: 'edge' | 'center' | 'grid' | 'window';
}

/**
 * Calculate snap zones for a given position
 */
function getSnapZones(
  screenWidth: number,
  screenHeight: number,
  windowWidth: number,
  windowHeight: number,
  otherWindows: WindowState[]
): SnapZone[] {
  const zones: SnapZone[] = [];

  // Screen edges
  zones.push({ x: EDGE_PADDING, type: 'edge' }); // left edge
  zones.push({ x: screenWidth - windowWidth - EDGE_PADDING, type: 'edge' }); // right edge
  zones.push({ y: EDGE_PADDING, type: 'edge' }); // top edge
  zones.push({ y: screenHeight - windowHeight - EDGE_PADDING, type: 'edge' }); // bottom edge

  // Screen center
  zones.push({ x: (screenWidth - windowWidth) / 2, type: 'center' });
  zones.push({ y: (screenHeight - windowHeight) / 2, type: 'center' });

  // Grid positions (thirds)
  const thirdX = screenWidth / 3;
  const thirdY = screenHeight / 3;
  zones.push({ x: thirdX - windowWidth / 2, type: 'grid' });
  zones.push({ x: 2 * thirdX - windowWidth / 2, type: 'grid' });
  zones.push({ y: thirdY - windowHeight / 2, type: 'grid' });
  zones.push({ y: 2 * thirdY - windowHeight / 2, type: 'grid' });

  // Other windows - snap to their edges
  for (const win of otherWindows) {
    // Snap to left edge of other window
    zones.push({ x: win.x, type: 'window' });
    // Snap to right edge of other window
    zones.push({ x: win.x + win.width, type: 'window' });
    // Snap to right side next to other window (align right edges)
    zones.push({ x: win.x + win.width - windowWidth, type: 'window' });
    // Snap to top edge of other window
    zones.push({ y: win.y, type: 'window' });
    // Snap to bottom edge of other window
    zones.push({ y: win.y + win.height, type: 'window' });
    // Snap to bottom next to other window (align bottom edges)
    zones.push({ y: win.y + win.height - windowHeight, type: 'window' });
  }

  return zones;
}

/**
 * Apply snapping to a position
 */
function snapPosition(
  x: number,
  y: number,
  windowWidth: number,
  windowHeight: number,
  otherWindows: WindowState[],
  screenWidth: number = DEFAULT_SCREEN_WIDTH,
  screenHeight: number = DEFAULT_SCREEN_HEIGHT
): { x: number; y: number; snapped: boolean } {
  const zones = getSnapZones(screenWidth, screenHeight, windowWidth, windowHeight, otherWindows);

  let snappedX = x;
  let snappedY = y;
  let didSnap = false;

  // Find closest snap zone for X
  for (const zone of zones) {
    if (zone.x !== undefined) {
      const distance = Math.abs(x - zone.x);
      if (distance < SNAP_THRESHOLD) {
        snappedX = zone.x;
        didSnap = true;
        break; // Take first match
      }
    }
  }

  // Find closest snap zone for Y
  for (const zone of zones) {
    if (zone.y !== undefined) {
      const distance = Math.abs(y - zone.y);
      if (distance < SNAP_THRESHOLD) {
        snappedY = zone.y;
        didSnap = true;
        break; // Take first match
      }
    }
  }

  // Ensure window stays on screen
  snappedX = Math.max(0, Math.min(snappedX, screenWidth - windowWidth));
  snappedY = Math.max(0, Math.min(snappedY, screenHeight - windowHeight));

  return { x: snappedX, y: snappedY, snapped: didSnap };
}

// Get screen-relative position from preset
function getPositionFromPreset(
  preset: PositionPreset,
  width: number,
  height: number
): { x: number; y: number } {
  // These are approximate - in practice you'd query actual screen size
  const screenWidth = DEFAULT_SCREEN_WIDTH;
  const screenHeight = DEFAULT_SCREEN_HEIGHT;
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
    async (
      windowId: string,
      position: PositionPreset | { x: number; y: number },
      options?: { enableSnap?: boolean }
    ) => {
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

        // Apply snapping if enabled (default: true for coordinate positions)
        const shouldSnap = options?.enableSnap !== false && typeof position !== 'string';
        if (shouldSnap) {
          // Get other windows for snap-to-window behavior
          const otherWindows = Array.from(useWindowStore.getState().openWindows.values())
            .filter((w) => w.id !== windowId);

          const snapped = snapPosition(
            newPosition.x,
            newPosition.y,
            size.width,
            size.height,
            otherWindows
          );
          newPosition = { x: snapped.x, y: snapped.y };
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

  /**
   * Move window with snapping applied
   */
  const moveWindowWithSnap = useCallback(
    async (windowId: string, x: number, y: number) => {
      return moveWindow(windowId, { x, y }, { enableSnap: true });
    },
    [moveWindow]
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
    moveWindowWithSnap,
    focusWindow,
  };
}

// Export snap utilities for external use
export { snapPosition, SNAP_THRESHOLD, EDGE_PADDING };
