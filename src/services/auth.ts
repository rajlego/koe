import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import { initializeApp, FirebaseApp } from 'firebase/app';
import { firebaseConfig, isFirebaseConfigured } from '../sync/firebaseConfig';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

// Initialize Firebase Auth
export function initAuth(): Auth | null {
  if (!isFirebaseConfigured()) {
    console.log('Firebase not configured, auth disabled');
    return null;
  }

  if (auth) return auth;

  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    return auth;
  } catch (error) {
    console.error('Failed to initialize Firebase Auth:', error);
    return null;
  }
}

// Get current auth instance
export function getAuthInstance(): Auth | null {
  return auth;
}

// Sign in with email/password
export async function signInWithEmail(
  email: string,
  password: string
): Promise<User> {
  const authInstance = initAuth();
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }

  const result = await signInWithEmailAndPassword(authInstance, email, password);
  return result.user;
}

// Create account with email/password
export async function createAccount(
  email: string,
  password: string
): Promise<User> {
  const authInstance = initAuth();
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }

  const result = await createUserWithEmailAndPassword(authInstance, email, password);
  return result.user;
}

// Sign in with Google
export async function signInWithGoogle(): Promise<User> {
  const authInstance = initAuth();
  if (!authInstance) {
    throw new Error('Firebase Auth not initialized');
  }

  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(authInstance, provider);
  return result.user;
}

// Sign out
export async function logOut(): Promise<void> {
  const authInstance = initAuth();
  if (!authInstance) {
    return;
  }

  await signOut(authInstance);
}

// Subscribe to auth state changes
export function onAuthChange(callback: (user: User | null) => void): () => void {
  const authInstance = initAuth();
  if (!authInstance) {
    // Call with null immediately if auth is not available
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(authInstance, callback);
}

// Get current user
export function getCurrentUser(): User | null {
  const authInstance = initAuth();
  if (!authInstance) {
    return null;
  }

  return authInstance.currentUser;
}
