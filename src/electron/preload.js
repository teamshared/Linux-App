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

    // Listens for the result of the focus session action (block/unblock)
    onFocusSessionResult: function(callback) {
        ipcRenderer.on('focus-session-result', function (event, message) {
            callback(message);
        });
    }

};

contextBridge.exposeInMainWorld('api', API);