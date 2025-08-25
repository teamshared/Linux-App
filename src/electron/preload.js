const { contextBridge, ipcRenderer } = require('electron');

const API = {


    //Get Lines
    exportList: function(urls){
        return ipcRenderer.send("url-channel", urls) 
    },

    onReply: function(callback) {
        ipcRenderer.on('reply-message', function (event, message) {
        callback(message);
        });
    },

    // Sends a request to start or stop the foucs session (depending on the current state)
    startFocusSession: function() {
        return ipcRenderer.send("start-focus-session")
    },


    // url functions
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
    }



};

contextBridge.exposeInMainWorld('api', API);