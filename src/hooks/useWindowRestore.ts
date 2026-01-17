import { useEffect, useRef } from 'react';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getAllWindowStates, removeWindowState } from '../sync';
import { useWindowStore } from '../store/windowStore';
import { useSettingsStore } from '../store/settingsStore';

// Restore saved windows on app startup
export function useWindowRestore() {
  const restoreWindows = useSettingsStore((s) => s.restoreWindows);
  const registerWindow = useWindowStore((s) => s.registerWindow);
  const restoredRef = useRef(false);

  useEffect(() => {
    // Only restore once
    if (restoredRef.current || !restoreWindows) return;
    restoredRef.current = true;

    const restoreSavedWindows = async () => {
      const savedWindows = getAllWindowStates();
      console.log(`Restoring ${savedWindows.length} saved windows`);

      for (const windowState of savedWindows) {
        try {
          // Check if window already exists
          const existing = await WebviewWindow.getByLabel(windowState.id);
          if (existing) {
            // Window already open, just register it
            registerWindow(windowState);
            continue;
          }

          // Create the webview window
          const webview = new WebviewWindow(windowState.id, {
            url: `/thought/${windowState.thoughtId}`,
            title: 'Thought',
            width: windowState.width,
            height: windowState.height,
            x: windowState.x,
            y: windowState.y,
            decorations: true,
            transparent: false,
            alwaysOnTop: false,
            focus: false, // Don't steal focus during restore
          });

          await new Promise<void>((resolve, reject) => {
            webview.once('tauri://created', () => {
              console.log(`Restored window ${windowState.id}`);
              registerWindow(windowState);
              resolve();
            });
            webview.once('tauri://error', (e) => {
              console.error(`Failed to restore window ${windowState.id}:`, e);
              // Remove invalid window state
              removeWindowState(windowState.id);
              reject(e);
            });
          });
        } catch (error) {
          console.error(`Error restoring window ${windowState.id}:`, error);
          // Clean up invalid window state
          removeWindowState(windowState.id);
        }
      }
    };

    // Delay restore slightly to ensure sync is ready
    const timer = setTimeout(restoreSavedWindows, 500);
    return () => clearTimeout(timer);
  }, [restoreWindows, registerWindow]);
}

// Hook for tracking window position/size changes and persisting them
export function useWindowTracking(windowId: string | null) {
  const updateWindowPosition = useWindowStore((s) => s.updateWindowPosition);
  const updateWindowSize = useWindowStore((s) => s.updateWindowSize);

  useEffect(() => {
    if (!windowId) return;

    const setupTracking = async () => {
      const webview = await WebviewWindow.getByLabel(windowId);
      if (!webview) return;

      // Track position changes
      const unlistenMove = await webview.onMoved((position) => {
        updateWindowPosition(windowId, position.payload.x, position.payload.y);
        // Persist to YJS is handled by windowStore if needed
      });

      // Track size changes
      const unlistenResize = await webview.onResized((size) => {
        updateWindowSize(windowId, size.payload.width, size.payload.height);
      });

      return () => {
        unlistenMove();
        unlistenResize();
      };
    };

    const cleanup = setupTracking();
    return () => {
      cleanup.then((fn) => fn && fn());
    };
  }, [windowId, updateWindowPosition, updateWindowSize]);
}
