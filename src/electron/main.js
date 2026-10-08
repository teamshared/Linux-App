import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain, session } from "electron";
import {createTray, getTrayWindow} from "./tray-handler.js"
import { createWebView, switchToWebView, hideAllWebViews, webViewConfigs, resizeCurrentWebView, getCurrentActiveWebViewId } from './webview-handler.js';
import { exec, execFile, spawn, execSync } from 'child_process';
import { promisify } from 'util';
import "./Blocker.js"
import { setBroadcastFunction } from './Blocker.js';
import { focusState } from './focusState.js';
import SimpleUrlGrabber from './simpleUrlGrabber.js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { createServer } from 'net';
import { unlink } from 'fs/promises';

dotenv.config();

const execFileAsync = promisify(execFile);

const SOCKET_PATH = '/tmp/focusbear.sock';
let socketServer = null;
const socketClients = new Map();       // socket → {browser: string|null, lastPing: number}
let currentBlocklist = [];
let currentWhitelist = [];
let warningWindow = null;
const connectedBrowsers = new Set();
const browserLastConnected = new Map();
let pingMonitorActive = false;
let extensionWarningTimer = null;
let extensionWarningActive = false;
let warningBrowserId = null;

let selectedBrowsers = ['firefox']; // persisted from setup; updated via applySettings

const BROWSER_PGREP_PATTERNS = {
  firefox:  ['firefox'],
  chrome:   ['google-chrome'],
  chromium: ['chromium'],
  brave:    ['brave'],
  opera:    ['opera'],
};

const BROWSER_KILL_TARGETS = {
  firefox:  ['firefox', 'firefox-bin', 'firefox-esr'],
  chrome:   ['google-chrome'],
  chromium: ['chromium', 'chromium-browser'],
  brave:    ['brave', 'brave-browser'],
  opera:    ['opera'],
};

function getWhitelistPath() {
  return join(app.getPath('userData'), 'whitelist.json');
}

async function loadWhitelistFromDisk() {
  try {
    const data = await fs.readFile(getWhitelistPath(), 'utf8');
    const entries = JSON.parse(data);
    currentWhitelist = entries.filter(e => e.expiresAt > Date.now());
    console.log(`[Whitelist] Loaded ${currentWhitelist.length} active entries from disk`);
  } catch (error) {
    currentWhitelist = [];
  }
}

async function saveWhitelistToDisk(entries) {
  try {
    await fs.writeFile(getWhitelistPath(), JSON.stringify(entries, null, 2));
  } catch (error) {
    console.error('[Whitelist] Failed to save:', error.message);
  }
}

function markBrowserConnected(socket, browser) {
  const client = socketClients.get(socket);
  if (client) client.browser = browser;
  browserLastConnected.set(browser, Date.now());
  if (!connectedBrowsers.has(browser)) {
    connectedBrowsers.add(browser);
    if (mainWindow) mainWindow.webContents.send('extension-connected', browser);
  }
  if (!warningBrowserId || warningBrowserId === browser) cancelExtensionWarning();
}

