import React, { useState, useEffect } from 'react';
import Preferences from './preferences.jsx';
import { authService } from '../services/auth.js';

const App = function() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Add this after your state declarations
  useEffect(() => {
    console.log('App state changed:', { 
      user: !!user, 
      isLoading, 
      isAuthenticating,
      currentPath: window.location.pathname,
      currentSearch: window.location.search
    });
  }, [user, isLoading, isAuthenticating]);

  useEffect(() => {
    initializeAuth();
    
    // Listen for auth success/error events
    const handleAuthSuccess = (event) => {
      setUser(event.detail);
      setIsAuthenticating(false);
    };
    
    const handleAuthError = (event) => {
      console.error('Auth error:', event.detail);
      setIsAuthenticating(false);
      // Don't show alert for auto-login failures, just stay on login screen
    };
    
    window.addEventListener('auth-success', handleAuthSuccess);
    window.addEventListener('auth-error', handleAuthError);
    
    return () => {
      window.removeEventListener('auth-success', handleAuthSuccess);
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, []);

  const initializeAuth = async function() {
    try {    
      // Check for callback first
      if (window.location.pathname === '/callback' || window.location.search.includes('code=')) {
        console.log('Processing auth callback...');
        await authService.handleRedirectCallback();
        
        // After successful callback, check auth status
        const isAuthenticated = await authService.isAuthenticated();
        if (isAuthenticated) {
          const userData = await authService.getUser();
          setUser(userData);
          setIsAuthenticating(false);
          return; // Exit early after successful callback
        }
      }
      
      // Check authentication status for normal app load
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        const userData = await authService.getUser();
        setUser(userData);
      } else {
        // Only auto-login if we're not processing a callback
        console.log('User not authenticated, starting auto-login...');
        setIsAuthenticating(true);
        await authService.login();
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      setIsAuthenticating(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualLogin = async () => {
    setIsAuthenticating(true);
    try {
      await authService.login();
    } catch (error) {
      console.error('Login failed:', error);
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // Loading state - checking authentication
  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>Focus Bear</div>
          <div style={{ fontSize: '14px', color: '#666' }}>Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Not authenticated - auto-login in progress or failed
  if (!user) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        padding: '20px'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '400px',
          padding: '40px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          border: '1px solid #e9ecef'
        }}>
          <h1 style={{ marginBottom: '20px' }}>Focus Bear</h1>
          
          {isAuthenticating ? (
            <div>
              <p style={{ marginBottom: '30px', color: '#666' }}>
                Redirecting to authentication...
              </p>
              <div style={{ 
                padding: '12px 30px',
                backgroundColor: '#6c757d',
                color: 'white',
                borderRadius: '5px',
                fontSize: '16px'
              }}>
                Please wait...
              </div>
            </div>
          ) : (
            <div>
              <p style={{ marginBottom: '20px', color: '#666' }}>
                Sign in to access your settings and features
              </p>
              <p style={{ marginBottom: '30px', color: '#888', fontSize: '14px' }}>
                Authentication failed or was cancelled. Try again:
              </p>
              <button 
                onClick={handleManualLogin}
                style={{
                  padding: '12px 30px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Sign in with Auth0
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Authenticated - show main app with preferences
  return (
    <div>
      {/* Auth status bar */}
      <div style={{
        padding: '10px 20px',
        backgroundColor: '#e8f5e8',
        borderBottom: '1px solid #c3e6c3',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '14px' }}>
          Signed in as: <strong>{user.email || user.name}</strong>
        </span>
        <button 
          onClick={handleLogout}
          style={{
            padding: '4px 12px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Sign out
        </button>
      </div>
      
      {/* Main app content - directly show preferences */}
      <Preferences user={user} />
    </div>
  );
};

export default App;