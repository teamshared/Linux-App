# Why Flatpak Cannot Package Focus Bear

## Summary
Flatpak's sandboxing model is incompatible with Focus Bear's core architecture. The application requires deep system integration that Flatpak explicitly prevents.

---

## Key Incompatibilities

### 1. **Firefox Native Messaging Broken**
- Focus Bear uses native messaging to communicate with Firefox extension
- Flatpak apps run in isolated paths that Firefox cannot resolve
- Native host manifest fails because executable paths are invalid
- **Result**: URL blocking doesn't work

### 2. **Cannot Install Native Host**
- Focus Bear needs to install `/usr/local/bin/focusbear-native-host`
- Flatpak apps cannot write to system directories
- Native messaging setup fails
- **Result**: Extension cannot communicate with app

### 3. **Systemd Service Cannot Work**
- Focus Bear provides background service: `/usr/lib/systemd/user/focusbear.service`
- Flatpak cannot install systemd files
- Users cannot use `systemctl --user enable focusbear`
- **Result**: Background execution broken

### 4. **Extension Installation Fails**
- Extension needs to be at `~/.local/share/focusbear/focusbear-extension.xpi`
- Flatpak isolates home directory access
- Would require explicit filesystem permission prompt every update
- **Result**: Poor user experience, breaks on updates

### 5. **D-Bus Restrictions**
- Flatpak restricts D-Bus access by default
- Native messaging needs unrestricted D-Bus access
- All required permissions would break sandboxing benefits
- **Result**: Defeats purpose of Flatpak

### 6. **Electron Double-Sandboxing**
- Electron already has its own sandbox
- Flatpak adds another sandbox layer
- Causes performance issues and conflicts
- **Result**: App runs slowly and unstably

---

## Why Other Packages Work Better

| Package Type | Native Messaging | System Integration | File Access | Auto-Update |
|---|---|---|---|---|
| **DEB/RPM** | ✅ Works | ✅ Full | ✅ Full | ✅ Yes |
| **AppImage** | ✅ Works | ✅ Full | ✅ Full | ✅ Yes |
| **Flatpak** | ❌ Broken | ❌ Limited | ⚠️ Restricted | ✅ Yes |

---

## Recommended Alternatives

✅ **Use DEB/RPM packages** - Best for system integration  
✅ **Use AppImage** - Works on any Linux distribution  
❌ **Don't use Flatpak** - Incompatible architecture

---

## Technical Reason

Flatpak's security model assumes apps don't need:
- Direct browser integration
- System-wide service installation
- Unrestricted filesystem access
- Direct native executable execution

Focus Bear needs all of these.

---

**Conclusion**: Native packages (DEB, RPM, AppImage) are the correct choice for Focus Bear.
