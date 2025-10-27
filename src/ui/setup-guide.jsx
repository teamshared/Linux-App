import { useState, useEffect } from 'react';
import './styles/Consistent-colors.css';
import './styles/setup-guide.css';

const SetupGuide = function() {
  const [copiedCommand, setCopiedCommand] = useState(null);
  const [certificateExists, setCertificateExists] = useState(null);
  const [certificatePath, setCertificatePath] = useState('~/.mitmproxy/mitmproxy-ca-cert.pem');
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkCertificate();
  }, []);

  const checkCertificate = async function() {
    setIsChecking(true);
    try {
      if (window.api?.checkCertificateExists) {
        const exists = await window.api.checkCertificateExists();
        setCertificateExists(exists);
      }
      if (window.api?.getCertificatePath) {
        const path = await window.api.getCertificatePath();
        setCertificatePath(path);
      }
    } catch (error) {
      console.error('Failed to check certificate:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const copyToClipboard = function(text, commandId) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCommand(commandId);
      setTimeout(() => setCopiedCommand(null), 2000);
    });
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
    <section id="setup-guide">
      <h1 style={{ fontSize: '1.3rem', marginBottom: '15px' }}>Certificate Setup Guide</h1>

      <div>
        <p>
          To block websites, Focus Bear uses mitmproxy to inspect connections.
          For this to work properly, you need to install and trust the mitmproxy CA certificate
          in your browser and system. Without this, you'll see certificate errors on every website
          when a focus session is active.
        </p>
      </div>

      {!isChecking && (
        <div className={`installation-status ${certificateExists ? 'installed' : 'not-installed'}`}>
          <div className="status-icon">
            {certificateExists ? '✓' : '⚠'}
          </div>
          <div className="status-content">
            <h3 className="status-title">
              {certificateExists ? 'Certificate file found' : 'Certificate not generated yet'}
            </h3>
            <p className="status-message">
              {certificateExists
                ? 'The certificate file exists. Make sure you\'ve imported it into your browser and system (see steps below).'
                : 'Start a focus session once to generate the certificate, then import it into your browser.'}
            </p>
            <button className="refresh-btn" onClick={checkCertificate}>
              Check again
            </button>
          </div>
        </div>
      )}

      <div className="setup-section">
        <h2 className="section-header">     
          Generate the certificate
        </h2>

        <ol className="instruction-list">
          <li>Open Focus Bear from the system tray to show the menu</li>
          <li>Click <strong>"Start Focus Session"</strong> to start mitmproxy</li>
          <li>This automatically generates the certificates in <code>~/.mitmproxy/</code></li>
          <li>Once generated, you can stop the focus session</li>
        </ol>

        <p style={{ marginTop: '15px' }}>
          <strong>Certificate location:</strong>
        </p>
        <CodeBlock
          command={certificatePath}
          commandId="cert-path"
        />
      </div>

      <div className="setup-section">
        <h2 className="section-header">
          Import certificate to your browser
        </h2>

        <p>
          Navigate to your browser settings and import the generated certificate.
          This step is <strong>critical</strong> - without it, all websites will show certificate errors.
        </p>

        <div className="browser-instructions">
          <h4>Firefox:</h4>
          <ol className="instruction-list">
            <li>Go to <strong>Settings → Privacy & Security → Certificates</strong></li>
            <li>Click <strong>"View Certificates..."</strong></li>
            <li>Go to the <strong>Authorities</strong> tab</li>
            <li>Click <strong>"Import..."</strong> and select <code>~/.mitmproxy/mitmproxy-ca-cert.pem</code></li>
            <li className="note">Note: You may need to enable "Show Hidden Files" in the file explorer to navigate to the certificate</li>
            <li>Check <strong>"Trust this CA to identify websites"</strong> and click OK</li>
          </ol>

          <h4>Chrome/Chromium:</h4>
          <ol className="instruction-list">
            <li>Go to <strong>Settings → Privacy and security → Security → Manage certificates</strong></li>
            <li>Go to the <strong>Authorities</strong> tab</li>
            <li>Click <strong>"Import"</strong> and select <code>~/.mitmproxy/mitmproxy-ca-cert.pem</code></li>
            <li>Check <strong>"Trust this certificate for identifying websites"</strong></li>
            <li>Click OK</li>
          </ol>
        </div>
      </div>

      <div className="setup-section">
        <h2 className="section-header">
          Install system-wide (Optional but recommended)
        </h2>

        <p>
          For applications outside your browser to trust the mitmproxy certificate,
          install it system-wide:
        </p>

        <div className="command-group">
          <CodeBlock
            command={`sudo cp ${certificatePath} /usr/local/share/ca-certificates/mitmproxy-ca.crt`}
            commandId="copy-cert"
          />
        </div>

        <div className="command-group">
          <CodeBlock
            command="sudo update-ca-certificates"
            commandId="update-certs"
          />
        </div>
      </div>

      <div className="setup-section warning-section">
        <h2 className="section-header">
          <span className="step-number">⚠</span>
          Important Warning
        </h2>
        <p>
          <strong>If you start a focus session without completing Step 2:</strong>
        </p>
        <ul className="instruction-list">
          <li>Your browser will show certificate errors on every HTTPS website</li>
          <li>Websites will display warnings like "Your connection is not private"</li>
          <li>You won't be able to browse the internet normally</li>
        </ul>
        <p style={{ marginTop: '15px' }}>
          <strong>Solution:</strong> If this happens, stop the focus session from the system tray,
          then complete the certificate import steps above before starting a new focus session.
        </p>
      </div>

      <div className="setup-section success-section">
        <h2 className="section-header">
          <span className="step-number">✓</span>
          You're all set!
        </h2>
        <p>
          Once you've imported the certificate, your browser will trust the mitmproxy connection.
          You can now use Focus Bear to block distracting websites during focus sessions without any certificate warnings!
        </p>
      </div>
    </section>
  );
};

export default SetupGuide;
