import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, Menu, Tray, BrowserWindow, screen } from 'electron'




let trayWindow;

// Load the popup HTML


// Hide window when it loses focus



function showWindow(){
    const primaryDisplay = screen.getPrimaryDisplay()
    const {width, height} = primaryDisplay.workAreaSize
    trayWindow = new BrowserWindow({
        width: 300,
        height: 400,
        show: false,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
    });

    trayWindow.on('blur', function() {
    if (!trayWindow.webContents.isDevToolsOpened()) {
        trayWindow.destroy()
    }
    });

    trayWindow.loadFile('system-tray.jsx');
}


function createTray(){
    let tray = new Tray((join(app.getAppPath(), "./public/bear-icon.png" )))
    

    const contextMenu = Menu.buildFromTemplate([
    { label: 'Item1', type: 'radio' },
    { label: 'Item2', type: 'radio' },
    { label: 'Item3', type: 'radio', checked: true },
    { label: 'Item4', type: 'radio' }
    ])
    tray.setToolTip('Focus Bear')
    tray.setContextMenu(contextMenu)

    tray.on('click', function (event, bounds) {
        const { x, y } = bounds;
        
        if (trayWindow.isVisible()) {
            trayWindow.destroy()

        } 
        else {
            showWindow();
        }
    });

    return tray
}

export {createTray}

