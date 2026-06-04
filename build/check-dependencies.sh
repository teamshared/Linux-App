#!/bin/bash
set -e

# Focus Bear - Dependency Checker
# This script checks for required dependencies and prompts user to install them

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Focus Bear - Dependency Checker                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Detect package manager
if command -v apt-get &> /dev/null; then
    PKG_MANAGER="apt"
    INSTALL_CMD="sudo apt-get install -y"
    UPDATE_CMD="sudo apt-get update"
elif command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
    INSTALL_CMD="sudo dnf install -y"
    UPDATE_CMD="sudo dnf check-update"
elif command -v zypper &> /dev/null; then
    PKG_MANAGER="zypper"
    INSTALL_CMD="sudo zypper install -y"
    UPDATE_CMD="sudo zypper refresh"
elif command -v pacman &> /dev/null; then
    PKG_MANAGER="pacman"
    INSTALL_CMD="sudo pacman -S --noconfirm"
    UPDATE_CMD="sudo pacman -Sy"
else
    echo -e "${RED}✗ Error: No supported package manager found${NC}"
    echo "  Supported: apt-get (Debian/Ubuntu), dnf (Fedora), zypper (openSUSE), pacman (Arch)"
    exit 1
fi

echo -e "Detected package manager: ${GREEN}$PKG_MANAGER${NC}"
echo ""

# Define required dependencies for each package manager
case $PKG_MANAGER in
    apt)
        DEPENDENCIES=(
            "libgtk-3-0:GTK 3 Libraries"
            "libnotify4:Notification Support"
            "libnss3:SSL/TLS Support"
            "libxss1:Screensaver Detection"
            "libxtst6:X11 Input Support"
            "xdg-utils:Desktop Integration"
            "libatspi2.0-0:Accessibility Support"
            "libuuid1:UUID Support"
            "libsecret-1-0:Secret Storage"
        )
        ;;
    dnf)
        DEPENDENCIES=(
            "gtk3:GTK 3 Libraries"
            "libnotify:Notification Support"
            "nss:SSL/TLS Support"
            "libXss:Screensaver Detection"
            "libXtst:X11 Input Support"
            "xdg-utils:Desktop Integration"
            "at-spi2-core:Accessibility Support"
            "util-linux:UUID Support"
            "libsecret:Secret Storage"
        )
        ;;
    zypper)
        DEPENDENCIES=(
            "gtk3:GTK 3 Libraries"
            "libnotify1:Notification Support"
            "mozilla-nss:SSL/TLS Support"
            "libxss1:Screensaver Detection"
            "libXtst6:X11 Input Support"
            "xdg-utils:Desktop Integration"
            "at-spi2-core:Accessibility Support"
            "util-linux:UUID Support"
            "libsecret-1-0:Secret Storage"
        )
        ;;
    pacman)
        DEPENDENCIES=(
            "gtk3:GTK 3 Libraries"
            "libnotify:Notification Support"
            "nss:SSL/TLS Support"
            "libxss:Screensaver Detection"
            "libxtst:X11 Input Support"
            "xdg-utils:Desktop Integration"
            "at-spi2-core:Accessibility Support"
            "util-linux:UUID Support"
            "libsecret:Secret Storage"
        )
        ;;
esac

# Check dependencies
MISSING=()
INSTALLED=()

echo "Checking dependencies..."
echo ""

for dep in "${DEPENDENCIES[@]}"; do
    PKG_NAME="${dep%%:*}"
    PKG_DESC="${dep##*:}"

    # Check if package is installed
    if case $PKG_MANAGER in
        apt) dpkg -l | grep -q "^ii  $PKG_NAME"; ;;
        dnf) rpm -q "$PKG_NAME" &>/dev/null; ;;
        zypper) zypper se -i "$PKG_NAME" &>/dev/null; ;;
        pacman) pacman -Q "$PKG_NAME" &>/dev/null; ;;
    esac; then
        echo -e "${GREEN}✓${NC} $PKG_NAME - $PKG_DESC"
        INSTALLED+=("$PKG_NAME")
    else
        echo -e "${RED}✗${NC} $PKG_NAME - $PKG_DESC ${YELLOW}(missing)${NC}"
        MISSING+=("$PKG_NAME")
    fi
done

echo ""

# If all dependencies are installed, we're done
if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All dependencies are installed!${NC}"
    echo ""
    echo "Installed packages (${#INSTALLED[@]}):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    for pkg in "${INSTALLED[@]}"; do
        echo "  ✓ $pkg"
    done
    echo ""
    exit 0
fi

# Ask user if they want to install missing dependencies
echo -e "${YELLOW}${#MISSING[@]} dependency/dependencies missing${NC}"
echo ""
echo "Missing packages:"
for pkg in "${MISSING[@]}"; do
    echo "  - $pkg"
done
echo ""

read -p "Install missing dependencies? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Installing dependencies..."
    echo ""

    # Update package manager cache first
    echo "Updating package manager cache..."
    if ! $UPDATE_CMD &>/dev/null; then
        echo -e "${YELLOW}⚠ Warning: Failed to update package cache${NC}"
    fi
    echo ""

    # Install missing packages
    if $INSTALL_CMD "${MISSING[@]}"; then
        echo ""
        echo -e "${GREEN}✓ Dependencies installed successfully!${NC}"
        echo ""
        exit 0
    else
        echo ""
        echo -e "${RED}✗ Failed to install some dependencies${NC}"
        echo "You may need to install them manually:"
        echo ""
        echo "  $INSTALL_CMD ${MISSING[@]}"
        echo ""
        exit 1
    fi
else
    echo ""
    echo -e "${YELLOW}Dependencies not installed${NC}"
    echo "You can install them later with:"
    echo ""
    echo "  $INSTALL_CMD ${MISSING[@]}"
    echo ""
    exit 0
fi
