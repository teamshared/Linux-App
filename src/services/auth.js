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
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    this.user = null;


    console.log('=== AUTH DEBUG ===');
    console.log('Environment Mode:', import.meta.env.MODE);
    console.log('Auth0 Domain:', import.meta.env.VITE_AUTH0_DOMAIN);
    console.log('Auth0 Client ID:', import.meta.env.VITE_AUTH0_CLIENT_ID);
    console.log('Redirect URI:', window.location.origin + '/callback');
  }

  async login() {
    try {
      console.log('Starting login with Auth0...');
      console.log('Redirect URI:', window.location.origin + '/callback');
      await this.auth0.loginWithRedirect({
      authorizationParams: {
        scope: 'openid profile email offline_access',
        audience: `https://${import.meta.env.VITE_AUTH0_DOMAIN}/api/v2/`
      }
    });
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
      const token = await this.getToken();
      
      if (!user || !token) {
        localStorage.setItem('settings_guest', JSON.stringify(settings));
        console.log('Settings synced for guest user');
        return;
      }

      // Save to Auth0 via backend API
      const response = await fetch(`${this.apiUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ settings })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      // Also save locally as backup
      localStorage.setItem(`settings_${user.sub}`, JSON.stringify(settings));
      console.log('Settings synced to Auth0 via:', this.apiUrl);
      
    } catch (error) {
      console.error('Auth0 sync failed, using localStorage only:', error);
      const user = await this.getUser();
      if (user) {
        localStorage.setItem(`settings_${user.sub}`, JSON.stringify(settings));
      }
    }
  }
  async getUserSettings() {
    try {
      const user = await this.getUser();
      const token = await this.getToken();
      
      if (!user || !token) {
        const stored = localStorage.getItem('settings_guest');
        return stored ? JSON.parse(stored) : null;
      }

      // Try Auth0 first
      const response = await fetch(`${this.apiUrl}/api/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.settings) {
          // Save to localStorage as backup
          localStorage.setItem(`settings_${user.sub}`, JSON.stringify(result.settings));
          console.log('Settings loaded from Auth0 via:', this.apiUrl);
          return result.settings;
        }
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
      const user = await this.getUser();
      if (!user) return null;
      
      const stored = localStorage.getItem(`settings_${user.sub}`);
      console.log('Settings loaded from localStorage:', stored ? JSON.parse(stored) : null);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }
}

export const authService = new AuthService();