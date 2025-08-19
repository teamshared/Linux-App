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
  }
};



contextBridge.exposeInMainWorld('api', API);