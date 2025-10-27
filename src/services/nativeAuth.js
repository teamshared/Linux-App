import { generatePKCEPair, generateState } from './pkce.js';

class NativeAuthService {
  constructor() {
    this.domain = import.meta.env.VITE_AUTH0_DOMAIN;
    this.clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;

    const isDev = import.meta.env.DEV;
    this.redirectUri = isDev
      ? 'http://localhost:5173/callback'
      : 'http://localhost/callback';

    console.log('[NativeAuth] Initializing with config:');
    console.log('  - Domain:', this.domain);
    console.log('  - Client ID:', this.clientId);
    console.log('  - Redirect URI:', this.redirectUri);
    console.log('  - Is packaged:', !isDev);

    if (!this.domain || !this.clientId) {
      console.error('[NativeAuth] CRITICAL: Missing Auth0 configuration!');
      console.error('  - Domain:', this.domain);
      console.error('  - Client ID:', this.clientId);
      console.error('  - This will cause authentication to fail in packaged app');
    }

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
      console.log('[NativeAuth] Starting PKCE login flow...');

      const { codeVerifier, codeChallenge, codeChallengeMethod } = await generatePKCEPair();
      const state = generateState();

      localStorage.setItem('pkce_code_verifier', codeVerifier);
      localStorage.setItem('pkce_state', state);

      const authUrl = `https://${this.domain}/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
        `scope=${encodeURIComponent('openid profile email offline_access')}&` +
        `audience=${encodeURIComponent('https://auth.focusbear.io/api/v2/')}&` +
        `state=${state}&` +
        `code_challenge=${codeChallenge}&` +
        `code_challenge_method=${codeChallengeMethod}`;

      console.log('[NativeAuth] Redirecting to Auth0...');
      window.location.href = authUrl;
    } catch (error) {
      console.error('[NativeAuth] Login failed:', error);
      throw error;
    }
  }

  async handleRedirectCallback() {
    try {
      console.log('[NativeAuth] Handling redirect callback...');
      console.log('[NativeAuth] Current URL:', window.location.href);

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      const storedState = localStorage.getItem('pkce_state');
      const codeVerifier = localStorage.getItem('pkce_code_verifier');

      console.log('[NativeAuth] Callback params:', {
        hasCode: !!code,
        hasState: !!state,
        hasStoredState: !!storedState,
        hasCodeVerifier: !!codeVerifier
      });

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

      localStorage.removeItem('pkce_code_verifier');
      localStorage.removeItem('pkce_state');

      window.history.replaceState({}, document.title, '/');

      console.log('[NativeAuth] Authentication successful');
      return this.user;
    } catch (error) {
      console.error('[NativeAuth] Callback handling failed:', error);
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
        redirect_uri: this.redirectUri,
        audience: 'https://auth.focusbear.io/api/v2/'
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
          refresh_token: this.refreshToken,
          audience: 'https://auth.focusbear.io/api/v2/'
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

      const returnUrl = import.meta.env.DEV
        ? 'http://localhost:5173'
        : 'http://localhost';

      const logoutUrl = `https://${this.domain}/v2/logout?` +
        `client_id=${encodeURIComponent(this.clientId)}&` +
        `returnTo=${encodeURIComponent(returnUrl)}`;

      console.log('[NativeAuth] Logging out from Auth0, redirecting to:', logoutUrl);
      window.location.href = logoutUrl;
    } catch (error) {
      console.error('[NativeAuth] Logout failed:', error);
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
