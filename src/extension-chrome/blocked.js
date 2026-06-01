/**
 * Blocked page script - Chrome MV3 version
 * URL is passed in hash (#URL) instead of query params to avoid & encoding issues with DNR regexSubstitution
 */

const browser = globalThis.browser ?? globalThis.chrome;

const tips = [
  "Try the Pomodoro technique: 25 minutes of focused work, followed by a 5-minute break.",
  "Close unnecessary tabs and apps to minimize distractions.",
  "Take regular breaks to maintain focus and avoid burnout.",
  "Write down what you want to accomplish before starting work.",
  "Turn off notifications during your focus sessions.",
  "Use a physical notepad to jot down distracting thoughts for later.",
  "Stand up and stretch every hour to refresh your mind.",
  "Keep a water bottle nearby - staying hydrated helps concentration."
];

document.addEventListener('DOMContentLoaded', async function() {
  // URL is in hash (from DNR regexSubstitution redirect) or query params (fallback)
  const hash = window.location.hash.slice(1);
  const blockedUrl = (hash.startsWith('http') ? hash : null)
    ?? new URLSearchParams(window.location.search).get('url')
    ?? 'Unknown URL';

  const matchedValue = new URLSearchParams(window.location.search).get('value') || blockedUrl;
  const blockType = new URLSearchParams(window.location.search).get('reason') || 'domain';

  const blockValueEl = document.getElementById('blockValue');
  if (blockValueEl) blockValueEl.textContent = matchedValue;

  document.title = `Blocked: ${blockedUrl}`;

  const subtitleEl = document.getElementById('subtitle');
  const messageEl = document.getElementById('message');
  if (blockType === 'regex') {
    if (subtitleEl) subtitleEl.textContent = 'Blocked by pattern match';
    if (messageEl) messageEl.textContent = 'This URL matches a blocking rule in your configuration.';
  } else {
    if (subtitleEl) subtitleEl.textContent = 'This site is on your blocklist';
    if (messageEl) messageEl.textContent = 'Take a moment to refocus on what matters most.';
  }

  try {
    const result = await browser.storage.local.get(['blocklist']);
    const blocklist = result.blocklist || [];
    if (blocklist.length > 0) {
      const statsContainer = document.getElementById('statsContainer');
      if (statsContainer) {
        const div = document.createElement('div');
        div.className = 'stats';
        div.innerHTML = `<span class="stats-icon">🛡️</span><span><strong>${blocklist.length}</strong> patterns active</span>`;
        statsContainer.appendChild(div);
      }
    }
  } catch {}

  const tipTextEl = document.getElementById('tipText');
  if (tipTextEl) tipTextEl.textContent = tips[Math.floor(Math.random() * tips.length)];

  const reasonRule = document.getElementById('reasonRule');
  const reasonUrl = document.getElementById('reasonUrl');
  if (reasonRule) reasonRule.textContent = `${matchedValue} (${blockType})`;
  if (reasonUrl) reasonUrl.textContent = blockedUrl;

  const openModal = id => document.getElementById(id)?.classList.add('open');
  const closeModal = id => document.getElementById(id)?.classList.remove('open');

  document.getElementById('openReason')?.addEventListener('click', () => openModal('reasonModal'));
  document.getElementById('openUnblock')?.addEventListener('click', () => openModal('unblockModal'));
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
  });

  const domainBtn = document.getElementById('unblockDomain');
  const exactBtn = document.getElementById('unblockExact');
  const durationSelect = document.getElementById('unblockDuration');

  const getDurationMs = () => parseInt(durationSelect.value, 10) * 60 * 1000;
  const formatDuration = (mins) => {
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  let domain = '';
  try { domain = new URL(blockedUrl).hostname; } catch {}

  const updateButtonText = () => {
    const label = formatDuration(parseInt(durationSelect.value, 10));
    if (domainBtn && domain) domainBtn.textContent = `Unblock this domain (${label})`;
    if (exactBtn) exactBtn.textContent = `Unblock this exact URL (${label})`;
  };
  durationSelect.addEventListener('change', updateButtonText);
  updateButtonText();

  if (domainBtn) {
    if (!domain) domainBtn.disabled = true;
    domainBtn.addEventListener('click', async () => {
      domainBtn.disabled = true;
      domainBtn.textContent = 'Unblocking...';
      try {
        await browser.runtime.sendMessage({ type: 'ADD_WHITELIST', pattern: domain, patternType: 'domain', durationMs: getDurationMs() });
        window.location.href = blockedUrl;
      } catch {
        domainBtn.textContent = 'Failed — try again';
        domainBtn.disabled = false;
      }
    });
  }

  if (exactBtn) {
    exactBtn.addEventListener('click', async () => {
      exactBtn.disabled = true;
      exactBtn.textContent = 'Unblocking...';
      try {
        await browser.runtime.sendMessage({ type: 'ADD_WHITELIST', pattern: blockedUrl, patternType: 'exact', durationMs: getDurationMs() });
        window.location.href = blockedUrl;
      } catch {
        exactBtn.textContent = 'Failed — try again';
        exactBtn.disabled = false;
      }
    });
  }
});
