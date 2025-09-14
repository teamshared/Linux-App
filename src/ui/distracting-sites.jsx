import React, { useState, useEffect } from 'react';
import './styles/Consistent-colors.css';
import './styles/distracting-sites.css';



const Distracting_sites_page = function() {
  const [showModal, setShowModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urls, setUrls] = useState('facebook.com\nx.com');
  const [selectedUrls, setSelectedUrls] = useState(new Set());
  const [isChecked, setIsChecked] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('No browser detected'); //for url monitoring 

  // Listen for URL monitoring changes
  useEffect(() => {
    if (window.api?.onUrlChanged) {
      window.api.onUrlChanged((data) => {
        if (data && data.url) {
          setCurrentUrl(data.url);
        } else {
          setCurrentUrl('No browser detected');
        }
      });
    }
  }, []);

  //print all urls
  useEffect(function() {
    window.api?.printList(urls);
    window.api.exportList(urls)
  }, [urls]);

  const urlList = urls.split('\n').filter(url => url.trim());

  const handleAddUrl = function() {
    if (urlInput.trim()) {
      setUrls(urls + (urls ? '\n' : '') + urlInput.trim());
      setUrlInput('');
      setShowModal(false);
    }
  };

  const toggleUrlSelection = function(index) {
    const newSelection = new Set(selectedUrls);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedUrls(newSelection)
    
  };

  const handleRemoveUrl = function() {
    const remainingUrls = urlList.filter((_, index) => !selectedUrls.has(index));
    setUrls(remainingUrls.join('\n'));
    setSelectedUrls(new Set());
  };

  const closeModal = function() {
    setShowModal(false);
    setUrlInput('');
  };

  // useEffect(() => {
  //   window.api?.hideWebView('instant-block');
  // }, [isChecked]);

  return (
    <section id="distracting-sites">
      <h1 style={{ fontSize: '1.1rem' }}>Super Distracting Sites</h1>
      <br />

      <p style={{ fontSize: '0.8rem' }}>
        Which sites do you waste time on? Focus Bear will help you be more intentional about how you use these sites.
        They will be blocked during focus sessions. The rest of the time, Focus Bear will ask you why you want to use the site.
      </p>

      {/* FOR URL MONITORING */}
      <br />
      <h4 style={{ fontSize: '0.9rem', margin: '0 0 5px 0', color: '#666' }}>
          Current Browser URL: {currentUrl}
      </h4>

      <br /><br />

      <div className="url-list">
        {urlList.map((url, index) => (
          <div 
            key={index}
            className={`url-item ${selectedUrls.has(index) ? 'selected' : ''}`}
            onClick={() => toggleUrlSelection(index)}
          >
            {url}
          </div>
        ))}
      </div>
      <br />

      <hr />
      <button id='url-button' className='ds-button' onClick={() => setShowModal(true)}>
        Add URL
      </button>
      <button 
        id='remove-button' 
        className='ds-button' 
        onClick={handleRemoveUrl}
        disabled={selectedUrls.size === 0}
      >
        Remove ({selectedUrls.size})
      </button>

      <br />
      <div className="instant-block-wrapper">
        <input 
          type="checkbox" 
          onChange={(e) => setIsChecked(e.target.checked)} 
        />
        <span id="instant-block-label">Immediately block super distracting sites</span>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="url-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <img 
                src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkY5NTAwIi8+Cjwvc3ZnPgo=" 
                alt="Focus Bear" 
                className="modal-icon" 
              />
              <span>Add Web Url</span>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>
            
            <div className="modal-body">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddUrl()}
                placeholder="facebook.com"
                autoFocus
                className="url-input"
              />
              <div className="help-text">
                <div>To block a certain website: domain.com</div>
                <div>To block all subdomains of a website: *.domain.com</div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button className="add-btn" onClick={handleAddUrl}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Distracting_sites_page;