async function startSocketServer() {
  try {
    await unlink(SOCKET_PATH);
  } catch { /* stale socket, ignore */ }

  socketServer = createServer((socket) => {
    console.log('[Socket] Native host connected');
    socketClients.set(socket, { browser: null, lastPing: Date.now() });

    // Push current blocklist immediately so new connections don't wait for a GET_BLOCKLIST
    if (currentBlocklist.length > 0) {
      socket.write(JSON.stringify({
        type: 'BLOCKLIST_UPDATE',
        data: currentBlocklist,
        timestamp: Date.now()
      }) + '\n');
    }

    // Push whitelist so extension can restore it after reinstall
    socket.write(JSON.stringify({
      type: 'WHITELIST_UPDATE',
      data: currentWhitelist.filter(e => e.expiresAt > Date.now()),
      timestamp: Date.now()
    }) + '\n');

    socket.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());

      lines.forEach(line => {
        try {
          const message = JSON.parse(line);
          const browserTag = message.browser ? ` (${message.browser})` : '';
          console.log(`[Socket] Received from native host: ${message.type}${browserTag}`);

          if (socketClients.has(socket)) socketClients.get(socket).lastPing = Date.now();

          if (message.type === 'NATIVE_HOST_CONNECTED') {
            if (message.browser) {
              // Evict stale socket for this browser — old host may not have cleaned up
              for (const [s, c] of socketClients) {
                if (s !== socket && c.browser === message.browser) {
                  console.log(`[Socket] Evicting stale ${message.browser} socket (new host connected)`);
                  s.destroy();
                  socketClients.delete(s);
                }
              }
              markBrowserConnected(socket, message.browser);
              console.log(`[Socket] Host identified as ${message.browser} on connect`);
            }
          } else if (message.type === 'PING') {
            markBrowserConnected(socket, message.browser || 'unknown');
          } else if (message.type === 'GET_BLOCKLIST') {
            console.log(`[Socket] Sending blocklist: ${currentBlocklist.length} entries`);
            socket.write(JSON.stringify({
              type: 'BLOCKLIST_RESPONSE',
              data: currentBlocklist,
              timestamp: Date.now()
            }) + '\n');
          } else if (message.type === 'GET_WHITELIST') {
            const active = currentWhitelist.filter(e => e.expiresAt > Date.now());
            console.log(`[Socket] Sending whitelist: ${active.length} entries`);
            socket.write(JSON.stringify({
              type: 'WHITELIST_RESPONSE',
              data: active,
              timestamp: Date.now()
            }) + '\n');
          } else if (message.type === 'WHITELIST_UPDATE') {
            currentWhitelist = message.data.filter(e => e.expiresAt > Date.now());
            console.log(`[Socket] Whitelist updated: ${currentWhitelist.length} entries`);
            saveWhitelistToDisk(currentWhitelist);
          } else if (typeof message.type === 'string' && message.type.startsWith('REQUEST_SESSION_')) {
            handleSessionRequest(socket, message);
          }
        } catch (error) {
          console.error('[Socket] Error parsing message:', error);
        }
      });
    });

    socket.on('close', () => {
      console.log('[Socket] Native host disconnected');
      const client = socketClients.get(socket);
      socketClients.delete(socket);
      const browser = client?.browser;
      if (browser && ![...socketClients.values()].some(c => c.browser === browser)) {
        connectedBrowsers.delete(browser);
      }
      // Chrome: SW suspension is normal — alarm reconnects within 60s. 70s grace avoids false positives.
      // Firefox: MV2 background is persistent, so disconnect means crash/disable. 5s grace.
      if (pingMonitorActive && browser) {
        const closedBrowser = browser;
        const gracePeriod = closedBrowser === 'firefox' ? 5000 : 70000;
        setTimeout(async () => {
          // Cancel if browser already reconnected during grace period
          if ([...socketClients.values()].some(c => c.browser === closedBrowser)) return;
          if (!extensionWarningActive && await isBrowserRunning(closedBrowser)) {
            console.log(`[PingMonitor] Socket closed, ${closedBrowser} still running after grace — showing warning`);
            showExtensionWarning(closedBrowser);
          }
        }, gracePeriod);
        // If browser unknown (PING never received before disconnect), browserScan handles it
      }
    });

    socket.on('error', (error) => {
      console.error('[Socket] Client error:', error.message);
    });
  });

  socketServer.listen(SOCKET_PATH, () => {
    console.log(`[Socket] Server listening on ${SOCKET_PATH}`);
  });

  socketServer.on('error', (error) => {
    console.error('[Socket] Server error:', error);
  });
}

function broadcastBlocklistUpdate(blocklist) {
  currentBlocklist = blocklist;

  const message = JSON.stringify({
    type: 'BLOCKLIST_UPDATE',
    data: blocklist,
    timestamp: Date.now()
  }) + '\n';

  console.log(`[Socket] Broadcasting blocklist update to ${socketClients.size} clients`);

  for (const socket of socketClients.keys()) {
    try {
      socket.write(message);
    } catch (error) {
      console.error('[Socket] Error broadcasting to client:', error);
    }
  }
}

// browserId: check only that browser. Omit to check all selected browsers.
async function isBrowserRunning(browserId) {
  const ids = browserId ? [browserId] : selectedBrowsers;
  for (const id of ids) {
    for (const p of (BROWSER_PGREP_PATTERNS[id] || [])) {
      try {
        await execFileAsync('pgrep', ['-f', p]);
        return true;
      } catch { /* no match */ }
    }
  }
  return false;
}

async function killBrowsers(browserId) {
  const targets = BROWSER_KILL_TARGETS[browserId] || [];
  console.log(`[PingMonitor] Killing ${browserId} (${targets.join(', ')})`);
  await Promise.all(targets.map(name => execFileAsync('pkill', ['-x', name]).catch(() => {})));
}

function destroyWarningWindow() {
  if (warningWindow) {
    const win = warningWindow;
    warningWindow = null;
    win.destroy();
  }
}

