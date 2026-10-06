# URL Blocking Architecture

## Current Implementation: Native Messaging Host

Focus Bear now uses a **Native Messaging Host** architecture to enable browser-based URL blocking without the overhead, complexity, and invasiveness of system-wide proxying. This approach respects system resources and user privacy while providing robust blocking capabilities.

### Architecture Overview

```
┌─────────────────┐
│  Electron App   │  (Focus Bear)
└────────┬────────┘
         │ Unix Socket
         │ /tmp/focusbear.sock
         ▼
┌─────────────────────────────────┐
│ Native Messaging Host           │  Node.js process
│ /usr/local/bin/focusbear-*      │  (stdio bridge)
└────────┬────────────────────────┘
         │ Native Messaging Protocol
         │ (stdin/stdout JSON)
         ▼
┌─────────────────────────────────┐
│ Browser Extension               │  Firefox/Chrome
│ (WebExtensions API)             │
└─────────────────────────────────┘
```

### How It Works

1. **Electron App** manages the blocklist and communicates with the native host via Unix socket
2. **Native Messaging Host** (`src/native-messaging/host.js`) acts as a bridge:
   - Connects to Electron app via Unix domain socket (`/tmp/focusbear.sock`)
   - Communicates with browser extension using Native Messaging protocol (length-prefixed JSON over stdin/stdout)
   - Forwards blocklist updates
3. **Browser Extension** (`src/extension/`) receives blocklist and blocks matching URLs using the `webRequest` API

### Key Features

#### Bidirectional Communication
- Native host maintains persistent socket connection to Electron app
- Real-time blocklist updates pushed to extension when user modifies settings
- Extension can request current blocklist on demand

#### Resilient Connection Handling
- Automatic reconnection with exponential backoff if connection drops
- Graceful degradation ensures blocking continues during temporary disconnections

#### Smart URL Matching
The extension supports multiple matching strategies:
- **Domain matching**: `facebook.com` blocks `facebook.com` and `www.facebook.com`
- **Subdomain matching**: `.reddit.com` blocks all subdomains
- **Simple substring**: Matches URLs containing the pattern
- **Regex patterns**: Full regex support for advanced blocking rules

### Advantages Over mitmproxy Approach

| Aspect | Native Messaging | mitmproxy (deprecated) |
|--------|-----------------|----------------------|
| **Performance** | Near-zero overhead | 70x slowdown observed |
| **User Setup** | One-click extension install | Manual CA cert + proxy config |
| **Security** | No MITM, browser-native | Requires trusting custom CA |
| **Resource Usage** | Lightweight (<10MB RAM) | Heavy proxy process |
| **Sandboxing** | Works with Flatpak/Snap | Breaks with sandboxed browsers |
| **Maintenance** | Auto-updates via extension | Requires cert renewal |

### Installation

#### For Development

1. **Install Native Messaging Host:**
   ```bash
   npm run install-native-messaging
   ```
   This installs the native host to `/usr/local/bin/` and creates Firefox manifest.

2. **Load Extension in Firefox:**
   - Navigate to `about:debugging#/runtime/this-firefox`
   - Click "Load Temporary Add-on"
   - Select `src/extension/manifest.json`

3. **Start Electron App:**
   The app automatically starts the Unix socket server on startup and broadcasts blocklist updates.

#### For Production

The Electron app will automatically:
- Install the native messaging host on first launch
- Configure browser manifests in `~/.mozilla/native-messaging-hosts/`
- Handle extension updates and blocklist synchronization

### File Locations

- **Native Host Binary:** `/usr/local/bin/focusbear-native-host`
- **Firefox Manifest:** `~/.mozilla/native-messaging-hosts/com.focusbear.host.json`
- **Chrome Manifest:** `~/.config/google-chrome/NativeMessagingHosts/com.focusbear.host.json`
- **Host Logs:** `/tmp/focusbear-native-host.log`

### Debugging

Check native host logs for connection issues:
```bash
tail -f /tmp/focusbear-native-host.log
```

Inspect extension console:
1. Go to `about:debugging#/runtime/this-firefox`
2. Find Focus Bear extension
3. Click "Inspect" to view console logs

### Current Status

✅ **Implemented:**
- Unix socket communication between Electron and native host
- Native Messaging protocol bridge (stdin/stdout)
- Firefox extension with webRequest blocking
- Real-time blocklist updates
- Multiple URL matching strategies
- Auto-installation on app startup
- Resilient connection handling with fallback

🚧 **In Progress:**
- Chrome/Chromium support (manifest v3 compatibility)
- Extension packaging for browser stores
- User-facing installation UI in settings

📋 **Future Enhancements:**
- Time-based blocking rules
- Per-site allow/block toggles
- Block attempt logging and statistics
- Extension whitelist management

---

## Deprecated: mitmproxy Approach

> **Note:** The mitmproxy-based blocking method has been completely removed from this codebase. The native messaging approach described above eliminates all the issues that mitmproxy had: no certificates to manage, no system proxy configuration, no performance overhead, and works seamlessly with sandboxed browsers.
