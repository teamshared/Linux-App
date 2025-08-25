import { ipcMain } from 'electron';
import SimpleUrlGrabber from './simpleUrlGrabber.js';

class UrlHandler {
  constructor() {
    this.urlGrabber = new SimpleUrlGrabber();
    this.mainWindow = null;
    this.monitoringStop = null;
    this.setupIpcHandlers();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setupIpcHandlers() {
    ipcMain.handle('grab-current-url', async () => {
      try {
        const result = await this.urlGrabber.getCurrentUrl();
        return result;
      } catch (error) {
        console.error('Error in grab-current-url:', error);
        return null;
      }
    });

    ipcMain.handle('grab-all-urls', async () => {
      try {
        const results = await this.urlGrabber.getAllUrls();
        return results;
      } catch (error) {
        console.error('Error in grab-all-urls:', error);
        return [];
      }
    });

    ipcMain.on('start-url-monitoring', (event) => {
      if (this.monitoringStop) {
        return;
      }

      this.monitoringStop = this.urlGrabber.startMonitoring((data) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('url-grabbed', data);
        }
      }, 2000);

      console.log('URL monitoring started');
    });

    ipcMain.on('stop-url-monitoring', () => {
      if (this.monitoringStop) {
        this.monitoringStop();
        this.monitoringStop = null;
        console.log('URL monitoring stopped');
      }
    });
  }

  cleanup() {
    if (this.monitoringStop) {
      this.monitoringStop();
      this.monitoringStop = null;
    }

    ipcMain.removeHandler('grab-current-url');
    ipcMain.removeHandler('grab-all-urls');
    ipcMain.removeAllListeners('start-url-monitoring');
    ipcMain.removeAllListeners('stop-url-monitoring');
  }
}

export default UrlHandler;