function cancelExtensionWarning() {
  if (extensionWarningTimer) {
    clearTimeout(extensionWarningTimer);
    extensionWarningTimer = null;
  }
  extensionWarningActive = false;
  destroyWarningWindow();
}

function showExtensionWarning(browserId) {
  if (extensionWarningActive) return;
  extensionWarningActive = true;
  warningBrowserId = browserId || null;
  console.log(`[PingMonitor] Showing extension disconnected warning (browser: ${browserId})`);

  const timerBrowserId = browserId || null;
  extensionWarningTimer = setTimeout(async () => {
    extensionWarningActive = false;
    extensionWarningTimer = null;
    destroyWarningWindow();
    await killBrowsers(timerBrowserId);
  }, 30000);

  warningWindow = new BrowserWindow({
    width: 600,
    height: 400,
    resizable: false,
    alwaysOnTop: true,
    title: 'Focus Bear — Extension Warning',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  const BROWSER_NAMES = { firefox: 'Firefox', chrome: 'Chrome', chromium: 'Chromium', brave: 'Brave', opera: 'Opera' };
  const browserName = BROWSER_NAMES[browserId] || 'your browser';
  warningWindow.loadFile(join(__dirname, 'extension-warning.html'), { query: { browser: browserName } });
  warningWindow.webContents.once('did-finish-load', () => {
    if (!warningWindow) return;
    warningWindow.webContents.executeJavaScript('document.querySelector(".card").getBoundingClientRect().height + 48')
      .then(h => {
        if (!warningWindow) return;
        const [w] = warningWindow.getContentSize();
        warningWindow.setContentSize(w, h);
      })
      .catch(() => {});
  });
  warningWindow.on('closed', () => { warningWindow = null; }); // handles manual X click
}

function startPingMonitor() {
  if (pingMonitorActive) return;
  pingMonitorActive = true;

  // Firefox MV2 background is persistent — detect hung connections via ping silence.
  // Chrome MV3 SWs sleep and reconnect via alarm; socket-close grace handles disconnect detection.
  setInterval(async () => {
    if (extensionWarningActive) return;
    const now = Date.now();
    for (const [, client] of socketClients) {
      if (client.browser !== 'firefox') continue;
      if (now - client.lastPing > 20000 && await isBrowserRunning('firefox')) {
        showExtensionWarning('firefox');
        break;
      }
    }
  }, 5000);

  // Detect browser running without extension ever connecting (startup / disabled-before-launch).
  // Firefox: 5s grace (persistent background connects immediately).
  // Chrome: 70s grace (alarm fires within 60s if extension enabled, then reconnects).
  const BROWSER_SCAN_GRACE = { firefox: 5000 };
  const DEFAULT_SCAN_GRACE = 70000;

  const browserScan = async () => {
    if (extensionWarningActive) return;
    const now = Date.now();
    for (const browserId of selectedBrowsers) {
      if (connectedBrowsers.has(browserId)) continue;
      if (!await isBrowserRunning(browserId)) continue;
      const grace = BROWSER_SCAN_GRACE[browserId] ?? DEFAULT_SCAN_GRACE;
      const lastSeen = browserLastConnected.get(browserId) ?? 0;
      if (now - lastSeen < grace) continue;
      console.log(`[BrowserScan] ${browserId} running without extension for >${grace}ms — showing warning`);
      showExtensionWarning(browserId);
      break;
    }
  };

  setTimeout(browserScan, 20000); // initial check — Firefox connects immediately; Chrome needs ~60s for alarm
  setInterval(browserScan, 90000);
}

// Install native messaging host on startup — runs in-process, no subprocess needed.
// Files are copied into ~/.local/share/focusbear/ so snap Firefox's sandbox can reach them.
const CHROME_EXTENSION_ID = 'dhjmacpmdnfhpghleebnngdhikmffcem';

async function installNativeMessaging() {
  try {
    const nativeSrcDir = app.isPackaged
      ? join(process.resourcesPath, 'native-messaging')
      : join(__dirname, '..', 'native-messaging');
    const extensionSrcDir = app.isPackaged
      ? join(process.resourcesPath, 'extension')
      : join(__dirname, '..', 'extension');
    const chromeExtSrcDir = app.isPackaged
      ? join(process.resourcesPath, 'extension-chrome')
      : join(__dirname, '..', 'extension-chrome');

    const localNativeDir = join(homedir(), '.local', 'share', 'focusbear', 'native-messaging');
    await fs.mkdir(localNativeDir, { recursive: true });
    await fs.copyFile(join(nativeSrcDir, 'host.js'),     join(localNativeDir, 'host.js'));
    await fs.copyFile(join(nativeSrcDir, 'package.json'), join(localNativeDir, 'package.json'));

    const localExtDir = join(homedir(), '.local', 'share', 'focusbear', 'extension');
    await fs.mkdir(localExtDir, { recursive: true });
    for (const f of await fs.readdir(extensionSrcDir)) {
      await fs.copyFile(join(extensionSrcDir, f), join(localExtDir, f)).catch(() => {});
    }

    // Wrapper at ~/.local/bin points to the home-dir copy of host.js
    const wrapperDir = join(homedir(), '.local', 'bin');
    const wrapperPath = join(wrapperDir, 'focusbear-native-host');
    await fs.mkdir(wrapperDir, { recursive: true });
    await fs.writeFile(wrapperPath, `#!/bin/sh\nexec node "${join(localNativeDir, 'host.js')}" "$@"\n`);
    await fs.chmod(wrapperPath, 0o755);

    // Write Firefox manifest to all known locations (regular + snap)
    const firefoxManifest = JSON.stringify({
      name: 'com.focusbear.host',
      description: 'Focus Bear Native Messaging Host',
      path: wrapperPath,
      type: 'stdio',
      allowed_extensions: ['focusbear@focusbear.io']
    }, null, 2);
    for (const dir of [
      join(homedir(), '.mozilla', 'native-messaging-hosts'),
      join(homedir(), 'snap', 'firefox', 'common', '.mozilla', 'native-messaging-hosts'),
    ]) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      await fs.writeFile(join(dir, 'com.focusbear.host.json'), firefoxManifest).catch(() => {});
    }

    // Write Chrome/Chromium native messaging manifests
    const chromeManifest = JSON.stringify({
      name: 'com.focusbear.host',
      description: 'Focus Bear Native Messaging Host',
      path: wrapperPath,
      type: 'stdio',
      allowed_origins: [`chrome-extension://${CHROME_EXTENSION_ID}/`]
    }, null, 2);
    for (const dir of [
      join(homedir(), '.config', 'google-chrome', 'NativeMessagingHosts'),
      join(homedir(), '.config', 'google-chrome-beta', 'NativeMessagingHosts'),
      join(homedir(), '.config', 'google-chrome-unstable', 'NativeMessagingHosts'),
      join(homedir(), '.config', 'chromium', 'NativeMessagingHosts'),
      join(homedir(), '.config', 'BraveSoftware', 'Brave-Browser', 'NativeMessagingHosts'),
      join(homedir(), '.config', 'opera', 'NativeMessagingHosts'),
    ]) {
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      await fs.writeFile(join(dir, 'com.focusbear.host.json'), chromeManifest).catch(() => {});
    }

    // Copy Chrome extension files and pack as .zip
    const localChromeExtDir = join(homedir(), '.local', 'share', 'focusbear', 'extension-chrome');
    await fs.mkdir(localChromeExtDir, { recursive: true });
    for (const f of await fs.readdir(chromeExtSrcDir).catch(() => [])) {
      await fs.copyFile(join(chromeExtSrcDir, f), join(localChromeExtDir, f)).catch(() => {});
    }
    const chromeZipPath = join(homedir(), '.local', 'share', 'focusbear', 'focusbear-extension-chrome.zip');
    try {
      try { await fs.unlink(chromeZipPath); } catch {}
      execSync(`cd "${localChromeExtDir}" && zip -r "${chromeZipPath}" .`, { stdio: 'pipe' });
      console.log('[Native Messaging] Chrome extension .zip ready at', chromeZipPath);
      console.log('[Native Messaging] Chrome: chrome://extensions → Load unpacked → select', localChromeExtDir);
    } catch (zipErr) {
      console.warn('[Native Messaging] Could not create Chrome .zip:', zipErr.message);
    }

    // Pack Firefox extension as .xpi (zip) so snap Firefox's portal grants access to a single file
    // containing all extension scripts — selecting manifest.json alone only mounts that one file.
    const xpiPath = join(homedir(), '.local', 'share', 'focusbear', 'focusbear-extension.xpi');
    try {
      try { await fs.unlink(xpiPath); } catch {}
      execSync(`cd "${localExtDir}" && zip -r "${xpiPath}" .`, { stdio: 'pipe' });
      console.log('[Native Messaging] Host installed at', wrapperPath);
      console.log('[Native Messaging] Extension .xpi ready at', xpiPath);
      console.log('[Native Messaging] Firefox: about:debugging → Load Temporary Add-on → select', xpiPath);
    } catch (zipErr) {
      console.warn('[Native Messaging] Could not create .xpi:', zipErr.message);
      console.log('[Native Messaging] Host installed at', wrapperPath);
      console.log('[Native Messaging] Load extension from:', join(localExtDir, 'manifest.json'));
    }
  } catch (error) {
    console.error('[Native Messaging] Setup failed:', error.message);
  }
}

console.log('[Main Process] Starting Focus Bear...');
console.log('[Main Process] App packaged:', app.isPackaged);
console.log('[Main Process] App path:', app.getAppPath());
console.log('[Main Process] User data path:', app.getPath('userData'));
console.log('[Main Process] Node env:', process.env.NODE_ENV);

let tray = null
let focusBearView = null
let mainWindow = null;
let authWindow = null;
let exitflag = false;
let pendingProtocolUrl = null;
const urlGrabber = new SimpleUrlGrabber();

// Unified focus session state
let isFocusActive = false;

// Extension session sync (native messaging)
let isFocusPaused = false;

// Send a session event to all connected native messaging clients
function emitSessionEvent(type, extra = {}, exceptSocket = null) {
  const message = JSON.stringify({ type, ...extra, timestamp: Date.now() }) + '\n';
  let sent = 0;
  for (const socket of socketClients.keys()) {
    if (socket === exceptSocket) continue;
    try { socket.write(message); sent++; } catch (e) { 
      console.error('[Session] emit failed:', e); }
  }
  console.log(`[Session] ${type} sent to ${sent} clients(s)`);
}

// Handles session control requests recieved from the browser extension
function handleSessionRequest(socket, message) {
  const detail = { durationSeconds: message.durationSeconds, task: message.task };

  switch (message.type) {
    case 'REQUEST_SESSION_START':
      if (isFocusActive) { 
        console.log('[Session START ignored - already running'); 
        return; 
      }
      isFocusActive = true;
      isFocusPaused = false;
      focusState.setActive(true);
      broadcastFocusState(true);
      broadcastBlocklistUpdate(currentBlocklist);
      emitSessionEvent('SESSION_START', detail, socket);
      break;

    case 'REQUEST_SESSION_PAUSE':
      if (!isFocusActive || isFocusPaused) { console.log('[Session] PAUSE ignored'); return; }
      isFocusPaused = true;
      emitSessionEvent('SESSION_PAUSE', {}, socket);
      break;
    
    case 'REQUEST_SESSION_RESUME':
      if (!isFocusActive || !isFocusPaused) { console.log('[Session] RESUME ignored'); return; }
      isFocusPaused = false;
      emitSessionEvent('SESSION_RESUME', {}, socket);
      break;
    
    case 'REQUEST_SESSION_CANCEL':
      if (!isFocusActive) { console.log('[Session] CANCEL ignored'); return; }
      isFocusActive = false;
      isFocusPaused = false;
      focusState.setActive(false);
      broadcastFocusState(false);
      emitSessionEvent('SESSION_CANCEL', {}, socket);
      break;
    
    default:
      return;
  }

  // Let the UI pick up the duration / task if it listens
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('extension-session-request', { action: message.type, ...detail });
  }
}

