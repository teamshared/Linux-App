import { useState, useEffect, useCallback } from 'react';
import { nativeAuthService } from '../services/nativeAuth.js';

const SYNCED_STATES = {
  selectedBlockMode: 'manual',
  selectedBlockMethod: 'hosts', 
  selectedBearMode: 'cuddly',
  urlList: ['facebook.com', 'x.com']
};

class SimpleAuth0Sync {
  constructor() {
    this.subscribers = new Map();
    this.cache = new Map();
    this.isInitialized = false;
    this.saveTimeout = null;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Try to load from Focus Bear API
      const savedSettings = await this.loadFromFocusBearAPI();
      
      if (savedSettings) {
        Object.entries(savedSettings).forEach(([key, value]) => {
          if (key in SYNCED_STATES) {
            this.cache.set(key, value);
          }
        });
        console.log('Loaded settings from Focus Bear API:', savedSettings);
      } else {
        // Use defaults if nothing saved
        Object.entries(SYNCED_STATES).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log('Using default settings');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      // Use defaults on error
      Object.entries(SYNCED_STATES).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      this.isInitialized = true;
    }
  }

  async loadFromFocusBearAPI() {
    try {
      const token = await nativeAuthService.getToken();
      if (!token) {
        throw new Error('No token available');
      }

      const API_URL = 'https://api.focusbear.io/settings'; // Placeholder
      
      const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No settings saved yet
          return null;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Loaded from Focus Bear API:', data);
      return data.settings || data; // Adjust based on their response format
      
    } catch (error) {
      console.error('Failed to load from Focus Bear API:', error);
      return null;
    }
  }

  async saveToFocusBearAPI(settings) {
    try {
      const token = await nativeAuthService.getToken();
      if (!token) {
        throw new Error('No token available');
      }


      const API_URL = 'https://api.focusbear.io/settings'; // Placeholder

      const response = await fetch(API_URL, {
        method: 'POST', // or PUT - ask client
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          settings: settings // Adjust based on their expected format
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save: ${response.status}`);
      }

      console.log('Settings saved to Focus Bear API');
      return true;
      
    } catch (error) {
      console.error('Failed to save to Focus Bear API:', error);
      throw error;
    }
  }

  getValue(key) {
    return this.cache.get(key) ?? SYNCED_STATES[key];
  }

  async setValue(key, value) {
    this.cache.set(key, value);

    // Notify subscribers
    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => callback(value));
    }

    // Queue save with debouncing
    this.queueSave();
  }

  queueSave() {
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const allSettings = {};
        for (const [key, value] of this.cache.entries()) {
          allSettings[key] = value;
        }

        // Save to Focus Bear API
        await this.saveToFocusBearAPI(allSettings);
        
        // Also save locally via IPC for offline access
        await window.api?.saveSettings(allSettings);
        
      } catch (error) {
        console.error('Failed to save settings:', error);
      }
    }, 1000);
  }

  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    return () => {
      const subscribers = this.subscribers.get(key);
      if (subscribers) {
        subscribers.delete(callback);
      }
    };
  }

  getAllSettings() {
    const result = {};
    for (const key of Object.keys(SYNCED_STATES)) {
      result[key] = this.getValue(key);
    }
    return result;
  }

  async forceSync() {
    try {
      const settings = await this.loadFromFocusBearAPI();
      if (settings) {
        Object.entries(settings).forEach(([key, value]) => {
          if (key in SYNCED_STATES) {
            this.cache.set(key, value);
            const subscribers = this.subscribers.get(key);
            if (subscribers) {
              subscribers.forEach(callback => callback(value));
            }
          }
        });
        console.log('Force sync completed from Focus Bear API');
      }
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }
}

const auth0Sync = new SimpleAuth0Sync();

// React hooks
export const useSyncedState = (key) => {
  if (!(key in SYNCED_STATES)) {
    throw new Error(`Unknown synced state: ${key}. Available: ${Object.keys(SYNCED_STATES).join(', ')}`);
  }

  const [value, setValue] = useState(SYNCED_STATES[key]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      await auth0Sync.initialize();
      setValue(auth0Sync.getValue(key));
      setIsLoading(false);
    };
    init();
  }, [key]);

  useEffect(() => {
    const unsubscribe = auth0Sync.subscribe(key, setValue);
    return unsubscribe;
  }, [key]);

  const setSyncedValue = useCallback(async (newValue) => {
    await auth0Sync.setValue(key, newValue);
  }, [key]);

  return [value, setSyncedValue, isLoading];
};

export const useUrlList = () => {
  const [urlArray, setUrlArray, isLoading] = useSyncedState('urlList');
  
  const addUrl = useCallback((url) => {
    if (url && !urlArray.includes(url)) {
      setUrlArray([...urlArray, url]);
    }
  }, [urlArray, setUrlArray]);

  const removeUrls = useCallback((indices) => {
    const newArray = urlArray.filter((_, index) => !indices.has(index));
    setUrlArray(newArray);
  }, [urlArray, setUrlArray]);

  return {
    urlArray, 
    setUrlArray,
    addUrl,
    removeUrls,
    isLoading
  };
};

export { auth0Sync };