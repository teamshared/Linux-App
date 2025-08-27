import React, { useState, useRef} from 'react';


import TestingPage from './testing-page.jsx';

const ScratchInterface = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const iframeRef = useRef(null);

  const tabs = [
    { id: 'Dashboard', label: 'Dashboard' },
    { id: 'Help', label: 'Help' },
    { id: 'Blocks', label: 'Blocks' },
    { id: 'Settings', label: 'Settings' },
    { id: 'Edit Habits', label: 'Edit Habits' },
    { id: 'Motivation', label: 'Motivation' }
  ];

  const supportButtons = [
    'Get Support',
    'Tutorials', 
    'Community',
    'Report Problem'
  ];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f8f9fa',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Top Navigation */}
      <div style={{
        display: 'flex',
        width: '100%',
        hieght: '100%',
        justifyContent: 'center',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        padding: '10px 0'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '8px 20px',
              margin: '0 5px',
              border: 'none',
              backgroundColor: activeTab === tab.id ? '#e3f2fd' : 'transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              width: '100%',
              height: '100%',
              color: activeTab === tab.id ? '#1976d2' : '#666'
            }}
          >
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: activeTab === tab.id ? '#1976d2' : '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '14px',
              marginBottom: '4px'
            }}>
              {tab.icon}
            </div>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Support Buttons */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '10px',
        padding: '15px',
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0'
      }}>
        {supportButtons.map(button => (
          <button
            key={button}
            style={{
              padding: '8px 16px',
              border: '1px solid #ddd',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#333'
            }}
          >
            {button}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {activeTab === 'Dashboard' ? (
        <TestingPage />
      ) : (
        <div style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          justifyContent: 'center',
          minHeight: 0 
        }}>
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '2px solid #ddd',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '60vh',
              backgroundColor: '#f0f0f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '14px'
            }}>
            {activeTab === 'Blocks' ? (
              <iframe 
                ref={iframeRef}
                src="https://dashboard.focusbear.io/settings#timing"
                style={{ width: '100%', height: '100%', border: 'none' }}
                onLoad={() => {
                  window.addEventListener('message', handleIframeMessage);
                  
                  // Try CSS injection after delay
                  setTimeout(() => {
                    try {
                      const iframe = iframeRef.current;
                      const doc = iframe.contentDocument;
                      const style = doc.createElement('style');
                      style.textContent = `
                        body > *:not([data-testid="timing-page-wrapper"]) { display: none !important; }
                        .react-tabs__tab-list { display: none !important; }
                        header, nav, .header, .nav, .sidebar { display: none !important; }
                      `;
                      doc.head.appendChild(style);
                    } catch (e) {
                      console.log('CORS prevented styling');
                    }
                  }, 1000);
                }}
              />
            ) : `${activeTab} Content`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App = ScratchInterface;
export default App;