// Handle Pause/Resume requets from the desktop application's UI
ipcMain.on('focus-session-pause', function(event, paused) {
  if (!isFocusActive || isFocusPaused === !!paused) return;
  isFocusPaused = !!paused;
  emitSessionEvent(isFocusPaused ? 'SESSION_PAUSE' : 'SESSION_RESUME');
});

function getWebviewContainerBounds() {
    const bounds = mainWindow.getBounds();
    const padding = 20;
    const topOffset = 140;

    return {
        x: padding,
        y: topOffset,
        width: bounds.width - (padding * 2),
        height: bounds.height - topOffset - padding
    };
}

//SINGLE INSTANCING FOR Auth0
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.on("ready", function(){
    // Start socket server for native messaging
    startSocketServer();

    // Set up broadcast function for Blocker.js
    setBroadcastFunction(broadcastBlocklistUpdate);

    // Load persisted whitelist before socket server accepts connections
    loadWhitelistFromDisk();

    // Install native messaging host
    installNativeMessaging();

    // Only monitor extension liveness after setup is complete.
    // Checked from disk so the decision is made before the renderer loads.
    fs.readFile(getSettingsPath(), 'utf8')
      .then(data => {
        const s = JSON.parse(data);
        if (s.selectedBrowsers) selectedBrowsers = s.selectedBrowsers;
        if (s.setupComplete) startPingMonitor();
      })
      .catch(() => {}); // first run — no settings file yet, skip monitor

    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 850,
        width: 1000,
        show: true,
        webviewTag: true,
        webPreferences: {
            preload: join(app.getAppPath(), "/src/electron/preload.js"),
            webSecurity: false,
        },
        devTools: false,
    });
    tray = createTray(mainWindow)

    const isDev = !app.isPackaged;

    if (!isDev) {
        const { webRequest } = mainWindow.webContents.session;
        const filter = { urls: ['http://localhost/callback*'] };

        webRequest.onBeforeRequest(filter, async (details, callback) => {
            console.log('[Auth] Intercepted callback on main window:', details.url);

            pendingProtocolUrl = details.url;

            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.once('did-finish-load', () => {
                    console.log('[Auth] Sending callback to renderer after reload:', pendingProtocolUrl);
                    if (pendingProtocolUrl) {
                        mainWindow.webContents.send('auth-protocol-callback', pendingProtocolUrl);
                        pendingProtocolUrl = null;
                    }
                });
                mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'));
            }

            callback({ cancel: true });
        });
    }

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'));
    }

    mainWindow.webContents.once('did-finish-load', () => {
        if (pendingProtocolUrl) {
            console.log('Sending pending protocol URL to renderer:', pendingProtocolUrl);
            mainWindow.webContents.send('auth-protocol-callback', pendingProtocolUrl);
            pendingProtocolUrl = null;
        }
    });

    mainWindow.on('resize', () => {
        const activeWebViewId = getCurrentActiveWebViewId();
        if (activeWebViewId) {
            let containerBounds = getWebviewContainerBounds();

            if (activeWebViewId === 'blocking_schedule') {
                containerBounds.height = containerBounds.height * 0.46;
            }

            resizeCurrentWebView(containerBounds);
        }
    });

    mainWindow.on('close', function(event) {
        if (exitflag){
            return
        }
        event.preventDefault();
        mainWindow.hide();
    });


    // Prevent popups in main window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        console.log('Navigation attempt to:', navigationUrl);

        if (navigationUrl.startsWith('file://') ||
            navigationUrl.startsWith('http://localhost:5173') ||
            navigationUrl.includes('auth0.com')) {
            return;
        }

        event.preventDefault();
    });


    // ipcMain.on('update-webview-bounds', function(event, webViewId, tabName) {
    //     const bounds = getWebviewContainerBounds();
    //     showWebView(webViewId, mainWindow, bounds);
    // });

    ipcMain.on('show-preferences', function() {
        if (mainWindow) {
            mainWindow.setSize(1000, 850);
            mainWindow.center();
            mainWindow.show();
            mainWindow.focus();
        }
    });
});

