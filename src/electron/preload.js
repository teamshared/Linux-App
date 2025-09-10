const { contextBridge, ipcRenderer } = require('electron');

const API = {
    exportList: function(urls){return ipcRenderer.send("url-channel", urls)},

    onReply: function(callback) {
        ipcRenderer.on('reply-message', function (event, message) {
        callback(message);})
    },

    showWebView: function(id, tab) { return ipcRenderer.send('show-webview', id, tab); },
    hideWebView: function(id) { return ipcRenderer.send('hide-webview', id); },
    updateWebviewBounds: function(id, tab) { return ipcRenderer.send('update-webview-bounds', id, tab); },

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
}

contextBridge.exposeInMainWorld('api', API);