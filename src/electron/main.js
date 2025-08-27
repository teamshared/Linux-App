import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain } from "electron";
import { Menu, Tray } from 'electron'
import {createTray} from "./system-tray.js"
import createWindow from './load-webview.js';

import './Blocker.js' 

let tray = null




app.on("ready", function(){

    tray = createTray()

    const mainWindow = new BrowserWindow({
        autoHideMenuBar: true,
        height: 850,
        width: 1000,
        webviewTag: true,
        webPreferences: {
            preload: join(app.getAppPath(), "/src/electron/preload.js")
        },
        devTools: true,
    });
    mainWindow.loadFile(join(app.getAppPath(), '/dist-react/index.html'))
    mainWindow.on("ready-to-show", mainWindow.show)
});




 


ipcMain.on('show-settings', function() {
    console.log("Received 'show-settings' message. Opening settings window.");
    

    createWindow("https://dashboard.focusbear.io/");

 
});


