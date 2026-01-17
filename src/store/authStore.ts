import { create } from 'zustand';
import { User } from 'firebase/auth';
import {
  initAuth,
  onAuthChange,
  signInWithEmail,
  signInWithGoogle,
  createAccount,
  logOut,
} from '../services/auth';
import { startSync, stopSync } from '../sync';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;
}

interface AuthActions {
  initialize: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,
  isInitialized: false,

  initialize: () => {
    if (get().isInitialized) return;

    // Initialize Firebase Auth
    initAuth();

    // Listen for auth state changes
    onAuthChange((user) => {
      set({ user, isInitialized: true, isLoading: false });

      // Start or stop sync based on auth state
      if (user) {
        try {
          startSync(user.uid);
        } catch (err) {
          console.error('Failed to start sync:', err);
        }
      } else {
        stopSync();
      }
    });
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await signInWithEmail(email, password);
      // Auth state change listener will update the user
    } catch (error) {
      set({
        isLoading: false,
        error: (error as Error).message || 'Failed to sign in',
      });
      throw error;
    }
  },

  signUp: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      await createAccount(email, password);
      // Auth state change listener will update the user
    } catch (error) {
      set({
        isLoading: false,
        error: (error as Error).message || 'Failed to create account',
      });
      throw error;
    }
  },

  signInGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      await signInWithGoogle();
      // Auth state change listener will update the user
    } catch (error) {
      set({
        isLoading: false,
        error: (error as Error).message || 'Failed to sign in with Google',
      });
      throw error;
    }
  },

  signOut: async () => {
    set({ isLoading: true, error: null });
    try {
      await logOut();
      // Auth state change listener will update the user
    } catch (error) {
      set({
        isLoading: false,
        error: (error as Error).message || 'Failed to sign out',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
