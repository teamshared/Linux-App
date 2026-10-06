# Focus Bear Native Messaging Extension

This extension communicates with the Focus Bear Electron app via native messaging to receive and enforce block lists.

## Setup for Development

### 1. Install the Native Messaging Host

Run this command from the project root:

```bash
npm run install-native-messaging
```

Or manually:

```bash
node src/native-messaging/install.js
```

This will:
- Copy the native host script to `/usr/local/bin/focusbear-native-host`
- Install the Firefox manifest to `~/.mozilla/native-messaging-hosts/`

### 2. Load the Extension in Firefox

1. Open Firefox
2. Navigate to `about:debugging#/runtime/this-firefox`
3. Click **"Load Temporary Add-on..."**
4. Navigate to `src/extension/` in this project
5. Select the `manifest.json` file

The extension will now be loaded and should appear in your toolbar.

### 3. Test the Connection

1. Start the Electron app (this starts the Unix socket server)
2. Click the Focus Bear extension icon in your Firefox toolbar
3. You should see:
   - Connection status (green = connected, red = disconnected)
   - Number of block patterns loaded
   - List of all block patterns/regexes

### 4. Configure Block List

Use the Focus Bear app to configure your block list. The app will automatically broadcast updates to the extension via the native messaging host.

## How It Works

```
┌─────────────────┐
│  Electron App   │
│  (Focus Bear)   │
└────────┬────────┘
         │ Unix Socket
         │ /tmp/focusbear.sock
         ▼
┌─────────────────────────────────┐
│ Native Messaging Host           │
│ (/usr/local/bin/...)            │
└────────┬────────────────────────┘
         │ stdin/stdout (JSON)
         ▼
┌─────────────────────────────────┐
│ Firefox Extension               │
│ (background.js + popup)         │
└─────────────────────────────────┘
```

## Files

- **manifest.json** - Extension manifest with permissions
- **background.js** - Handles native messaging connection and URL blocking
- **popup.html** - Extension popup UI
- **popup.js** - Popup logic and display
- **icon.png** - Extension icon

## Debugging

### Check Native Host Logs

```bash
tail -f /tmp/focusbear-native-host.log
```

### Check Extension Console

1. Go to `about:debugging#/runtime/this-firefox`
2. Find the Focus Bear extension
3. Click **"Inspect"**
4. Check the Console tab for logs

### Test Native Host Manually

You can test the native host directly:

```bash
echo '{"type":"PING"}' | /usr/local/bin/focusbear-native-host
```

Note: This won't work exactly as shown because native messaging uses length-prefixed messages, but you can check if the script runs.

## Uninstalling

Remove the native messaging components:

```bash
# Remove native host
sudo rm /usr/local/bin/focusbear-native-host

# Remove Firefox manifest
rm ~/.mozilla/native-messaging-hosts/com.focusbear.host.json
```

## Next Steps

- [ ] Add support for Chrome/Chromium
- [ ] Implement two-way communication (extension can send data back to app)
- [ ] Add more sophisticated blocking rules (time-based, etc.)
- [ ] Package extension for Firefox Add-ons store
- [ ] Auto-installer in app settings
