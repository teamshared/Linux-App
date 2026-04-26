import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain, session } from "electron";
import {createTray, getTrayWindow} from "./tray-handler.js"
import { createWebView, switchToWebView, hideAllWebViews, webViewConfigs, resizeCurrentWebView, getCurrentActiveWebViewId } from './webview-handler.js';
import { exec, execFile, spawn } from 'child_process';
import "./Blocker.js"
import { setBroadcastFunction } from './Blocker.js';
import { focusState } from './focusState.js';
import SimpleUrlGrabber from './simpleUrlGrabber.js';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { createServer } from 'net';
import { unlink } from 'fs/promises';

dotenv.config();

// Unix domain socket server for native messaging
const SOCKET_PATH = '/tmp/focusbear.sock';
let socketServer = null;
let nativeHostClients = [];

async function startSocketServer() {
  // Remove existing socket file if it exists
  try {
    await unlink(SOCKET_PATH);
  } catch (error) {
    // Ignore if file doesn't exist
  }

  socketServer = createServer((socket) => {
    console.log('[Socket] Native host connected');
    nativeHostClients.push(socket);

    // Store the current blocklist for this client
    socket.currentBlocklist = [];

    socket.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());

      lines.forEach(line => {
        try {
          const message = JSON.parse(line);
          console.log('[Socket] Received from native host:', message.type);

          if (message.type === 'GET_BLOCKLIST') {
            // Send the current in-memory blocklist
            console.log(`[Socket] Sending blocklist: ${socket.currentBlocklist.length} entries`);
            socket.write(JSON.stringify({
              type: 'BLOCKLIST_RESPONSE',
              data: socket.currentBlocklist,
              timestamp: Date.now()
            }) + '\n');
          }
        } catch (error) {
          console.error('[Socket] Error parsing message:', error);
        }
      });
    });

    socket.on('close', () => {
      console.log('[Socket] Native host disconnected');
      nativeHostClients = nativeHostClients.filter(s => s !== socket);
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

// Broadcast blocklist update to all connected native hosts
function broadcastBlocklistUpdate(blocklist) {
  const message = JSON.stringify({
    type: 'BLOCKLIST_UPDATE',
    data: blocklist,
    timestamp: Date.now()
  }) + '\n';

  console.log(`[Socket] Broadcasting blocklist update to ${nativeHostClients.length} clients`);

  nativeHostClients.forEach(client => {
    try {
      // Update the stored blocklist for each client
      client.currentBlocklist = blocklist;
      client.write(message);
    } catch (error) {
      console.error('[Socket] Error broadcasting to client:', error);
    }
  });
}

// Install native messaging host on startup
async function installNativeMessaging() {
  const installerPath = join(__dirname, '../native-messaging/install.js');
  try {
    console.log('[Native Messaging] Installing native messaging host...');
    execFile('node', [installerPath], (error, stdout, stderr) => {
      if (error) {
        console.error('[Native Messaging] Installation failed:', error.message);
      } else {
        console.log('[Native Messaging] Installation output:', stdout);
      }
    });
  } catch (error) {
    console.error('[Native Messaging] Failed to run installer:', error);
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
let mitmproxyProcess = null;

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
      mainWindow.focus();
    }
  });
}

