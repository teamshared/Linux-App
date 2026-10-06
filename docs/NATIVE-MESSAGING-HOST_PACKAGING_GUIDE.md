# Packaging Changes Guide

Covers three commits on `packaging/8-packaging-for-debian`:

| Commit | Summary |
|--------|---------|
| `b841ad3` | Automated native messaging host install + `.xpi` extension packaging |
| `c3b4cb0` | CI pipeline fixes + `zip` runtime dependency + desktop entry patch |
| `7976d17` | Desktop icon launch fix (`--no-sandbox` wrapper) |

---

## What Changed

### 1. Native Messaging Host — No More `sudo`

Previously the installer copied `host.js` to `/usr/local/bin` and required root. It now runs silently inside the Electron main process on every app startup, writing entirely to the user's home directory.

**Files written on first launch:**

```
~/.local/bin/focusbear-native-host          ← wrapper script (calls node host.js)
~/.local/share/focusbear/native-messaging/  ← host.js + package.json
~/.local/share/focusbear/extension/         ← extension source files
~/.local/share/focusbear/focusbear-extension.xpi  ← zipped extension for snap Firefox
~/.mozilla/native-messaging-hosts/com.focusbear.host.json
~/snap/firefox/common/.mozilla/native-messaging-hosts/com.focusbear.host.json
```

Both the standard and snap Firefox manifest locations are written so the native host works regardless of how Firefox was installed.

### 2. Firefox Extension Loading

Because snap Firefox's XDG portal only grants access to a single file at a time, the extension files are zipped into `focusbear-extension.xpi` on startup using the system `zip` binary.

**To load the extension in Firefox:**
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `~/.local/share/focusbear/focusbear-extension.xpi`

> The `.xpi` is recreated on every app launch, so it stays in sync with any packaged extension updates.

### 3. `.deb` Package — `postinst` / `prerm`

When installed via `sudo dpkg -i`, the package runs `build/postinst` as root, which handles system-wide setup separately from the per-user home-dir setup above.

**`postinst` does:**
- Sets `chrome-sandbox` SUID root (`chmod 4755`)
- Creates `/usr/bin/focusbear` wrapper script (see §4 below)
- Patches the `.desktop` `Exec` line to use `/usr/bin/focusbear %U`
- Writes `/usr/local/bin/focusbear-native-host` for non-snap Firefox
- Installs system-wide Firefox manifest to `/usr/lib/mozilla/native-messaging-hosts/`

**`prerm` does:**
- Removes `/usr/bin/focusbear`, `/usr/local/bin/focusbear-native-host`, and the system manifest

### 4. Desktop Icon Fix

The app is installed to `/opt/Focus Bear/` (space in path). This caused two problems when launching from the desktop icon:

1. Electron's `LaunchProcess` splits on the space, failing to find `chrome-sandbox`
2. The user-namespace sandbox fallback is blocked by AppArmor on this kernel

**Fix:** `postinst` now writes a wrapper script instead of a plain symlink:

```sh
#!/bin/sh
exec "/opt/Focus Bear/focusbear" --no-sandbox "$@"
```

`--no-sandbox` is safe because `chrome-sandbox` is already set SUID root by the same `postinst`, so Electron's privileged sandbox path still works normally.

### 5. CI Pipeline (`build-deb.yml`)

Three fixes were needed for the pipeline to produce a working `.deb`:

| Fix | Why |
|-----|-----|
| `apt-get install zip` | App uses `zip` on first launch to create `.xpi`; must be on the runner and declared as a runtime dep |
| `chmod +x build/postinst build/prerm` | GitHub checkout strips the executable bit; `electron-builder` embeds these into the `.deb` control archive and `dpkg` refuses to run non-executable scripts |
| `zip` added to `package.json` `deb.depends` | Ensures `zip` is installed on end-user systems when the `.deb` is installed |

---

## Dependencies

| Dependency | Where declared | Why |
|------------|---------------|-----|
| `nodejs` | `package.json` `deb.depends` + `rpm.depends` | Runs `host.js` via the native host wrapper |
| `zip` | `package.json` `deb.depends` + CI `apt-get` | Creates `focusbear-extension.xpi` on first launch |

> `mitmproxy` was removed from both `deb` and `rpm` depends in `b841ad3` — native messaging no longer uses it.

---

## Build & Test Locally

**Build the `.deb`:**
```bash
npm ci
chmod +x build/postinst build/prerm   # needed if cloned fresh
npm run package:all
```

Output: `dist/focusbear_*.deb`

**Install and verify:**
```bash
sudo dpkg -i dist/focusbear_*.deb

# Check wrapper exists
cat /usr/bin/focusbear

# Check desktop entry was patched
grep '^Exec' /usr/share/applications/focusbear.desktop

# Check system-wide Firefox manifest
cat /usr/lib/mozilla/native-messaging-hosts/com.focusbear.host.json

# Launch app and check per-user files are created
focusbear &
ls ~/.local/share/focusbear/
```

**Uninstall:**
```bash
sudo dpkg -r focusbear
# Verify cleanup
ls /usr/bin/focusbear /usr/local/bin/focusbear-native-host 2>&1

```
