// Enhanced webview-handler.js with optimized management
import { WebContentsView, session } from 'electron';

const webViews = new Map();
let currentActiveWebView = null;

export function createWebView(config) {
    const { id, url, mainWindow } = config;
    
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
    webViews.set(id, webView);
    return webView;
}

export function switchToWebView(id, mainWindow, bounds) {
    if (currentActiveWebView && mainWindow && mainWindow.contentView) {
        mainWindow.contentView.removeChildView(currentActiveWebView);
    }

    const webView = webViews.get(id);
    if (webView && mainWindow) {
        mainWindow.contentView.addChildView(webView);
        webView.setBounds(bounds);
        currentActiveWebView = webView;
    }
}

export function hideAllWebViews(mainWindow) {
    if (currentActiveWebView && mainWindow && mainWindow.contentView) {
        mainWindow.contentView.removeChildView(currentActiveWebView);
        currentActiveWebView = null;
    }
}

export function showWebView(id, mainWindow, bounds) {
    switchToWebView(id, mainWindow, bounds);
}

export function hideWebView(id, mainWindow) {
    const webView = webViews.get(id);
    if (webView === currentActiveWebView) {
        hideAllWebViews(mainWindow);
    }
}

export const webViewConfigs = {
    'edit_habits': {
        id: 'edit_habits',
        url: 'https://dashboard.focusbear.io/'
    },
    'courses': {
        id: 'courses',
        url: 'https://dashboard.focusbear.io/webview/enrolled-courses' 
    },
    'get_support': {
        id: 'get_support', 
        url: 'https://dashboard.focusbear.io/webview/get-support'
    },
    
    'upgrade-now': {
        id: 'upgrade',
        url: 'https://dashboard.focusbear.io/manage-subscription'
    },   
    'todo-player': {
        id: 'player',
        url: 'https://dashboard.focusbear.io/webview/todo-player'
    }, 
    'todo-list': {
        id: 'list',
        url: 'https://dashboard.focusbear.io/webview/tools-todo-list'
    }, 
    'focus-end': {
        id: 'focus-end',
        url: 'https://dashboard.focusbear.io/webview/focus-end'
    }, 
    'motivation': {
        id: 'motivation',
        url: 'https://dashboard.focusbear.io/webview/motivational-summary'
    },
    'stats': {
        id: 'stats',
        url: 'https://dashboard.focusbear.io/webview/stats'
    },
    'survey': {
        id: 'survey',
        url: 'https://dashboard.focusbear.io/webview/survey'
    },

    'blocking_schedule': {
        id: 'blocking_schedule',
        url: 'https://dashboard.focusbear.io/' 
    }
};

// Tab to WebView mapping - defines which webview should be active for each tab combination
export const getWebViewForTab = (activeTab, activeSubTab = null) => {
    const tabMappings = {
        'Help': 'get_support',
        'Edit Habits': 'edit_habits', 
        'Motivation': 'motivation',
        'Blocks': {
            'Blocking Schedule': 'blocking_schedule',
            'Super Distracting Sites': null 
        },
        'Settings': {
            'Super Distracting Sites': null, 
            'Account': null, 
            'General': null,
            'AI': null, 
            'Uninstall': null
        }
    };
    
    const mapping = tabMappings[activeTab];
    

    if (typeof mapping === 'string') {
        return mapping;
    }
    
    if (mapping && typeof mapping === 'object' && activeSubTab) {
        return mapping[activeSubTab];
    }
    

    return null;
};