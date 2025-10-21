from mitmproxy import http, ctx
import os
import time
import re

# ------------------- CONFIG -------------------
DOMAIN_BLOCKLIST_FILE = "/tmp/focusbear-blocklist.txt"
KEYWORD_FILE = "/tmp/focusbear-keywords.txt"
BLOCK_PAGE_FILE = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), 
    "../ui/focusbear_blocked.html"
)

# ------------------- STATE (CACHING) -------------------
domain_blocklist_mtime = 0
keyword_list_mtime = 0
domain_rules = {"exact": set(), "subdomains": set(), "paths": set()}
blocked_keywords = set()

# ------------------- HELPER: LOAD & PARSE DOMAIN BLOCKLIST -------------------
def load_domain_blocklist() -> dict:
    """Load domain rules from file: split into exact domains, subdomains, and paths."""
    rules = {"exact": set(), "subdomains": set(), "paths": set()}
    if not os.path.exists(DOMAIN_BLOCKLIST_FILE):
        ctx.log.warn(f"Domain blocklist missing: {DOMAIN_BLOCKLIST_FILE}")
        return rules

    global domain_blocklist_mtime
    domain_blocklist_mtime = os.path.getmtime(DOMAIN_BLOCKLIST_FILE)

    with open(DOMAIN_BLOCKLIST_FILE, "r") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip().lower()
            if not line or line.startswith("#"):
                continue

            # Path rule (e.g., example.com/path)
            if "/" in line:
                rules["paths"].add(line)
            
            # Subdomain rule (e.g., *.example.com)
            elif line.startswith("*."):
                domain = line[2:]
                if "." not in domain:
                    ctx.log.warn(f"Invalid subdomain rule (line {line_num}): {line}")
                    continue
                rules["subdomains"].add(domain)
            
            # Exact domain rule (e.g., example.com)
            else:
                if "." not in line:
                    ctx.log.warn(f"Invalid exact domain (line {line_num}): {line}")
                    continue
                
                # Add the primary exact rule
                rules["exact"].add(line)
                ctx.log.debug(f"Loaded exact rule: {line}")

                # --- AUTOMATIC WWW VARIANT HANDLING ---
                # Automatically add the 'www.' variant for common domain blocking.
                # This handles cases where 'example.com' is blocked but 'www.example.com' is not.
                if not line.startswith("www."):  # Check if it's not already a www. prefixed domain
                    www_variant = f"www.{line}"
                    # Add the www. variant as an exact rule
                    rules["exact"].add(www_variant)
                    ctx.log.debug(f"Added www variant: {www_variant}")

    ctx.log.info(f"Loaded domain rules: {len(rules['exact'])} exact, {len(rules['subdomains'])} subdomains, {len(rules['paths'])} paths")
    return rules

# ------------------- HELPER: CHECK IF HOST IS BLOCKED -------------------
def is_host_blocked(hostname: str, url: str, domain_rules: dict) -> bool:
    """Check if hostname or URL matches any blocking rule."""
    hostname_lower = hostname.lower()
    url_lower = url.lower()

    # 1. Check exact domain match
    if hostname_lower in domain_rules["exact"]:
        ctx.log.debug(f"Exact domain match: {hostname_lower}")
        return True
    
    # Check if it matches without www prefix (this might be redundant now with automatic www variants)
    normalized_hostname = hostname_lower
    if normalized_hostname.startswith("www."):
        normalized_hostname = normalized_hostname[4:]
    
    if normalized_hostname in domain_rules["exact"]:
        ctx.log.debug(f"Exact domain match (normalized): {normalized_hostname}")
        return True

    # 2. Check subdomain match
    for domain in domain_rules["subdomains"]:
        # Check if the hostname ends with the target domain
        if hostname_lower.endswith(f".{domain}"):
            # Get the part before the target domain
            prefix = hostname_lower[:-len(domain) - 1]
            
            # If there's at least one dot in the prefix or it's not "www", it's a true subdomain
            if "." in prefix or (prefix != "www" and prefix != ""):
                ctx.log.debug(f"Subdomain match: {hostname_lower} (domain: {domain})")
                return True

    # 3. Check path match
    for path_rule in domain_rules["paths"]:
        if path_rule in url_lower:
            ctx.log.debug(f"Path match: {url_lower} (rule: {path_rule})")
            return True

    return False

# ------------------- HELPER: LOAD KEYWORDS -------------------
def load_keywords() -> set:
    """Load keywords only if the file has changed."""
    global keyword_list_mtime
    if not os.path.exists(KEYWORD_FILE):
        ctx.log.warn(f"Keyword file missing: {KEYWORD_FILE}")
        return set()

    current_mtime = os.path.getmtime(KEYWORD_FILE)
    if current_mtime == keyword_list_mtime:
        return blocked_keywords

    keyword_list_mtime = current_mtime
    with open(KEYWORD_FILE, "r") as f:
        keywords = {line.strip().lower() for line in f if line.strip()}
    ctx.log.info(f"Loaded keywords: {len(keywords)}")
    return keywords

