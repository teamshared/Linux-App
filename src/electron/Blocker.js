import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { ipcMain } from 'electron';

// Import broadcast function from main (we'll export it)
let broadcastBlocklistUpdate = null;

export function setBroadcastFunction(broadcastFn) {
  broadcastBlocklistUpdate = broadcastFn;
}

ipcMain.on("url-channel", function (event, arg) {

  let urls = []
  console.log(arg);

  const urlArray = arg
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  console.log(urlArray)
  console.log("\n")
  console.log(typeof(urlArray))


  try {
    // Broadcast to native messaging hosts
    if (broadcastBlocklistUpdate) {
      broadcastBlocklistUpdate(urlArray);
    }

    console.log(`\nBroadcasting ${urlArray.length} (sub)domains to native hosts\n`);
    event.reply('reply-message', `Updated ${urlArray.length} (sub)domains!`);
  }
  catch (error){
    console.error(`\nError broadcasting blocklist: ${error.message}\n`);
    event.reply('reply-message', `Error updating blocklist: ${error.message}`);
  }

});

ipcMain.on("keywords-channel", function (event, arg) {

  let urls = []
  console.log(arg);

  const urlArray = arg
    .split('\n')
    .map(url => url.trim())
    .filter(url => url.length > 0);

  console.log(urlArray)
  console.log("\n")
  console.log(typeof(urlArray))

  // Keywords functionality not yet implemented for native messaging
  console.log(`\nReceived ${urlArray.length} keywords (not yet implemented)\n`);
  event.reply('reply-message', `Keywords received: ${urlArray.length} (not yet implemented)`);

});


