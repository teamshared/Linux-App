import './styles/Consistent-colors.css';
import './styles/setup-guide.css';

const SetupGuide = function() {
  return (
    <section id="setup-guide">
      <h1 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>mitmproxy Setup (Removed)</h1>

      <div className="installation-status not-installed">
        <div className="status-icon">ℹ️</div>
        <div className="status-content">
          <h3 className="status-title">
            mitmproxy blocking has been removed
          </h3>
          <p className="status-message">
            The mitmproxy-based blocking approach has been completely removed from Focus Bear. 
            All blocking functionality now uses the native messaging extension architecture, 
            which is lightweight, secure, and doesn't require certificate management or system-wide proxy configuration.
          </p>
        </div>
      </div>

      <div className="setup-section">
        <h2 className="section-header">New Blocking Method</h2>
        <p>
          Focus Bear now uses a browser extension with native messaging to block websites. 
          This approach offers several advantages:
        </p>
        <ul className="instruction-list">
          <li>No certificate installation required</li>
          <li>No system proxy configuration needed</li>
          <li>Near-zero performance overhead</li>
          <li>Works with sandboxed browsers (Flatpak, Snap)</li>
          <li>Simple one-click installation</li>
        </ul>
        <p style={{ marginTop: '15px' }}>
          Please refer to the main README for setup instructions for the native messaging extension.
        </p>
      </div>
    </section>
  );
};

export default SetupGuide;
