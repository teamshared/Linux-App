import gi
gi.require_version('Atspi', '2.0')
from gi.repository import Atspi
import sys

def find_url_in_browser():
    try:
        # Initialize AT-SPI
        Atspi.init()
        
        # Get the desktop
        desktop = Atspi.get_desktop(0)
        
        # Iterate through all applications
        for i in range(desktop.get_child_count()):
            app = desktop.get_child_at_index(i)
            if not app:
                continue
                
            app_name = app.get_name()
            if not app_name:
                continue
                
            # Check if it's a browser
            if any(browser in app_name.lower() for browser in ['firefox', 'chrome', 'chromium', 'brave']):
                # Search for URL bar (document frame or entry with URL)
                for j in range(app.get_child_count()):
                    window = app.get_child_at_index(j)
                    if not window:
                        continue
                    
                    # Try to find URL in different ways depending on browser
                    url = find_url_in_window(window)
                    if url:
                        print(url)
                        return url
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
    
    return None

def find_url_in_window(window):
    try:
        # Try to find document frame (common in browsers)
        role = window.get_role()
        if role == Atspi.Role.DOCUMENT_FRAME or role == Atspi.Role.DOCUMENT_WEB:
            # Get the document URL
            doc = window.queryDocument()
            if doc:
                url = doc.get_document_attribute('DocURL')
                if url:
                    return url
        
        # Recursively search children
        for i in range(window.get_child_count()):
            child = window.get_child_at_index(i)
            if child:
                # Check if it's an entry field (URL bar)
                if child.get_role() == Atspi.Role.ENTRY:
                    text = child.get_text(0, -1)
                    if text and (text.startswith('http') or text.startswith('https')):
                        return text
                
                # Check autocomplete entries (Chrome/Chromium)
                if child.get_role() == Atspi.Role.AUTOCOMPLETE:
                    text = child.get_text(0, -1)
                    if text and (text.startswith('http') or text.startswith('https')):
                        return text
                
                # Recursive search
                result = find_url_in_window(child)
                if result:
                    return result
    except:
        pass
    
    return None

if __name__ == "__main__":
    url = find_url_in_browser()
    if url:
        sys.exit(0)
    sys.exit(1)