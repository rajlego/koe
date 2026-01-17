import { initLocalPersistence } from './yjsProvider';
import { initFirebase } from './firebaseSync';

// Initialize all sync providers
export async function initSync(): Promise<void> {
  // Always init local persistence first (offline-first)
  await initLocalPersistence();

  // Try to init Firebase (optional)
  initFirebase();
}

// Re-export everything
export {
  ydoc,
  initLocalPersistence,
  getThoughtsMap,
  addThought,
  updateThought,
  deleteThought,
  getThought,
  getAllThoughts,
  onThoughtsChange,
  getWindowsMap,
  saveWindowState,
  removeWindowState,
  getAllWindowStates,
  getConversationArray,
  addConversationMessage,
  getConversationHistory,
  clearConversationHistory,
  getSyncStatus,
  destroy,
} from './yjsProvider';

export {
  initFirebase,
  startSync,
  stopSync,
  getFirebaseSyncStatus,
  onSyncStatusChange,
  forceFullSync,
} from './firebaseSync';

export { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';
