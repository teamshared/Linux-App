import React, { useState, useEffect } from 'react';
import './styles/Consistent-colors.css';
import './styles/distracting-sites.css';

const Keywords_page = function() {
  const [showModal, setShowModal] = useState(false);
  const [KwInput, setKwInput] = useState('');
  const [keywords, setKeywords] = useState('');
  const [selectedKeyword, setSelectedKeyword] = useState(new Set()); 

  useEffect(function() {
    window.api?.printList(keywords);
    window.api?.exportKeywords?.(keywords); 
  }, [keywords]);

  const KwList = keywords.split('\n').filter(keyword => keyword.trim()); 

  const handleAddKw = function() {
    if (KwInput.trim()) {
      setKeywords(keywords + (keywords ? '\n' : '') + KwInput.trim());
      setKwInput('');
      setShowModal(false);
    }
  };

  const toggleKeywordSelection = function(index) {
    const newSelection = new Set(selectedKeyword);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedKeyword(newSelection);
  };

  const handleRemoveKw = function() {
    const remainingKw = KwList.filter((_, index) => !selectedKeyword.has(index)); 
    setKeywords(remainingKw.join('\n')); 
    setSelectedKeyword(new Set());
  };

  const closeModal = function() {
    setShowModal(false);
    setKwInput('');
  };

  return (
    <section id="distracting-sites">
      <h1 style={{ fontSize: '1.1rem' }}>Distracting Keywords</h1>
      <br />

      <p style={{ fontSize: '0.8rem' }}>
        Which keywords are problematic? Focus Bear will help you be more intentional about how you use these keywords.
        Sites containing these keywords will be blocked during focus sessions. The rest of the time, Focus Bear will ask you why you want to visit sites with these keywords.
      </p>

      <br /><br />

      <div className="url-list">
        {KwList.map((keyword, index) => (
          <div 
            key={index}
            className={`url-item ${selectedKeyword.has(index) ? 'selected' : ''}`} 
            onClick={() => toggleKeywordSelection(index)}
          >
            {keyword}
          </div>
        ))}
      </div>
      <br />

      <hr />
      <button id='url-button' className='ds-button' onClick={() => setShowModal(true)}>
        Add Keyword
      </button>
      <button 
        id='remove-button' 
        className='ds-button' 
        onClick={handleRemoveKw}
        disabled={selectedKeyword.size === 0} 
      >
        Remove ({selectedKeyword.size})
      </button>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="url-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <img 
                src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Lc0MTQgMjJMMTAuOTEgMTUuNzRMNCA5TDEwLjkxIDguMjZMMTIgMloiIGZpbGw9IiNGRjk1MDAiLz4KPC9zdmc+Cg==" 
                alt="Focus Bear" 
                className="modal-icon" 
              />
              <span>Add Keyword</span>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>
            
            <div className="modal-body">
              <input
                type="text"
                value={KwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddKw()}
                placeholder="games"
                autoFocus
                className="url-input"
              />
              <div className="help-text">
                <div>To block sites containing a keyword: games</div>
                <div>To block multiple keywords: social media</div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="cancel-btn" onClick={closeModal}>
                Cancel
              </button>
              <button className="add-btn" onClick={handleAddKw}>
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Keywords_page;