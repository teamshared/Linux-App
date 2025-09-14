// services/auth.js - Simplified for Development Server
import { Auth0Client } from '@auth0/auth0-spa-js';

class AuthService {
  constructor() {
    this.auth0 = new Auth0Client({
      domain: import.meta.env.VITE_AUTH0_DOMAIN,
      clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
      authorizationParams: {
        redirect_uri: window.location.origin + '/callback',
        scope: 'openid profile email',
        response_type: 'code'
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

  // Helper method to sync user settings (for future use)
  async syncUserSettings(settings) {
    try {
      const token = await this.getToken();
      if (!token) {
        throw new Error('No access token available');
      }
      
      const user = await this.getUser();
      if (user) {
        localStorage.setItem(`settings_${user.sub}`, JSON.stringify(settings));
        console.log('Settings synced locally:', settings);
      }
    } catch (error) {
      console.error('Settings sync failed:', error);
      throw error;
    }
  }

  // Helper method to get user settings
  async getUserSettings() {
    try {
      const user = await this.getUser();
      if (!user) return null;

      const stored = localStorage.getItem(`settings_${user.sub}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to get user settings:', error);
      return null;
    }
  }
}

export const authService = new AuthService();