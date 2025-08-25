// urlHandler.js
import { ipcMain } from 'electron';
import BrowserUrlGrabber from './browserUrlGrabber.js';

class UrlHandler {
  constructor() {
    this.grabber = new BrowserUrlGrabber();
    this.mainWindow = null;
    this.monitoringStop = null;
    this.setupIpcHandlers();
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  setupIpcHandlers() {
    // Handle single URL grab request
    ipcMain.handle('grab-current-url', async () => {
      try {
        const result = await this.grabber.getActiveUrl();
        return result;
      } catch (error) {
        console.error('Error in grab-current-url:', error);
        return null;
      }
    });

    // Handle all URLs grab request
    ipcMain.handle('grab-all-urls', async () => {
      try {
        const results = await this.grabber.getAllBrowserUrls();
        return results;
      } catch (error) {
        console.error('Error in grab-all-urls:', error);
        return [];
      }
    });

    // Start monitoring for URL changes
    ipcMain.on('start-url-monitoring', (event) => {
      if (this.monitoringStop) {
        // Already monitoring
        return;
      }

      this.monitoringStop = this.grabber.startMonitoring((data) => {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send('url-grabbed', data);
        }
      }, 1000); // Check every second

      console.log('URL monitoring started');
    });

    // Stop monitoring
    ipcMain.on('stop-url-monitoring', () => {
      if (this.monitoringStop) {
        this.monitoringStop();
        this.monitoringStop = null;
        console.log('URL monitoring stopped');
      }
    });
  }

  cleanup() {
    // Stop monitoring if active
    if (this.monitoringStop) {
      this.monitoringStop();
      this.monitoringStop = null;
    }

    // Cleanup D-Bus connection
    if (this.grabber) {
      this.grabber.cleanup();
    }

    // Remove IPC handlers
    ipcMain.removeHandler('grab-current-url');
    ipcMain.removeHandler('grab-all-urls');
    ipcMain.removeAllListeners('start-url-monitoring');
    ipcMain.removeAllListeners('stop-url-monitoring');
  }
}

export default UrlHandler;