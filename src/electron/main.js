import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain } from "electron";
import { exec } from 'child_process';

import './Blocker.js'  // or

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
});

// Global variable to keep track of whether a focus session is currently active
let isFocusActive = false;

// IPC handler for Start/Stop Focus Session
// Listens for messages from the renderer process when the user clicks the "Start/Stop Focus Session" button
ipcMain.on('start-focus-session', (event) => {
    // Path to the blocking script and the blocklist file exported from the GUI
    const scriptPath = join(__dirname, 'focusbear_hosts_blocker.cjs');
    const blocklistPath = '/tmp/focusbear-blocklist.txt';
    // Decide whether to block or unblock based on the current state
    const command = isFocusActive
        ? `pkexec node "${scriptPath}" unblock`
        : `pkexec node "${scriptPath}" block --list "${blocklistPath}"`;

    // Log the command being executed for debugging purposes
    console.log(`Executing command: ${command}`);

    // Execute the blocking/unblocking script as a child process
    exec(command, (error, stdout, stderr) => {
        if (!error) {
            // Toggle the state only if the command executed successfully
            isFocusActive = !isFocusActive;
        }
        // Prepare output message (either success or error)
        const result = error ? `Error: ${stderr || error.message}` : stdout;
        // Send the result back to the renderer process so it can update the UI
        event.sender.send('focus-session-result', result);
    });
});