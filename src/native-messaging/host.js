#!/usr/bin/env node

/**
 * Native Messaging Host for Focus Bear
 * Connects to Electron app via Unix socket for bidirectional communication
 */

import { appendFileSync } from 'fs';
import { createConnection } from 'net';
import { tmpdir } from 'os';
import { join } from 'path'; 
import { cache } from 'react';

const SOCKET_PATH = process.platform === "win32" ? "\\\\.\\pipe\\focusbear" : "/tmp/focusbear.sock";

const LOG_PATH = join(tmpdir(), 'focusbear-native-host.log');

const SESSION_REQUESTS = new Set ([
  'REQUEST_SESSION_START',
  'REQUEST_SESSION_PAUSE',
  'REQUEST_SESSION_RESUME',
  'REQUEST_SESSION_CANCEL'
]);

let appSocket = null;
let socketBuf = ''; 
let isConnectedToApp = false;
let cachedBrowserId = null;
let pendingBlocklistCallback = null;
let pendingBlocklistTimeout = null;

// Native messaging uses length-prefixed JSON messages
function sendMessage(message) {
  const buffer = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);

  process.stdout.write(header);
  process.stdout.write(buffer);
}

function readMessage(callback) {
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 4) {
      const msgLen = buffer.readUInt32LE(0);
      if (buffer.length < 4 + msgLen) break;
      try {
        callback(JSON.parse(buffer.slice(4, 4 + msgLen).toString('utf8')));
      } catch (error) {
        log(`Error parsing stdin message: ${error.message}`);
      }
      buffer = buffer.slice(4 + msgLen);
    }
  });
}

// Log to a file since stdout is used for messaging
function log(message) {
  try {
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Ignore
  }
}

// Connect to Electron app via Unix socket
function connectToApp() {
  log('Attempting to connect to Electron app socket...');

  appSocket = createConnection(SOCKET_PATH);

  appSocket.on('connect', () => {
    socketBuf = '';
    log('Connected to Electron app via socket');
    isConnectedToApp = true;

    // Send initial handshake — include cached browser ID if known (covers reconnects)
    appSocket.write(JSON.stringify({ type: 'NATIVE_HOST_CONNECTED', browser: cachedBrowserId }) + '\n');
  });

  appSocket.on('data', (data) => {
    socketBuf += data.toString('utf8');
    const lines = socketBuf.split('\n');
    socketBuf = lines.pop();

    lines.filter(line => line.trim()).forEach(line => {
      try {
        const message = JSON.parse(line);
        log(`Received from app: ${JSON.stringify(message)}`);

        if (message.type === 'BLOCKLIST_UPDATE') {
          log(`Forwarding blocklist update to extension (${message.data.length} entries)`);
          sendMessage({
            type: 'BLOCKLIST_UPDATE',
            data: message.data,
            timestamp: Date.now()
          });
        } else if (message.type === 'WHITELIST_UPDATE') {
          log(`Forwarding whitelist update to extension (${message.data.length} entries)`);
          sendMessage({
            type: 'WHITELIST_UPDATE',
            data: message.data,
            timestamp: Date.now()
          });
        } else if (message.type === 'WHITELIST_RESPONSE') {
          log(`Forwarding whitelist response to extension (${message.data.length} entries)`);
          sendMessage({
            type: 'WHITELIST_RESPONSE',
            data: message.data,
            timestamp: Date.now()
          });
        } else if (message.type === 'BLOCKLIST_RESPONSE') {
          if (pendingBlocklistCallback) {
            const cb = pendingBlocklistCallback;
            pendingBlocklistCallback = null;
            clearTimeout(pendingBlocklistTimeout);
            pendingBlocklistTimeout = null;
            cb(null, message.data);
          }
        } else if (typeof message.type === 'string' && message.type.startsWith('SESSION_')) {
          log(`Forwarding ${message.type} to extension`);
          sendMessage({ ...message, timestamp: message.timestamp ?? Date.now() });
        }
      } catch (error) {
        log(`Error parsing socket message: ${error.message}`);
      }
    });
  });

  appSocket.on('error', (error) => {
    log(`Socket error: ${error.message}`);
    isConnectedToApp = false;
  });

  appSocket.on('close', () => {
    log('Socket connection closed. Will retry...');
    socketBuf = '';
    isConnectedToApp = false;
    appSocket = null;

    // Retry connection after 2 seconds
    setTimeout(connectToApp, 2000);
  });
}

