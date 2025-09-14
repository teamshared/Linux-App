import React, { useState, useEffect } from 'react';
import './distracting-sites'
import './styles/preferences.css';
import './styles/Consistent-colors.css'
import Distracting_sites_page from './distracting-sites';
import MotivationPage from './motivation';
import BlockingSchedule from './blocking-schedule'
import AccountPage from './account';

const PreferencesPage = function({ user }) {
  const [activeTab, setActiveTab] = useState('Help');
  const [activeSettingsTab, setActiveSettingsTab] = useState('General');
  const [activeBlocksTab, setActiveBlocksTab] = useState('Blocking Schedule');

  useEffect(() => {
    const webViewId = getWebViewForCurrentTab();
    
    if (webViewId) {
      // Show the appropriate webview
      window.api.switchWebView?.(webViewId);
    } else {
      // Hide all webviews when showing React components
      window.api.hideAllWebViews?.();
    }
  }, [activeTab, activeSettingsTab, activeBlocksTab]);

  // Helper function to determine which webview should be active
  const getWebViewForCurrentTab = () => {
    // Map tab combinations to webview IDs
    const tabMappings = {
      'Help': 'get_support',
      'Edit Habits': 'edit_habits',
      'Motivation': 'motivation',
      'Blocks': {
        'Blocking Schedule': 'blocking_schedule',
        'Super Distracting Sites': null // Uses React component
      },
      'Settings': {
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
  const settingsTabs = ['General', 'Super Distracting Sites', 'Account', 'AI', 'Uninstall'];
  const blocksTabs = ['Blocking Schedule', 'Super Distracting Sites'];

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
      (activeTab === 'Settings' && (activeSettingsTab === 'Super Distracting Sites' || activeSettingsTab === 'Account')) ||
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