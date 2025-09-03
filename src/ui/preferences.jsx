import React, { useState, useEffect } from 'react';
import './distracting-sites'
import './styles/preferences.css';
import './styles/Consistent-colors.css'
import Distracting_sites_page from './distracting-sites';
import MotivationPage from './motivation';
import BlockingSchedule from './blocking-schedule'


const PreferencesPage = function() {
  const [activeTab, setActiveTab] = useState('Help');
  const [activeSettingsTab, setActiveSettingsTab] = useState('General');
  const [activeBlocksTab, setActiveBlocksTab] = useState('Blocking Schedule');


  useEffect(() => {

    window.api.hideWebView('edit_habits');
    window.api.hideWebView('motivation');


    if (activeTab === 'Edit Habits') {
      window.api.showWebView('edit_habits');
    }
    // if (activeTab === 'Motivation') {
    //   window.api.showWebView('motivation');
    // }  

    if (!window.api) return;
    window.api.updateWebviewBounds?.(activeTab);

  }, [activeTab]);

  const tabs = ['Help', 'Blocks', 'Settings', 'Edit Habits', 'Motivation'];
  const settingsTabs = ['General', 'Super Distracting Sites', 'Account', 'AI', 'Uninstall'];
  const blocksTabs = ['Blocking Schedule', 'Super Distracting Sites'];

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


      {/* /* {for settings super distracting sites tab} */ }
      {console.log('activeTab:', activeTab, 'activeSettingsTab:', activeSettingsTab)}
      {(activeTab === 'Settings' && activeSettingsTab === 'Super Distracting Sites') && (
          <section className={`content-area with-subnav light-orange `}> 
             <Distracting_sites_page />
          </section>

         
       
      )}

      {/*Motivation Tab */}
      {activeTab === 'Motivation' && (
        <div className='content-area'>
            <MotivationPage />
        </div>  

      )}

      {/*Sub-Navigation BLOCKS TAB*/}
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
      {/* for Super Distracting Sites in BLOCKS TAB */}
      {(activeTab === 'Blocks' && activeBlocksTab === 'Super Distracting Sites') && (
        <div className='content-area with-subnav'>
          <Distracting_sites_page />
        </div>
      )}
      {/* for Blocking Schedule in BLOCKS TAB */}
      {(activeTab === 'Blocks' && activeBlocksTab === 'Blocking Schedule') && (
        <div className='content-area with-subnav'>
          <BlockingSchedule />
        </div>
      )}


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
        className={`content-area 

        // For Settings Tabs
        ${activeTab === 'Settings' ? 'with-subnav' : ''} 
        ${activeSettingsTab === 'Super Distracting Sites' ? 'hideArea' : ''} 

        //For Displaying the Webviews, Motivation and Edit Habits Primary Tabs
        ${activeTab === 'Edit Habits' | 'Motivation' ? 'hideArea' : ''}

        //For Blocking Sub Navigation
        ${activeTab === 'Blocks' ? 'with-subnav' : ''}
        ${activeBlocksTab == 'Super Distracting Sites' || 'Blocking Schedule' ? 'hideArea' : ''}
      
        `}
        
      >
        {getContentText()}
      </section>
    </main>
  );
};

export default PreferencesPage;