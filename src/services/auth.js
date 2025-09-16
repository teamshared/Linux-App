// services/auth.js - Simplified for Development Server
import { Auth0Client } from '@auth0/auth0-spa-js';

class AuthService {
  constructor() {
    this.auth0 = new Auth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin + '/callback',
        scope: 'openid profile email offline_access',
        response_type: 'code',
        audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/api/v2/`  // Add this line
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage'
    });
    
    this.user = null;
  }

  async login() {
    try {
      console.log('Starting login with Auth0...');
      console.log('Redirect URI:', window.location.origin + '/callback');
      await this.auth0.loginWithRedirect();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async handleRedirectCallback() {
    try {
      console.log('Handling Auth0 redirect callback...');
      console.log('Current URL:', window.location.href);
      
      await this.auth0.handleRedirectCallback();
      
      // Get user data
      this.user = await this.auth0.getUser();
      console.log('Login successful:', this.user);
      
      // Clean up URL and navigate to root
      window.history.replaceState({}, document.title, '/');
      
      return this.user;
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
      console.log('Logging out...');
      this.user = null;
      
      await this.auth0.logout({
        logoutParams: {
          returnTo: window.location.origin
        }
      });
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  async getUser() {
    if (!this.user) {
      this.user = await this.auth0.getUser();
    }
    return this.user;
  }

  async isAuthenticated() {
    try {
      return await this.auth0.isAuthenticated();
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  async getToken() {
    try {
      return await this.auth0.getTokenSilently();
    } catch (error) {
      console.error('Token retrieval failed:', error);
      return null;
    }
  }

  async syncUserSettings(settings) {
    try {
      const user = await this.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Save to Auth0 user metadata
      const token = await this.getManagementToken();
      const domain = import.meta.env.VITE_AUTH0_DOMAIN;

      // Get current metadata first
      const currentResponse = await fetch(`https://${domain}/api/v2/users/${user.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const currentData = await currentResponse.json();
      
      // Update metadata
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

      // Also save locally as backup
      localStorage.setItem(`settings_${user.sub}`, JSON.stringify(settings));
      console.log('Settings synced to Auth0 and locally:', settings);
    } catch (error) {
      console.error('Settings sync failed:', error);
      // Fallback to localStorage only
      const user = await this.getUser();
      if (user) {
        localStorage.setItem(`settings_${user.sub}`, JSON.stringify(settings));
        console.log('Settings synced locally only:', settings);
      }
      throw error;
    }
  }

  // Helper method to get user settings
  async getUserSettings() {
    try {
      const user = await this.getUser();
      if (!user) return null;

      // Try to load from Auth0 first
      try {
        const token = await this.getManagementToken();
        const domain = import.meta.env.VITE_AUTH0_DOMAIN;
        
        const response = await fetch(`https://${domain}/api/v2/users/${user.sub}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const userData = await response.json();
          const cloudSettings = userData.user_metadata?.focusbear_settings;
          if (cloudSettings) {
            // Also save locally as backup
            localStorage.setItem(`settings_${user.sub}`, JSON.stringify(cloudSettings));
            console.log('Settings loaded from Auth0');
            return cloudSettings;
          }
        }
      } catch (error) {
        console.log('Auth0 load failed, trying localStorage:', error.message);
      }

      // Fallback to localStorage
      const stored = localStorage.getItem(`settings_${user.sub}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }

  async getManagementToken() {
    try {
      return await this.auth0.getTokenSilently({
        authorizationParams: {
          audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/api/v2/`,
          scope: 'read:user_metadata update:user_metadata'
        }
      });
    } catch (error) {
      console.error('Management token retrieval failed:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();