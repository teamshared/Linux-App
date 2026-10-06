# **Installing Focus Bear on Linux (package managers)**

This document describes how to install, verify, and uninstall the Focus Bear Linux application using distribution package managers. It currently includes verified flows for Arch Linux (`pacman`) and Fedora / RHEL-family distributions (`dnf` / `rpm`), with a roadmap for other formats.

## Arch Linux (pacman)

### Install

Install the packaged build using `pacman -U`:

```bash
sudo pacman -U /path/to/focusbear-<version>-x86_64.pkg.tar.zst
```

![][pacman-install]  

#### Notes

- `pacman` installs dependencies automatically. If `mitmproxy` does not appear in the output, it may already be present on your system.
- To confirm the package is installed and inspect metadata, you can run:

```bash
pacman -Qi focusbear
```

### Desktop entry (launcher integration)

After installation, Focus Bear should appear in your application launcher.

![][desktop-entry-launcher]  

This addresses issue \#39 \-\> *“As a user, the app needs to appear in my application launcher after installation, so that I can open it like any other desktop application”*

### System tray

Once running, the app should show a system tray icon and a tray popup/menu.

![][system-tray-icon] ![][system-tray-popup]  

This addresses issue \#40 *“As a user, the app needs to be displayed an icon in my desktop environment, so that I can visually identify it in my launcher and taskbar”*

### Verify basic functionality

Launch the app and confirm the main UI loads and is usable.

![][basic-functionality]  

### Uninstall

Remove the package:

```bash
sudo pacman -R focusbear
```

![][pacman-uninstall]  

This addresses issue \#35 *“As a user, I want to be able to uninstall the app cleanly so that no unnecessary files remain on my system”.*

After uninstalling, the app should no longer appear in your launcher.

![][after-uninstall]

## Fedora / RHEL / openSUSE (dnf / rpm)

The `.rpm` artifact is produced by the same CI run as the `.deb` and `AppImage` (workflow: `.github/workflows/build-deb.yml`, target: `npm run package:full`). The filename follows `focusbear-<version>-<arch>.rpm`.

### Install

On Fedora-family distros (Fedora, RHEL, Rocky, AlmaLinux), prefer `dnf` so dependencies resolve automatically:

```bash
sudo dnf install /path/to/focusbear-<version>-x86_64.rpm
```

On openSUSE, use `zypper`:

```bash
sudo zypper install /path/to/focusbear-<version>-x86_64.rpm
```

If you prefer the low-level tool (no automatic dependency resolution — fails if `python3`, `nodejs`, or `zip` are missing):

```bash
sudo rpm -i /path/to/focusbear-<version>-x86_64.rpm
```

#### What the post-install scriptlet does

Defined in `build/rpm-postinst`. It runs as root after files are laid down and:

- Sets `chrome-sandbox` SUID so Electron's process sandbox works.
- Writes a `/usr/bin/focusbear` wrapper that invokes the binary in `/opt/Focus Bear/` with `--no-sandbox` (the install path contains a space, which breaks Electron's `LaunchProcess` argv splitting).
- Patches the `.desktop` `Exec=` to point at the wrapper.
- Installs a system-wide Firefox native messaging manifest at `/usr/lib/mozilla/native-messaging-hosts/com.focusbear.host.json` and a wrapper at `/usr/local/bin/focusbear-native-host`.

### Verify

Inspect package metadata:

```bash
rpm -qi focusbear
```

List installed files:

```bash
rpm -ql focusbear
```

The app should appear in your application launcher and show a system tray icon once running (same expected behavior as the pacman flow above).

### Uninstall

```bash
sudo dnf remove focusbear
# or, equivalently:
sudo rpm -e focusbear
```

The `%preun` scriptlet (`build/rpm-prerm`) only runs cleanup when `$1 = 0` (full uninstall), so an upgrade — where the old version's `%preun` fires *after* the new version's `%post` — won't strip the `/usr/bin/focusbear` wrapper or the native messaging manifest that the new install just created.

## Roadmap (other distribution formats)

The following tickets represent the next phases of distribution support:

* Linux-App \#37 (Flatpak): Providing a sandboxed, distribution-agnostic installation option.  
* Linux-App \#38 (AppImage): Allowing the application to run as a standalone file without a formal installation process.

[pacman-install]: docs/images/pacman-install-and-package-info.png
[desktop-entry-launcher]: docs/images/launcher-desktop-entry-rofi.png
[system-tray-icon]: docs/images/system-tray-icon.png
[system-tray-popup]: docs/images/system-tray-popup.png
[basic-functionality]: docs/images/app-dashboard-basic-functionality.png
[pacman-uninstall]: docs/images/pacman-uninstall.png
[after-uninstall]: docs/images/after-uninstall-launcher-entry-removed.png