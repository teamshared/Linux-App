# Focus Bear - Linux Distraction Blocker

A lightweight, browser-native URL blocking application for Linux using Electron and native messaging architecture.

**Status:** [0.1.0] - Ready to Open Source

---

## Quick Start

### Prerequisites

- Node.js v20+ (for development)
- Firefox or Chrome/Chromium browser
- System libraries (see [System Dependencies](#system-dependencies))

### Development

```bash
npm ci                  # Install dependencies
npm run start          # Development mode (hot reload)
npm run start:prod     # Production mode
```

### Production - Install via Package Manager

```bash
# Debian/Ubuntu
sudo dpkg -i ./focusbear-0.1.0-amd64.deb

# Fedora/RHEL
sudo dnf install ./focusbear-0.1.0-x86_64.rpm

# openSUSE
sudo zypper install ./focusbear-0.1.0-x86_64.rpm

# Or use AppImage (no installation)
chmod +x focusbear-0.1.0-x86_64.AppImage
./focusbear-0.1.0-x86_64.AppImage
```

---

## Architecture

Focus Bear uses a **native messaging bridge** to enable browser-based URL blocking without system-wide proxying:

```
┌──────────────────────────────────────────────────────────────┐
│ Electron App                                                 │
│ (blocklist management, Unix socket server)                   │
└────────────────────┬─────────────────────────────────────────┘
                     │ Unix Socket (/tmp/focusbear.sock)
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ Native Messaging Host                                        │
│ (node process, bridges socket ↔ browser native messaging)   │
└────────────────────┬─────────────────────────────────────────┘
                     │ Native Messaging Protocol
                     │
┌────────────────────▼─────────────────────────────────────────┐
│ Browser Extension (Firefox/Chrome)                           │
│ (blocks URLs using WebExtensions webRequest API)            │
└──────────────────────────────────────────────────────────────┘
```

### Why This Approach?

| Feature | Native Messaging | mitmproxy (deprecated) |
|---------|------------------|----------------------|
| Performance | ~0% overhead | 70x slowdown |
| Setup | One-click | Manual proxy + cert config |
| Security | No MITM | Requires custom CA trust |
| Sandboxing | Works with Flatpak/Snap | Breaks with sandboxed browsers |

---

## Installation & Setup

### 1. Install via Package Manager (Recommended)

The package includes automatic dependency checking. During installation, you'll see:

```
╔════════════════════════════════════════════════════════════════╗
║          Focus Bear - Dependency Checker                       ║
╚════════════════════════════════════════════════════════════════╝

Detected package manager: apt

⚠ Found missing dependencies: 3
  - libgtk-3-0
  - libnotify4
  - libnss3

Install missing dependencies now? (requires sudo) [Y/n]
```

**Press Enter** to automatically install all dependencies.

### 2. Post-Installation Setup

After installation, the app automatically:
- Creates `/usr/bin/focusbear` wrapper script
- Installs native messaging host
- Configures Firefox/Chrome manifests
- Creates `~/.local/share/focusbear/` with extension files

**First launch:**
```bash
focusbear &
```

### 3. Load Extension in Firefox

1. Open Firefox → `about:debugging#/runtime/this-firefox`
2. Click **"Load Temporary Add-on"**
3. Select `~/.local/share/focusbear/focusbear-extension.xpi`

### 4. Load Extension in Chrome

1. Open Chrome → `chrome://extensions/`
2. Enable **"Developer mode"** (top right)
3. Click **"Load unpacked"**
4. Select `~/.local/share/focusbear/extension/`

---

## System Dependencies

### Debian/Ubuntu

```bash
sudo apt-get install -y \
  libgtk-3-0 libglib2.0-0 libx11-6 libdbus-1-3 \
  libfontconfig1 libfreetype6 libnotify4 libnss3 \
  libxss1 libxtst6 xdg-utils libatspi2.0-0 \
  libuuid1 libsecret-1-0 python3 nodejs zip
```

### Fedora/RHEL

```bash
sudo dnf install -y \
  gtk3 glib2 libX11 dbus fontconfig freetype \
  libnotify nss libXss libXtst xdg-utils \
  at-spi2-core util-linux libsecret python3 nodejs zip
```

### openSUSE

```bash
sudo zypper install -y \
  gtk3 glib2 libX11-6 dbus-1 fontconfig freetype2 \
  libnotify1 mozilla-nss libxss1 libXtst6 xdg-utils \
  at-spi2-core util-linux libsecret-1-0 python3 nodejs zip
```

---

## Usage

### In the App

1. **Add URLs to block** in the blocklist
2. **Export domains** to sync with browser
3. **Enable focus sessions** to activate blocking
4. **Whitelist exceptions** as needed

### In the Browser Extension

- Green status ✅ = Connected to native host
- Red status ❌ = Connection lost (restart the app)
- View current blocklist directly in extension popup

---

## Uninstallation

### Via Package Manager

```bash
# Debian/Ubuntu
sudo apt-get remove focusbear

# Fedora/RHEL
sudo dnf remove focusbear

# openSUSE
sudo zypper remove focusbear
```

### Manual Cleanup

```bash
# Remove all user data
rm -rf ~/.local/share/focusbear/
rm -rf ~/.mozilla/native-messaging-hosts/com.focusbear.native_host.json
rm -rf ~/.config/focusbear/
rm -f /tmp/focusbear.sock
```

---

## Debugging

### Common Issues

#### Native Host Connection Failed
```bash
# Check if socket exists
ls -la /tmp/focusbear.sock

# View native host logs
tail -f /tmp/focusbear-native-host.log

# Kill stale process
pkill -f focusbear
```

#### Extension Not Loading
```bash
# Verify extension file
ls -la ~/.local/share/focusbear/focusbear-extension.xpi

# Check Firefox manifest
cat ~/.mozilla/native-messaging-hosts/com.focusbear.native_host.json
```

#### Missing Dependencies
Re-run installation; dependency checker will auto-install:

```bash
sudo apt-get install ./focusbear-0.1.0-amd64.deb  # Debian
sudo dnf install ./focusbear-0.1.0-x86_64.rpm    # Fedora
```

### Debug Commands

```bash
# View app version
focusbear --version

# Check installed packages
dpkg -l | grep focusbear        # Debian
rpm -qa | grep focusbear        # RPM

# Monitor socket connections
lsof /tmp/focusbear.sock

# View browser extension console
Firefox: about:debugging#/runtime/this-firefox → Inspect
Chrome: chrome://extensions → "Details" → "Errors"
```

---

## Building from Source

### Prerequisites

```bash
# Debian/Ubuntu
sudo apt-get install -y nodejs npm fakeroot rpm zip python3

# Fedora/RHEL
sudo dnf install -y nodejs npm fakeroot rpm zip python3

# openSUSE
sudo zypper install -y nodejs npm fakeroot rpm zip python3
```

### Build Steps

```bash
npm ci                              # Install dependencies
chmod +x build/postinst build/prerm # Make scripts executable
npm run package:full                # Build all formats
```

Output:
- `dist/focusbear-0.1.0-x86_64.AppImage` (~160 MB)
- `dist/focusbear-0.1.0-amd64.deb` (~77 MB)
- `dist/focusbear-0.1.0-x86_64.rpm` (~77 MB)

---

## Development Scripts

```bash
npm run start              # Dev mode with hot reload
npm run start:prod        # Production mode
npm run build             # Build frontend
npm run build:dev         # Build frontend (dev)
npm run package           # Package AppImage only
npm run package:all       # Package all formats (AppImage + deb)
npm run package:full      # Package all formats including RPM
npm run lint              # Run ESLint
npm run install-native-messaging  # Install native host manually
```

---

## Known Limitations

### Flatpak ❌
Flatpak sandboxing prevents:
- Writing to `/usr/local/bin/` (native host)
- Firefox native messaging (path resolution fails)
- Systemd service installation
- Per-user extension setup

**Use DEB/RPM/AppImage instead.**

### AppImage
- No systemd background service support
- No package manager auto-updates
- Use DEB/RPM for production deployments

---

## File Locations

| Component | Location |
|-----------|----------|
| App config | `~/.config/focusbear/` |
| App data | `~/.local/share/focusbear/` |
| Native host | `/usr/local/bin/focusbear-native-host` |
| Firefox manifest (system) | `/usr/lib/mozilla/native-messaging-hosts/com.focusbear.native_host.json` |
| Firefox manifest (user) | `~/.mozilla/native-messaging-hosts/com.focusbear.native_host.json` |
| Chrome manifest | `~/.config/google-chrome/NativeMessagingHosts/com.focusbear.native_host.json` |
| Logs | `/tmp/focusbear-native-host.log` |
| Socket | `/tmp/focusbear.sock` (runtime only) |

---

## Documentation

- [URL Blocking Architecture](docs/BLOCKING.md) - How the native messaging system works
- [RPM Packaging Guide](docs/RPM_PACKAGING_GUIDE.md) - RPM-specific details
- [Flatpak Limitations](docs/FLATPAK_LIMITATIONS.md) - Why Flatpak won't work
- [CI/CD Pipeline](docs/PACKAGING\&CI-PIPELINE.md) - GitHub Actions setup
- [Native Messaging Guide](docs/NATIVE-MESSAGING-HOST_PACKAGING_GUIDE.md) - Full technical details

---

## Secrets

Auth0 credentials are stored in GitHub repository secrets:
- `VITE_AUTH0_DOMAIN`
- `VITE_AUTH0_CLIENT_ID`

These are automatically injected during CI builds and embedded in the production bundle.

For local development, create a `.env` file:
```env
VITE_AUTH0_DOMAIN=dev-xxxx.us.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
```

---

## Support

- **Issues:** GitHub Issues
- **Docs:** See links above

---

## Version

**Focus Bear v0.1.0** - Linux Distraction Blocker

---

## License

Released under the [MIT License](LICENSE).
