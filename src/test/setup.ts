import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  WebviewWindow: vi.fn().mockImplementation((label, options) => ({
    label,
    options,
    once: vi.fn((event, callback) => {
      if (event === 'tauri://created') {
        setTimeout(() => callback(), 0);
      }
    }),
    close: vi.fn(),
    setFocus: vi.fn(),
    setPosition: vi.fn(),
    innerSize: vi.fn(() => Promise.resolve({ width: 400, height: 300 })),
  })),
}));

// Mock IndexedDB for YJS
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};
vi.stubGlobal('indexedDB', indexedDB);

// Mock crypto for UUID generation
vi.stubGlobal('crypto', {
  randomUUID: () => `test-${Math.random().toString(36).slice(2)}`,
});

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    VITE_ANTHROPIC_API_KEY: 'test-api-key',
    VITE_FIREBASE_API_KEY: '',
    VITE_FIREBASE_AUTH_DOMAIN: '',
    VITE_FIREBASE_PROJECT_ID: '',
  },
});