ipcMain.handle('get-extension-connected', () => [...connectedBrowsers]);

ipcMain.handle('get-local-settings', async () => {
  try {
    const data = await fs.readFile(getSettingsPath(), 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
});

ipcMain.on('setup-complete', () => { startPingMonitor(); });

ipcMain.on('extension-warning-close-browser', async () => {
  cancelExtensionWarning();
  await killBrowsers(warningBrowserId);
});

ipcMain.on('quit-channel', function() {
    exitflag = true
    app.quit();
});

ipcMain.on('focus-session-true', function(event) {
    if (isFocusActive) {
        event.sender.send('focus-session-result', 'Focus session already active');
        return;
    }

    // Native messaging extension handles blocking
    isFocusActive = true;
    focusState.setActive(true);
    broadcastFocusState(true);
    isFocusPaused = false;
    emitSessionEvent('SESSION_START');
    broadcastBlocklistUpdate(currentBlocklist);
    console.log('Focus session started (native messaging extension)');

    try {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('focus-session-result', 'Focus session started');
        }
    } catch (e) {
        console.log('Could not send result to original sender (window destroyed)');
    }
});

ipcMain.on('focus-session-false', function(event) {
    if (!isFocusActive) {
        event.sender.send('focus-session-result', 'Focus session already inactive');
        return;
    }

    // Native messaging extension handles blocking
    isFocusActive = false;
    focusState.setActive(false);
    broadcastFocusState(false);
    isFocusPaused = false;
    emitSessionEvent('SESSION_CANCEL');
    console.log('Focus session ended');

    try {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('focus-session-result', 'Focus session stopped');
        }
    } catch (e) {
        console.log('Could not send result to original sender (window destroyed)');
    }
});

