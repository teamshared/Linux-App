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
    switchWebView: function(id) {
        return ipcRenderer.send('switch-webview', id);
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
        ipcRenderer.on('auth-protocol-callback', function(event, url) {
            console.log("=== PRELOAD RECEIVED CALLBACK ===");
            console.log("URL:", url);
            callback(url);
            console.log("preload called")
        });
    },
    
    //  settings sync
    getSettings: function() {
        return ipcRenderer.invoke('get-settings');
    },

    saveSettings: function(settings) {
        return ipcRenderer.invoke('save-settings', settings);
    },

    // Auth0 communication handlers for main process
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
    }
    

}

contextBridge.exposeInMainWorld('api', API);