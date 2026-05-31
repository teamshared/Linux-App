import React, { useState, useEffect } from 'react';

// Add new browsers here as support is added.
// id must match the BROWSER_ID constant in src/extension/background.js.
const BROWSERS = [
  {
    id: 'firefox',
    name: 'Firefox',
    icon: '🦊',
    xpiPath: '~/.local/share/focusbear/focusbear-extension.xpi',
    instructions: [
      'Open Firefox',
      'Navigate to about:debugging in the address bar',
      'Click "This Firefox"',
      'Click "Load Temporary Add-on…"',
      'Select the file path shown below',
    ],
  },
];

const s = {
  root: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4f8',
    padding: '24px',
    overflowY: 'auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  stepDots: {
    display: 'flex',
    gap: '6px',
    marginBottom: '28px',
  },
  dot: (active) => ({
    width: '28px',
    height: '4px',
    borderRadius: '2px',
    background: active ? '#ed8936' : '#e2e8f0',
    transition: 'background 0.2s',
  }),
  emoji: {
    fontSize: '36px',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#718096',
    marginBottom: '28px',
    lineHeight: '1.6',
  },
  browserCard: (checked) => ({
    border: `2px solid ${checked ? '#ed8936' : '#e2e8f0'}`,
    borderRadius: '10px',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    marginBottom: '10px',
    background: checked ? '#fffaf5' : 'white',
    transition: 'border-color 0.15s, background 0.15s',
    userSelect: 'none',
  }),
  checkbox: (checked) => ({
    width: '20px',
    height: '20px',
    borderRadius: '6px',
    border: `2px solid ${checked ? '#ed8936' : '#cbd5e0'}`,
    background: checked ? '#ed8936' : 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  }),
  instructions: {
    margin: '0 0 16px 0',
    paddingLeft: '20px',
    color: '#4a5568',
    fontSize: '14px',
    lineHeight: '2',
  },
  pathBox: {
    background: '#f7fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 14px',
    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
    fontSize: '12px',
    color: '#2d3748',
    wordBreak: 'break-all',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  copyBtn: {
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    padding: '4px 10px',
    fontSize: '11px',
    fontWeight: '600',
    color: '#718096',
    cursor: 'pointer',
    flexShrink: 0,
  },
  statusRow: (connected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 16px',
    borderRadius: '10px',
    background: connected ? '#f0fff4' : '#fffaf0',
    border: `1px solid ${connected ? '#9ae6b4' : '#fbd38d'}`,
    marginBottom: '16px',
  }),
  statusDot: (connected) => ({
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: connected ? '#48bb78' : '#ed8936',
    flexShrink: 0,
    animation: connected ? 'none' : 'focusbear-pulse 1.5s ease-in-out infinite',
  }),
  statusText: (connected) => ({
    fontSize: '13px',
    fontWeight: '600',
    color: connected ? '#276749' : '#7b341e',
  }),
  btnRow: {
    display: 'flex',
    gap: '10px',
    marginTop: '24px',
  },
  primaryBtn: (disabled) => ({
    flex: 2,
    padding: '13px',
    borderRadius: '10px',
    border: 'none',
    background: disabled ? '#e2e8f0' : '#ed8936',
    color: disabled ? '#a0aec0' : 'white',
    fontSize: '14px',
    fontWeight: '600',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background 0.15s',
  }),
  secondaryBtn: {
    flex: 1,
    padding: '13px',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    background: 'white',
    color: '#718096',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default function Setup({ onComplete }) {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(['firefox']);
  const [connectedBrowsers, setConnectedBrowsers] = useState([]);
  const [copiedPath, setCopiedPath] = useState(null);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    window.api.getExtensionConnected?.().then(browsers => {
      setConnectedBrowsers(browsers || []);
    });

    const cleanup = window.api.onExtensionConnected?.((browserId) => {
      setConnectedBrowsers(prev =>
        prev.includes(browserId) ? prev : [...prev, browserId]
      );
    });

    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, []);

  const toggleBrowser = (id) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const copyPath = (path) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const allConnected = selected.length > 0 && selected.every(b => connectedBrowsers.includes(b));

  const handleComplete = async () => {
    setCompleting(true);
    await window.api.saveSettings({ setupComplete: true, selectedBrowsers: selected });
    window.api.notifySetupComplete?.();
    onComplete();
  };

  const selectedDefs = BROWSERS.filter(b => selected.includes(b.id));

  if (step === 1) {
    return (
      <div style={s.root}>
        <style>{`body, html { margin: 0; padding: 0; width: 100%; height: 100%; }`}</style>
        <div style={s.card}>
          <div style={s.stepDots}>
            <div style={s.dot(true)} />
            <div style={s.dot(false)} />
          </div>
          <div style={s.emoji}>🐻</div>
          <div style={s.title}>Welcome to Focus Bear</div>
          <div style={s.subtitle}>
            Which browser do you use? We'll help you install the blocking extension for it.
          </div>

          {BROWSERS.map(b => (
            <div
              key={b.id}
              style={s.browserCard(selected.includes(b.id))}
              onClick={() => toggleBrowser(b.id)}
            >
              <span style={{ fontSize: '24px' }}>{b.icon}</span>
              <span style={{ fontSize: '15px', fontWeight: '600', color: '#2d3748', flex: 1 }}>
                {b.name}
              </span>
              <div style={s.checkbox(selected.includes(b.id))}>
                {selected.includes(b.id) && (
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>✓</span>
                )}
              </div>
            </div>
          ))}

          <div style={{ marginTop: '24px' }}>
            <button
              style={s.primaryBtn(selected.length === 0)}
              disabled={selected.length === 0}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <style>{`body, html { margin: 0; padding: 0; width: 100%; height: 100%; } @keyframes focusbear-pulse { 0%,100%{opacity:1} 50%{opacity:0.35} } @keyframes focusbear-spin { to{transform:rotate(360deg)} }`}</style>
      <div style={s.card}>
        <div style={s.stepDots}>
          <div style={s.dot(true)} />
          <div style={s.dot(true)} />
        </div>
        <div style={s.emoji}>🧩</div>
        <div style={s.title}>Install the Extension</div>
        <div style={s.subtitle}>
          Load the Focus Bear extension into your browser, then return here.
        </div>

        {selectedDefs.map(b => {
          const connected = connectedBrowsers.includes(b.id);
          return (
            <div key={b.id}>
              {selectedDefs.length > 1 && (
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#4a5568', marginBottom: '10px' }}>
                  {b.icon} {b.name}
                </div>
              )}
              <ol style={s.instructions}>
                {b.instructions.map((line, i) => <li key={i}>{line}</li>)}
              </ol>
              <div style={s.pathBox}>
                <span>{b.xpiPath}</span>
                <button style={s.copyBtn} onClick={() => copyPath(b.xpiPath)}>
                  {copiedPath === b.xpiPath ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={s.statusRow(connected)}>
                <div style={s.statusDot(connected)} />
                <span style={s.statusText(connected)}>
                  {connected
                    ? `${b.name} extension connected`
                    : `Waiting for ${b.name} extension…`}
                </span>
              </div>
            </div>
          );
        })}

        <div style={s.btnRow}>
          <button style={s.secondaryBtn} onClick={() => setStep(1)}>← Back</button>
          <button
            style={s.primaryBtn(!allConnected || completing)}
            disabled={!allConnected || completing}
            onClick={handleComplete}
          >
            {completing
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'focusbear-spin 0.7s linear infinite' }} />
                  Setting up…
                </span>
              : allConnected ? 'Get Started →' : 'Waiting…'}
          </button>
        </div>
      </div>
    </div>
  );
}
