# Sprint 1 Product Backlog Report

## Items Covered

- **Item A:** `.deb` packaging for Debian-based Linux (PBI27)
- **Item B:** Clean Uninstall to remove related files (PBI31)
- **Item C:** CI pipeline so developers never build packages locally (PBI32)

---

## Item A: `.deb` Packaging

Installing via `apt` gives users:

- Automatic resolution and installation of runtime dependencies (`python3`, `mitmproxy`)
- A desktop launcher entry so Focus Bear appears in GNOME, KDE, and other DEs
- Registration of the `focusbear://` URL protocol handler for Auth0 callbacks
- A clean removal path — `apt remove focusbear` runs a cleanup script that removes all runtime files the app wrote outside its install directory

### Current Implementation

The configuration lives in `package.json` under the `build` key. `electron-builder` reads it and calls `dpkg-deb` (via `fakeroot`) to produce the final `.deb`.

**Relevant config:**

```json
"deb": {
  "depends": ["python3", "mitmproxy"],
  "afterRemove": "build/scripts/afterRemove.sh"
}
```

### What Gets Installed on the User's Machine

```
/opt/focusbear/
  focusbear                        // Electron binary

/usr/bin/focusbear                 // Symlink → /opt/focusbear/focusbear

/usr/share/applications/
  focusbear.desktop                // Desktop launcher (auto-generated)

/usr/share/mime/packages/
  focusbear.xml                    // focusbear:// protocol registration
```

### Runtime Files Created by the App (not the package)

```
~/.config/focusbear/               // Electron userData: settings, auth tokens
~/.mitmproxy/                      // mitmproxy CA certificate
/tmp/focusbear-blocklist.txt       // Active URL blocklist
/tmp/focusbear-keywords.txt        // Active keyword list
~/.focus_proxy_env                 // Proxy state file
```

### How to Install

```bash
# Preferred - apt resolves dependencies automatically
sudo apt install ./focusbear-1.0.0-amd64.deb

# Low-level - dpkg only, then fix missing deps
sudo dpkg -i focusbear-1.0.0-amd64.deb
sudo apt-get install -f
```

### How to Uninstall

```bash
sudo apt remove focusbear
```

### How to Build Locally

```bash
# Prerequisites on a Debian/Ubuntu machine
sudo apt-get install fakeroot python3 mitmproxy

# Install Node dependencies
npm ci

# Provide Auth0 credentials in env file
# .env.production

# Build — produces dist/focusbear-1.0.0-amd64.deb
npm run package:all
```

---

## Item B: Cleanup

Clean uninstall is implemented at two levels, which together ensure nothing is left behind regardless of how the user removes the app:

- **Layer 1 — In-app cleanup:** Settings > Uninstall > "Clean Up App Data"
- **Layer 2 — Package manager hook:** runs `afterRemove.sh` automatically on `apt remove`

Both layers are needed. A user may run in-app cleanup before uninstalling (best practice). But if they skip that step and go straight to `apt remove`, the `afterRemove.sh` script is the safety net.

The cleanup process:

1. Deletes `/tmp/focusbear-blocklist.txt` and `/tmp/focusbear-keywords.txt`
2. Deletes `~/.focus_proxy_env`
3. Deletes `settings.json` from the Electron userData directory

### `afterRemove.sh`

Located at `build/scripts/afterRemove.sh`. Runs automatically as a `postrm` script when `apt remove focusbear` is executed. It cleans files that exist outside the package's install prefix (which `dpkg` cannot track):

```bash
# Shared temp files
rm -f /tmp/focusbear-blocklist.txt
rm -f /tmp/focusbear-keywords.txt

# Per-user data (iterates all home directories including /root)
for user_home in /root /home/*; do
  rm -f "$user_home/.focus_proxy_env"
  rm -rf "$user_home/.config/focusbear"    # Electron userData
  rm -rf "$user_home/.config/Focus Bear"   # Alternate casing
done
```

---

## Item C: CI Pipeline

The pipeline is defined in `.github/workflows/build-deb.yml`. It runs on an `ubuntu-latest` GitHub Actions runner and produces `.deb` and AppImage artifacts without any local build environment needed.

### Pipeline Steps

| Step | Description |
|------|-------------|
| 1 | Checkout source code |
| 2 | Setup Node.js 24 with npm cache |
| 3 | Cache `~/.cache/electron` (~100 MB, keyed by `package-lock.json` hash) |
| 4 | Cache `~/.cache/electron-builder` |
| 5 | `apt install fakeroot` (required by electron-builder to create `.deb`) |
| 6 | `npm ci` (clean reproducible install) |
| 7 | Inject Auth0 secrets → `.env` (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID` from repo secrets) |
| 8 | Verify secret format (partial reveal: first 4 chars only) |
| 9 | `npm run package:all` (Vite build → electron-builder AppImage + deb) |
| 10 | Upload `focusbear-linux-AppImage` as artifact |
| 11 | Upload `focusbear-linux-deb` as artifact |

### Auth0 Secret Handling

Auth0 credentials are stored as GitHub Actions repository secrets (`VITE_AUTH0_DOMAIN`, `VITE_AUTH0_CLIENT_ID`). They are written into a `.env` file at Step 7 and read by Vite at build time via `import.meta.env.VITE_*`. They are baked into the built JavaScript bundle.
