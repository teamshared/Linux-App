import os
import subprocess
import sys
from typing import Optional

PROXY_HOST = "127.0.0.1"
PROXY_PORT = 8080

# --- Utility Functions ---

def run_command(command: list[str]) -> Optional[str]:
    """Runs a command and returns stdout if successful, None otherwise."""
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            check=False,
            timeout=5
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None


# --- Verification Helpers (Optional Usefulness) ---

def verify_gsettings_proxy(host: str, port: int) -> bool:
    """Verify GSettings proxy."""
    mode = run_command(["gsettings", "get", "org.gnome.system.proxy", "mode"])
    http_host = run_command(["gsettings", "get", "org.gnome.system.proxy.http", "host"])
    http_port = run_command(["gsettings", "get", "org.gnome.system.proxy.http", "port"])

    if mode == "'manual'" and http_host == f"'{host}'" and http_port == str(port):
        print("GSettings verification SUCCESS.")
        return True
    return False

def kwriteconfig5_exists() -> bool:
    """Check if kwriteconfig5 exists."""
    return bool(run_command(["which", "kwriteconfig5"]))


# --- Proxy Setters ---

def set_proxy_gsettings(host: str, port: int) -> None:
    """Sets proxy via GSettings/DConf."""
    print("-> Setting proxy via GSettings...")
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy", "mode", "manual"])
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy.http", "host", host])
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy.http", "port", str(port)])
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy.https", "host", host])
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy.https", "port", str(port)])


def unset_proxy_gsettings() -> None:
    """Unsets proxy via GSettings."""
    print("-> Unsetting proxy via GSettings...")
    subprocess.run(["gsettings", "set", "org.gnome.system.proxy", "mode", "none"])


def set_proxy_kwriteconfig5(host: str, port: int) -> None:
    """Sets proxy via KDE KWriteConfig5."""
    if not kwriteconfig5_exists():
        print("kwriteconfig5 not found — skipping KDE proxy setup.")
        return

    print("-> Setting proxy via KWriteConfig5...")
    proxy_val = f"http://{host}:{port}"
    subprocess.run(["kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "1"])
    subprocess.run(["kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", proxy_val])
    subprocess.run(["kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpsProxy", proxy_val])


def unset_proxy_kwriteconfig5() -> None:
    """Unsets KDE proxy."""
    if not kwriteconfig5_exists():
        return
    print("-> Unsetting proxy via KWriteConfig5...")
    subprocess.run(["kwriteconfig5", "--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "0"])


def set_proxy_env(host: str, port: int) -> None:
    """Sets proxy via environment variables."""
    print("-> Setting proxy via environment variables...")
    proxy_url = f"http://{host}:{port}/"

    os.environ["http_proxy"] = proxy_url
    os.environ["https_proxy"] = proxy_url
    os.environ["HTTP_PROXY"] = proxy_url
    os.environ["HTTPS_PROXY"] = proxy_url

    proxy_env_path = os.path.expanduser("~/.focus_proxy_env")
    with open(proxy_env_path, "w") as f:
        f.write(f"export http_proxy='{proxy_url}'\n")
        f.write(f"export https_proxy='{proxy_url}'\n")
        f.write(f"export HTTP_PROXY='{proxy_url}'\n")
        f.write(f"export HTTPS_PROXY='{proxy_url}'\n")
        f.write("export NO_PROXY='localhost,127.0.0.1,::1'\n")
        f.write("export no_proxy='localhost,127.0.0.1,::1'\n")

    print(f"Environment proxy active (source ~/.focus_proxy_env to apply globally).")


def unset_proxy_env() -> None:
    """Clears proxy environment variables and files."""
    print("-> Clearing proxy environment variables...")
    for var in ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "no_proxy", "NO_PROXY"]:
        os.environ.pop(var, None)

    proxy_env_path = os.path.expanduser("~/.focus_proxy_env")
    if os.path.exists(proxy_env_path):
        os.remove(proxy_env_path)


# --- Unified All-in-One Operations ---

def set_proxy_all(host: str, port: int) -> None:
    """Sets proxy using all available methods."""
    print("==== Setting System Proxy Across All Methods ====")
    set_proxy_gsettings(host, port)
    set_proxy_kwriteconfig5(host, port)
    set_proxy_env(host, port)

    print("\nAll proxy methods applied.")
    verify_gsettings_proxy(host, port)


def unset_proxy_all() -> None:
    """Unsets proxy across all methods."""
    print("==== Unsetting System Proxy Across All Methods ====")
    unset_proxy_gsettings()
    unset_proxy_kwriteconfig5()
    unset_proxy_env()
    print("\nAll proxy settings cleared.")


# --- Main CLI Entry ---

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python set_system_proxy.py [set|unset]")
        sys.exit(1)

    action = sys.argv[1].lower()

    if action == "set":
        set_proxy_all(PROXY_HOST, PROXY_PORT)
    elif action == "unset":
        unset_proxy_all()
    else:
        print("Invalid action. Use 'set' or 'unset'.")
