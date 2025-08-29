import React, { useState, useEffect } from 'react';
import './App.css';

const App = () => {
  const [activeTab, setActiveTab] = useState('Help');
  const [activeSettingsTab, setActiveSettingsTab] = useState('General');

  useEffect(() => {
    if (!window.api) return;
    window.api.updateWebviewBounds?.(activeTab);
    
    if (activeTab === 'Edit Habits') {
      window.api.showFocusBearView?.();
    } else {
      window.api.hideFocusBearView?.();
      
    }


  }, [activeTab]);

  const tabs = ['Help', 'Blocks', 'Settings', 'Edit Habits', 'Motivation'];
  const settingsTabs = ['General', 'Super Distracting Sites', 'Account', 'AI', 'Uninstall'];

  const getContentText = () => {
    if (activeTab === 'Blocks') return 'Loading Focus Bear...';
    if (activeTab === 'Settings') return `${activeSettingsTab} Settings`;
    return `${activeTab} Content`;
  };

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

      {/* Settings Sub-Navigation */}
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

      {/* Content Area */}
      <section 
        id="webview-container"
        className={`content-area ${activeTab === 'Settings' ? 'with-settings' : ''} 
        ${activeTab === 'Edit Habits' ? 'hideArea' : ''}`}
      >
        {getContentText()}
      </section>
    </main>
  );
};

export default App;