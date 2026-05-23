/**
 * Popup script - displays blocklist from storage
 */

function log(message) {
  console.log('[Popup]', message);
}

function formatTime(timestamp) {
  if (!timestamp) return 'Never';
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function formatTimeRemaining(expiresAt) {
  const ms = expiresAt - Date.now();
  if (ms <= 0) return 'expired';
  const mins = Math.ceil(ms / 60000);
  return mins === 1 ? '1 min left' : `${mins} mins left`;
}

function renderWhitelist(entries) {
  const container = document.getElementById('whitelist');
  if (!container) return;

  const active = entries.filter(e => e.expiresAt > Date.now());
  if (active.length === 0) {
    container.innerHTML = '<div class="empty">No temporary exemptions</div>';
    return;
  }

  container.innerHTML = active.map(entry => `
    <div class="whitelist-item">
      <div class="whitelist-item-info">
        <div class="whitelist-item-pattern">${escapeHtml(entry.pattern)}</div>
        <div class="whitelist-item-meta">${entry.type} · ${formatTimeRemaining(entry.expiresAt)}</div>
      </div>
      <button class="whitelist-remove" data-pattern="${escapeHtml(entry.pattern)}" title="Remove">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.whitelist-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      browser.runtime.sendMessage({ type: 'REMOVE_WHITELIST', pattern: btn.dataset.pattern })
        .then(() => updateUI());
    });
  });
}

function updateUI() {
  // Get status from background script
  browser.runtime.sendMessage({ type: 'GET_STATUS' }).then(response => {
    const statusHostDiv = document.getElementById('statusHost');
    const statusAppDiv = document.getElementById('statusApp');

    // Native messaging host connection (in debug section)
    if (statusHostDiv) {
      if (response.connected) {
        statusHostDiv.className = 'status-small connected';
        statusHostDiv.textContent = 'Connected to native messaging host';
      } else {
        statusHostDiv.className = 'status-small disconnected';
        statusHostDiv.textContent = 'Not connected to native messaging host';
      }
    }

    // Electron app connection (main display)
    if (statusAppDiv) {
      if (response.connectedToApp) {
        statusAppDiv.className = 'status connected';
        statusAppDiv.textContent = 'Connected to Focus Bear app';
      } else if (response.connected) {
        // Connected to host but not to app
        statusAppDiv.className = 'status warning';
        statusAppDiv.textContent = 'App not running (using cached data)';
      } else {
        statusAppDiv.className = 'status disconnected';
        statusAppDiv.textContent = 'Not connected to Focus Bear app';
      }
    }
  });

  // Get blocklist from storage
  browser.storage.local.get(['blocklist', 'lastUpdate']).then(result => {
    const blocklist = result.blocklist || [];
    const lastUpdate = result.lastUpdate;

    document.getElementById('count').textContent = blocklist.length;
    document.getElementById('lastUpdate').textContent = formatTime(lastUpdate);

    const blocklistDiv = document.getElementById('blocklist');

    if (blocklist.length === 0) {
      blocklistDiv.innerHTML = '<div class="empty">No block patterns loaded</div>';
    } else {
      blocklistDiv.innerHTML = blocklist
        .map(pattern => `<div class="blocklist-item">${escapeHtml(pattern)}</div>`)
        .join('');
    }

    log(`Displayed ${blocklist.length} patterns`);
  });

  browser.runtime.sendMessage({ type: 'GET_WHITELIST' }).then(response => {
    renderWhitelist(response.whitelist || []);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Refresh button handler
document.getElementById('refresh').addEventListener('click', () => {
  log('Refresh button clicked');
  browser.runtime.sendMessage({ type: 'REFRESH_BLOCKLIST' }).then(response => {
    if (response.success) {
      log('Refresh request sent');
      // UI will update when storage changes
      setTimeout(updateUI, 500);
    } else {
      log('Refresh failed:', response.error);
      alert('Failed to refresh: ' + response.error);
    }
  });
});

// Listen for storage changes
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.blocklist || changes.whitelist)) {
    log('Storage changed, updating UI');
    updateUI();
  }
});

// Initial update
updateUI();

// Refresh every 2 seconds
setInterval(updateUI, 2000);

log('Popup loaded');
