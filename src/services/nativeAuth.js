import { generatePKCEPair, generateState } from './pkce.js';

class NativeAuthService {
  constructor() {
    this.domain = import.meta.env.VITE_AUTH0_DOMAIN;
    this.clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
    this.redirectUri = 'focusbear://callback';

    this.accessToken = null;
    this.refreshToken = null;
    this.idToken = null;
    this.user = null;
    this.tokenExpiry = null;

    this.loadTokensFromStorage();
  }

  loadTokensFromStorage() {
    try {
      const storedAccessToken = localStorage.getItem('auth_access_token');
      const storedRefreshToken = localStorage.getItem('auth_refresh_token');
      const storedIdToken = localStorage.getItem('auth_id_token');
      const storedUser = localStorage.getItem('auth_user');
      const storedExpiry = localStorage.getItem('auth_token_expiry');

      if (storedAccessToken) this.accessToken = storedAccessToken;
      if (storedRefreshToken) this.refreshToken = storedRefreshToken;
      if (storedIdToken) this.idToken = storedIdToken;
      if (storedUser) this.user = JSON.parse(storedUser);
      if (storedExpiry) this.tokenExpiry = parseInt(storedExpiry, 10);
    } catch (error) {
      console.error('Failed to load tokens from storage:', error);
    }
  }

  saveTokensToStorage() {
    try {
      if (this.accessToken) localStorage.setItem('auth_access_token', this.accessToken);
      if (this.refreshToken) localStorage.setItem('auth_refresh_token', this.refreshToken);
      if (this.idToken) localStorage.setItem('auth_id_token', this.idToken);
      if (this.user) localStorage.setItem('auth_user', JSON.stringify(this.user));
      if (this.tokenExpiry) localStorage.setItem('auth_token_expiry', this.tokenExpiry.toString());
    } catch (error) {
      console.error('Failed to save tokens to storage:', error);
    }
  }

  clearTokensFromStorage() {
    localStorage.removeItem('auth_access_token');
    localStorage.removeItem('auth_refresh_token');
    localStorage.removeItem('auth_id_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token_expiry');
  }

  async login() {
    try {
      console.log('Starting Native PKCE login flow...');

      const { codeVerifier, codeChallenge, codeChallengeMethod } = await generatePKCEPair();
      const state = generateState();

      sessionStorage.setItem('pkce_code_verifier', codeVerifier);
      sessionStorage.setItem('pkce_state', state);

      const authUrl = `https://${this.domain}/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `scope=${encodeURIComponent('openid profile email offline_access')}&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=${codeChallengeMethod}`;

      if (window.api?.openAuthWindow) {
        window.api.openAuthWindow(authUrl);
      } else {
        window.open(authUrl, '_blank');
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async handleCallback(callbackUrl) {
    try {
      console.log('Handling auth callback:', callbackUrl);

      const url = new URL(callbackUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');

      const storedState = sessionStorage.getItem('pkce_state');
      const codeVerifier = sessionStorage.getItem('pkce_code_verifier');

      if (!state || state !== storedState) {
        throw new Error('State mismatch - possible CSRF attack');
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      if (!codeVerifier) {
        throw new Error('No code verifier found in session');
      }

      const tokens = await this.exchangeCodeForTokens(code, codeVerifier);

      this.accessToken = tokens.access_token;
      this.refreshToken = tokens.refresh_token;
      this.idToken = tokens.id_token;
      this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

      await this.loadUserInfo();

      this.saveTokensToStorage();

      sessionStorage.removeItem('pkce_code_verifier');
      sessionStorage.removeItem('pkce_state');

      console.log('Authentication successful');
      return this.user;
    } catch (error) {
      console.error('Callback handling failed:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(code, codeVerifier) {
    const response = await fetch(`https://${this.domain}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: this.redirectUri
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
    }

    return await response.json();
  }

  async loadUserInfo() {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const response = await fetch(`https://${this.domain}/userinfo`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to load user info');
    }

    this.user = await response.json();
    return this.user;
  }

  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`https://${this.domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          refresh_token: this.refreshToken
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Token refresh failed: ${error.error_description || error.error}`);
      }

      const tokens = await response.json();

      this.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token;
      }
      if (tokens.id_token) {
        this.idToken = tokens.id_token;
      }
      this.tokenExpiry = Date.now() + (tokens.expires_in * 1000);

      this.saveTokensToStorage();

      console.log('Token refreshed successfully');
      return this.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearTokens();
      throw error;
    }
  }

  async getToken() {
    if (!this.accessToken) {
      return null;
    }

    const now = Date.now();
    const bufferTime = 5 * 60 * 1000;

    if (this.tokenExpiry && (now + bufferTime) >= this.tokenExpiry) {
      console.log('Token expiring soon, refreshing...');
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  async isAuthenticated() {
    if (!this.accessToken) {
      return false;
    }

    try {
      await this.getToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  getUser() {
    return this.user;
  }

  async logout() {
    try {
      this.clearTokens();

      const logoutUrl = `https://${this.domain}/v2/logout?` +
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `returnTo=${encodeURIComponent('focusbear://logout')}`;

      if (window.api?.openAuthWindow) {
        window.api.openAuthWindow(logoutUrl);
      } else {
        window.open(logoutUrl, '_blank');
      }
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.idToken = null;
    this.user = null;
    this.tokenExpiry = null;
    this.clearTokensFromStorage();
  }
}

export const nativeAuthService = new NativeAuthService();
