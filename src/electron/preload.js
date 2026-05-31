const { contextBridge, ipcRenderer } = require('electron');

const API = {
    exportList: function(urls){return ipcRenderer.send("url-channel", urls)},

    // Export to keywords file
    exportKeywords: function(urls){
        return ipcRenderer.send("keywords-channel", urls)
    },

    onReply: function(callback) {
        ipcRenderer.on('reply-message', function (event, message) {
        callback(message);})
    },


    hideAllViews: function() {return ipcRenderer.send('hide-all-webview')},
    // updateWebviewBounds: function(id, tab) { return ipcRenderer.send('update-webview-bounds', id, tab); },

    showPreferences: function() { return ipcRenderer.send('show-preferences'); },

    showQuitDialog: function() {ipcRenderer.send("quit-channel")},

    instantBlock: function() {ipcRenderer.send("instant-block")},

    printList: function(urls) {ipcRenderer.send("print-urls", urls)},

    grabCurrentUrl: function() {
        return ipcRenderer.invoke('grab-current-url');
    },

    grabAllUrls: function() {
        return ipcRenderer.invoke('grab-all-urls');
    },

    startMonitoring: function() {
        return ipcRenderer.send('start-url-monitoring');
    },

    stopMonitoring: function() {
        return ipcRenderer.send('stop-url-monitoring');
    },

    onUrlGrabbed: function(callback) {
        ipcRenderer.on('url-grabbed', function (event, data) {
            callback(data);
        });
    },

    //Webview Management
    switchWebView: function(id, metadata) {
        return ipcRenderer.send('switch-webview', id, metadata);
    },

    hideAllWebViews: function() {
        return ipcRenderer.send('hide-all-webviews');
    },
    //
    
    onFocusSessionResult: function(callback) {
        ipcRenderer.on('focus-session-result', function (event, message) {
            callback(message);
        });
    },

    onFocusStateChanged: function(callback) {
      ipcRenderer.on('focus-state-changed', function(event, isActive) {
          callback(isActive);
      });
    },

    //For Focus Session
    toggleFocusSession: function(flag) {
      if (flag){return ipcRenderer.send("focus-session-true")}
      else {return ipcRenderer.send("focus-session-false")}
    },

    //for url monitoring
    onUrlChanged: function(callback) {
        ipcRenderer.on('url-changed', function(event, data) {
            callback(data);
        });
    },


    // Auth0 protocol callback listener
    onAuthProtocolCallback: function(callback) {
        ipcRenderer.removeAllListeners('auth-protocol-callback');

        const handler = function(event, url) {
            console.log("=== PRELOAD RECEIVED CALLBACK ===");
            console.log("URL:", url);
            callback(url);
            console.log("preload called")
        };

        ipcRenderer.on('auth-protocol-callback', handler);

        return () => {
            ipcRenderer.removeListener('auth-protocol-callback', handler);
        };
    },
    
    getSettings: function() {
        return ipcRenderer.invoke('get-settings');
    },

    saveSettings: function(settings) {
        return ipcRenderer.invoke('save-settings', settings);
    },

    onAuth0GetSettings: function(callback) {
        ipcRenderer.on('auth0-get-settings', callback);
    },

    onAuth0SaveSettings: function(callback) {
        ipcRenderer.on('auth0-save-settings', (event, settings) => {
            callback(settings);
        });
    },

    sendAuth0SettingsResponse: function(result) {
        ipcRenderer.send('auth0-settings-response', result);
    },

    sendAuth0SaveResponse: function(result) {
        ipcRenderer.send('auth0-save-response', result);
    },

    openAuthWindow: function(url) {
        return ipcRenderer.send('open-auth-window', url);
    },

    checkCertificateExists: function() {
        return ipcRenderer.invoke('check-certificate-exists');
    },

    getCertificatePath: function() {
        return ipcRenderer.invoke('get-certificate-path');
    },

    detectDistro: function() {
        return ipcRenderer.invoke('detect-distro');
    },

    cleanupAppData: function() {
        return ipcRenderer.invoke('cleanup-app-data');
    },

    // App update notifications
    checkForUpdates: function() {
        return ipcRenderer.invoke('check-for-updates');
    },

    getLastUpdateStatus: function() {
        return ipcRenderer.invoke('get-last-update-status');
    },

    onUpdateStatus: function(callback) {
        const handler = function(event, status) { callback(status); };
        ipcRenderer.on('update-status', handler);
        return () => ipcRenderer.removeListener('update-status', handler);
    },

    openUpdateDownload: function(url) {
        return ipcRenderer.send('open-update-download', url);
    }
    // Returns string[] of currently connected browser ids (e.g. ['firefox'])
    getExtensionConnected: function() {
        return ipcRenderer.invoke('get-extension-connected');
    },

    notifySetupComplete: function() {
        ipcRenderer.send('setup-complete');
    },

    getLocalSettings: function() {
        return ipcRenderer.invoke('get-local-settings');
    },

    // callback(browserId: string) fires each time a new browser's extension connects
    onExtensionConnected: function(callback) {
        const handler = function(event, browserId) { callback(browserId); };
        ipcRenderer.on('extension-connected', handler);
        return () => ipcRenderer.removeListener('extension-connected', handler);
    },

}

contextBridge.exposeInMainWorld('api', API);