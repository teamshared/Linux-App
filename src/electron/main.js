import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow } from "electron";
import { Menu, Tray } from 'electron'
import {createTray} from "./system-tray.js"

import './Blocker.js'  // or

let tray = null
app.whenReady().then(() => {

})


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