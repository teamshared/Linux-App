#!/usr/bin/env node
/*
 * FocusBear Hosts Blocker (Node.js)
 * ---------------------------------
 * Blocks specified domains/subdomains by inserting entries into /etc/hosts
 * between identifiable markers. Restores cleanly on demand or after a timer.
 *
 * Usage (run with sudo/root):
 *   sudo node focusbear-hosts-blocker.js block --list /path/to/blocklist.txt --time 45m
 *   sudo node focusbear-hosts-blocker.js unblock
 *   sudo node focusbear-hosts-blocker.js status
 *   sudo node focusbear-hosts-blocker.js block --list list.txt --dry-run
 *
 * Blocklist format: one hostname per line (no schema), lines starting with # are ignored.
 * Example lines:  youtube.com\nwww.youtube.com\nnews.example.com
 *
 * Notes:
 * - Writes markers `# focusbear-start` and `# focusbear-end` to allow safe removal.
 * - Uses atomic write (write temp file in /etc then rename) to avoid corruption.
 * - Adds both IPv4 (0.0.0.0) and IPv6 (::) entries for completeness.
 * - Handles SIGINT/SIGTERM to auto-restore if a timed session is active.
 */

// Core Node.js modules for file system and path operations
const fs = require('fs');
const path = require('path');

// Constants for maintainability and easy configuration.
const HOSTS_PATH = '/etc/hosts';  // Standard hosts file location
const MARKER_START = '# focusbear-start'; // Start marker for our block
const MARKER_END = '# focusbear-end'; // End marker for our block
const BACKUP_PATH = '/etc/hosts.focusbear.bak'; // Backup file location

// /**
//  * Automatically expand domains to include common variations
//  * @param {Array} hosts - Original host list
//  * @returns {Array} Expanded host list
//  */
function expandDomains(hosts) {
  const expanded = new Set();
  
  for (const host of hosts) {
    // Add the original host
    expanded.add(host);
    
    // Skip IP addresses
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) continue;
    
    // Add www. version if not present
    if (!host.startsWith('www.')) {
      expanded.add(`www.${host}`);
    }
    
    // Add bare domain (remove www. if present)
    const bareDomain = host.replace(/^www\./, '');
    if (bareDomain !== host) {
      expanded.add(bareDomain);
    }
  }
  
  return Array.from(expanded);
}

/**
 * Verify script is running with root privileges
 * Required for modifying /etc/hosts
 */
function assertRoot() {
  if (process.getuid && process.getuid() !== 0) {
    console.error('[ERROR] This command must be run as root (use sudo).');
    process.exit(1);
  }
}

// /**
//  * Safely read the hosts file with error handling
//  * @returns {string} Contents of the hosts file
//  */
function readHosts() {
  try { return fs.readFileSync(HOSTS_PATH, 'utf8'); } 
  catch (e) {
    console.error(`[ERROR] Failed to read ${HOSTS_PATH}:`, e.message);
    process.exit(1);
  }
}

// /**
//  * Atomic write operation to prevent hosts file corruption
//  * Writes to temp file first, then renames to target
//  * @param {string} content - New content for hosts file
//  */
function writeHostsAtomic(content) {
  const dir = path.dirname(HOSTS_PATH);
  const tmp = path.join(dir, `.hosts.focusbear.tmp-${Date.now()}`);
  try {
    fs.writeFileSync(tmp, content, { mode: 0o644 });  // Write with correct permissions
    fs.renameSync(tmp, HOSTS_PATH); // Atomic operation on same filesystem
  } catch (e) {
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
    console.error('[ERROR] Failed to write hosts atomically:', e.message);
    process.exit(1);
  }
}

