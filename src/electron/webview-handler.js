import { WebContentsView, session } from 'electron';

const webViews = new Map();

export function createWebView(config) {
    const { id, url, cssRules, mainWindow } = config;
    
    if (webViews.has(id)) {
        return webViews.get(id);
    }

    const webView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.fromPartition(`persist:dashboard`)
        }
    });

    webView.webContents.loadURL(url);

    webView.webContents.once('dom-ready', () => {
        setTimeout(() => {
            webView.webContents.insertCSS(cssRules.initial || '');
        }, 2000);

        setTimeout(() => {
            webView.webContents.insertCSS(cssRules.secondary || '');
        }, 3000);
    });

    webViews.set(id, webView);
    return webView;
}

export function showWebView(id, mainWindow, bounds) {
    const webView = webViews.get(id);
    if (webView && mainWindow) {
        mainWindow.contentView.addChildView(webView);
        webView.setBounds(bounds);
    }
}

export function hideWebView(id, mainWindow) {
    const webView = webViews.get(id);
    if (webView && mainWindow && mainWindow.contentView) {
        mainWindow.contentView.removeChildView(webView);
    }
}

export const webViewConfigs = {
    'edit_habits': {
        id: 'edit_habits',
        url: 'https://dashboard.focusbear.io/settings',
        cssRules: {
            initial: `
                /* get rid of header */
                nav, header, .nav, .header, .sidebar, .div.section {
                    display: none !important;
                }

                /* get rid of footer */
                [data-testid*="footer-website-link"], [data-testid*="footer-logo"], [data-testid="footer-privacy-link"],[data-testid="footer-terms-link"], p.w-full.text-gray-500.text-sm.text-center{
                    display: none !important;
                }
            
                /* get rid of chat widget */
                [aria-label="Chat Widget"]{display: none !important;} 
                body { margin: 0 !important; padding: 0 !important; }
            `,
            secondary: `
                /* Show only the tabs */
                [data-testid*="settings-tabs-container"] {
                    display: block !important;
                }
            `
        }
    },
    'motivation': {
        id: 'motivation',
        url: 'https://dashboard.focusbear.io/stats',
        cssRules: {
            initial: `
                /* get rid of header */
                nav, header, .nav, .header, .sidebar, .div.section {
                    display: none !important;
                }

                /* get rid of footer */
                [data-testid*="footer-website-link"], [data-testid*="footer-logo"], [data-testid="footer-privacy-link"],[data-testid="footer-terms-link"], p.w-full.text-gray-500.text-sm.text-center{
                    display: none !important;
                }
            
                /* get rid of chat widget */
                [aria-label="Chat Widget"]{display: none !important;} 
                body { margin: 0 !important; padding: 0 !important; }
            `,
            secondary:  `
                /* Show only the tabs */
                [data-testid*="settings-tabs-container"] {
                    display: block !important;
                }
            `
        }
    }
};