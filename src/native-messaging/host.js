#!/usr/bin/env node

/**
 * Native Messaging Host for Focus Bear
 * Connects to Electron app via Unix socket for bidirectional communication
 */

import { appendFileSync } from 'fs';
import { createConnection } from 'net';

const SOCKET_PATH = '/tmp/focusbear.sock';

let appSocket = null;
let isConnectedToApp = false;

// Native messaging uses length-prefixed JSON messages
function sendMessage(message) {
  const buffer = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buffer.length, 0);

  process.stdout.write(header);
  process.stdout.write(buffer);
}

function readMessage(callback) {
  const chunks = [];
  let totalLength = 0;
  let expectedLength = null;

  process.stdin.on('data', (chunk) => {
    chunks.push(chunk);
    totalLength += chunk.length;

    // Read the 4-byte length header first
    if (expectedLength === null && totalLength >= 4) {
      const allData = Buffer.concat(chunks);
      expectedLength = allData.readUInt32LE(0);

      // Check if we have the complete message
      if (totalLength >= 4 + expectedLength) {
        const messageBuffer = allData.slice(4, 4 + expectedLength);
        const message = JSON.parse(messageBuffer.toString('utf8'));
        callback(message);

        // Reset for next message
        chunks.length = 0;
        totalLength = 0;
        expectedLength = null;
      }
    } else if (expectedLength !== null && totalLength >= 4 + expectedLength) {
      const allData = Buffer.concat(chunks);
      const messageBuffer = allData.slice(4, 4 + expectedLength);
      const message = JSON.parse(messageBuffer.toString('utf8'));
      callback(message);

      // Reset for next message
      chunks.length = 0;
      totalLength = 0;
      expectedLength = null;
    }
  });
}

// Log to a file since stdout is used for messaging
function log(message) {
  const logPath = '/tmp/focusbear-native-host.log';
  const timestamp = new Date().toISOString();
  appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}

// Connect to Electron app via Unix socket
function connectToApp() {
  log('Attempting to connect to Electron app socket...');

  appSocket = createConnection(SOCKET_PATH);

  appSocket.on('connect', () => {
    log('Connected to Electron app via socket');
    isConnectedToApp = true;

    // Send initial handshake
    appSocket.write(JSON.stringify({ type: 'NATIVE_HOST_CONNECTED' }) + '\n');
  });

  appSocket.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());

    lines.forEach(line => {
      try {
        const message = JSON.parse(line);
        log(`Received from app: ${JSON.stringify(message)}`);

        if (message.type === 'BLOCKLIST_UPDATE') {
          // Forward to extension
          log(`Forwarding blocklist update to extension (${message.data.length} entries)`);
          sendMessage({
            type: 'BLOCKLIST_UPDATE',
            data: message.data,
            timestamp: Date.now()
          });
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
  
  log('Requesting blocklist from app via socket...');
  
  // Set up one-time listener for response
  const timeout = setTimeout(() => {
    log('Blocklist request timed out');
    appSocket.removeAllListeners('data');
    callback(new Error('Timeout'), []);
  }, 5000);
  
  const originalDataHandler = appSocket.listeners('data')[0];
  
  appSocket.once('data', (data) => {
    clearTimeout(timeout);
    
    try {
      const message = JSON.parse(data.toString().trim());
      
      if (message.type === 'BLOCKLIST_RESPONSE') {
        log(`Received blocklist: ${message.data.length} entries`);
        callback(null, message.data);
      } else {
        callback(new Error('Unexpected response type'), []);
      }
    } catch (error) {
      log(`Error parsing blocklist response: ${error.message}`);
      callback(error, []);
    }
    
    // Restore original data handler
    if (originalDataHandler) {
      appSocket.on('data', originalDataHandler);
    }
  });
  
  appSocket.write(JSON.stringify({ type: 'GET_BLOCKLIST' }) + '\n');
}

log('Native messaging host started');

// Connect to Electron app
connectToApp();

// Handle messages from the extension
readMessage((message) => {
  log(`Received from extension: ${JSON.stringify(message)}`);

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
      sendMessage({
        type: 'PONG',
        timestamp: Date.now(),
        connectedToApp: isConnectedToApp
      });
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
