/**
 * Background script - handles native messaging connection
 */

let port = null;
let blocklist = [];
let whitelist = []; // { pattern, type: 'domain'|'exact', expiresAt }
let isConnected = false;
let isConnectedToApp = false;

const WHITELIST_DURATION_MS = 30 * 60 * 1000;

// Agreed-upon browser identifier sent in every PING so Electron knows which browser this is.
// Add a new string here when adding support for a new browser.
const BROWSER_ID = (() => {
  if (typeof browser !== 'undefined' && browser.runtime?.getBrowserInfo) return 'firefox';
  if (navigator.userAgent.includes('Chrome')) return 'chrome';
  return 'unknown';
})();

// Load persisted state on startup
browser.storage.local.get(['whitelist', 'blocklist']).then(result => {
  whitelist = (result.whitelist || []).filter(e => e.expiresAt > Date.now());
  browser.storage.local.set({ whitelist });
  blocklist = result.blocklist || [];
});

function pruneWhitelist() {
  const before = whitelist.length;
  whitelist = whitelist.filter(e => e.expiresAt > Date.now());
  if (whitelist.length !== before) {
    browser.storage.local.set({ whitelist });
  }
  return whitelist;
}

const stripProtocol = u => u.replace(/^https?:\/\//, '');

function isWhitelisted(url) {
  pruneWhitelist();
  for (const entry of whitelist) {
    if (entry.type === 'exact' && stripProtocol(url) === stripProtocol(entry.pattern)) return true;
    if (entry.type === 'domain') {
      try {
        const hostname = new URL(url).hostname;
        if (hostname === entry.pattern || hostname.endsWith('.' + entry.pattern)) return true;
      } catch (e) { /* invalid url */ }
    }
  }
  return false;
}

function notifyWhitelistUpdate() {
  if (port && isConnected) {
    try {
      port.postMessage({ type: 'WHITELIST_UPDATE', data: whitelist });
    } catch (e) {
      log('Failed to notify host of whitelist update: ' + e.message);
    }
  }
}

function log(message) {
  console.log('[Focus Bear Extension]', message);
}

function connectToNativeHost() {
  log('Attempting to connect to native host...');
  
  try {
    port = browser.runtime.connectNative('com.focusbear.native_host');
    
    port.onMessage.addListener((message) => {
      log('Received message from native host:', message);
      
      switch (message.type) {
        case 'BLOCKLIST_RESPONSE':
        case 'BLOCKLIST_UPDATE':
          blocklist = message.data || [];
          log(`Updated blocklist: ${blocklist.length} entries`);
          browser.storage.local.set({
            blocklist: blocklist,
            lastUpdate: message.timestamp
          });
          break;

        case 'WHITELIST_RESPONSE':
        case 'WHITELIST_UPDATE':
          // Incoming from Electron (authoritative source) — replace local state
          whitelist = (message.data || []).filter(e => e.expiresAt > Date.now());
          log(`Received whitelist from app: ${whitelist.length} entries`);
          browser.storage.local.set({ whitelist });
          break;
          
        case 'PONG':
          log('Connection confirmed (pong received)');
          isConnected = true;
          isConnectedToApp = message.connectedToApp || false;
          log(`Native host connected to Electron app: ${isConnectedToApp}`);
          // Request authoritative whitelist from Electron (covers reinstall)
          port.postMessage({ type: 'GET_WHITELIST' });
          break;
          
        case 'ERROR':
          log('Error from native host:', message.error);
          break;
      }
    });
    
    port.onDisconnect.addListener(() => {
      log('Disconnected from native host');
      isConnected = false;
      isConnectedToApp = false;
      port = null;
      
      // Check for error
      if (browser.runtime.lastError) {
        log('Disconnect error:', browser.runtime.lastError.message);
      }
      
      // Try to reconnect after 5 seconds
      setTimeout(connectToNativeHost, 5000);
    });
    
    // Send initial ping to test connection
    log('Sending ping to native host...');
    port.postMessage({ type: 'PING', browser: BROWSER_ID });
    
    // Request initial blocklist
    setTimeout(() => {
      log('Requesting initial blocklist...');
      port.postMessage({ type: 'GET_BLOCKLIST' });
    }, 100);
    
  } catch (error) {
    log('Failed to connect to native host:', error);
    isConnected = false;
    
    // Retry connection after 5 seconds
    setTimeout(connectToNativeHost, 5000);
  }
}

// Start connection when extension loads
connectToNativeHost();

// Listen for popup requests
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    sendResponse({
      connected: isConnected,
      connectedToApp: isConnectedToApp,
      blocklistSize: blocklist.length,
      whitelistSize: pruneWhitelist().length
    });
  } else if (message.type === 'REFRESH_BLOCKLIST') {
    if (port && isConnected) {
      port.postMessage({ type: 'GET_BLOCKLIST' });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not connected to native host' });
    }
  } else if (message.type === 'GET_WHITELIST') {
    sendResponse({ whitelist: pruneWhitelist() });
  } else if (message.type === 'ADD_WHITELIST') {
    const durationMs = message.durationMs || WHITELIST_DURATION_MS;
    const entry = {
      pattern: message.pattern,
      type: message.patternType,
      expiresAt: Date.now() + durationMs
    };
    // Replace any existing entry for same pattern
    whitelist = pruneWhitelist().filter(e => e.pattern !== message.pattern);
    whitelist.push(entry);
    browser.storage.local.set({ whitelist });
    notifyWhitelistUpdate();
    log(`Whitelist added: ${message.patternType}:${message.pattern}`);
    sendResponse({ success: true });
  } else if (message.type === 'REMOVE_WHITELIST') {
    whitelist = pruneWhitelist().filter(e => e.pattern !== message.pattern);
    browser.storage.local.set({ whitelist });
    notifyWhitelistUpdate();
    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// Optional: Block matching URLs using webRequest API
browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url;

    // Don't block our own extension pages
    if (url.startsWith(browser.runtime.getURL(''))) {
      return { cancel: false };
    }

    // Whitelisted — allow through
    if (isWhitelisted(url)) {
      log(`Whitelist pass: ${url}`);
      return { cancel: false };
    }
    
    // Check if URL matches any regex in blocklist
    for (const pattern of blocklist) {
      try {
        let matched = false;
        let matchedPattern = pattern;
        
        // Try multiple matching strategies
        // 1. Simple substring match for domains
        if (url.includes(pattern)) {
          matched = true;
        }
        
        // 2. Regex match (if pattern looks like a regex)
        if (!matched && (pattern.includes('.*') || pattern.includes('\\'))) {
          try {
            const regex = new RegExp(pattern, 'i');
            if (regex.test(url)) {
              matched = true;
            }
          } catch (e) {
            // Invalid regex, skip
          }
        }
        
        // 3. Domain matching (extract hostname)
        if (!matched) {
          try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            
            // Check if pattern matches hostname or subdomain
            if (hostname === pattern || 
                hostname.endsWith('.' + pattern) ||
                pattern.startsWith('.') && hostname.endsWith(pattern)) {
              matched = true;
            }
          } catch (e) {
            // Invalid URL, skip
          }
        }
        
        if (matched) {
          log(`Blocking: ${url} (matched: ${pattern})`);
          
          // Determine more specific block type
          let blockType = 'domain';
          if (pattern.includes('.*') || pattern.includes('\\')) {
            blockType = 'regex';
          }
          
          // Redirect to block page with info
          const blockPageUrl = browser.runtime.getURL('blocked.html') +
            `?url=${encodeURIComponent(url)}` +
            `&value=${encodeURIComponent(matchedPattern)}` +
            `&reason=${blockType}`;
          
          return { redirectUrl: blockPageUrl };
        }
      } catch (error) {
        // Invalid regex or error, skip
        log(`Error checking pattern ${pattern}: ${error.message}`);
      }
    }
    
    return { cancel: false };
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

log('Background script loaded');

// Periodically check connection status
setInterval(() => {
  if (port && isConnected) {
    try {
      port.postMessage({ type: 'PING', browser: BROWSER_ID });
    } catch (error) {
      log(`Error sending periodic ping: ${error.message}`);
    }
  }
}, 10000);

// Prune expired whitelist entries, sync to Electron, reload active tab if it matched
setInterval(() => {
  const expired = whitelist.filter(e => e.expiresAt <= Date.now());
  pruneWhitelist();
  if (expired.length === 0) return;

  log(`Pruned ${expired.length} expired whitelist entries`);
  notifyWhitelistUpdate();

  browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    const matched = expired.some(entry => {
      try {
        const hostname = new URL(tab.url).hostname;
        return entry.type === 'exact'
          ? stripProtocol(tab.url) === stripProtocol(entry.pattern)
          : hostname === entry.pattern || hostname.endsWith('.' + entry.pattern);
      } catch (e) { return false; }
    });
    if (matched) {
      log(`Active tab ${tab.url} matched expired whitelist entry — reloading`);
      browser.tabs.reload(tab.id);
    }
  });
}, 60 * 1000);
