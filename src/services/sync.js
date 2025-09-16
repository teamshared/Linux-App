import { useState, useEffect, useCallback } from 'react';
import { authService } from '../services/auth.js';

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
    this.setupAuth0Handlers();
  }

  setupAuth0Handlers() {
    if (window.api?.onAuth0GetSettings) {
        window.api.onAuth0GetSettings(async () => {
        try {
            const settings = await authService.getUserSettings();
            window.api.sendAuth0SettingsResponse({ success: true, data: settings });
        } catch (error) {
            window.api.sendAuth0SettingsResponse({ success: false, error: error.message });
        }
        });
    }

    if (window.api?.onAuth0SaveSettings) {
        window.api.onAuth0SaveSettings(async (settings) => {
        try {
            await authService.syncUserSettings(settings);
            window.api.sendAuth0SaveResponse({ success: true });
        } catch (error) {
            window.api.sendAuth0SaveResponse({ success: false, error: error.message });
        }
        });
    }
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const savedSettings = await window.api?.getSettings();
      
      if (savedSettings) {
        Object.entries(savedSettings).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log('Loaded settings:', savedSettings);
      } else {
        Object.entries(SYNCED_STATES).forEach(([key, value]) => {
          this.cache.set(key, value);
        });
        console.log('Using default settings');
      }

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize settings:', error);
      Object.entries(SYNCED_STATES).forEach(([key, value]) => {
        this.cache.set(key, value);
      });
      this.isInitialized = true;
    }
  }

  async loadFromAuth0() {
    try {
      const user = await authService.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const token = await authService.getManagementToken();
      const domain = import.meta.env.VITE_AUTH0_DOMAIN;
      
      const response = await fetch(`https://${domain}/api/v2/users/${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Auth0 API error: ${response.status}`);
      }

      const userData = await response.json();
      return userData.user_metadata?.focusbear_settings || null;
    } catch (error) {
      console.error('Failed to load from Auth0:', error);
      throw error;
    }
  }

  async saveToAuth0(settings) {
    try {
      const user = await authService.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const token = await authService.getManagementToken();
      const domain = import.meta.env.VITE_AUTH0_DOMAIN;

      const currentResponse = await fetch(`https://${domain}/api/v2/users/${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const currentData = await currentResponse.json();
      
      const response = await fetch(`https://${domain}/api/v2/users/${user.sub}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_metadata: {
            ...currentData.user_metadata,
            focusbear_settings: settings
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save to Auth0: ${response.status}`);
      }

      console.log('Settings saved to Auth0');
    } catch (error) {
      console.error('Failed to save to Auth0:', error);
      throw error;
    }
  }

  getValue(key) {
    return this.cache.get(key) ?? SYNCED_STATES[key];
  }

  async setValue(key, value) {
    this.cache.set(key, value);

    const subscribers = this.subscribers.get(key);
    if (subscribers) {
      subscribers.forEach(callback => callback(value));
    }

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

        await window.api?.saveSettings(allSettings);
        console.log('Settings saved');
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
      const settings = await this.loadFromAuth0();
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
        console.log('Force sync completed from Auth0');
      }
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }
}

const auth0Sync = new SimpleAuth0Sync();

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
  
  const urlString = urlArray.join('\n');
  
  const setUrlString = useCallback((newUrlString) => {
    const newArray = newUrlString.split('\n').filter(url => url.trim());
    setUrlArray(newArray);
  }, [setUrlArray]);

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
    urlString,
    urlArray, 
    setUrlString,
    setUrlArray,
    addUrl,
    removeUrls,
    isLoading
  };
};

export const useForceSync = () => {
  return useCallback(async () => {
    await auth0Sync.forceSync();
  }, []);
};

export { auth0Sync };