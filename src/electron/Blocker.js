import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
import { writeFileSync } from 'fs';
const __dirname = dirname(__filename);
import { ipcMain } from 'electron';

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
    const url = 'blocked-urls.txt' 
    const filepath = join(__dirname, url);
    const fileContent = urlArray.join('\n');

    writeFileSync( filepath, fileContent, 'utf8' )
    console.log(`\nSaved ${urlArray.length} URLs to: ${filepath}\n`);
    event.reply('reply-message', `Saved ${urlArray.length} URLs to file!`);
  }
  catch (error){
    console.error(`\nError saving file: ${error.message}\n`);
    event.reply('reply-message', `Error saving file: ${error.message}`);
  }
  
});


