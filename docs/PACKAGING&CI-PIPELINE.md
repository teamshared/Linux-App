# CI Pipeline Documentation

## Overview

The CI pipeline is defined in `.github/workflows/build-deb.yml`. It runs on an `ubuntu-latest` GitHub Actions runner and automatically builds three distribution packages (AppImage, .deb, and .rpm) whenever code is pushed to the repository. No local build environment is required from developers.

---

## Pipeline Steps

The pipeline executes the following steps:

### 1. Checkout Code

Checks out the source code using GitHub Actions checkout action (v4).

### 2. Node.js Setup

Sets up Node.js v24 with npm cache enabled for faster dependency installation.

### 3. Cache Electron Binaries

Caches `~/.cache/electron` (~100 MB) keyed by `package-lock.json` hash. This significantly speeds up subsequent runs by avoiding re-downloading Electron binaries.

### 4. Cache electron-builder Tools

Caches `~/.cache/electron-builder` to speed up the packaging step. electron-builder downloads platform-specific tools on first run; caching reuses them.

### 5. Install System Dependencies

Installs required system packages:
- `fakeroot` — Allows electron-builder to create `.deb` packages without root privileges
- `rpm` — Provides rpmbuild, required by electron-builder to assemble `.rpm` packages on an Ubuntu runner
- `zip` — Declared as a runtime dependency; the app uses it on first launch to create the `focusbear-extension.xpi` file so snap Firefox can load the extension from a single file

### 6. Make Installer Scripts Executable

Sets executable permissions on post-install and pre-uninstall scripts:
- `build/postinst` — Debian post-installation script
- `build/prerm` — Debian pre-removal script
- `build/rpm-postinst` — RPM post-installation script
- `build/rpm-prerm` — RPM pre-removal script

These scripts must be executable or dpkg/rpm will refuse to run them.

### 7. Install npm Dependencies

Runs `npm ci` (clean install) for reproducible dependency installation.

### 8. Inject Auth0 Secrets

Creates a `.env` file with Auth0 credentials from GitHub repository secrets:
- `VITE_AUTH0_DOMAIN` — Auth0 tenant domain
- `VITE_AUTH0_CLIENT_ID` — Auth0 application client ID

These are injected at build time and embedded into the Vite bundle via `import.meta.env.VITE_*`.

### 9. Verify Secret Format

Outputs a partial verification of secrets (first 4 characters only) to confirm they were injected correctly without exposing sensitive data in logs.

### 10. Build and Package

Runs `npm run package:full`, which:
- Builds the React frontend with Vite → `dist-react/`
- Packages with electron-builder → `dist/`
  - `focusbear-X.X.X-x86_64.AppImage` — Universal Linux format
  - `focusbear-X.X.X-amd64.deb` — Debian/Ubuntu/Linux Mint
  - `focusbear-X.X.X-x86_64.rpm` — Fedora/RHEL/openSUSE

### 11. Upload Artifacts

Uploads each package format as separate GitHub Actions artifacts:
- `focusbear-linux-AppImage`
- `focusbear-linux-deb`
- `focusbear-linux-rpm`

These artifacts are available for download from the Actions run for 90 days (default GitHub retention).

---

## Post-Installation Setup

When users install the packages, the post-installation scripts automatically handle:

**Debian/Ubuntu (postinst):**
- Sets chrome-sandbox SUID so Electron's process sandbox works
- Creates `/usr/bin/focusbear` symlink for PATH access
- Refreshes the desktop application database
- Deploys native messaging host to `/usr/local/bin/focusbear-native-host`
- Installs Firefox native messaging manifest to `/usr/lib/mozilla/native-messaging-hosts/`
- Checks for and installs missing system dependencies

**RPM-based (rpm-postinst):**
- Performs equivalent setup for Fedora/RHEL systems using rpm-specific paths and package managers

---

## Auth0 Secret Configuration

Auth0 credentials must be configured in GitHub repository settings before the pipeline can build:

1. Go to Repository Settings → Secrets and variables → Actions
2. Add `VITE_AUTH0_DOMAIN` with your Auth0 tenant domain
3. Add `VITE_AUTH0_CLIENT_ID` with your Auth0 application ID

These secrets are:
- Never printed to logs
- Masked in workflow output
- Injected only at build time
- Embedded into the final JavaScript bundle

---

## Deployment Workflow

1. Developer pushes code to repository
2. GitHub Actions pipeline triggers automatically
3. All three packages are built in parallel caching
4. Artifacts are uploaded to the Actions run
5. Team downloads artifacts from the run
6. Packages are tested on respective Linux distributions
7. Once verified, packages are released to users via GitHub Releases or package repositories

---

## Pipeline Configuration

The pipeline configuration is defined in `.github/workflows/build-deb.yml`. Key configuration details:

- **Trigger:** Runs on every push (can be restricted to specific branches by uncommenting the `branches` filter)
- **Runner:** `ubuntu-latest` (Ubuntu 22.04 LTS)
- **Node Version:** v24
- **Cache Strategy:** npm dependencies, Electron binaries, and electron-builder tools are cached to reduce build time
- **Artifact Retention:** 90 days (GitHub default)

---

## Notes

- The pipeline ensures consistent, reproducible builds across all three package formats
- Developers never need to build packages locally; the CI/CD handles all packaging
- Native messaging host and Firefox extension installation is automated during package installation
- The dependency checker runs on first launch to ensure all system requirements are met
