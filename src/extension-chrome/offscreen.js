// Runs in a persistent offscreen document — sends keepalive pings to the service worker
// every 20s so the SW stays active and the native messaging port never closes.
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'KEEPALIVE' }).catch(() => {});
}, 20000);
