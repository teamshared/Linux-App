#!/usr/bin/env node

/**
 * Installer for Focus Bear Native Messaging Host
 * Sets up the native messaging manifest for Firefox
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function install() {
  console.log('🐻 Installing Focus Bear Native Messaging Host...\n');

  try {
    // 1. Install wrapper to ~/.local/bin — no sudo required
    const hostScriptPath = join(__dirname, 'host.js');
    const localBinDir = join(homedir(), '.local', 'bin');
    const targetHostPath = join(localBinDir, 'focusbear-native-host');

    console.log(`📦 Installing native host wrapper...`);
    console.log(`   To: ${targetHostPath}`);

    await fs.mkdir(localBinDir, { recursive: true });

    // Wrapper calls node on the actual host.js so it runs from its own directory
    // where package.json marks it as ESM — copying the file loses that context.
    const wrapperContent = `#!/bin/sh\nexec node "${hostScriptPath}" "$@"\n`;
    await fs.writeFile(targetHostPath, wrapperContent);
    await fs.chmod(targetHostPath, 0o755);
    console.log(`   ✓ Installed`);

    // 2. Install Firefox manifest pointing to the user-local wrapper
    const firefoxManifestDir = join(homedir(), '.mozilla', 'native-messaging-hosts');
    const targetManifestPath = join(firefoxManifestDir, 'com.focusbear.host.json');

    console.log(`\n🦊 Installing Firefox native messaging manifest...`);
    console.log(`   Target: ${targetManifestPath}`);

    await fs.mkdir(firefoxManifestDir, { recursive: true });

    // Generate manifest with the actual wrapper path (varies per user / dev vs packaged)
    const manifest = {
      name: 'com.focusbear.host',
      description: 'Focus Bear Native Messaging Host',
      path: targetHostPath,
      type: 'stdio',
      allowed_extensions: ['focusbear@focusbear.io']
    };
    await fs.writeFile(targetManifestPath, JSON.stringify(manifest, null, 2));
    console.log(`   ✓ Manifest installed`);

    for (const stale of ['com.focusbear.native_host.json', 'com.focusbear.native.json']) {
      await fs.rm(join(firefoxManifestDir, stale), { force: true });
    }

    if (registeredCount === 0) {
      console.log(`   ℹ️  No Firefox profiles found.`);
      console.log(`   Load manually: Firefox → about:debugging → Load Temporary Add-on`);
    } else {
      console.log(`   ℹ️  Restart Firefox to apply. If prompted to enable the extension, click Allow.`);
    }

    console.log(`✅ Installation complete!\n`);
    console.log(`Native host:     ${targetHostPath}`);
    console.log(`Firefox manifest: ${targetManifestPath}\n`);

  } catch (error) {
    console.error(`\n❌ Installation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

install();
