import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { existsSync, readFileSync } from "fs";

const host = process.env.TAURI_DEV_HOST;

// Read port from file if it exists (set by dev script)
function getPort(): number {
  const portFile = path.resolve(__dirname, ".dev-port");
  if (existsSync(portFile)) {
    return parseInt(readFileSync(portFile, "utf-8").trim(), 10);
  }
  return 1450; // Unique port for Koe to avoid cache conflicts
}

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: getPort(),
    strictPort: false, // Allow fallback to other ports
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: getPort() + 1 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-yjs': ['yjs', 'y-indexeddb'],
          'vendor-tauri': ['@tauri-apps/api'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
}));
