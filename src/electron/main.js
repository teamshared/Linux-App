import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain } from "electron";
import UrlHandler from './urlHandler.js';
import { exec } from 'child_process';

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

ipcMain.on('start-focus-session', (event) => {
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const blocklistPath = '/tmp/focusbear-blocklist.txt';
    // Decide whether to block or unblock based on the current state
    const command = isFocusActive
        ? `pkexec node "${scriptPath}" unblock`
        : `pkexec node "${scriptPath}" block --list "${blocklistPath}"`;

    console.log(`Executing command: ${command}`);

    exec(command, (error, stdout, stderr) => {
        if (!error) {
            isFocusActive = !isFocusActive;
        }
        const result = error ? `Error: ${stderr || error.message}` : stdout;
        event.sender.send('focus-session-result', result);
    });
});

app.on('before-quit', () => {
    urlHandler.cleanup();
});