import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain } from "electron";
import UrlHandler from './urlHandler.js';
import { exec } from 'child_process';
import { spawn } from 'child_process';

import './Blocker.js'  // or
let urlHandler;

app.on("ready", ()=>{
    const mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 850,
        width: 1000,
        webPreferences: {
            preload: join(app.getAppPath(), "/src/electron/preload.js")
        },
        devTools: true,
    });
    mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'))
    mainWindow.on("ready-to-show", mainWindow.show)

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