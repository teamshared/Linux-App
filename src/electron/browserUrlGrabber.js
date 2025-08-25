// browserUrlGrabber.js - Debug Version
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class BrowserUrlGrabber {
  constructor() {
    this.supportedBrowsers = [
      'firefox',
      'chrome',
      'chromium',
      'brave-browser',
      'brave',
      'google-chrome',
      'google-chrome-stable'
    ];
  }

  /**
   * Test if gdbus is available
   */
  async testGdbus() {
    try {
      const { stdout } = await execAsync('which gdbus');
      console.log('gdbus found at:', stdout.trim());
      return true;
    } catch (error) {
      console.error('gdbus not found! This is required for URL grabbing.');
      return false;
    }
  }

  /**
   * Execute gdbus command with logging
   */
  async gdbusCall(busName, objectPath, method) {
    try {
      const cmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method ${method}`;
      console.log('Executing:', cmd);
      const { stdout } = await execAsync(cmd);
      console.log('Result:', stdout.trim().substring(0, 100)); // First 100 chars
      return stdout.trim();
    } catch (error) {
      console.error('gdbus call failed:', error.message);
      return null;
    }
  }

  /**
   * Get property value with logging
   */
  async getProperty(busName, objectPath, interfaceName, property) {
    try {
      const cmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method org.freedesktop.DBus.Properties.Get "${interfaceName}" "${property}"`;
      console.log('Getting property:', property, 'from', busName);
      const { stdout } = await execAsync(cmd);
      
      // Parse the variant output
      const match = stdout.match(/<(.+?)>/);
      if (match) {
        const value = match[1].replace(/'/g, '');
        console.log(`Property ${property} = ${value}`);
        return value;
      }
      return null;
    } catch (error) {
      console.error(`Failed to get property ${property}:`, error.message);
      return null;
    }
  }

  /**
   * Parse gdbus output to extract accessible children
   */
  parseChildrenOutput(output) {
    if (!output) return [];
    
    const children = [];
    // Match patterns like ('busname', '/object/path')
    const regex = /\('([^']+)',\s*'([^']+)'\)/g;
    let match;
    
    while ((match = regex.exec(output)) !== null) {
      children.push({
        busName: match[1],
        objectPath: match[2]
      });
    }
    
    console.log(`Parsed ${children.length} children`);
    return children;
  }

  /**
   * Get children of an accessible object
   */
  async getChildren(busName, objectPath) {
    const childrenStr = await this.getProperty(busName, objectPath, 'org.a11y.atspi.Accessible', 'Children');
    return this.parseChildrenOutput(childrenStr);
  }

  /**
   * Get accessible name
   */
  async getName(busName, objectPath) {
    return await this.getProperty(busName, objectPath, 'org.a11y.atspi.Accessible', 'Name') || '';
  }

  /**
   * Get accessible role
   */
  async getRole(busName, objectPath) {
    const roleStr = await this.getProperty(busName, objectPath, 'org.a11y.atspi.Accessible', 'Role');
    return roleStr ? parseInt(roleStr) : -1;
  }

  /**
   * Get text content with logging
   */
  async getText(busName, objectPath) {
    try {
      console.log('Getting text from:', objectPath);
      // Get character count
      const countCmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method org.a11y.atspi.Text.GetCharacterCount`;
      const { stdout: countOut } = await execAsync(countCmd);
      
      const countMatch = countOut.match(/\((\d+),?\)/);
      if (!countMatch) {
        console.log('No text found (empty)');
        return '';
      }
      
      const count = parseInt(countMatch[1]);
      if (count <= 0) {
        console.log('Text count is 0');
        return '';
      }
      
      console.log(`Text has ${count} characters`);
      
      // Get text
      const textCmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method org.a11y.atspi.Text.GetText 0 ${count}`;
      const { stdout: textOut } = await execAsync(textCmd);
      
      const textMatch = textOut.match(/\('(.*)'\)/);
      const text = textMatch ? textMatch[1] : '';
      console.log('Got text:', text.substring(0, 50)); // First 50 chars
      return text;
    } catch (error) {
      console.error('Failed to get text:', error.message);
      return '';
    }
  }

  /**
   * Get document attributes with logging
   */
  async getDocumentAttributes(busName, objectPath) {
    try {
      console.log('Getting document attributes from:', objectPath);
      const cmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method org.a11y.atspi.Document.GetAttributes`;
      const { stdout } = await execAsync(cmd);
      
      const attrs = {};
      // Parse attributes like "key=value"
      const regex = /'([^=]+)=([^']+)'/g;
      let match;
      
      while ((match = regex.exec(stdout)) !== null) {
        attrs[match[1]] = match[2];
      }
      
      console.log('Document attributes:', attrs);
      return attrs;
    } catch (error) {
      console.error('Failed to get document attributes:', error.message);
      return {};
    }
  }

  /**
   * Check if window is focused
   */
  async isFocused(busName, objectPath) {
    try {
      const cmd = `gdbus call --session --dest ${busName} --object-path ${objectPath} --method org.a11y.atspi.Accessible.GetState`;
      const { stdout } = await execAsync(cmd);
      
      // Parse state output (two uint32 values)
      const match = stdout.match(/\((\d+),\s*(\d+)\)/);
      if (match) {
        const state1 = parseInt(match[1]);
        // FOCUSED is bit 12
        const isFocused = (state1 & (1 << 12)) !== 0;
        console.log(`Window focused state: ${isFocused}`);
        return isFocused;
      }
    } catch (error) {
      console.error('Failed to check focus state:', error.message);
    }
    return false;
  }

  /**
   * Find URL in browser window with detailed logging
   */
  async findUrlInBrowser(busName, objectPath, depth = 0) {
    if (depth > 10) {
      console.log('Max depth reached');
      return null;
    }

    try {
      const role = await this.getRole(busName, objectPath);
      console.log(`Checking object with role: ${role} at depth ${depth}`);
      
      // Role constants
      const ROLE_DOCUMENT_FRAME = 13;
      const ROLE_DOCUMENT_WEB = 90;
      const ROLE_ENTRY = 30;
      const ROLE_TEXT = 82;
      const ROLE_COMBO_BOX = 11;

      // Check document frames
      if (role === ROLE_DOCUMENT_FRAME || role === ROLE_DOCUMENT_WEB) {
        console.log('Found document frame!');
        const attrs = await this.getDocumentAttributes(busName, objectPath);
        if (attrs.DocURL || attrs.url || attrs.URL) {
          const url = attrs.DocURL || attrs.url || attrs.URL;
          console.log('Found URL in document:', url);
          return url;
        }
      }

      // Check text entries
      if (role === ROLE_ENTRY || role === ROLE_TEXT) {
        console.log('Found text entry');
        const text = await this.getText(busName, objectPath);
        if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
          console.log('Found URL in text entry:', text);
          return text;
        }
      }

      // Check combo boxes (Chrome)
      if (role === ROLE_COMBO_BOX) {
        console.log('Found combo box');
        const name = await this.getName(busName, objectPath);
        if (name && name.toLowerCase().includes('address')) {
          console.log('Found address bar combo box');
          const text = await this.getText(busName, objectPath);
          if (text) {
            console.log('Found URL in combo box:', text);
            return text;
          }
        }
      }

      // Search children
      const children = await this.getChildren(busName, objectPath);
      console.log(`Searching ${children.length} children at depth ${depth}`);
      
      for (const child of children) {
        const url = await this.findUrlInBrowser(child.busName, child.objectPath, depth + 1);
        if (url) return url;
      }
    } catch (error) {
      console.error('Error in findUrlInBrowser:', error.message);
    }

    return null;
  }

  /**
   * Check if app is a supported browser
   */
  isSupportedBrowser(appName) {
    if (!appName) return false;
    const lowerAppName = appName.toLowerCase();
    const isSupported = this.supportedBrowsers.some(browser => 
      lowerAppName.includes(browser)
    );
    if (isSupported) {
      console.log(`Found supported browser: ${appName}`);
    }
    return isSupported;
  }

  /**
   * Get desktop applications with logging
   */
  async getDesktopApplications() {
    try {
      console.log('Getting desktop applications...');
      const children = await this.getChildren('org.a11y.atspi.Registry', '/org/a11y/atspi/accessible/root');
      console.log(`Found ${children.length} desktop applications`);
      
      // Log application names
      for (const child of children) {
        const name = await this.getName(child.busName, child.objectPath);
        if (name) {
          console.log(`  - ${name}`);
        }
      }
      
      return children;
    } catch (error) {
      console.error('Error getting desktop applications:', error);
      return [];
    }
  }

  /**
   * Get active browser URL with detailed logging
   */
  async getActiveUrl() {
    try {
      console.log('\n=== Starting URL grab ===');
      
      // Test gdbus first
      const gdbusAvailable = await this.testGdbus();
      if (!gdbusAvailable) {
        console.error('Cannot proceed without gdbus');
        return null;
      }
      
      const applications = await this.getDesktopApplications();
      console.log(`Checking ${applications.length} applications for browsers...`);

      // First pass: focused windows
      console.log('\nFirst pass: Looking for focused browser windows...');
      for (const app of applications) {
        const appName = await this.getName(app.busName, app.objectPath);
        
        if (!this.isSupportedBrowser(appName)) continue;
        
        console.log(`\nChecking browser: ${appName}`);
        const windows = await this.getChildren(app.busName, app.objectPath);
        console.log(`  Found ${windows.length} windows`);
        
        for (const window of windows) {
          const focused = await this.isFocused(window.busName, window.objectPath);
          
          if (focused) {
            console.log('  Window is focused, searching for URL...');
            const url = await this.findUrlInBrowser(window.busName, window.objectPath);
            if (url) {
              console.log(`\n=== SUCCESS: Found URL: ${url} ===\n`);
              return { url, browser: appName };
            }
          }
        }
      }

      // Second pass: any browser
      console.log('\nSecond pass: Looking for any browser window...');
      for (const app of applications) {
        const appName = await this.getName(app.busName, app.objectPath);
        
        if (!this.isSupportedBrowser(appName)) continue;
        
        console.log(`\nChecking browser: ${appName}`);
        const windows = await this.getChildren(app.busName, app.objectPath);
        
        for (const window of windows) {
          console.log('  Searching window for URL...');
          const url = await this.findUrlInBrowser(window.busName, window.objectPath);
          if (url) {
            console.log(`\n=== SUCCESS: Found URL: ${url} ===\n`);
            return { url, browser: appName };
          }
        }
      }
      
      console.log('\n=== No URLs found ===\n');
    } catch (error) {
      console.error('Error getting active URL:', error);
    }

    return null;
  }

  /**
   * Get all browser URLs
   */
  async getAllBrowserUrls() {
    const urls = [];

    try {
      console.log('\n=== Getting all browser URLs ===');
      const applications = await this.getDesktopApplications();

      for (const app of applications) {
        const appName = await this.getName(app.busName, app.objectPath);
        
        if (!this.isSupportedBrowser(appName)) continue;

        const windows = await this.getChildren(app.busName, app.objectPath);
        
        for (const window of windows) {
          const url = await this.findUrlInBrowser(window.busName, window.objectPath);
          if (url) {
            const windowName = await this.getName(window.busName, window.objectPath);
            urls.push({
              url,
              browser: appName,
              title: windowName || 'Tab'
            });
            console.log(`Found URL: ${url}`);
          }
        }
      }
      
      console.log(`\n=== Found ${urls.length} total URLs ===\n`);
    } catch (error) {
      console.error('Error getting all browser URLs:', error);
    }

    return urls;
  }

  /**
   * Monitor for URL changes
   */
  startMonitoring(callback, interval = 1000) {
    let lastUrl = null;
    console.log('Starting URL monitoring...');

    const checkInterval = setInterval(async () => {
      const result = await this.getActiveUrl();
      if (result && result.url !== lastUrl) {
        lastUrl = result.url;
        console.log('URL changed:', result.url);
        callback(result);
      }
    }, interval);

    return () => {
      console.log('Stopping URL monitoring');
      clearInterval(checkInterval);
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    console.log('Cleanup called');
  }
}

export default BrowserUrlGrabber;