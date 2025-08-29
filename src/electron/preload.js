const { contextBridge, ipcRenderer } = require('electron');


const API = {

    exportList: function(urls){return ipcRenderer.send("url-channel", urls)},
    showSettingsWindow: function(){return ipcRenderer.send("show-settings");},

    onReply: function(callback) {
        ipcRenderer.on('reply-message', function (event, message) {
        callback(message);})
    },

    showFocusBearView: function() {ipcRenderer.send('show-focus-bear-view')},
    hideFocusBearView: function() {ipcRenderer.send('hide-focus-bear-view')},
    updateWebviewBounds: function (tabName) {ipcRenderer.send('update-webview-bounds', tabName)},

  }
contextBridge.exposeInMainWorld('api', API);