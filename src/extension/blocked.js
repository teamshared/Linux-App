/**
 * Blocked page script - displays blocking information
 */

// Productivity tips to rotate
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
  // Get blocking info from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const blockedUrl = urlParams.get('url') || 'Unknown URL';
  const matchedValue = urlParams.get('value') || urlParams.get('pattern') || 'Unknown pattern';
  const blockType = urlParams.get('reason') || 'domain';
  
  console.log('[Blocked Page] Loading with params:', {
    url: blockedUrl,
    value: matchedValue,
    reason: blockType
  });
  
  // Update the matched value display
  const blockValueEl = document.getElementById('blockValue');
  if (blockValueEl) {
    blockValueEl.textContent = matchedValue;
  }
  
  // Set page title
  document.title = `Blocked: ${blockedUrl}`;
  
  // Customize subtitle and message based on block type
  const subtitleEl = document.getElementById('subtitle');
  const messageEl = document.getElementById('message');
  
  if (blockType === 'domain') {
    if (subtitleEl) {
      subtitleEl.textContent = 'This site is on your blocklist';
    }
    if (messageEl) {
      messageEl.textContent = 'Take a moment to refocus on what matters most.';
    }
  } else if (blockType === 'regex') {
    if (subtitleEl) {
      subtitleEl.textContent = 'Blocked by pattern match';
    }
    if (messageEl) {
      messageEl.textContent = 'This URL matches a blocking rule in your configuration.';
    }
  } else if (blockType === 'keyword') {
    if (subtitleEl) {
      subtitleEl.textContent = 'Content contains restricted keyword';
    }
    if (messageEl) {
      messageEl.textContent = 'This page may contain distracting content.';
    }
  }
  
  // Get and display statistics
  try {
    const result = await browser.storage.local.get(['blocklist']);
    const blocklist = result.blocklist || [];
    
    if (blocklist.length > 0) {
      const statsContainer = document.getElementById('statsContainer');
      if (statsContainer) {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats';
        statsDiv.innerHTML = `
          <span class="stats-icon">🛡️</span>
          <span><strong>${blocklist.length}</strong> patterns active</span>
        `;
        statsContainer.appendChild(statsDiv);
      }
    }
  } catch (error) {
    console.error('[Blocked Page] Error loading statistics:', error);
  }
  
  // Show a random productivity tip
  const tipTextEl = document.getElementById('tipText');
  if (tipTextEl) {
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    tipTextEl.textContent = randomTip;
  }
  
  console.log('[Blocked Page] Successfully displayed');
});