// URL monitoring
const stopMonitoring = urlGrabber.startRealtimeMonitoring((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('url-changed', data);
    }
}, 250);

// Other IPC handlers
ipcMain.on('print-urls', function(event, urls) {
    console.log('URLs received for printing:\n', urls);
});

ipcMain.on('url-channel', function(e, urls){
    // Handle URL export
});

// App lifecycle
app.on('window-all-closed', function() {
    if (exitflag) {
        // Allow app to quit
    } else {
        return
    }
});

app.on('before-quit', function() {
    stopMonitoring()

    // Close socket server
    if (socketServer) {
        socketServer.close();
        for (const socket of socketClients.keys()) socket.end();
    }
});

app.on('will-quit', function() {
    exitflag = false;
});

// Focus state broadcasting
function broadcastFocusState(isActive) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('focus-state-changed', isActive);
    }

    const trayWindow = getTrayWindow();
    if (trayWindow && !trayWindow.isDestroyed()) {
        trayWindow.webContents.send('focus-state-changed', isActive);
    }
}

app.setAsDefaultProtocolClient('focusbear');

app.on('open-url', (event, url) => {
  event.preventDefault();
  console.log('=== MAIN PROCESS RECEIVED PROTOCOL URL (open-url event) ===');
  console.log('URL:', url);

  if (url.startsWith('focusbear://')) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('Sending to renderer process...');
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('auth-protocol-callback', url);
        });
      } else {
        mainWindow.webContents.send('auth-protocol-callback', url);
      }
      mainWindow.show();
      mainWindow.focus();
    } else {
      console.log('Main window not available, storing URL for later');
      pendingProtocolUrl = url;
    }
  }
});

