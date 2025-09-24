import os
import subprocess
import sys

def detect_desktop_env():
    env = os.environ.get("XDG_CURRENT_DESKTOP") or os.environ.get("DESKTOP_SESSION") or ""
    env = env.lower()

    # Sometimes multiple values are separated by colons, take the first
    if ":" in env:
        env = env.split(":")[0]

    if "gnome" in env or "unity" in env or "cinnamon" in env:
        return "gnome"   # Cinnamon/Unity use GNOME proxy settings
    elif "mate" in env:
        return "mate"
    elif "kde" in env or "plasma" in env:
        return "kde"
    elif "xfce" in env:
        return "xfce"
    else:
        return "unknown"

def set_proxy(host, port):
    de = detect_desktop_env()
    proxy = f"http://{host}:{port}/"
    if de == "gnome":
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy", "mode", "manual"
        ])
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy.http", "host", host
        ])
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy.http", "port", str(port)
        ])
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy.https", "host", host
        ])
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy.https", "port", str(port)
        ])
    elif de == "kde":
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "1"
        ])
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", proxy
        ])
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpsProxy", proxy
        ])
    elif de == "xfce":
        subprocess.run([
            "xfconf-query", "-c", "xfce4-session", "-p", "/proxy/http", "-s", proxy
        ])
        subprocess.run([
            "xfconf-query", "-c", "xfce4-session", "-p", "/proxy/https", "-s", proxy
        ])
    elif de == "mate":
        subprocess.run([
            "gsettings", "set", "org.mate.system.proxy", "mode", "manual"
        ])
        subprocess.run([
            "gsettings", "set", "org.mate.system.proxy.http", "host", host
        ])
        subprocess.run([
            "gsettings", "set", "org.mate.system.proxy.http", "port", str(port)
        ])
        subprocess.run([
            "gsettings", "set", "org.mate.system.proxy.https", "host", host
        ])
        subprocess.run([
            "gsettings", "set", "org.mate.system.proxy.https", "port", str(port)
        ])
    else:
        print("Unsupported desktop environment. Please set proxy manually.")

def unset_proxy():
    de = detect_desktop_env()
    if de == "gnome":
        subprocess.run([
            "gsettings", "set", "org.gnome.system.proxy", "mode", "none"
        ])
    elif de == "kde":
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "0"
        ])
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", ""
        ])
        subprocess.run([
            "kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpsProxy", ""
        ])
    elif de == "xfce":
        subprocess.run([
            "xfconf-query", "-c", "xfce4-session", "-p", "/proxy/http", "-r"
        ])
        subprocess.run([
            "xfconf-query", "-c", "xfce4-session", "-p", "/proxy/https", "-r"
        ])
    elif de == "mate":
            subprocess.run([
                "gsettings", "set", "org.mate.system.proxy", "mode", "none"
            ])
    else:
        print("Unsupported desktop environment. Please unset proxy manually.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_system_proxy.py [set|unset] [host] [port]")
        sys.exit(1)
    action = sys.argv[1]
    if action == "set" and len(sys.argv) == 4:
        set_proxy(sys.argv[2], sys.argv[3])
    elif action == "unset":
        unset_proxy()
    else:
        print("Invalid arguments.")