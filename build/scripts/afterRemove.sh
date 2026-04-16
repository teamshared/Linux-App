#!/bin/bash
# Focus Bear — post-removal cleanup script
# Runs automatically after: sudo apt remove focusbear
#
# Removes runtime files that the app created outside its install prefix.

set -e

# Shared /tmp files 
rm -f /tmp/focusbear-blocklist.txt
rm -f /tmp/focusbear-keywords.txt

# Per-user data 
# Iterate over every home directory (including /root) and clean up files 
for user_home in /root /home/*; do
    [ -d "$user_home" ] || continue

    # Proxy environment file written by set_system_proxy.py
    rm -f "$user_home/.focus_proxy_env"

    # Electron userData directory
    rm -rf "$user_home/.config/focusbear"
    rm -rf "$user_home/.config/Focus Bear"
done

echo "Focus Bear: post-removal cleanup complete."
exit 0