// AUTH WINDOW HANDLER
function openAuthWindow(authUrl) {
    if (authWindow) {
        authWindow.focus();
        return;
    }

    authWindow = new BrowserWindow({
        width: 500,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false
        },
        autoHideMenuBar: true,
        title: 'Focus Bear - Sign In'
    });

    const { webRequest } = authWindow.webContents.session;
    const filter = { urls: ['http://localhost/callback*'] };

    webRequest.onBeforeRequest(filter, async (details, callback) => {
        console.log('[Auth] Intercepted callback:', details.url);

        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('auth-protocol-callback', details.url);
            mainWindow.show();
            mainWindow.focus();
        }

        if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
        }

        callback({ cancel: true });
    });

    authWindow.on('closed', () => {
        authWindow = null;
    });

    authWindow.loadURL(authUrl);
}

function handleAuthRedirect(url) {
    if (url.startsWith('focusbear://')) {
        console.log('Auth callback received:', url);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('auth-protocol-callback', url);
            mainWindow.show();
            mainWindow.focus();
        }

        if (authWindow && !authWindow.isDestroyed()) {
            authWindow.close();
        }
    }
}

//Webiew Handling
ipcMain.on('switch-webview', function(event, webViewId, metadata) {
    console.log(`[Main Process] switch-webview called for ${webViewId}`);
    console.log(`[Main Process] Metadata:`, {
        hasAccessToken: !!metadata?.access_token,
        hasClientId: !!metadata?.client_id,
        clientId: metadata?.client_id,
        hasUser: !!metadata?.user
    });

    const config = webViewConfigs[webViewId];
    if (!config) {
        console.error(`[Main Process] No config found for webViewId: ${webViewId}`);
        return;
    }

    const webView = createWebView({ ...config, mainWindow, metadata });
    const bounds = getWebviewContainerBounds();

    switch(webViewId) {
        case 'blocking_schedule':
            bounds.height = bounds.height * 0.46;
            break;
        case 'edit_habits':
            break;
    }
    switchToWebView(webViewId, mainWindow, bounds);
});

ipcMain.on('hide-all-webviews', function(event) {
    hideAllWebViews(mainWindow);
})

ipcMain.on('open-auth-window', function(event, url) {
    console.log('Opening auth window with URL:', url);
    openAuthWindow(url);
})


//FOR AUTH0 SETTINGS SYNCING

const getSettingsPath = () => {
  return join(app.getPath('userData'), 'settings.json');
};

