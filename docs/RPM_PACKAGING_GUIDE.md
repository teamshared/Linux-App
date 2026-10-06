# RPM Packaging Guide

## Quick Overview

Focus Bear is packaged for Fedora, RHEL, and openSUSE using electron-builder. The GitHub Actions pipeline automatically builds the RPM package whenever code is pushed.

## Installation

**For Fedora/RHEL/CentOS:**
```bash
sudo dnf install ./focusbear-1.0.0-x86_64.rpm
```

**For openSUSE:**
```bash
sudo zypper install ./focusbear-1.0.0-x86_64.rpm
```

During installation, the system automatically:
- Detects and installs missing dependencies
- Deploys the native messaging host
- Registers the Firefox extension
- Sets up the application launcher

## What Gets Installed

```
/opt/Focus Bear/              - Application files
/usr/bin/focusbear           - Command to launch the app
/usr/share/applications/     - Desktop launcher entry
/usr/local/bin/focusbear-native-host  - Browser extension communication
/usr/lib/mozilla/            - Firefox extension manifest
```

User files are created automatically in `~/.local/share/focusbear/` when the app first runs.

## Launching the App

```bash
focusbear
```

Or find it in your application menu.

## Uninstalling

```bash
sudo dnf remove focusbear
```

All application files and settings are removed. User data in `~/.local/share/focusbear/` is kept (use the app's "Clean Up App Data" option to remove it).

## Build Locally (Development Only)

Get the artifacts from the GitHub Actions pipeline instead of building locally. If you need to build locally for testing:

```bash
sudo apt-get install -y fakeroot rpm zip
npm ci
npm run package:full
```

Output: `dist/focusbear-<version>-x86_64.rpm`

## Verify Installation

```bash
# Check the app is accessible
which focusbear

# Check Firefox extension is registered
ls /usr/lib{,64}/mozilla/native-messaging-hosts/com.focusbear.host.json

# Check package info
rpm -qi focusbear
```

## Firefox Extension

The extension is automatically registered during installation. When you open Firefox and launch Focus Bear, the extension should appear in your toolbar and connect automatically.

If the extension doesn't appear:
1. Restart Firefox
2. Check: `about:debugging#/runtime/this-firefox`
3. Look for "Focus Bear" extension in the list

## Troubleshooting

**Extension not connecting:**
```bash
tail -f /tmp/focusbear-native-host.log
```

**Missing dependencies:**
The installer detects and installs them automatically. If issues occur, reinstall:
```bash
sudo dnf reinstall focusbear-1.0.0-x86_64.rpm
```

**Complete removal:**
```bash
sudo dnf remove focusbear
rm -rf ~/.local/share/focusbear/
rm -rf ~/.config/focusbear/
```