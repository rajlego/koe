#!/usr/bin/env node

/**
 * Release script for Koe
 *
 * Usage:
 *   node scripts/release.js patch   # 0.1.0 -> 0.1.1
 *   node scripts/release.js minor   # 0.1.0 -> 0.2.0
 *   node scripts/release.js major   # 0.1.0 -> 1.0.0
 *   node scripts/release.js 0.2.0   # Set specific version
 *
 * This script:
 * 1. Updates version in package.json
 * 2. Updates version in src-tauri/tauri.conf.json
 * 3. Creates a git commit
 * 4. Creates a git tag
 * 5. Pushes to origin (triggers release workflow)
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function bumpVersion(current, type) {
  const [major, minor, patch] = current.split('.').map(Number);

  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      // Assume it's a specific version
      if (/^\d+\.\d+\.\d+$/.test(type)) {
        return type;
      }
      throw new Error(`Invalid version type: ${type}`);
  }
}

function exec(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

async function main() {
  const versionArg = process.argv[2];

  if (!versionArg) {
    console.log('Usage: node scripts/release.js <patch|minor|major|x.y.z>');
    process.exit(1);
  }

  // Read current versions
  const packagePath = join(rootDir, 'package.json');
  const tauriConfigPath = join(rootDir, 'src-tauri', 'tauri.conf.json');

  const packageJson = readJSON(packagePath);
  const tauriConfig = readJSON(tauriConfigPath);

  const currentVersion = packageJson.version;
  const newVersion = bumpVersion(currentVersion, versionArg);

  console.log(`\nBumping version: ${currentVersion} -> ${newVersion}\n`);

  // Update package.json
  packageJson.version = newVersion;
  writeJSON(packagePath, packageJson);
  console.log(`Updated package.json`);

  // Update tauri.conf.json
  tauriConfig.version = newVersion;
  writeJSON(tauriConfigPath, tauriConfig);
  console.log(`Updated tauri.conf.json`);

  // Git operations
  console.log(`\nCommitting and tagging...\n`);

  exec('git add package.json src-tauri/tauri.conf.json');
  exec(`git commit -m "chore: bump version to ${newVersion}"`);
  exec(`git tag -a v${newVersion} -m "Release v${newVersion}"`);

  console.log(`\nReady to push! Run:\n`);
  console.log(`  git push origin main --tags\n`);
  console.log(`This will trigger the release workflow to build and publish.\n`);

  // Ask if user wants to push now
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Push now? (y/n) ', (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'y') {
      exec('git push origin main --tags');
      console.log(`\nDone! Check GitHub Actions for build progress.`);
    } else {
      console.log(`\nSkipped push. Run 'git push origin main --tags' when ready.`);
    }
  });
}

main().catch(console.error);