ipcMain.handle('get-settings', async () => {
  try {
    const cloudSettings = await loadFromAuth0();
    if (cloudSettings) {
      console.log('Loaded settings from Auth0:', cloudSettings);
      saveLocalBackup(cloudSettings);
      return cloudSettings;
    }
  } catch (error) {
    console.log('Auth0 load failed, trying local fallback:', error.message);
  }

  try {
    const settingsPath = getSettingsPath();
    const data = await fs.readFile(settingsPath, 'utf8');
    const settings = JSON.parse(data);
    console.log('Loaded settings from local fallback:', settings);
    return settings;
  } catch (error) {
    console.log('No settings found, using defaults');
    return null;
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const settingsWithMeta = {
      ...settings,
      lastModified: new Date().toISOString(),
      version: '1.0.0'
    };

    try {
      await saveToAuth0(settingsWithMeta);
      console.log('Settings saved to Auth0');
    } catch (error) {
      console.error('Auth0 save failed, saving locally:', error.message);
    }

    await saveLocalBackup(settingsWithMeta);
    applySettings(settings);

    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: error.message };
  }
});

async function loadFromAuth0() {
  return new Promise((resolve, reject) => {
    mainWindow.webContents.send('auth0-get-settings');

    const timeout = setTimeout(() => {
      ipcMain.removeAllListeners('auth0-settings-response');
      reject(new Error('Timeout loading from Auth0'));
    }, 5000);

    ipcMain.once('auth0-settings-response', (event, result) => {
      clearTimeout(timeout);
      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error(result.error));
      }
    });
  });
}

async function saveToAuth0(settings) {
  return new Promise((resolve, reject) => {
    mainWindow.webContents.send('auth0-save-settings', settings);

    const timeout = setTimeout(() => {
      ipcMain.removeAllListeners('auth0-save-response');
      reject(new Error('Timeout saving to Auth0'));
    }, 10000);

    ipcMain.once('auth0-save-response', (event, result) => {
      clearTimeout(timeout);
      if (result.success) {
        resolve(result.data);
      } else {
        reject(new Error(result.error));
      }
    });
  });
}

async function saveLocalBackup(settings) {
  try {
    const settingsPath = getSettingsPath();
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    console.log('Local backup saved:', settingsPath);
  } catch (error) {
    console.error('Failed to save local backup:', error);
  }
}

function applySettings(settings) {
  if (settings.urlList) {
    console.log('Blocklist updated');
    broadcastBlocklistUpdate(settings.urlList);
  }

  if (settings.selectedBrowsers) {
    selectedBrowsers = settings.selectedBrowsers;
    console.log('Selected browsers updated:', selectedBrowsers);
  }

  console.log('Blocking mode:', settings.selectedBlockMode);
  console.log('Blocking method:', settings.selectedBlockMethod);
  console.log('Bear mode:', settings.selectedBearMode);
}
// END OF AUTH 0 SETTINGS SYNCING

ipcMain.handle('detect-distro', async function() {
  return new Promise((resolve) => {
    exec('cat /etc/os-release', (error, stdout, stderr) => {
      if (error) {
        resolve('unknown');
        return;
      }

      const output = stdout.toLowerCase();
      if (output.includes('ubuntu')) {
        resolve('ubuntu');
      } else if (output.includes('debian')) {
        resolve('debian');
      } else if (output.includes('fedora')) {
        resolve('fedora');
      } else if (output.includes('arch')) {
        resolve('arch');
      } else if (output.includes('mint')) {
        resolve('mint');
      } else {
        resolve('unknown');
      }
    });
  });
});

ipcMain.handle('cleanup-app-data', async function() {
  const details = [];
  let success = true;

  try {
    if (isFocusActive) {
      isFocusActive = false;
      focusState.setActive(false);
      details.push('Stopped active focus session');
    }

    try {
      await fs.unlink('/tmp/focusbear-blocklist.txt');
      details.push('Removed blocklist file');
    } catch (error) {
      console.log('Blocklist file not found or already removed');
    }

    try {
      await fs.unlink('/tmp/focusbear-keywords.txt');
      details.push('Removed keywords file');
    } catch (error) {
      console.log('Keywords file not found or already removed');
    }

    const settingsPath = getSettingsPath();
    try {
      await fs.unlink(settingsPath);
      details.push('Removed local settings backup');
    } catch (error) {
      console.log('Settings file not found or already removed');
    }

    return {
      success: true,
      message: 'Successfully cleaned up all Focus Bear data',
      details: details
    };

  } catch (error) {
    console.error('Cleanup failed:', error);
    return {
      success: false,
      message: 'Failed to clean up some data: ' + error.message,
      details: details
    };
  }
});
