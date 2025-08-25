import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SimpleUrlGrabber {
  constructor() {
    this.supportedBrowsers = [
      'firefox',
      'chrome', 
      'chromium',
      'brave',
      'google-chrome'
    ];
  }

  async getActiveWindowTitle() {
    const methods = [
      { 
        cmd: 'xdotool getactivewindow getwindowname',
        requires: 'xdotool'
      },
      { 
        cmd: 'xprop -root _NET_ACTIVE_WINDOW | cut -d# -f2 | xargs -I{} xprop -id {} WM_NAME | cut -d\\" -f2',
        requires: 'xprop'
      },
      {
        cmd: 'xwininfo -root -tree | grep "(has focus)" | head -1 | sed \'s/.*"\\(.*\\)".*/\\1/\'',
        requires: 'xwininfo'
      }
    ];

    for (const method of methods) {
      try {
        console.log(`Trying method: ${method.cmd}`);
        const { stdout } = await execAsync(method.cmd);
        const title = stdout.trim();
        if (title && title !== '' && title !== 'null') {
          console.log('Active window title:', title);
          return title;
        } else {
          console.log('Empty or null result');
        }
      } catch (error) {
        console.log(`Method failed: ${method.cmd} - ${error.message}`);
      }
    }
    
    console.log('All window title methods failed, trying window list approach...');
    return await this.getAnyBrowserTitle();
  }

  async getAnyBrowserTitle() {
    try {
      console.log('Getting any browser window title...');
      const { stdout } = await execAsync('wmctrl -l');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const title = parts.slice(4).join(' ');
          if (this.isBrowserWindow(title)) {
            console.log('Found browser window:', title);
            
            const fullTitle = await this.getFullWindowTitle(parts[0]);
            return fullTitle || title;
          }
        }
      }
    } catch (error) {
      console.log('Could not get browser window from wmctrl');
    }
    
    return null;
  }

  async getAllBrowserWindows() {
    const windows = [];
    
    try {
      console.log('Getting all browser windows...');
      const { stdout } = await execAsync('wmctrl -l');
      const lines = stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 5) {
          const title = parts.slice(4).join(' ');
          console.log('Checking window:', title);
          if (this.isBrowserWindow(title)) {
            console.log('Found browser window:', title);
            
            const fullTitle = await this.getFullWindowTitle(parts[0]);
            console.log('Full window title:', fullTitle);
            
            windows.push({
              id: parts[0],
              title: fullTitle || title
            });
          }
        }
      }
    } catch (error) {
      console.log('wmctrl not available');
    }
    
    return windows;
  }

  async getFullWindowTitle(windowId) {
    const methods = [
      `xprop -id ${windowId} WM_NAME | cut -d'"' -f2`,
      `xprop -id ${windowId} _NET_WM_NAME | cut -d'"' -f2`,
      `xwininfo -id ${windowId} | grep "xwininfo:" | sed 's/.*"\\(.*\\)".*/\\1/'`
    ];

    for (const method of methods) {
      try {
        console.log(`Trying to get full title: ${method}`);
        const { stdout } = await execAsync(method);
        const title = stdout.trim();
        if (title && title !== '' && title !== 'null' && !title.includes('not found')) {
          console.log('Got full title:', title);
          return title;
        }
      } catch (error) {
        console.log(`Method failed: ${method}`);
      }
    }
    
    return null;
  }

  isBrowserWindow(title) {
    if (!title) return false;
    
    const browserIndicators = [
      'Mozilla Firefox',
      'Google Chrome', 
      'Chromium',
      'Brave',
      '— Mozilla Firefox',
      '- Google Chrome',
      '- Chromium',
      'Firefox',
      'Chrome'
    ];
    
    console.log(`Checking if "${title}" is a browser window...`);
    const isMatch = browserIndicators.some(indicator => {
      const match = title.toLowerCase().includes(indicator.toLowerCase());
      if (match) {
        console.log(`Matched indicator: "${indicator}"`);
      }
      return match;
    });
    
    console.log(`Result: ${isMatch}`);
    return isMatch;
  }

  extractUrlFromTitle(title) {
    if (!title) return null;
    
    console.log(`Extracting URL from title: "${title}"`);
    
    const urlPatterns = [
      /(https?:\/\/[^\s\]]+)/i,
      /([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}/
    ];

    for (const pattern of urlPatterns) {
      const match = title.match(pattern);
      if (match) {
        let url = match[0];
        if (!url.startsWith('http')) {
          url = 'https://' + url;
        }
        console.log(`Found URL via pattern: ${url}`);
        return url;
      }
    }

    if (title.includes('://')) {
      const urlMatch = title.match(/[^\s]*:\/\/[^\s]*/);
      if (urlMatch) {
        console.log(`Found URL via :// pattern: ${urlMatch[0]}`);
        return urlMatch[0];
      }
    }

    const commonSites = [
      { pattern: /youtube/i, url: 'https://youtube.com' },
      { pattern: /google/i, url: 'https://google.com' },
      { pattern: /github/i, url: 'https://github.com' },
      { pattern: /stack.*overflow/i, url: 'https://stackoverflow.com' },
      { pattern: /reddit/i, url: 'https://reddit.com' },
      { pattern: /twitter/i, url: 'https://twitter.com' },
      { pattern: /facebook/i, url: 'https://facebook.com' }
    ];

    for (const site of commonSites) {
      if (site.pattern.test(title)) {
        console.log(`Matched common site: ${site.url}`);
        return site.url;
      }
    }

    const domainMatch = title.match(/([a-zA-Z0-9.-]+\.(com|org|net|edu|gov|co|io|ly|me|tv|info|biz|us|uk|ca|de|fr|jp|cn|ru|br|au|in|it|es|nl|pl|se|no|dk|fi|be|ch|at|cz|sk|hu|ro|bg|hr|si|lt|lv|ee|is|mt|cy|lu|gr|pt))/i);
    if (domainMatch) {
      const url = 'https://' + domainMatch[0];
      console.log(`Found domain: ${url}`);
      return url;
    }

    console.log('No URL found in title');
    return null;
  }

  async getProcessUrls() {
    const urls = [];
    
    try {
      const processes = await execAsync('ps aux | grep -E "(firefox|chrome|chromium|brave)" | grep -v grep');
      const lines = processes.stdout.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        if (line.includes('--new-window') || line.includes('http')) {
          const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            urls.push({
              url: urlMatch[1],
              source: 'process',
              browser: this.getBrowserFromProcess(line)
            });
          }
        }
      }
    } catch (error) {
      console.log('Could not get process URLs');
    }
    
    return urls;
  }

  getBrowserFromProcess(processLine) {
    if (processLine.includes('firefox')) return 'Firefox';
    if (processLine.includes('chrome')) return 'Chrome';
    if (processLine.includes('chromium')) return 'Chromium';
    if (processLine.includes('brave')) return 'Brave';
    return 'Unknown';
  }

  async checkToolAvailability() {
    const tools = ['xdotool', 'wmctrl', 'xprop', 'xwininfo'];
    const available = {};
    
    for (const tool of tools) {
      try {
        await execAsync(`which ${tool}`);
        available[tool] = true;
        console.log(`${tool} is available`);
      } catch (error) {
        available[tool] = false;
        console.log(`${tool} is not available`);
      }
    }
    
    return available;
  }

  async getCurrentUrl() {
    console.log('Getting current URL using simple methods...');
    
    const tools = await this.checkToolAvailability();
    
    if (tools.xdotool || tools.wmctrl || tools.xprop) {
      const title = await this.getActiveWindowTitle();
      if (title && this.isBrowserWindow(title)) {
        const url = this.extractUrlFromTitle(title);
        if (url) {
          return {
            url: url,
            title: title,
            method: 'window_title',
            browser: this.getBrowserFromTitle(title)
          };
        }
      }
    }

    const processUrls = await this.getProcessUrls();
    if (processUrls.length > 0) {
      return processUrls[0];
    }

    console.log('No URL found with simple methods');
    return null;
  }

  getBrowserFromTitle(title) {
    if (title.includes('Firefox')) return 'Firefox';
    if (title.includes('Chrome')) return 'Chrome';  
    if (title.includes('Chromium')) return 'Chromium';
    if (title.includes('Brave')) return 'Brave';
    return 'Unknown';
  }

  async getAllUrls() {
    console.log('Getting all URLs using simple methods...');
    
    const urls = [];
    
    const windows = await this.getAllBrowserWindows();
    for (const window of windows) {
      const url = this.extractUrlFromTitle(window.title);
      if (url) {
        urls.push({
          url: url,
          title: window.title,
          method: 'window_list',
          browser: this.getBrowserFromTitle(window.title),
          windowId: window.id
        });
      }
    }

    const processUrls = await this.getProcessUrls();
    urls.push(...processUrls);

    const uniqueUrls = urls.filter((url, index, self) => 
      index === self.findIndex(u => u.url === url.url)
    );

    console.log(`Found ${uniqueUrls.length} URLs`);
    return uniqueUrls;
  }

  startMonitoring(callback, interval = 2000) {
    let lastUrl = null;
    console.log('Starting simple URL monitoring...');

    const checkInterval = setInterval(async () => {
      try {
        const result = await this.getCurrentUrl();
        if (result && result.url !== lastUrl) {
          lastUrl = result.url;
          console.log('URL changed:', result.url);
          callback(result);
        }
      } catch (error) {
        console.error('Error during monitoring:', error);
      }
    }, interval);

    return () => {
      console.log('Stopping simple URL monitoring');
      clearInterval(checkInterval);
    };
  }
}

export default SimpleUrlGrabber;