app.on("ready", function(){
    // Start socket server for native messaging
    startSocketServer();

    // Set up broadcast function for Blocker.js
    setBroadcastFunction(broadcastBlocklistUpdate);

    // Install native messaging host
    installNativeMessaging();

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
        devTools: true,
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

ipcMain.on('quit-channel', function() {
    exitflag = true
    app.quit();
});

ipcMain.on('focus-session-true', function(event) {
    if (isFocusActive) {
        event.sender.send('focus-session-result', 'Focus session already active');
        return;
    }

    startMitmproxyBlocker((error, result) => {
        if (!error) {
            isFocusActive = true;
            focusState.setActive(true);
            broadcastFocusState(true);
            console.log('Focus session started with mitmproxy');
        }

        try {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('focus-session-result', error ? `Error: ${result}` : result);
            }
        } catch (e) {
            console.log('Could not send result to original sender (window destroyed)');
        }
    });

    //Uncomment if using hosts file method
    /*
    // Hosts file blocking is deprecated in favor of native messaging
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const command = `pkexec node "${scriptPath}" block`;

    console.log(`Starting focus session (deprecated): ${command}`);

    exec(command, (error, stdout, stderr) => {
        if (!error) {
            isFocusActive = true;
            focusState.setActive(true)
            broadcastFocusState(true);
            console.log('Focus session started with hosts file');
        }
        const result = error ? `Error: ${stderr || error.message}` : stdout;
        try {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('focus-session-result', result);
            }
        } catch (e) {
            console.log('Could not send result to original sender (window destroyed)');
        }
    });
    */
});

ipcMain.on('focus-session-false', function(event) {
    if (!isFocusActive) {
        event.sender.send('focus-session-result', 'Focus session already inactive');
        return;
    }

    // Stop mitmproxy blocker
    stopMitmproxyBlocker();
    isFocusActive = false;
    focusState.setActive(false);
    broadcastFocusState(false);
    console.log('Focus session ended');

    try {
        if (event.sender && !event.sender.isDestroyed()) {
            event.sender.send('focus-session-result', 'Focus session stopped');
        }
    } catch (e) {
        console.log('Could not send result to original sender (window destroyed)');
    }

    // Uncomment if using hosts file method
    /*
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const command = `pkexec node "${scriptPath}" unblock`;

    console.log(`Ending focus session: ${command}`);

    exec(command, (error, stdout, stderr) => {
        if (!error) {
            isFocusActive = false;
            focusState.setActive(false);
            broadcastFocusState(false);
            console.log('Focus session ended');
        }

        const result = error ? `Error: ${stderr || error.message}` : stdout;

        try {
            if (event.sender && !event.sender.isDestroyed()) {
                event.sender.send('focus-session-result', result);
            }
        } catch (e) {
            console.log('Could not send result to original sender (window destroyed)');
        }
    });
    */
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
    stopMitmproxyBlocker();

    // Close socket server
    if (socketServer) {
        socketServer.close();
        nativeHostClients.forEach(client => client.end());
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

// SYSTEM PROXY FUNCTIONS
function setSystemProxy(host, port, callback) {
    const scriptPath = app.isPackaged
        ? join(process.resourcesPath, 'python', 'set_system_proxy.py')
        : join(__dirname, '../python/set_system_proxy.py');
    execFile('python3', [scriptPath, 'set', host, port], (err, stdout, stderr) => {
        if (err) {
            console.error('Proxy set error:', stderr);
            if (callback) callback(err, stderr);
        } else {
            console.log('Proxy set:', stdout);
            if (callback) callback(null, stdout);
        }
    });
}

function unsetSystemProxy(callback) {
    const scriptPath = app.isPackaged
        ? join(process.resourcesPath, 'python', 'set_system_proxy.py')
        : join(__dirname, '../python/set_system_proxy.py');
    execFile('python3', [scriptPath, 'unset'], (err, stdout, stderr) => {
        if (err) {
            console.error('Proxy unset error:', stderr);
            if (callback) callback(err, stderr);
        } else {
            console.log('Proxy unset:', stdout);
            if (callback) callback(null, stdout);
        }
    });
}

// MITMPROXY BLOCKING FUNCTIONS
function checkCertificateExists(callback) {
    const certPath = join(app.getPath('home'), '.mitmproxy', 'mitmproxy-ca-cert.pem');
    fs.access(certPath)
        .then(() => callback(true))
        .catch(() => callback(false));
}

function startMitmproxyBlocker(callback) {
    const scriptPath = app.isPackaged
        ? join(process.resourcesPath, 'python', 'mitmproxy_blocker.py')
        : join(__dirname, '../python/mitmproxy_blocker.py');
    const proxyHost = '127.0.0.1';
    const proxyPort = 8080;

    setSystemProxy(proxyHost, proxyPort, (err, result) => {
        if (err) {
            callback(err, 'Failed to set system proxy');
            return;
        }

        console.log('Starting mitmproxy blocker...');

        mitmproxyProcess = spawn('mitmdump', [
            '-s', scriptPath,
            '--set', 'block_global=false'
        ]);

        mitmproxyProcess.stdout.on('data', (data) => {
            console.log(`mitmproxy: ${data}`);
        });

        mitmproxyProcess.stderr.on('data', (data) => {
            console.error(`mitmproxy error: ${data}`);
        });

        mitmproxyProcess.on('close', (code) => {
            console.log(`mitmproxy process exited with code ${code}`);
            mitmproxyProcess = null;
            isFocusActive = false;
        });

        mitmproxyProcess.on('error', (error) => {
            console.error('Failed to start mitmproxy:', error);
            callback(error, `Failed to start mitmproxy: ${error.message}`);
            return;
        });

        setTimeout(() => {
            callback(null, 'mitmproxy blocker started');
        }, 1000);
    });
}

function stopMitmproxyBlocker() {
    let proxyUnsetAttempted = false; // Flag to ensure proxy is unset only once

    // 1. Stop mitmproxy
    if (mitmproxyProcess) {
        console.log('Stopping mitmproxy blocker...');

        // Use an event listener to run unset AFTER mitmproxy closes,
        // OR run it immediately if mitmproxy fails to stop.

        const cleanupAndUnset = () => {
            if (!proxyUnsetAttempted) {
                proxyUnsetAttempted = true;
                unsetSystemProxy((err, result) => {
                    if (err) {
                        console.error('Failed to unset system proxy:', result);
                    } else {
                        console.log('System proxy unset:', result);
                    }
                });
            }
        };

        // Ensure cleanup happens when the process ends (success or failure)
        mitmproxyProcess.once('close', cleanupAndUnset);
        mitmproxyProcess.once('error', cleanupAndUnset);

        // Send kill signal (SIGTERM is preferred for graceful shutdown)
        mitmproxyProcess.kill('SIGTERM');
        mitmproxyProcess = null;

    } else {
        // 2. If mitmproxy wasn't running, still try to unset the proxy just in case.
        console.log('mitmproxy not running. Attempting proxy cleanup...');
        unsetSystemProxy((err, result) => {
            if (err) {
                console.error('Failed to unset system proxy:', result);
            } else {
                console.log('System proxy unset:', result);
            }
        });
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

ipcMain.handle('check-certificate-exists', async function() {
    return new Promise((resolve) => {
        checkCertificateExists((exists) => {
            resolve(exists);
        });
    });
})

ipcMain.handle('get-certificate-path', async function() {
    return join(app.getPath('home'), '.mitmproxy', 'mitmproxy-ca-cert.pem');
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
    // Broadcast to native hosts
    broadcastBlocklistUpdate(settings.urlList);
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
      await stopMitmproxyBlocker();
      details.push('Stopped active focus session');
    }

    const pythonScriptPath = app.isPackaged
      ? join(process.resourcesPath, 'python', 'set_system_proxy.py')
      : join(app.getAppPath(), 'src', 'python', 'set_system_proxy.py');

    await new Promise((resolve) => {
      exec(`python3 "${pythonScriptPath}" unset`, (error) => {
        if (error) {
          console.error('Failed to unset proxy:', error);
        }
        details.push('Reset system proxy settings');
        resolve();
      });
    });

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

    const homeDir = app.getPath('home');
    const proxyEnvPath = join(homeDir, '.focus_proxy_env');
    try {
      await fs.unlink(proxyEnvPath);
      details.push('Removed proxy environment file');
    } catch (error) {
      console.log('Proxy env file not found or already removed');
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
