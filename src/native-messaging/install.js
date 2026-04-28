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
    const targetManifestPath = join(firefoxManifestDir, 'com.focusbear.native_host.json');

    console.log(`\n🦊 Installing Firefox native messaging manifest...`);
    console.log(`   Target: ${targetManifestPath}`);

    await fs.mkdir(firefoxManifestDir, { recursive: true });

    // Generate manifest with the actual wrapper path (varies per user / dev vs packaged)
    const manifest = {
      name: 'com.focusbear.native_host',
      description: 'Focus Bear Native Messaging Host',
      path: targetHostPath,
      type: 'stdio',
      allowed_extensions: ['focusbear@focusbear.io']
    };
    await fs.writeFile(targetManifestPath, JSON.stringify(manifest, null, 2));
    console.log(`   ✓ Manifest installed`);

    // 3. Register extension with all Firefox profiles via proxy file
    // Firefox reads <profile>/extensions/<extension-id> — its content is the path to the
    // unpacked extension directory, which tells Firefox where to sideload it from.
    const extensionId = 'focusbear@focusbear.io';
    const extensionDir = join(__dirname, '..', 'extension');

    // Support both standard Firefox and Snap Firefox profile locations
    const firefoxBaseDirs = [
      join(homedir(), '.mozilla', 'firefox'),
      join(homedir(), 'snap', 'firefox', 'common', '.mozilla', 'firefox'),
    ];

    console.log(`\n🧩 Registering Firefox extension...`);
    console.log(`   Extension path: ${extensionDir}`);

    let registeredCount = 0;
    for (const baseDir of firefoxBaseDirs) {
      const iniContent = await fs.readFile(join(baseDir, 'profiles.ini'), 'utf8').catch(() => null);
      if (!iniContent) continue;

      // Parse profiles.ini — collect one absolute path per [Profile*] section
      const profileDirs = [];
      let profilePath = null, isRelative = '0';
      for (const line of iniContent.split('\n')) {
        const t = line.trim();
        if (t.startsWith('[') && !t.startsWith('[General') && !t.startsWith('[Install')) {
          if (profilePath) {
            profileDirs.push(isRelative === '1' ? join(baseDir, profilePath) : profilePath);
            profilePath = null; isRelative = '0';
          }
        } else if (t.startsWith('Path=')) {
          profilePath = t.slice(5);
        } else if (t.startsWith('IsRelative=')) {
          isRelative = t.slice(11);
        }
      }
      if (profilePath) profileDirs.push(isRelative === '1' ? join(baseDir, profilePath) : profilePath);

      for (const profileDir of profileDirs) {
        const proxyFile = join(profileDir, 'extensions', extensionId);
        await fs.mkdir(dirname(proxyFile), { recursive: true }).catch(() => {});
        await fs.writeFile(proxyFile, extensionDir).catch(() => {});
        console.log(`   ✓ Registered in: ${profileDir}`);
        registeredCount++;
      }
    }

    if (registeredCount === 0) {
      console.log(`   ℹ️  No Firefox profiles found.`);
      console.log(`   Load manually: Firefox → about:debugging → Load Temporary Add-on`);
      console.log(`   Select: ${join(extensionDir, 'manifest.json')}`);
    } else {
      console.log(`   ℹ️  Restart Firefox to apply. If prompted to enable the extension, click Allow.`);
    }

    console.log(`✅ Installation complete!\n`);
    console.log(`Extension files: ${extensionDir}`);
    console.log(`Native host:     ${targetHostPath}`);
    console.log(`Firefox manifest: ${targetManifestPath}\n`);

  } catch (error) {
    console.error(`\n❌ Installation failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

install();
