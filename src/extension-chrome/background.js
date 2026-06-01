/**
 * Chrome MV3 service worker - native messaging + declarativeNetRequest blocking
 */

let port = null;
let blocklist = [];
let whitelist = []; // { pattern, type: 'domain'|'exact', expiresAt }
let isConnected = false;
let isConnectedToApp = false;

const WHITELIST_DURATION_MS = 30 * 60 * 1000;
const NATIVE_HOST = 'com.focusbear.native_host';

// Detect which Chromium-based browser we're in so Electron knows which process to kill.
// UA strings are useless here — Chromium's UA is identical to Chrome's.
// userAgentData.brands is the reliable signal: Chrome has "Google Chrome", Chromium does not.
const BROWSER_ID = (() => {
  if (typeof navigator.brave !== 'undefined') return 'brave';
  if (/OPR\/|Opera/.test(navigator.userAgent)) return 'opera';
  const brands = navigator.userAgentData?.brands?.map(b => b.brand) ?? [];
  if (brands.includes('Google Chrome')) return 'chrome';
  if (brands.includes('Chromium')) return 'chromium';
  return 'chrome';
})();

function log(message) {
  console.log('[Focus Bear Extension]', message);
}

function escapeRegex(str) {
  return str.replace(/[.+*?^${}()|[\]\\]/g, '\\$&');
}

function stripProtocol(u) {
  return u.replace(/^https?:\/\//, '');
}

// ── DNR ──────────────────────────────────────────────────────────────────────

async function updateDNRRules() {
  const blockedPageBase = chrome.runtime.getURL('blocked.html');
  const rules = [];
  let id = 1;

  // Allow rules for whitelist (priority 2 beats block rules at priority 1)
  const activeWhitelist = whitelist.filter(e => e.expiresAt > Date.now());
  for (const entry of activeWhitelist) {
    let regexFilter;
    if (entry.type === 'domain') {
      regexFilter = `^https?://(.*\\.)?${escapeRegex(entry.pattern)}(/.*)?$`;
    } else {
      regexFilter = `^${escapeRegex(stripProtocol(entry.pattern))}$`;
    }
    rules.push({
      id: id++,
      priority: 2,
      action: { type: 'allow' },
      condition: { regexFilter, resourceTypes: ['main_frame', 'sub_frame'] }
    });
  }

  // Redirect rules for blocklist (priority 1)
  // All rules use regexFilter so \0 in regexSubstitution = full matched URL
  const MAX_RULES = 1000 - activeWhitelist.length;
  for (const pattern of blocklist.slice(0, MAX_RULES)) {
    const isRegex = pattern.includes('.*') || pattern.includes('\\');
    const core = isRegex ? pattern : escapeRegex(pattern);
    const reason = isRegex ? 'regex' : 'domain';
    rules.push({
      id: id++,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: {
          // URL goes into hash — avoids query-string encoding issues with & in URLs
          regexSubstitution: `${blockedPageBase}#\\0`
        }
      },
      condition: {
        regexFilter: `.*${core}.*`,
        resourceTypes: ['main_frame']
      }
    });
    void reason; // value tracked by blocklist lookup in blocked.js
  }

  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(r => r.id),
      addRules: rules
    });
    log(`DNR updated: ${rules.length} rules (${activeWhitelist.length} allow, ${rules.length - activeWhitelist.length} block)`);
  } catch (err) {
    log('DNR update failed: ' + err.message);
  }
}

// ── Whitelist ─────────────────────────────────────────────────────────────────

function pruneWhitelist() {
  const before = whitelist.length;
  whitelist = whitelist.filter(e => e.expiresAt > Date.now());
  if (whitelist.length !== before) {
    chrome.storage.local.set({ whitelist });
  }
  return whitelist;
}

function isWhitelistedUrl(url) {
  const active = whitelist.filter(e => e.expiresAt > Date.now());
  for (const entry of active) {
    try {
      if (entry.type === 'exact' && url.replace(/^https?:\/\//, '') === entry.pattern.replace(/^https?:\/\//, '')) return true;
      if (entry.type === 'domain') {
        const hostname = new URL(url).hostname;
        if (hostname === entry.pattern || hostname.endsWith('.' + entry.pattern)) return true;
      }
    } catch {}
  }
  return false;
}

async function maybeBlockTab(tabId, url) {
  if (!url || !url.startsWith('http')) return;
  if (isWhitelistedUrl(url) || !isBlockedByList(url)) return;
  await chrome.tabs.update(tabId, { url: chrome.runtime.getURL('blocked.html') + '#' + url }).catch(() => {});
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.url) await maybeBlockTab(tabId, tab.url);
  } catch {}
});

function notifyWhitelistUpdate() {
  if (port && isConnected) {
    try {
      port.postMessage({ type: 'WHITELIST_UPDATE', data: whitelist });
    } catch (e) {
      log('Failed to notify host of whitelist update: ' + e.message);
    }
  }
}

// ── Native messaging ──────────────────────────────────────────────────────────

