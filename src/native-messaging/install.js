#!/usr/bin/env node

/**
 * Installer for Focus Bear Native Messaging Host
 * Sets up the native messaging manifest for Firefox
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function install() {
  console.log('🐻 Installing Focus Bear Native Messaging Host...\n');

  try {
    // 1. Install the native host script to /usr/local/bin
    const hostScriptPath = join(__dirname, 'host.js');
    const targetHostPath = '/usr/local/bin/focusbear-native-host';

    console.log(`📦 Installing native host script...`);
    console.log(`   From: ${hostScriptPath}`);
    console.log(`   To:   ${targetHostPath}`);

    // Make host script executable
    try {
      await fs.chmod(hostScriptPath, 0o755);
    } catch (error) {
      console.log(`   ℹ️  Could not chmod host script: ${error.message}`);
    }

    // Copy to /usr/local/bin (may require sudo)
    try {
      await fs.copyFile(hostScriptPath, targetHostPath);
      await fs.chmod(targetHostPath, 0o755);
      console.log(`   ✓ Installed to ${targetHostPath}`);
    } catch (error) {
      if (error.code === 'EACCES') {
        console.log(`   ⚠️  Permission denied. Trying with sudo...`);
        try {
          execSync(`sudo cp "${hostScriptPath}" "${targetHostPath}"`);
          execSync(`sudo chmod +x "${targetHostPath}"`);
          console.log(`   ✓ Installed to ${targetHostPath} (with sudo)`);
        } catch (sudoError) {
          console.error(`   ✗ Failed to install: ${sudoError.message}`);
          console.log(`   You can manually run: sudo cp "${hostScriptPath}" "${targetHostPath}"`);
        }
      } else {
        throw error;
      }
    }

    // 2. Install Firefox manifest
    const firefoxManifestDir = join(homedir(), '.mozilla', 'native-messaging-hosts');
    const manifestPath = join(__dirname, 'manifest.json');
    const targetManifestPath = join(firefoxManifestDir, 'com.focusbear.native_host.json');

    console.log(`\n🦊 Installing Firefox native messaging manifest...`);
    console.log(`   Target: ${targetManifestPath}`);

    // Create directory if it doesn't exist
    await fs.mkdir(firefoxManifestDir, { recursive: true });

    // Copy manifest
    await fs.copyFile(manifestPath, targetManifestPath);
    console.log(`   ✓ Manifest installed`);

    console.log(`\n✅ Installation complete!\n`);
    console.log(`Next steps:`);
    console.log(`  1. Open Firefox`);
    console.log(`  2. Go to about:debugging#/runtime/this-firefox`);
    console.log(`  3. Click "Load Temporary Add-on"`);
    console.log(`  4. Select: ${join(__dirname, '..', 'extension', 'manifest.json')}`);
    console.log(`  5. Click the extension icon to see the blocklist\n`);

  } catch (error) {
    console.error(`\n❌ Installation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

install();
