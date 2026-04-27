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
- **Firefox Manifest:** `~/.mozilla/native-messaging-hosts/com.focusbear.native_host.json`
- **Chrome Manifest:** `~/.config/google-chrome/NativeMessagingHosts/com.focusbear.native_host.json`
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

> **Note:** The mitmproxy-based blocking method is deprecated and will be removed in a future release. It is documented here for reference only.

### Manual Configuration & User Burden

A primary drawback of the mitmproxy architecture was the high degree of manual intervention required from the user. Because automated injection is unreliable across diverse Linux environments, the setup process mandated several manual steps that created a high barrier to entry:

* **Manual Certificate Import:** Users had to navigate through deep browser security menus (e.g., `Settings -> Privacy & Security -> Certificates -> View Certificates`) to manually import the mitmproxy CA. This included the friction of trusting a root CA, which often triggered intimidating security warnings from the browser.
* **Proxy Entry:** Users were required to manually toggle their browser's network settings to point to `localhost:8080`. This was a tedious process that most users expected to be handled "under the hood."
* **Sandboxing Conflicts:** For users running browsers as **Flatpaks** or **Snaps**, manual configuration was even more complex due to filesystem isolation, often requiring additional permissions overrides (via Flatseal or CLI) just to allow the browser to see the local proxy or certificate files.

This manual "onboarding" was not only a poor user experience but also a significant point of failure for non-technical users who found the process daunting or error-prone.

### Technical Overview
The implementation utilized **mitmproxy** to intercept and filter web traffic. For this to function, the following conditions had to be met:
1.  **Certificate Trust:** A custom CA certificate had to be installed and trusted by the operating system and/or specific browser certificate stores (e.g., NSS).
2.  **Proxy Configuration:** Browsers had to be configured to route traffic through the local `mitmproxy` instance.

### Challenges & Limitations

#### 1. Automation Complexity
Automating these steps on Linux was notoriously difficult due to the fragmentation of certificate stores.
* **System vs. Browser Stores:** Many browsers (like Firefox) use their own internal NSS database rather than the system-wide store.
* **The "Brute Force" Method:** Previous suggestions included programmatically digging through every possible certificate store to inject the CA. This was fragile and posed security risks.
* **Policy Constraints:** While browser policies could automate certificate installs, they generally required a **browser restart** to take effect, disrupting the user's workflow.

#### 2. Performance Degradation
The performance overhead of routing all web traffic through a local proxy was substantial. 
* **Latency:** In testing, system-wide proxying showed potential traffic slowdowns of **up to 70x**. 
* **Resource Usage:** Maintaining an active proxy service permanently incurred a constant CPU and memory footprint, which was undesirable for a productivity-focused application.

#### 3. User Experience & Invasiveness
For the Linux community, transparency and system integrity are paramount.
* **Invasiveness:** Forcing a system-wide proxy was a heavy-handed approach for a URL-blocking feature.
* **User Friction:** Requiring users to trust a custom root CA and endure significant network latency did not align with the goal of a lightweight, efficient Linux application.

### Why We Moved Away
The native messaging approach eliminates all of these issues:
- No certificates to manage
- No system proxy configuration
- No performance overhead
- Works seamlessly with sandboxed browsers
- Simple one-click extension installation

The mitmproxy functionality remains in the codebase for backward compatibility but is no longer the recommended blocking method.