// /**
//  * Create backup of original hosts file if none exists
//  * @param {string} original - Current content of hosts file
//  */
function ensureBackupOnce(original) {
  try {
    if (!fs.existsSync(BACKUP_PATH)) {
      fs.writeFileSync(BACKUP_PATH, original, { mode: 0o644 });
      console.log(`[INFO] Backup created at ${BACKUP_PATH}`);
    }
  } catch (e) {
    console.warn('[WARN] Could not create backup:', e.message);
  }
}

// /**
//  * Remove existing FocusBear block from hosts file content
//  * @param {string} text - Current hosts file content
//  * @returns {object} {changed: boolean, text: string} - Whether changes were made and new content
//  */
function removeFocusBearBlock(text) {
  const startIdx = text.indexOf(MARKER_START);
  const endIdx = text.indexOf(MARKER_END);
  // If markers not found or malformed, return original
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return { changed: false, text };
  // Extract content before and after our block
  const before = text.slice(0, startIdx);
  const after = text.slice(endIdx + MARKER_END.length);
  // Rebuild content with proper newline handling
  let combined = before.trimEnd();
  if (combined && !combined.endsWith('\n')) combined += '\n';
  combined += after.replace(/^\n?/, '');
  return { changed: true, text: combined };
}

// /**
//  * Sanitize and validate a hostname from the blocklist
//  * @param {string} line - Raw line from blocklist file
//  * @returns {string|null} Validated hostname or null if invalid
//  */
function sanitizeHost(line) {
  const trimmed = line.trim().toLowerCase();
  // Skip empty lines and comments
  if (!trimmed || trimmed.startsWith('#')) return null;
  // Skip full URLs (should only contain hostnames)
  if (trimmed.includes('://')) return null; // ignore URLs
  // Basic hostname validation (no spaces, contains a dot or is localhost-like)
  if (/\s/.test(trimmed)) return null;
  return trimmed;
}

// /**
//  * Load and parse blocklist file
//  * @param {string} filePath - Path to blocklist file
//  * @returns {Array} Array of validated hostnames to block
//  */
function loadBlocklist(filePath) {
  let raw;
  try { raw = fs.readFileSync(filePath, 'utf8'); }
  catch (e) {
    console.error('[ERROR] Could not read blocklist:', e.message);
    process.exit(1);
  }

  // Parse and sanitize first
  const initialList = [];
  for (const line of raw.split(/\r?\n/)) {
    const h = sanitizeHost(line);
    if (h) initialList.push(h);
  }

  // Then expand the domains
  return expandDomains(initialList);
}

// /**
//  * Generate hosts file entries for the given hostnames
//  * Creates both IPv4 and IPv6 blocking entries
//  * @param {Array} hosts - Array of hostnames to block
//  * @returns {string} Formatted entries for hosts file
//  */
function buildEntries(hosts) {
  const lines = [];
  for (const h of hosts) {
    lines.push(`127.0.0.1 ${h}`); // IPv4 blocking
    lines.push(`:: ${h}`);  // IPv6 blocking
  }
  return lines.join('\n');
}

// /**
//  * Inject blocking entries into hosts file content
//  * @param {string} original - Current hosts file content
//  * @param {string} entryText - Formatted blocking entries
//  * @returns {string} New hosts file content with block inserted
//  */
function injectBlock(original, entryText) {
  // First remove any existing block
  const removed = removeFocusBearBlock(original).text;
  const ts = new Date().toISOString();
  let content = removed.trimEnd();
  
  // Ensure proper newline at end of existing content
  if (content && !content.endsWith('\n')) content += '\n';
  
  // Build our block with markers and timestamp
  const block = [
    MARKER_START + ` ${ts}`,
    '# FocusBear hosts blocking (do not edit between markers)',
    '# Blocked domains include www variants',
    entryText,
    MARKER_END
  ].join('\n');
  
  return content + block + '\n';
}

