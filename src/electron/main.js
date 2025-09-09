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

ipcMain.on('focus-session-true' ,  function(e){
    console.log(`Focus SESSION IS true (line 116, main.js)`)
})
ipcMain.on('focus-session-false' ,  function(e){
    console.log(`Focus SESSION IS false (line 119, main.js)`)
})

//PRINTING THE URLS
ipcMain.on('print-urls', function(event, urls) {
    console.log('URLs received for printing:\n', urls);
});

app.on('window-all-closed', function() {
    if (exitflag) {
    }
    else{
        return
    }
});

app.on('before-quit', function() {
    urlHandler.cleanup();
})

app.on('will-quit', function() {
    exitflag = false;
});






