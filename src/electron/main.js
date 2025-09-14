import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain} from "electron";
import {createTray, getTrayWindow} from "./tray-handler.js"
import { createWebView, showWebView, hideWebView, webViewConfigs } from './webview-handler.js';
import { exec } from 'child_process';
import { spawn } from 'child_process';

import "./Blocker.js"
import { focusState } from './focusState.js';
import SimpleUrlGrabber from './simpleUrlGrabber.js';

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();


let tray = null
let focusBearView = null
let mainWindow = null;
let exitflag = false;
const urlGrabber = new SimpleUrlGrabber();


function getWebviewContainerBounds() {
    const bounds = mainWindow.getBounds();
    const padding = 20;
    const topOffset = 140; // Account for navigation bars
    
    return {
        x: padding,
        y: topOffset,
        width: bounds.width - (padding * 2),
        height: bounds.height - topOffset - padding
    };
}
let urlHandler;


//SINGLE INSTANCING FOR Auth0
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window instead
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // Check if launched with protocol URL
      const protocolUrl = commandLine.find(arg => arg.startsWith('focusbear://'));
      if (protocolUrl) {
        mainWindow.webContents.send('auth-protocol-callback', protocolUrl);
      }
    }
  });
}


app.on("ready", function(){
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 850,
        width: 1000,
        show: false,
        webviewTag: true,
        webPreferences: {
            preload: join(app.getAppPath(), "/src/electron/preload.js"),
            webSecurity: false,
        },
        devTools: true,
    });
    tray = createTray(mainWindow)
        const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'));
    }
   // mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html')) //UNCOMMENT FOR PRODUCTION
   // mainWindow.loadFile(join(app.getAppPath(), 'http://localhost:5173')) //FOR DEVELOPMENT

<<<<<<< HEAD
    mainWindow.on('resize', () => {
        if (focusBearView && mainWindow.contentView) {
            const containerBounds = getWebviewContainerBounds();
            focusBearView.setBounds(containerBounds);
        }
    });

    mainWindow.on('close', function(event) {

        if (exitflag){
            return 
        }
        event.preventDefault(); 
        mainWindow.hide();      
        
    });

    ipcMain.on('show-webview', function(event, webViewId, tabName) {
        const config = webViewConfigs[webViewId];
        if (!config) return;

        const webView = createWebView({ ...config, mainWindow });
        const bounds = getWebviewContainerBounds();
        switch(tabName){
            case "Blocking Schedule":
                bounds.height = bounds.height * 0.46  //reduce the height of the webview window to 56%
            case "Edit Habits":
                break;
            case "Motivation":
                break;
            default:
                break;
        }
        
        
        showWebView(webViewId, mainWindow, bounds);
    });



        // Add this to allow Auth0 navigation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        // Allow Auth0 URLs to open in the same window
        if (url.includes('auth0.com')) {
            mainWindow.loadURL(url);
            return { action: 'deny' };
        }
        return { action: 'deny' };
    });


    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        console.log('Navigation attempt to:', navigationUrl);
        
        // Allow Auth0 URLs but prevent ones with fragments that could cause issues
        if (navigationUrl.includes('auth0.com')) {
            return; // Allow all Auth0 navigation
        }
        if (navigationUrl.startsWith('file://')) {
            return;
        }
    
        event.preventDefault();
    }
    );

    ipcMain.on('hide-webview', function(event, webViewId) {
        hideWebView(webViewId, mainWindow);
    });

    ipcMain.on('update-webview-bounds', function(event, webViewId, tabName) {
        const bounds = getWebviewContainerBounds();
        showWebView(webViewId, mainWindow, bounds);
    });



    ipcMain.on('show-preferences', function() {
        if (mainWindow) {
            // Resize to preferences size
            mainWindow.setSize(1000, 850);
            mainWindow.center(); // Center on screen after resize
            mainWindow.show();
            mainWindow.focus();
            
            // mainWindow.webContents.executeJavaScript(`
            //     window.location.hash = '#preferences';
            // `);
        }
    });
});


ipcMain.on('quit-channel', function() {
    exitflag = true
    app.quit();
        
});

let isFocusActive = false; // Make sure this is initialized

