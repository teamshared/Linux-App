import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain, WebContentsView, session } from "electron";
import { Menu, Tray } from 'electron'
import {createTray} from "./tray-handler.js"

import './Blocker.js' 

let tray = null
let focusBearView = null
let mainWindow = null;
let exitflag = false;

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

    // Handle window resize to reposition the webview
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

    ipcMain.on('show-focus-bear-view', function (){
        if (!focusBearView) {
            focusBearView = new WebContentsView({
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    session: session.fromPartition('persist:dashboard')
                }
            });

            focusBearView.webContents.loadURL('https://dashboard.focusbear.io/settings#timing');
            
            // Wait longer and try multiple times
            focusBearView.webContents.once('dom-ready', () => {
                setTimeout(() => {
                    // Less aggressive CSS - just hide navigation first
                    focusBearView.webContents.insertCSS(`
                        /* Hide only navigation elements first */
                      
                       
                        nav, header, .nav, .header, .sidebar, .div.section {
                            display: none !important;
                        }

                        /* Hide footer content */
                        [data-testid*="footer-website-link"], [data-testid*="footer-logo"], [data-testid*="footer-terms-link"],
                        [data-testid*="footer-privacy-link"], .container, [aria-label*="Chat Widget"]
                        {
                            display: none !important;
                        }

                        /* Make content fill the container */
                        body {
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    `);
                }, 2000);
                
                // Wait longer for React to render, then target timing content
                setTimeout(() => {
                    focusBearView.webContents.insertCSS(`
                        /* Show only the active tab panel */
                        [data-testid*="settings-tabs-container"] {
                            display: block !important;
                        }
                    `);
                }, 3000); // Wait 3 seconds for React to fully load
            });
        }
        
        // Add the view as a child
        mainWindow.contentView.addChildView(focusBearView);
        
        // Position it inside the webview container
        const containerBounds = getWebviewContainerBounds();
        focusBearView.setBounds(containerBounds);
    });

    ipcMain.on('hide-focus-bear-view', function() {
        if (focusBearView && mainWindow.contentView) {
            mainWindow.contentView.removeChildView(focusBearView);
        }
    });

    // New IPC handler for updating webview bounds when React component mounts/unmounts
    ipcMain.on('update-webview-bounds', function(event, tabName) {
        if (focusBearView && mainWindow.contentView) {
            if (tabName === 'Blocks') {
                // Show and position the webview
                const containerBounds = getWebviewContainerBounds();
                focusBearView.setBounds(containerBounds);
                
                // Make sure it's visible
                if (!mainWindow.contentView.children.includes(focusBearView)) {
                    mainWindow.contentView.addChildView(focusBearView);
                }
            } else {
                // Hide the webview for other tabs
                if (mainWindow.contentView.children.includes(focusBearView)) {
                    mainWindow.contentView.removeChildView(focusBearView);
                }
            }
        }
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

app.on('window-all-closed', function() {
    if (exitflag) {
    }
    else{
        return
    }
});


app.on('will-quit', function() {
    exitflag = false;
});





