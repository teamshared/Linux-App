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
    const fileContent = urlArray.join('\n');
    const tempFilePath = '/tmp/focusbear-blocklist.txt'; // Temporary file path for the blocklist
    writeFileSync( tempFilePath, fileContent, 'utf8' )
    console.log(`\nSaved ${urlArray.length} (sub)domains to: ${tempFilePath}\n`);
    event.reply('reply-message', `Saved ${urlArray.length} (sub)domains to file!`);
  }
  catch (error){
    console.error(`\nError saving file: ${error.message}\n`);
    event.reply('reply-message', `Error saving file: ${error.message}`);
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

  
  try {
    const fileContent = urlArray.join('\n');
    const tempFilePath = '/tmp/focusbear-keywords.txt'; // Temporary file path for the blocklist
    writeFileSync( tempFilePath, fileContent, 'utf8' )
    console.log(`\nSaved ${urlArray.length} keywords to: ${tempFilePath}\n`);
    event.reply('reply-message', `Saved ${urlArray.length} keywords to file!`);
  }
  catch (error){
    console.error(`\nError saving file: ${error.message}\n`);
    event.reply('reply-message', `Error saving file: ${error.message}`);
  }
  
});


