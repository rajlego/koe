import { useEffect, lazy, Suspense } from "react";
import ControlSurface from "./components/ControlSurface/ControlSurface";
import { useSettingsStore } from "./store/settingsStore";
import { useWindowStore } from "./store/windowStore";
import { useAuthStore } from "./store/authStore";
import { useWindowRestore } from "./hooks/useWindowRestore";
import { initSync } from "./sync";
import { setSoundsEnabled } from "./services/sounds";
import "./App.css";

// Lazy load ThoughtWindow (also lazy-loaded in main.tsx for route-based loading)
const ThoughtWindow = lazy(() => import("./components/ThoughtWindow/ThoughtWindow"));

function App() {
  const displayMode = useSettingsStore((s) => s.displayMode);
  const soundsEnabled = useSettingsStore((s) => s.soundsEnabled);
  const activeThoughtId = useWindowStore((s) => s.activeThoughtId);
  const initializeAuth = useAuthStore((s) => s.initialize);

  // Restore windows on app start
  useWindowRestore();

  useEffect(() => {
    initSync();
    initializeAuth();
  }, [initializeAuth]);

  // Sync sounds enabled setting
  useEffect(() => {
    setSoundsEnabled(soundsEnabled);
  }, [soundsEnabled]);

  // Mode B: Main window is also a thought window
  if (displayMode === "integrated" && activeThoughtId) {
    return (
      <div className="app integrated-mode">
        <Suspense fallback={<div className="loading">Loading...</div>}>
          <ThoughtWindow thoughtId={activeThoughtId} isMainWindow />
        </Suspense>
      </div>
    );
  }

  // Mode A (default): Main window is control surface only
  return (
    <div className="app control-mode">
      <ControlSurface />
    </div>
  );
}

export default App;
