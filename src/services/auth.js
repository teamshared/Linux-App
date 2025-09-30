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
        //audience: 'https://auth.focusbear.io/api/v2/'
      },
      useRefreshTokens: true,
      cacheLocation: 'localstorage'
    });
    this.user = null;
  }

  async login() {
    try {
      console.log('Starting login with Auth0...');
      await this.auth0.loginWithRedirect({
        authorizationParams: {
          scope: 'openid profile email offline_access',
          //audience: 'https://auth.focusbear.io/api/v2/'
        }
      });
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async handleRedirectCallback() {
    try {
      await this.auth0.handleRedirectCallback();
      this.user = await this.auth0.getUser();
      console.log('Login successful:', this.user);
      window.history.replaceState({}, document.title, '/');
      return this.user;
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw error;
    }
  }

  async logout() {
    try {
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
      const token = await this.auth0.getTokenSilently({
        authorizationParams: {
          audience: 'https://auth.focusbear.io/api/v2/',
          scope: 'openid profile email offline_access'
        }
      });
      
      if (token) {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        console.log('Token payload:', {
          audience: payload.aud,
          scopes: payload.scope,
          subject: payload.sub,
          expires: new Date(payload.exp * 1000)
        });
      }
      
      return token;
    } catch (error) {
      console.error('Token retrieval failed:', error);
      return null;
    }
  }
}

export const authService = new AuthService();