function connectToNativeHost() {
  log('Connecting to native host...');
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST);

    port.onMessage.addListener((message) => {
      log('Received: ' + message.type);
      switch (message.type) {
        case 'BLOCKLIST_RESPONSE':
        case 'BLOCKLIST_UPDATE':
          blocklist = message.data || [];
          chrome.storage.local.set({ blocklist, lastUpdate: message.timestamp });
          updateDNRRules();
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.url) maybeBlockTab(tabs[0].id, tabs[0].url).catch(() => {});
          });
          break;

        case 'WHITELIST_RESPONSE':
        case 'WHITELIST_UPDATE':
          whitelist = (message.data || []).filter(e => e.expiresAt > Date.now());
          chrome.storage.local.set({ whitelist });
          updateDNRRules();
          break;

        case 'PONG':
          isConnected = true;
          isConnectedToApp = message.connectedToApp || false;
          log('Pong received, app connected: ' + isConnectedToApp);
          port.postMessage({ type: 'GET_WHITELIST' });
          break;

        case 'ERROR':
          log('Error from host: ' + message.error);
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      isConnected = false;
      isConnectedToApp = false;
      port = null;
      if (chrome.runtime.lastError) {
        log('Disconnect error: ' + chrome.runtime.lastError.message);
      }
      setTimeout(connectToNativeHost, 5000);
    });

    port.postMessage({ type: 'PING', browser: BROWSER_ID });
    setTimeout(() => port?.postMessage({ type: 'GET_BLOCKLIST' }), 100);

  } catch (err) {
    log('Connect failed: ' + err.message);
    isConnected = false;
    setTimeout(connectToNativeHost, 5000);
  }
}

// ── Offscreen keepalive ───────────────────────────────────────────────────────

async function ensureOffscreenDocument() {
  try {
    if (await chrome.offscreen.hasDocument?.()) return;
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Keepalive pings to keep service worker alive for native messaging'
    });
  } catch (err) {
    // Throws if document already exists in older Chrome without hasDocument()
    if (!err.message?.includes('Only a single offscreen')) log('Offscreen error: ' + err.message);
  }
}

// ── Startup ───────────────────────────────────────────────────────────────────

async function restoreState() {
  const result = await chrome.storage.local.get(['blocklist', 'whitelist']);
  blocklist = result.blocklist || [];
  whitelist = (result.whitelist || []).filter(e => e.expiresAt > Date.now());
  await updateDNRRules();
}

chrome.runtime.onInstalled.addListener(async () => {
  await restoreState();
  connectToNativeHost();
  ensureOffscreenDocument();
  chrome.alarms.create('pruneWhitelist', { periodInMinutes: 1 });
  chrome.alarms.create('ping', { periodInMinutes: 1 });
});

chrome.runtime.onStartup.addListener(async () => {
  await restoreState();
  connectToNativeHost();
  ensureOffscreenDocument();
});

// SW wakes cold on every message/alarm — restore state and reconnect each time.
// onInstalled/onStartup only fire once; this covers all subsequent wakes.
restoreState().then(() => {
  if (!port) connectToNativeHost();
  ensureOffscreenDocument();
  // Ensure ping alarm survives SW restarts (alarms persist but recreating is idempotent)
  chrome.alarms.get('ping', alarm => { if (!alarm) chrome.alarms.create('ping', { periodInMinutes: 1 }); });
});

// Re-connect on wake if port is gone
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pruneWhitelist') {
    const before = whitelist.length;
    pruneWhitelist();
    if (whitelist.length !== before) {
      notifyWhitelistUpdate();
      await updateDNRRules();

      // Reload any open tabs that matched expired whitelist entries
      const expired = whitelist.filter(e => e.expiresAt <= Date.now()); // already pruned, so check storage delta
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (!tab.url) continue;
        const shouldReload = whitelist.length < before && isBlockedByList(tab.url);
        if (shouldReload) chrome.tabs.reload(tab.id).catch(() => {});
      }
    }
  }

  if (alarm.name === 'ping') {
    if (!port || !isConnected) connectToNativeHost();
    else port.postMessage({ type: 'PING', browser: BROWSER_ID });
  }
});

function isBlockedByList(url) {
  return blocklist.some(pattern => {
    if (url.includes(pattern)) return true;
    try {
      const hostname = new URL(url).hostname;
      return hostname === pattern || hostname.endsWith('.' + pattern);
    } catch { return false; }
  });
}

// ── Message handler (popup / blocked page) ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({ connected: isConnected, connectedToApp: isConnectedToApp, blocklistSize: blocklist.length, whitelistSize: pruneWhitelist().length });

  } else if (message.type === 'REFRESH_BLOCKLIST') {
    if (port && isConnected) {
      port.postMessage({ type: 'GET_BLOCKLIST' });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not connected' });
    }

  } else if (message.type === 'GET_WHITELIST') {
    sendResponse({ whitelist: pruneWhitelist() });

  } else if (message.type === 'ADD_WHITELIST') {
    const durationMs = message.durationMs || WHITELIST_DURATION_MS;
    const entry = { pattern: message.pattern, type: message.patternType, expiresAt: Date.now() + durationMs };
    whitelist = pruneWhitelist().filter(e => e.pattern !== message.pattern);
    whitelist.push(entry);
    chrome.storage.local.set({ whitelist });
    notifyWhitelistUpdate();
    updateDNRRules();
    sendResponse({ success: true });

  } else if (message.type === 'KEEPALIVE') {
    if (port && isConnected) port.postMessage({ type: 'PING', browser: BROWSER_ID });
    sendResponse({ alive: true });

  } else if (message.type === 'REMOVE_WHITELIST') {
    whitelist = pruneWhitelist().filter(e => e.pattern !== message.pattern);
    chrome.storage.local.set({ whitelist });
    notifyWhitelistUpdate();
    updateDNRRules();
    sendResponse({ success: true });
  }

  return true;
});

log('Service worker loaded');
