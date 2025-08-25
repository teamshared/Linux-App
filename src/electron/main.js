import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain } from "electron";
import { Menu, Tray } from 'electron'
import {createTray} from "./system-tray.js"
import createWindow from './load-webview.js';

import './Blocker.js'  // or

let tray = null
// app.whenReady().then(() => {

// })




app.on("ready", ()=>{

    tray = createTray()

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
});




 

// This is the listener for your "Show Settings" button.
// It must be placed here, after the app is ready.
ipcMain.on('show-settings', function() {
    console.log("Received 'show-settings' message. Opening settings window.");
    
    // Create a new window for the settings page.
    createWindow("https://dashboard.focusbear.io/");

    // Load the external Focus Bear website.
});

// Handle macOS-specific behavior.

