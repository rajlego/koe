#!/usr/bin/env node

import { createServer } from 'net';
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const portFile = join(rootDir, '.dev-port');
const tauriConfigPath = join(rootDir, 'src-tauri', 'tauri.conf.json');
const tauriConfigBackup = join(rootDir, 'src-tauri', 'tauri.conf.json.bak');

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
  let originalConfig = null;

  try {
    const port = await findAvailablePort();
    console.log(`\n🎤 Koe: Using port ${port}\n`);

    // Write port to file for Vite to read
    writeFileSync(portFile, String(port));

    // Backup and update tauri.conf.json with the dynamic port
    originalConfig = readFileSync(tauriConfigPath, 'utf-8');
    writeFileSync(tauriConfigBackup, originalConfig);

    const config = JSON.parse(originalConfig);
    config.build.devUrl = `http://localhost:${port}`;
    writeFileSync(tauriConfigPath, JSON.stringify(config, null, 2));

    // Run tauri dev
    const tauri = spawn('npx', ['tauri', 'dev'], {
      stdio: 'inherit',
      shell: true,
      cwd: rootDir,
    });

    // Clean up on exit
    const cleanup = () => {
      if (existsSync(portFile)) {
        try { unlinkSync(portFile); } catch {}
      }
      if (originalConfig) {
        try { writeFileSync(tauriConfigPath, originalConfig); } catch {}
      }
      if (existsSync(tauriConfigBackup)) {
        try { unlinkSync(tauriConfigBackup); } catch {}
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

    tauri.on('close', (code) => {
      cleanup();
      process.exit(code || 0);
    });

  } catch (error) {
    console.error('Failed to start dev server:', error.message);
    // Restore config if we modified it
    if (originalConfig) {
      writeFileSync(tauriConfigPath, originalConfig);
    }
    process.exit(1);
  }
}

main();
