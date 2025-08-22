const { BrowserWindow, app } = require('electron');


function createExternalUIWindow(url) {
  const externalWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, 
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  externalWindow.loadURL(url);
  
  externalWindow.webContents.on('will-navigate', function (event, navigationUrl) {
    if (!navigationUrl.startsWith('https://dashboard.focusbear.io/settings')) {
      event.preventDefault();
    }
  });

  return externalWindow;
}