import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { useAuthStore } from './authStore';
import * as authService from '../services/auth';

// Mock Firebase auth
vi.mock('../services/auth', () => ({
  initAuth: vi.fn(() => null),
  onAuthChange: vi.fn((callback) => {
    // Simulate no user initially
    callback(null);
    return () => {};
  }),
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  createAccount: vi.fn(),
  logOut: vi.fn(),
}));

// Mock sync
vi.mock('../sync', () => ({
  startSync: vi.fn(),
  stopSync: vi.fn(),
}));

describe('authStore', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuthStore.setState({
      user: null,
      isLoading: false,
      error: null,
      isInitialized: false,
    });
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should start with no user', () => {
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('should not be loading initially', () => {
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('should have no error initially', () => {
      expect(useAuthStore.getState().error).toBeNull();
    });

    it('should not be initialized initially', () => {
      expect(useAuthStore.getState().isInitialized).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should set isInitialized to true after initialization', () => {
      useAuthStore.getState().initialize();
      // The mock calls the callback with null, which sets isInitialized
      expect(useAuthStore.getState().isInitialized).toBe(true);
    });

    it('should not reinitialize if already initialized', () => {
      useAuthStore.getState().initialize();
      useAuthStore.getState().initialize();
      // Should only be called once
      expect(authService.initAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe('signIn', () => {
    it('should set loading state while signing in', async () => {
      (authService.signInWithEmail as Mock).mockResolvedValueOnce({ email: 'test@test.com' });

      const signInPromise = useAuthStore.getState().signIn('test@test.com', 'password');
      expect(useAuthStore.getState().isLoading).toBe(true);

      await signInPromise;
    });

    it('should set error on sign in failure', async () => {
      (authService.signInWithEmail as Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

      await expect(
        useAuthStore.getState().signIn('test@test.com', 'wrongpassword')
      ).rejects.toThrow();

      expect(useAuthStore.getState().error).toBe('Invalid credentials');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('signUp', () => {
    it('should set loading state while signing up', async () => {
      (authService.createAccount as Mock).mockResolvedValueOnce({ email: 'new@test.com' });

      const signUpPromise = useAuthStore.getState().signUp('new@test.com', 'password');
      expect(useAuthStore.getState().isLoading).toBe(true);

      await signUpPromise;
    });

    it('should set error on sign up failure', async () => {
      (authService.createAccount as Mock).mockRejectedValueOnce(new Error('Email already in use'));

      await expect(
        useAuthStore.getState().signUp('existing@test.com', 'password')
      ).rejects.toThrow();

      expect(useAuthStore.getState().error).toBe('Email already in use');
    });
  });

  describe('signInGoogle', () => {
    it('should set loading state while signing in with Google', async () => {
      (authService.signInWithGoogle as Mock).mockResolvedValueOnce({ email: 'google@test.com' });

      const signInPromise = useAuthStore.getState().signInGoogle();
      expect(useAuthStore.getState().isLoading).toBe(true);

      await signInPromise;
    });
  });

  describe('signOut', () => {
    it('should set loading state while signing out', async () => {
      (authService.logOut as Mock).mockResolvedValueOnce(undefined);

      const signOutPromise = useAuthStore.getState().signOut();
      expect(useAuthStore.getState().isLoading).toBe(true);

      await signOutPromise;
    });
  });

  describe('clearError', () => {
    it('should clear the error', () => {
      useAuthStore.setState({ error: 'Some error' });
      expect(useAuthStore.getState().error).toBe('Some error');

      useAuthStore.getState().clearError();
      expect(useAuthStore.getState().error).toBeNull();
    });
  });
});
