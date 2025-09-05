const { contextBridge, ipcRenderer, app } = require('electron');


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


    //For Focus Session
    toggleFocusSession: function(flag) {
      if (flag){return ipcRenderer.send("focus-session-true")}
      else {return ipcRenderer.send("focus-session-false")}

    }
  }
contextBridge.exposeInMainWorld('api', API);