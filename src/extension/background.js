/**
 * Background script - handles native messaging connection
 */

let port = null;
let blocklist = [];
let isConnected = false;
let isConnectedToApp = false;

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
          // Store in extension storage for popup to access
          browser.storage.local.set({ 
            blocklist: blocklist,
            lastUpdate: message.timestamp 
          });
          break;
          
        case 'PONG':
          log('Connection confirmed (pong received)');
          isConnected = true;
          isConnectedToApp = message.connectedToApp || false;
          log(`Native host connected to Electron app: ${isConnectedToApp}`);
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
    port.postMessage({ type: 'PING' });
    
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
      blocklistSize: blocklist.length
    });
  } else if (message.type === 'REFRESH_BLOCKLIST') {
    if (port && isConnected) {
      port.postMessage({ type: 'GET_BLOCKLIST' });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Not connected to native host' });
    }
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
    // Send a ping to verify connection and update app status
    try {
      port.postMessage({ type: 'PING' });
    } catch (error) {
      log(`Error sending periodic ping: ${error.message}`);
    }
  }
}, 10000); // Every 10 seconds
