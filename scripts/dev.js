#!/usr/bin/env node

import { createServer } from 'net';
import { spawn } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const portFile = join(__dirname, '..', '.dev-port');

// Find an available port starting from base
async function findAvailablePort(base = 1420, max = 1500) {
  for (let port = base; port <= max; port++) {
    const available = await checkPort(port);
    if (available) return port;
  }
  throw new Error(`No available port found between ${base} and ${max}`);
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  try {
    const port = await findAvailablePort();
    console.log(`Found available port: ${port}`);

    // Write port to file so Tauri can read it
    writeFileSync(portFile, String(port));

    // Set environment variable and start Vite
    const vite = spawn('npx', ['vite', '--port', String(port)], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, VITE_DEV_PORT: String(port) },
    });

    // Clean up on exit
    const cleanup = () => {
      if (existsSync(portFile)) {
        unlinkSync(portFile);
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', () => {
      cleanup();
      process.exit();
    });
    process.on('SIGTERM', () => {
      cleanup();
      process.exit();
    });

    vite.on('close', (code) => {
      cleanup();
      process.exit(code || 0);
    });
  } catch (error) {
    console.error('Failed to start dev server:', error.message);
    process.exit(1);
  }
}

main();