ipcMain.on('focus-session-true', function(event) {
    if (isFocusActive) {
        // Already active, no need to do anything
        event.sender.send('focus-session-result', 'Focus session already active');
        return;
    }
    
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const blocklistPath = '/tmp/focusbear-blocklist.txt';
    const command = `pkexec node "${scriptPath}" block --list "${blocklistPath}"`;
    
    console.log(`Starting focus session: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (!error) {
            focusState.setActive(true)
            broadcastFocusState(true);
            console.log('Focus session started successfully');
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
});

const stopMonitoring = urlGrabber.startRealtimeMonitoring((data) => {
    // Send to renderer process
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('url-changed', data);
    }
}, 250);

ipcMain.on('focus-session-false', function(event) {
    if (!focusState.isActive()) {
        event.sender.send('focus-session-result', 'Focus session already inactive');
        return;
    }
    
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const command = `pkexec node "${scriptPath}" unblock`;
    
    console.log(`Ending focus session: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
        if (!error) {
            focusState.setActive(false);
            broadcastFocusState(false);
            console.log('Focus session ended successfully');
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
});

//PRINTING THE URLS
ipcMain.on('print-urls', function(event, urls) {
    console.log('URLs received for printing:\n', urls);
});

//SAVING URLS TO FILE
ipcMain.on('url-channel', function(e, urls){
    
})

app.on('window-all-closed', function() {
    if (exitflag) {
    }
    else{
        return
    }
});

app.on('before-quit', function() {
    // urlHandler.cleanup();
    //Commented out to prevent issue 
    stopMonitoring()
})

app.on('will-quit', function() {
    exitflag = false;
});


//to tell the tray.js about the changes in the focus state
function broadcastFocusState(isActive) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('focus-state-changed', isActive);
    }
    
    // Get tray window from tray-handler
    const trayWindow = getTrayWindow();
    if (trayWindow && !trayWindow.isDestroyed()) {
        trayWindow.webContents.send('focus-state-changed', isActive);
    }
}

//AUTH 0 CUSTOM PROTOCOL
app.setAsDefaultProtocolClient('focusbear');

<<<<<<< HEAD



=======
    urlHandler = new UrlHandler();
    urlHandler.setMainWindow(mainWindow);
});

let isFocusActive = false;
let mitmproxyProcess = null;

ipcMain.on('start-focus-session', (event) => {
    if (isFocusActive) {
        // Stop mitmproxy blocker
        stopMitmproxyBlocker();
        isFocusActive = false;
        event.sender.send('focus-session-result', 'Focus session stopped');
    } else {
        // Start mitmproxy blocker
        startMitmproxyBlocker((error, result) => {
            if (!error) {
                isFocusActive = true;
                event.sender.send('focus-session-result', 'Focus session started');
            } else {
                event.sender.send('focus-session-result', `Error: ${result}`);
            }
        });
    }
});

// Function to start mitmproxy blocker
function startMitmproxyBlocker(callback) {
    const scriptPath = join(__dirname, '../python/mitmproxy_blocker.py');
    
    console.log('Starting mitmproxy blocker...');
    
    // Start mitmdump with the blocker script
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
        callback(error, error.message);
        return;
    });

    // Give mitmproxy a moment to start
    setTimeout(() => {
        callback(null, 'mitmproxy blocker started');
    }, 1000);
}

// Function to stop mitmproxy blocker
function stopMitmproxyBlocker() {
    if (mitmproxyProcess) {
        console.log('Stopping mitmproxy blocker...');
        mitmproxyProcess.kill('SIGTERM');
        mitmproxyProcess = null;
    }
}

app.on('before-quit', () => {
    // Clean up mitmproxy process on app exit
    stopMitmproxyBlocker();
});
>>>>>>> 59b83135d1612d7a8d9ae82872c7a8690a5a415f
=======
// Handle protocol callback
app.on('open-url', (event, url) => {
  event.preventDefault();
console.log('=== MAIN PROCESS RECEIVED PROTOCOL URL ===');
  console.log('URL:', url);
  // Forward to renderer
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('Sending to renderer process...');
    mainWindow.webContents.send('auth-protocol-callback', url);
  } else {
    console.log('Main window not available!');
  }
});
>>>>>>> develop/user-interface