# ------------------- HELPER: LOAD BRANDED BLOCK PAGE -------------------
def load_block_page(block_type: str, match_value: str) -> str:
    """Load custom block page with placeholders."""
    if not os.path.exists(BLOCK_PAGE_FILE):
        ctx.log.warn(f"Block page missing: {BLOCK_PAGE_FILE} → Using default")
        return f"""
        <html><body>
            <h1>🔒 Focus Bear: Blocked</h1>
            <p>Reason: {block_type} match</p>
            <p>Matched: {match_value}</p>
            <p>Time: {time.strftime("%Y-%m-%d %H:%M:%S")}</p>
        </body></html>
        """

    with open(BLOCK_PAGE_FILE, "r") as f:
        html = f.read()
    
    # Add blocking information to the page
    html = html.replace("{block_type}", block_type)
    html = html.replace("{matched_value}", match_value)
    
    return html

# ------------------- HELPER: EXTRACT PAGE TITLE -------------------
def extract_page_title(content: bytes) -> str:
    """Extract page title from HTML content."""
    try:
        content_str = content.decode('utf-8', errors='ignore')
        # Simple regex to find the title tag content
        title_match = re.search(r'<title[^>]*>(.*?)</title>', content_str, re.IGNORECASE | re.DOTALL)
        if title_match:
            title = title_match.group(1).strip()
            # Remove extra whitespace and newlines
            title = re.sub(r'\s+', ' ', title)
            return title.lower()
    except Exception as e:
        ctx.log.debug(f"Error extracting title: {e}")
    return ""

# ------------------- INITIALIZE BLOCKLISTS -------------------
def load(layer: str) -> None:
    """Run once when mitmproxy starts: load initial rules."""
    global domain_rules, blocked_keywords
    domain_rules = load_domain_blocklist()
    blocked_keywords = load_keywords()
    ctx.log.info("Focus Bear mitmproxy blocker initialized")

# ------------------- MAIN REQUEST HANDLING -------------------
def request(flow: http.HTTPFlow) -> None:
    global domain_rules, blocked_keywords

    # Reload rules if files changed
    if os.path.exists(DOMAIN_BLOCKLIST_FILE):
        if os.path.getmtime(DOMAIN_BLOCKLIST_FILE) != domain_blocklist_mtime:
            domain_rules = load_domain_blocklist()
    blocked_keywords = load_keywords()

    # Extract request details
    hostname = flow.request.host
    url = flow.request.pretty_url.lower()

    # Debug logging to see what's being processed
    ctx.log.debug(f"Checking: {hostname} - {url}")
    ctx.log.debug(f"Exact rules: {domain_rules['exact']}")
    ctx.log.debug(f"Subdomain rules: {domain_rules['subdomains']}")

    # 1. Domain/Subdomain/Path block check
    if is_host_blocked(hostname, url, domain_rules):
        ctx.log.info(f"Blocking domain/path: {hostname} - {url}")
        flow.response = http.Response.make(
            200, 
            load_block_page(block_type="domain", match_value=hostname),
            {"Content-Type": "text/html"}
        )
        return

    # 2. Keyword block check
    for keyword in blocked_keywords:
        if keyword in url:
            ctx.log.info(f"Blocking URL (keyword: {keyword}): {url}")
            flow.response = http.Response.make(
                200, 
                load_block_page(block_type="keyword", match_value=keyword),
                {"Content-Type": "text/html"}
            )
            return

# ------------------- RESPONSE HANDLING FOR PAGE TITLE CHECK -------------------
def response(flow: http.HTTPFlow) -> None:
    """Check page titles for blocked keywords after receiving response."""
    global blocked_keywords
    
    # Only check HTML responses
    content_type = flow.response.headers.get("Content-Type", "").lower()
    if "text/html" not in content_type:
        return
    
    # Skip if response content is empty or too large
    if not flow.response.content or len(flow.response.content) > 10 * 1024 * 1024:  # 10MB limit
        return
    
    # Extract page title
    page_title = extract_page_title(flow.response.content)
    if not page_title:
        return
    
    # Check for blocked keywords in page title
    for keyword in blocked_keywords:
        if keyword in page_title:
            ctx.log.info(f"Blocking page title (keyword: {keyword}): {page_title[:100]}...")
            flow.response = http.Response.make(
                200, 
                load_block_page(block_type="keyword in page title", match_value=keyword),
                {"Content-Type": "text/html"}
            )
            return