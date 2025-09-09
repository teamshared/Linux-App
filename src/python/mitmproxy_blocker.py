from mitmproxy import http, ctx
import os

# Path to keyword list file
KEYWORD_FILE = "/tmp/focusbear-keywords.txt"
BLOCK_PAGE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../ui/focusbear_blocked.html")

# Load keywords from file
def load_keywords():
    if not os.path.exists(KEYWORD_FILE):
        ctx.log.warn(f"Keyword file not found: {KEYWORD_FILE}")
        return []
    with open(KEYWORD_FILE, "r") as f:
        keywords = [line.strip().lower() for line in f if line.strip()]
    return keywords

def load_block_page(keyword: str) -> str:
    if not os.path.exists(BLOCK_PAGE_FILE):
        ctx.log.warn(f"Block page not found: {BLOCK_PAGE_FILE}")
        return f"<html><body><h1>Blocked</h1><p>Keyword: {keyword}</p></body></html>"
    with open(BLOCK_PAGE_FILE, "r") as f:
        html = f.read()
    return html.replace("{keyword}", keyword)

# Initial load
blocked_keywords = load_keywords()

def request(flow: http.HTTPFlow) -> None:
    global blocked_keywords
    url = flow.request.pretty_url.lower()

    # Reload keywords each request (for testing; can optimize later)
    blocked_keywords = load_keywords()

    for keyword in blocked_keywords:
        if keyword in url:
            ctx.log.info(f"Blocking: {url} (matched keyword: {keyword})")
            block_page = load_block_page(keyword)
            flow.response = http.Response.make(
                200,
                block_page,
                {"Content-Type": "text/html"}
            )
            return