// /**
//  * Parse duration string into milliseconds
//  * Supports formats like 30s, 15m, 2h, 1d
//  * @param {string} str - Duration string
//  * @returns {number|null} Duration in ms or null if invalid
//  */
function parseDuration(str) {
  if (!str) return null;
  const m = str.match(/^(\d+)([smhd])$/i);
  if (!m) {
    console.error('[ERROR] Invalid duration. Use forms like 30s, 15m, 2h, 1d');
    process.exit(1);
  }
  const n = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  // Convert to milliseconds
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return n * mult;
}

/**
 * Display usage instructions
 */
function usage() {
  console.log(`\nFocusBear Hosts Blocker\n------------------------\nCommands:\n  block   --list <file> [--time <dur>] [--dry-run]\n  unblock\n  status\n\nExamples:\n  sudo node focusbear-hosts-blocker.js block --list list.txt --time 1h\n  sudo node focusbear-hosts-blocker.js unblock\n  sudo node focusbear-hosts-blocker.js status\n`);
}

// /**
//  * Parse command line arguments
//  * @param {Array} argv - process.argv array
//  * @returns {object} Parsed arguments
//  */
function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (key === 'dry-run') { args['dry-run'] = true; continue; }
      if (!next || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    } else {
      args._.push(a);
    }
  }
  return args;
}

/**
 * Check and display current blocking status
 */
async function cmdStatus() {
  const text = readHosts();
  const has = text.includes(MARKER_START) && text.includes(MARKER_END);
  console.log(has ? '[STATUS] Block is ACTIVE.' : '[STATUS] No active block.');
}

/**
 * Remove FocusBear block from hosts file
 */
async function cmdUnblock() {
  assertRoot();
  const original = readHosts();
  const { changed, text } = removeFocusBearBlock(original);
  
  if (!changed) {
    console.log('[INFO] Nothing to remove. No active block.');
    return;
  }

  writeHostsAtomic(text);
  
  console.log('[OK] Hosts file restored (block removed).');
}

// /**
//  * Add new block to hosts file
//  * @param {object} args - Command line arguments
//  */
async function cmdBlock(args) {
  assertRoot();
  const listPath = args.list;
  if (!listPath) { console.error('[ERROR] --list <file> is required.'); usage(); process.exit(1); }
  const hostsToBlock = loadBlocklist(listPath);
  if (!hostsToBlock.length) { console.error('[ERROR] Blocklist is empty after parsing.'); process.exit(1); }

  const original = readHosts();
  ensureBackupOnce(original);
  const entries = buildEntries(hostsToBlock);
  const newContent = injectBlock(original, entries);

  // Dry-run mode shows what would be changed without actually writing
  if (args['dry-run']) {
    console.log('----- DRY RUN: Proposed additions between markers -----');
    console.log(entries);
    console.log('-------------------------------------------------------');
    return;
  }

  writeHostsAtomic(newContent);
  console.log(`[OK] Inserted ${hostsToBlock.length} hostnames into ${HOSTS_PATH}.`);

   // Handle timed blocking session if duration specified
  const durationMs = parseDuration(args.time);
  if (durationMs) {
    console.log(`[INFO] Active for ${args.time}. Will auto-unblock when timer ends.`);
    // Set up timer for auto-unblock
    const timer = setTimeout(async () => {
      try { await cmdUnblock(); } finally { process.exit(0); }
    }, durationMs);
    // Cleanup handler for signals
    const cleanup = async () => {
      clearTimeout(timer);
      await cmdUnblock();
      process.exit(0);
    };
    // Handle interrupt signals gracefully
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    // Keep process alive until timer completes
    await new Promise(() => {});
  }
}

// Main execution
(async function main() {
  const args = parseArgs(process.argv);
  const cmd = args._[0];

  // Validate command
  if (!cmd || !['block','unblock','status'].includes(cmd)) {
    usage();
    process.exit(cmd ? 1 : 0);
  }
  try {
    if (cmd === 'status') await cmdStatus();
    else if (cmd === 'unblock') await cmdUnblock();
    else if (cmd === 'block') await cmdBlock(args);
  } catch (e) {
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
})();