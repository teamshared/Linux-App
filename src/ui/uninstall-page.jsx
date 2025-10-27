import { useState, useEffect } from 'react';
import './styles/Consistent-colors.css';
import './styles/uninstall-page.css';

const UninstallPage = function() {
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [distro, setDistro] = useState('unknown');
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);

  useEffect(() => {
    detectDistro();
  }, []);

  const detectDistro = async function() {
    try {
      if (window.api?.detectDistro) {
        const detected = await window.api.detectDistro();
        setDistro(detected);
      }
    } catch (error) {
      console.error('Failed to detect distro:', error);
    }
  };

  const copyToClipboard = function(text, commandId) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCommand(commandId);
      setTimeout(() => setCopiedCommand(null), 2000);
    });
  };

  const handleCleanup = async function() {
    setIsCleaningUp(true);
    setCleanupResult(null);

    try {
      if (window.api?.cleanupAppData) {
        const result = await window.api.cleanupAppData();
        setCleanupResult(result);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
      setCleanupResult({
        success: false,
        message: 'Failed to clean up app data: ' + error.message
      });
    } finally {
      setIsCleaningUp(false);
    }
  };

  const getUninstallCommand = function() {
    switch(distro) {
      case 'ubuntu':
      case 'debian':
      case 'mint':
        return 'sudo apt remove focusbear';
      case 'fedora':
        return 'sudo dnf remove focusbear';
      case 'arch':
        return 'rm ~/focusbear-*.AppImage';
      default:
        return 'Check your package manager to uninstall focusbear';
    }
  };

  const CodeBlock = function({ command, commandId }) {
    return (
      <div className="code-block-wrapper">
        <code className="code-block">{command}</code>
        <button
          className="copy-btn"
          onClick={() => copyToClipboard(command, commandId)}
        >
          {copiedCommand === commandId ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    );
  };

  return (
    <section id="uninstall-page">
      <h1 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>Uninstall Focus Bear</h1>

      <div>
        <p>
          Before you uninstall, you can clean up all app data
          and settings. This will remove your configuration but won't uninstall the application itself.
        </p>
      </div>

      {cleanupResult && (
        <div className={`cleanup-status ${cleanupResult.success ? 'success' : 'error'}`}>
          <div className="status-icon">
            {cleanupResult.success ? '✓' : '⚠'}
          </div>
          <div className="status-content">
            <h3 className="status-title">
              {cleanupResult.success ? 'Cleanup Successful' : 'Cleanup Failed'}
            </h3>
            <p className="status-message">
              {cleanupResult.message}
            </p>
            {cleanupResult.details && (
              <ul className="cleanup-details">
                {cleanupResult.details.map((detail, idx) => (
                  <li key={idx}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="setup-section">
        <h2 className="section-header">
      
          Clean up app data
        </h2>

        <p>
          This will remove all local data created by Focus Bear, including:
        </p>

        <ul className="instruction-list">
          <li>Your blocked sites and keywords configuration</li>
          <li>Application settings and preferences</li>
          <li>Temporary files in <code>/tmp/focusbear-*</code></li>
          <li>System proxy settings (if active)</li>
          <li>Focus session state</li>
        </ul>

        <p style={{ marginTop: '15px' }}>
          <strong>Note:</strong> This does not remove the mitmproxy certificate.
          If you want to remove it, see the instructions below.
        </p>

        <div style={{ marginTop: '20px' }}>
          <button
            className="cleanup-btn"
            onClick={handleCleanup}
            disabled={isCleaningUp}
          >
            {isCleaningUp ? 'Cleaning up...' : 'Clean Up App Data'}
          </button>
        </div>
      </div>

      <div className="setup-section">
        <h2 className="section-header">
      
          Uninstall the application
        </h2>

        <p>
          After cleaning up your data, you can uninstall Focus Bear using your system's package manager:
        </p>

        <div className="command-group">
          <p className="command-label">Uninstall command for your system ({distro}):</p>
          <CodeBlock
            command={getUninstallCommand()}
            commandId="uninstall-cmd"
          />
        </div>

        <p style={{ marginTop: '15px', color: '#666', fontSize: '0.85rem' }}>
          Run this command in your terminal to completely remove Focus Bear from your system.
        </p>
      </div>

      <div className="setup-section">
        <h2 className="section-header">

          Remove mitmproxy certificate (Optional)
        </h2>

        <p>
          If you want to completely remove the mitmproxy CA certificate from your system:
        </p>

        <div className="browser-instructions">
          <h4>Remove from Browser:</h4>
          <ol className="instruction-list">
            <li><strong>Firefox:</strong> Settings → Privacy & Security → Certificates → View Certificates → Authorities tab → Find "mitmproxy" → Delete</li>
            <li><strong>Chrome:</strong> Settings → Privacy and security → Security → Manage certificates → Authorities tab → Find "mitmproxy" → Delete</li>
          </ol>

          <h4>Remove from System:</h4>
          <div className="command-group">
            <CodeBlock
              command="sudo rm /usr/local/share/ca-certificates/mitmproxy-ca.crt"
              commandId="remove-cert-1"
            />
          </div>
          <div className="command-group">
            <CodeBlock
              command="sudo update-ca-certificates"
              commandId="remove-cert-2"
            />
          </div>
          <div className="command-group">
            <CodeBlock
              command="rm -rf ~/.mitmproxy"
              commandId="remove-cert-3"
            />
          </div>
        </div>
      </div>

  
    </section>
  );
};

export default UninstallPage;