// Request blocklist from app via socket
function requestBlocklist(callback) {
  if (!isConnectedToApp || !appSocket) {
    log('Not connected to app, cannot retrieve blocklist');
    callback(new Error('Not connected to app'), []);
    return;
  }

  if (pendingBlocklistCallback) {
    callback(new Error('Request already pending'), []);
    return;
  }

  log('Requesting blocklist from app via socket...');
  pendingBlocklistCallback = callback;
  pendingBlocklistTimeout = setTimeout(() => {
    log('Blocklist request timed out');
    pendingBlocklistCallback = null;
    pendingBlocklistTimeout = null;
    callback(new Error('Timeout'), []);
  }, 5000);

  appSocket.write(JSON.stringify({ type: 'GET_BLOCKLIST' }) + '\n');
}

log('Native messaging host started');

// When extension is disabled/removed, Firefox closes stdin — exit cleanly so
// Electron's socket close handler detects the disconnection immediately.
process.stdin.on('end', () => {
  log('stdin closed (extension disconnected), exiting');
  if (appSocket) appSocket.end();
  process.exit(0);
});

// Connect to Electron app
connectToApp();

// Setup Heartbeat for extension detection.
setInterval(() => {
  if (isConnectedToApp && appSocket && cachedBrowserId) {
    appSocket.write(JSON.stringify({ type: 'PING', browser: cachedBrowserId, timestamp: Date.now() }) + '\n');
  }
}, 10000);

// Handle messages from the extension
readMessage((message) => {
  log(`Received from extension: ${JSON.stringify(message)}`);

  if (SESSION_REQUESTS.has(message.type)) {
    if (isConnectedToApp && appSocket) {
      appSocket.write(JSON.stringify({ ...message, timestamp: Date.now() }) + '\n');
    } else {
      log(`Not connected to app, ${message.type} not forwarded`);
      sendMessage({ type: 'ERROR', error: "Not connected to app", requestType: message.type});
    }
    return;
  }

  switch (message.type) {
    case 'GET_BLOCKLIST':
      requestBlocklist((error, blocklist) => {
        if (error) {
          log(`Error getting blocklist: ${error.message}`);
          sendMessage({
            type: 'ERROR',
            error: error.message
          });
        } else {
          log(`Sending blocklist to extension: ${blocklist.length} entries`);
          sendMessage({
            type: 'BLOCKLIST_RESPONSE',
            data: blocklist,
            timestamp: Date.now()
          });
        }
      });
      break;

    case 'PING':
      log('Received ping, sending pong');
      const browserChanged = message.browser && message.browser !== cachedBrowserId;
      if (message.browser) cachedBrowserId = message.browser;
      sendMessage({
        type: 'PONG',
        timestamp: Date.now(),
        connectedToApp: isConnectedToApp
      });
      if (isConnectedToApp && appSocket) {
        if (browserChanged) {
          appSocket.write(JSON.stringify({ type: 'NATIVE_HOST_CONNECTED', browser: cachedBrowserId }) + '\n');
        }
        appSocket.write(JSON.stringify({ type: 'PING', browser: cachedBrowserId || 'unknown', timestamp: Date.now() }) + '\n');
      }
      break;

    case 'GET_WHITELIST':
      log('Forwarding GET_WHITELIST to app');
      if (isConnectedToApp && appSocket) {
        appSocket.write(JSON.stringify({ type: 'GET_WHITELIST' }) + '\n');
      } else {
        log('Not connected to app, sending empty whitelist response');
        sendMessage({ type: 'WHITELIST_RESPONSE', data: [] });
      }
      break;

    case 'WHITELIST_UPDATE':
      log(`Forwarding whitelist update to app (${message.data.length} entries)`);
      if (isConnectedToApp && appSocket) {
        appSocket.write(JSON.stringify({
          type: 'WHITELIST_UPDATE',
          data: message.data,
          timestamp: Date.now()
        }) + '\n');
      } else {
        log('Not connected to app, whitelist update not forwarded');
      }
      break;

    default:
      log(`Unknown message type: ${message.type}`);
      sendMessage({
        type: 'ERROR',
        error: `Unknown message type: ${message.type}`
      });
  }
});

// Handle process termination
process.on('SIGTERM', () => {
  log('Received SIGTERM, closing socket and exiting');
  if (appSocket) {
    appSocket.end();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  log('Received SIGINT, closing socket and exiting');
  if (appSocket) {
    appSocket.end();
  }
  process.exit(0);
});

log('Native host ready, waiting for messages');
