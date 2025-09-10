import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain} from "electron";
import {createTray, getTrayWindow} from "./tray-handler.js"
import { createWebView, showWebView, hideWebView, webViewConfigs } from './webview-handler.js';
import UrlHandler from './urlHandler.js';
import { exec } from 'child_process';

import "./Blocker.js"
import { focusState } from './focusState.js';
import SimpleUrlGrabber from './simpleUrlGrabber.js';


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

app.on("ready", function(){
    mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 850,
        width: 1000,
        show: false,
        webviewTag: true,
        webPreferences: {
            preload: join(app.getAppPath(), "/src/electron/preload.js")
        },
        devTools: true,
    });
    tray = createTray(mainWindow)
    
    mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'))

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
            
            mainWindow.webContents.executeJavaScript(`
                window.location.hash = '#preferences';
            `);
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





