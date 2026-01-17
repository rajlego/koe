import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { isFirebaseConfigured } from '../../sync/firebaseConfig';
import './AuthSection.css';

export default function AuthSection() {
  const { user, isLoading, error, signIn, signUp, signInGoogle, signOut, clearError } =
    useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  if (!isFirebaseConfigured()) {
    return (
      <div className="auth-section auth-disabled">
        <h3>Cloud Sync</h3>
        <p className="auth-note">
          Firebase not configured. Add Firebase credentials to .env to enable cloud sync.
        </p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      if (isSignUp) {
        await signUp(email, password);
      } else {
        await signIn(email, password);
      }
      setEmail('');
      setPassword('');
    } catch {
      // Error is handled in the store
    }
  };

  const handleGoogleSignIn = async () => {
    clearError();
    try {
      await signInGoogle();
    } catch {
      // Error is handled in the store
    }
  };

  const handleSignOut = async () => {
    clearError();
    try {
      await signOut();
    } catch {
      // Error is handled in the store
    }
  };

  if (user) {
    return (
      <div className="auth-section auth-signed-in">
        <h3>Cloud Sync</h3>
        <div className="user-info">
          <span className="user-email">{user.email}</span>
          <span className="sync-status">Syncing enabled</span>
        </div>
        <button
          className="sign-out-btn"
          onClick={handleSignOut}
          disabled={isLoading}
        >
          {isLoading ? 'Signing out...' : 'Sign Out'}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-section">
      <h3>Cloud Sync</h3>
      <p className="auth-note">
        Sign in to sync your thoughts across devices.
      </p>

      {error && (
        <div className="auth-error" onClick={clearError}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          required
          minLength={6}
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        className="google-btn"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <p className="auth-toggle">
        {isSignUp ? (
          <>
            Already have an account?{' '}
            <button onClick={() => setIsSignUp(false)}>Sign In</button>
          </>
        ) : (
          <>
            Don't have an account?{' '}
            <button onClick={() => setIsSignUp(true)}>Create Account</button>
          </>
        )}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.44 15.983 5.485 18 9.003 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0 5.485 0 2.44 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z"
        fill="#EA4335"
      />
    </svg>
  );
}
