# **Installing Focus Bear on Linux (package managers)**

This document describes how to install, verify, and uninstall the Focus Bear Linux application using distribution package managers. It currently includes a verified flow for Arch Linux (`pacman`), with a roadmap for other formats.

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

## Roadmap (other distribution formats)

For other distributions, the packaging flow is conceptually similar; the main difference is the package format and distribution channel (e.g., `.rpm` for Fedora/Red Hat). This has not been implemented yet to avoid publishing incomplete packages to public repositories.

The following tickets represent the next phases of distribution support:

* Linux-App \#36 (.rpm): Targeting Fedora and Red Hat-based distributions.  
* Linux-App \#37 (Flatpak): Providing a sandboxed, distribution-agnostic installation option.  
* Linux-App \#38 (AppImage): Allowing the application to run as a standalone file without a formal installation process.

[pacman-install]: docs/images/pacman-install-and-package-info.png
[desktop-entry-launcher]: docs/images/launcher-desktop-entry-rofi.png
[system-tray-icon]: docs/images/system-tray-icon.png
[system-tray-popup]: docs/images/system-tray-popup.png
[basic-functionality]: docs/images/app-dashboard-basic-functionality.png
[pacman-uninstall]: docs/images/pacman-uninstall.png
[after-uninstall]: docs/images/after-uninstall-launcher-entry-removed.png