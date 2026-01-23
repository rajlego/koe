import { invoke } from '@tauri-apps/api/core';

/**
 * Logger that forwards to Rust stdout (visible in terminal)
 * Use this instead of console.log when debugging Tauri issues
 */
export const logger = {
  log: (message: string, ...args: unknown[]) => {
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.log(message, ...args); // Also log to browser console
    invoke('frontend_log', { level: 'log', message: msg }).catch(() => {});
  },

  info: (message: string, ...args: unknown[]) => {
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.info(message, ...args);
    invoke('frontend_log', { level: 'info', message: msg }).catch(() => {});
  },

  warn: (message: string, ...args: unknown[]) => {
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.warn(message, ...args);
    invoke('frontend_log', { level: 'warn', message: msg }).catch(() => {});
  },

  error: (message: string, ...args: unknown[]) => {
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.error(message, ...args);
    invoke('frontend_log', { level: 'error', message: msg }).catch(() => {});
  },

  debug: (message: string, ...args: unknown[]) => {
    const msg = args.length ? `${message} ${JSON.stringify(args)}` : message;
    console.debug(message, ...args);
    invoke('frontend_log', { level: 'debug', message: msg }).catch(() => {});
  },
};
