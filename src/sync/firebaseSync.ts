import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import * as Y from 'yjs';
import { firebaseConfig, isFirebaseConfigured } from './firebaseConfig';
import { ydoc } from './yjsProvider';

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let unsubscribe: Unsubscribe | null = null;
let syncStatus: 'synced' | 'syncing' | 'offline' | 'error' = 'offline';
const statusListeners: Set<(status: typeof syncStatus) => void> = new Set();

// Initialize Firebase
export function initFirebase(): boolean {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured. Running in offline-only mode.');
    return false;
  }

  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return false;
  }
}

// Start syncing with Firestore
export function startSync(userId: string, docId: string = 'default'): void {
  if (!db) {
    console.warn('Firebase not initialized. Cannot start sync.');
    return;
  }

  const docRef = doc(db, 'users', userId, 'documents', docId);
  setSyncStatus('syncing');

  // Listen for remote changes
  unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.update) {
          // Apply remote update to local Yjs doc
          const update = Uint8Array.from(atob(data.update), (c) => c.charCodeAt(0));
          Y.applyUpdate(ydoc, update, 'firebase');
        }
      }
      setSyncStatus('synced');
    },
    (error) => {
      console.error('Firestore sync error:', error);
      setSyncStatus('error');
    }
  );

  // Listen for local changes and push to Firestore
  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    // Don't re-sync updates that came from Firebase
    if (origin === 'firebase') return;

    setSyncStatus('syncing');

    // Encode update as base64 for Firestore storage
    const encoded = btoa(String.fromCharCode(...update));

    // Get full state for initial sync / recovery
    const fullState = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc)));

    setDoc(
      docRef,
      {
        update: encoded,
        fullState: fullState,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
      .then(() => {
        setSyncStatus('synced');
      })
      .catch((error) => {
        console.error('Failed to sync to Firestore:', error);
        setSyncStatus('error');
      });
  });
}

// Stop syncing
export function stopSync(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  setSyncStatus('offline');
}

// Get current sync status
export function getFirebaseSyncStatus(): typeof syncStatus {
  return syncStatus;
}

// Set sync status and notify listeners
function setSyncStatus(status: typeof syncStatus): void {
  syncStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

// Subscribe to sync status changes
export function onSyncStatusChange(
  callback: (status: typeof syncStatus) => void
): () => void {
  statusListeners.add(callback);
  callback(syncStatus);

  return () => {
    statusListeners.delete(callback);
  };
}

// Force a full sync (useful for recovery)
export async function forceFullSync(userId: string, docId: string = 'default'): Promise<void> {
  if (!db) {
    throw new Error('Firebase not initialized');
  }

  const docRef = doc(db, 'users', userId, 'documents', docId);
  const fullState = btoa(String.fromCharCode(...Y.encodeStateAsUpdate(ydoc)));

  await setDoc(docRef, {
    fullState: fullState,
    updatedAt: new Date().toISOString(),
    forceSynced: true,
  });
}
