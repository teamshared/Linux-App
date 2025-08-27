import { BrowserWindow, session} from 'electron';


function createWindow(url) {
  const dashboardSession = session.fromPartition('persist:dashboard');


  const externalWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      session: dashboardSession,
      nodeIntegration: false, 
      contextIsolation: true,
      enableRemoteModule: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      autoHideMenuBar: true,

    }
  });

  externalWindow.loadURL(url);
  
  externalWindow.webContents.on('will-navigate', function (event, navigationUrl) {
    if (!navigationUrl.startsWith(url)) {
      event.preventDefault();
    }
  });

  return externalWindow;
}

export default createWindow;
