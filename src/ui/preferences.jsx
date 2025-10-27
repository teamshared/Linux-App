import React, { useState, useEffect } from 'react';
import './distracting-sites'
import './styles/preferences.css';
import './styles/Consistent-colors.css'
import Distracting_sites_page from './distracting-sites';
import MotivationPage from './motivation';
import BlockingSchedule from './blocking-schedule'
import AccountPage from './account';
import Keywords_page from './keyword-page';
import SetupGuide from './setup-guide';
import UninstallPage from './uninstall-page';
import { nativeAuthService } from '../services/nativeAuth.js';

const PreferencesPage = function({ user }) {
  const [activeTab, setActiveTab] = useState('Help');
  const [activeSettingsTab, setActiveSettingsTab] = useState('General');
  const [activeBlocksTab, setActiveBlocksTab] = useState('Blocking Schedule');

  useEffect(() => {
    const switchWebViewWithAuth = async () => {
      const webViewId = getWebViewForCurrentTab();

      if (webViewId) {
        const metadata = await buildWebViewMetadata();
        window.api.switchWebView?.(webViewId, metadata);
      } else {
        window.api.hideAllWebViews?.();
      }
    };

    switchWebViewWithAuth();
  }, [activeTab, activeSettingsTab, activeBlocksTab]);

  const buildWebViewMetadata = async () => {
    try {
      const access_token = await nativeAuthService.getToken();
      const id_token = nativeAuthService.idToken;
      const client_id = nativeAuthService.clientId;
      const user = nativeAuthService.getUser();

      console.log('[Preferences] Building webview metadata:');
      console.log('  - client_id:', client_id);
      console.log('  - has access_token:', !!access_token);
      console.log('  - has id_token:', !!id_token);
      console.log('  - user email:', user?.email);

      if (!client_id) {
        console.error('[Preferences] WARNING: client_id is undefined!');
      }

      return {
        access_token,
        id_token,
        client_id,
        user,
        theme: 'LIGHT',
        lang: 'en',
        font: 'default',
        flags: [],
        tasks: '[]',
        total_duration: 0,
        intention: '',
        brain_dump: ''
      };
    } catch (error) {
      console.error('Failed to build webview metadata:', error);
      return null;
    }
  };

  // Helper function to determine which webview should be active
  const getWebViewForCurrentTab = () => {
    // Map tab combinations to webview IDs
    const tabMappings = {
      'Help': 'get_support',
      'Edit Habits': 'edit_habits',
      'Motivation': 'motivation',
      'Blocks': {
        'Blocking Schedule': 'blocking_schedule',
        'Super Distracting Sites': null, // Uses React component
        'Keyword Blocking': null
      },
      'Settings': {
        'Setup Guide': null, // Uses React component
        'Super Distracting Sites': null, // Uses React component
        'Account': null, // Uses React component
        'General': null,
        'AI': null,
        'Uninstall': null
      }
    };

    const mapping = tabMappings[activeTab];
    
    // If it's a simple string mapping, return it
    if (typeof mapping === 'string') {
      return mapping;
    }
    
    // If it's an object (has sub-tabs), look up the appropriate sub-tab
    if (mapping && typeof mapping === 'object') {
      if (activeTab === 'Blocks') {
        return mapping[activeBlocksTab];
      } else if (activeTab === 'Settings') {
        return mapping[activeSettingsTab];
      }
    }
    
    return null;
  };

  const tabs = ['Help', 'Blocks', 'Settings', 'Edit Habits', 'Motivation'];
  const settingsTabs = ['Setup Guide', 'General', 'Super Distracting Sites', 'Account', 'AI', 'Uninstall'];
  const blocksTabs = ['Blocking Schedule', 'Super Distracting Sites', 'Keyword Blocking'];

  return (
    <main className="app-container">
      {/* Main Navigation */}
      <nav className="main-nav">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`nav-button ${activeTab === tab ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Sub-Navigation for Blocks Tab */}
      {activeTab === 'Blocks' && (
        <nav className="blocks-nav">
          {blocksTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveBlocksTab(tab)}
              className={`blocks-button ${activeBlocksTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      )}

      {/* Sub-Navigation for Settings Tab */}
      {activeTab === 'Settings' && (
        <nav className="settings-nav">
          {settingsTabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveSettingsTab(tab)}
              className={`settings-button ${activeSettingsTab === tab ? 'active' : ''}`}
            >
              {tab}
            </button>
          ))}
        </nav>
      )}

      {/* React Component Renders - only show when not using webviews */}
      {/* BLOCK TAB */}
      {(activeTab === 'Blocks' && activeBlocksTab === 'Super Distracting Sites') && (
        <section className="content-area with-subnav light-orange">
          <Distracting_sites_page />
        </section>
      )}

      {(activeTab === 'Blocks' && activeBlocksTab === 'Blocking Schedule') && (
        <div className="content-area with-subnav">
          <BlockingSchedule />
        </div>
      )}

      {(activeTab === 'Blocks' && activeBlocksTab === 'Keyword Blocking') && (
        <div className="content-area with-subnav">
          <Keywords_page />
        </div>
      )}

      {(activeTab === 'Settings' && activeSettingsTab === 'Setup Guide') && (
        <div className="content-area with-subnav">
          <SetupGuide />
        </div>
      )}

      {(activeTab === 'Settings' && activeSettingsTab === 'Account') && (
        <div className="content-area with-subnav">
          <AccountPage />
        </div>
      )}

      {(activeTab === 'Settings' && activeSettingsTab === 'Super Distracting Sites') && (
        <div className="content-area with-subnav">
          <Distracting_sites_page />
        </div>
      )}

      {(activeTab === 'Settings' && activeSettingsTab === 'Uninstall') && (
        <div className="content-area with-subnav">
          <UninstallPage />
        </div>
      )}

      {/* <section
        id="webview-container" 
        className={`content-area 
          ${activeTab === 'Settings' || activeTab === 'Blocks' ? 'with-subnav' : ''}
          ${shouldHideWebViewContainer() ? 'hideArea' : ''}
        `}
      >
        Loading webview...
      </section> */}

    </main>
  );

  function shouldHideWebViewContainer() {
    const webViewId = getWebViewForCurrentTab();

    return !webViewId && (
      (activeTab === 'Settings' && (activeSettingsTab === 'Super Distracting Sites' || activeSettingsTab === 'Account' || activeSettingsTab === 'Setup Guide')) ||
      (activeTab === 'Blocks' && activeBlocksTab === 'Super Distracting Sites')
    );
  }

  function getDefaultContent() {
    if (activeTab === 'Settings' && !['Super Distracting Sites', 'Account'].includes(activeSettingsTab)) {
      return `${activeSettingsTab} Settings`;
    }
    return `${activeTab} Content`;
  }
};

export default PreferencesPage;