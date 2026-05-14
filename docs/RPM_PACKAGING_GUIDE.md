# RPM Packaging Guide

## Files Added for RPM

```
build/rpm-postinst                  ← runs as %post (after install / upgrade)
build/rpm-prerm                     ← runs as %preun (before uninstall / upgrade)
package.json → build.rpm            ← electron-builder rpm config
.github/workflows/build-deb.yml     ← installs rpm + uploads .rpm artifact
```

## Why Two Firefox Manifest Directories

`build/rpm-postinst` writes the system-wide Firefox native messaging manifest to **both**:

```
/usr/lib/mozilla/native-messaging-hosts/com.focusbear.native_host.json
/usr/lib64/mozilla/native-messaging-hosts/com.focusbear.native_host.json
```

Reason: Firefox scans `${LIBDIR}/mozilla/native-messaging-hosts/` where `LIBDIR` is the path Firefox itself was built with.

| Firefox source                       | Scans       |
|--------------------------------------|-------------|
| Fedora / RHEL RPM (x86_64)           | `/usr/lib64` |
| openSUSE RPM                         | `/usr/lib`   |
| Mozilla tarball from mozilla.org     | `/usr/lib`   |
| Debian / Ubuntu .deb                 | `/usr/lib`   |

Writing both paths is harmless on systems that only check one, and avoids a per-distro lookup. The `.deb` only writes `/usr/lib` because that's all Debian-family Firefox uses.

---

## What Gets Installed

Same layout as the `.deb`:

```
/opt/Focus Bear/                                                     ← Electron app bundle
/opt/Focus Bear/chrome-sandbox                                       ← SUID root (set by %post)
/usr/bin/focusbear                                                   ← wrapper, exec's with --no-sandbox
/usr/share/applications/focusbear.desktop                            ← Exec= patched to wrapper
/usr/local/bin/focusbear-native-host                                 ← shell wrapper → node host.js
/usr/lib/mozilla/native-messaging-hosts/com.focusbear.native_host.json
/usr/lib64/mozilla/native-messaging-hosts/com.focusbear.native_host.json
```

Per-user files (`~/.local/share/focusbear/...`, `~/.mozilla/native-messaging-hosts/...`) are created by the Electron app on first launch — same as the `.deb`. See `NATIVE-MESSAGING-HOST_PACKAGING_GUIDE.md`.

---

## Build Locally

Prerequisites (on a Debian/Ubuntu dev box — the CI runner uses the same):

```bash
sudo apt-get install -y fakeroot rpm zip
npm ci
chmod +x build/postinst build/prerm build/rpm-postinst build/rpm-prerm
```

> `rpm` provides `rpmbuild`, which `electron-builder` shells out to. The package is available on Debian/Ubuntu — you do not need to be on a Fedora host to build RPMs.

Build all three formats (AppImage + .deb + .rpm):

```bash
npm run package:full
```

Output: `dist/focusbear-<version>-x86_64.rpm`

Build only the `.rpm`:

```bash
npm run build && npx electron-builder --linux rpm
```

---

## Install & Verify

On Fedora-family (Fedora, RHEL, Rocky, Alma) — use `dnf` so deps resolve automatically:

```bash
sudo dnf install ./focusbear-1.0.0-x86_64.rpm
```

On openSUSE:

```bash
sudo zypper install ./focusbear-1.0.0-x86_64.rpm
```

Low-level (no dep resolution — fails if `python3`, `nodejs`, or `zip` are missing):

```bash
sudo rpm -i focusbear-1.0.0-x86_64.rpm
```

Smoke-test the install:

```bash
# Wrapper exists and points at the bundled binary
cat /usr/bin/focusbear

# Desktop entry was patched to use the wrapper
grep '^Exec' /usr/share/applications/focusbear.desktop

# System-wide Firefox manifest written to both libdirs
ls -l /usr/lib{,64}/mozilla/native-messaging-hosts/com.focusbear.native_host.json

# Package metadata + file manifest
rpm -qi focusbear
rpm -ql focusbear | head
```

Launch:

```bash
focusbear &
ls ~/.local/share/focusbear/        # confirms per-user install ran
```

---

## Uninstall

```bash
sudo dnf remove focusbear           # or: sudo rpm -e focusbear
```

Verify cleanup:

```bash
ls /usr/bin/focusbear \
   /usr/local/bin/focusbear-native-host \
   /usr/lib{,64}/mozilla/native-messaging-hosts/com.focusbear.native_host.json 2>&1
```

All five should report "No such file or directory". Per-user files in `~/.local/share/focusbear/` are *not* removed — they belong to the user, not the package, and the in-app "Clean Up App Data" action is the supported way to remove them.

---