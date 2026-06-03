// Enhanced webview-handler.js with optimized management
import { WebContentsView, session, app } from 'electron';

const webViews = new Map();
const webViewInjectionStatus = new Map();
let currentActiveWebView = null;

export function createWebView(config) {
    const { id, url, mainWindow, metadata } = config;

    if (webViews.has(id)) {
        console.log(`[WebView Handler] Reusing existing webview: ${id}`);
        return webViews.get(id);
    }

    console.log(`[WebView Handler] Creating new webview: ${id}`);

    const webView = new WebContentsView({
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.fromPartition(`persist:dashboard`),
            webSecurity: true,
            allowRunningInsecureContent: false,
            backgroundColor: '#ffffff'
        }
    });

    webView.setBackgroundColor('#ffffff');

    webViewInjectionStatus.set(id, {injected: false, needsReload: false});

    webView.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        const headers = details.responseHeaders;
        if (headers['Content-Security-Policy']) {
            delete headers['Content-Security-Policy'];
        }
        if (headers['content-security-policy']) {
            delete headers['content-security-policy'];
        }
        callback({ responseHeaders: headers });
    });

    if (metadata) {
        webView.webContents.on('dom-ready', () => {
            const status = webViewInjectionStatus.get(id);
            if (!status.injected) {
                console.log(`[WebView Handler] DOM ready for ${id}, injecting tokens...`);
                injectAuthTokens(webView, id, metadata);
                webViewInjectionStatus.set(id, {injected: true, needsReload: true});
            } else if (status.needsReload) {
                console.log(`[WebView Handler] Page reloaded with auth, calling window function for ${id}...`);
                callWindowFunction(webView, id, metadata);
                webViewInjectionStatus.set(id, {injected: true, needsReload: false});
            }
        });

        webView.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error(`[WebView Handler] Failed to load ${id}:`, errorCode, errorDescription);
        });
    }

    webView.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[WebView ${id} Console]:`, message);
    });

    webView.webContents.loadURL(url);

//    webView.webContents.openDevTools({ mode: 'detach' });

    webViews.set(id, webView);
    return webView;
}

async function injectAuthTokens(webView, webViewId, metadata) {
    const auth0ClientId = metadata.client_id;

    if (!auth0ClientId) {
        console.error(`[WebView Handler] CRITICAL: client_id is undefined for ${webViewId}!`);
        console.error(`[WebView Handler] Metadata received:`, metadata);
        return;
    }

    if (!metadata.access_token) {
        console.error(`[WebView Handler] CRITICAL: access_token is missing for ${webViewId}!`);
        return;
    }

    const auth0CacheKey = `@@auth0spajs@@::${auth0ClientId}::default::openid profile email offline_access`;

    console.log(`[WebView Handler] Injecting tokens for ${webViewId}:`);
    console.log(`  - client_id: ${auth0ClientId}`);
    console.log(`  - has access_token: ${!!metadata.access_token}`);
    console.log(`  - has id_token: ${!!metadata.id_token}`);

    const userDataJson = metadata.user ? JSON.stringify(metadata.user) : '{}';
    const idToken = metadata.id_token || metadata.access_token;

    const injectionConfig = getInjectionConfigForWebView(webViewId, metadata);
    const serializedData = JSON.stringify(injectionConfig?.data || {});

    const tokenInjectionScript = `
        (function() {
            console.log('[Focus Bear Native] Injecting authentication tokens');
            console.log('[Focus Bear Native] Client ID: ${auth0ClientId}');

            try {
                Object.keys(localStorage).forEach(key => {
                    if (key.includes('@@auth0spajs@@::undefined')) {
                        console.log('[Focus Bear Native] Removing broken cache entry:', key);
                        localStorage.removeItem(key);
                    }
                });

                localStorage.setItem('focusbear_auth_data', '${serializedData.replace(/'/g, "\\'")}');
                localStorage.setItem('focusbear_access_token', '${metadata.access_token}');
                localStorage.setItem('focusbear_platform', 'linux');

                const auth0Cache = {
                    body: {
                        client_id: '${auth0ClientId}',
                        access_token: '${metadata.access_token}',
                        id_token: '${idToken}',
                        scope: 'openid profile email offline_access',
                        expires_in: 86400,
                        token_type: 'Bearer',
                        decodedToken: {
                            user: ${userDataJson}
                        }
                    },
                    expiresAt: Math.floor(Date.now() / 1000) + 86400
                };

                localStorage.setItem('${auth0CacheKey}', JSON.stringify(auth0Cache));
                console.log('[Focus Bear Native] Tokens injected successfully');
                console.log('[Focus Bear Native] Auth0 cache key:', '${auth0CacheKey}');

            } catch (error) {
                console.error('[Focus Bear Native] Error injecting tokens:', error);
            }
        })();
    `;

    try {
        await webView.webContents.executeJavaScript(tokenInjectionScript);
        console.log(`[WebView Handler] Tokens injected for ${webViewId}, reloading...`);
        await webView.webContents.reload();
    } catch (err) {
        console.error(`[WebView Handler] Failed to inject tokens for ${webViewId}:`, err);
    }
}

async function callWindowFunction(webView, webViewId, metadata) {
    const injectionConfig = getInjectionConfigForWebView(webViewId, metadata);

    if (!injectionConfig) {
        console.log(`[WebView Handler] No window function config for ${webViewId}`);
        return;
    }

    const { functionName, data } = injectionConfig;
    const serializedData = JSON.stringify(data);

    console.log(`[WebView Handler] Calling window function for ${webViewId}: ${functionName}`);

    const functionCallScript = `
        (function() {
            console.log('[Focus Bear Native] Attempting to call window function: ${functionName}');

            const waitForAppLoaded = setInterval(() => {
                if (window['${functionName}']) {
                    console.log('[Focus Bear Native] Found ${functionName}, calling it now...');
                    try {
                        window['${functionName}'](${serializedData});
                        console.log('[Focus Bear Native] Successfully called ${functionName}');
                        clearInterval(waitForAppLoaded);
                    } catch (error) {
                        console.error('[Focus Bear Native] Error calling ${functionName}:', error);
                        clearInterval(waitForAppLoaded);
                    }
                } else {
                    console.log('[Focus Bear Native] Waiting for ${functionName}...');
                }
            }, 100);

            setTimeout(() => {
                clearInterval(waitForAppLoaded);
                console.log('[Focus Bear Native] Timeout - stopped waiting for ${functionName}');
            }, 30000);
        })();
    `;

    try {
        await webView.webContents.executeJavaScript(functionCallScript);
        console.log(`[WebView Handler] Function call script executed for ${webViewId}`);
    } catch (err) {
        console.error(`[WebView Handler] Failed to call function for ${webViewId}:`, err);
    }
}

function getInjectionConfigForWebView(webViewId, metadata) {
    const {
        access_token,
        theme = 'LIGHT',
        lang = 'en',
        font = 'default',
        flags = [],
        tasks = '[]',
        total_duration = 0,
        intention = '',
        brain_dump = ''
    } = metadata;

    const configs = {
        'edit_habits': {
            functionName: 'loadSettingsData',
            data: {
                access_token,
                platform: 'linux',
                font,
                lang,
                flags,
                theme
            }
        },
        'get_support': {
            functionName: 'loadMetaDataFoGetSupport',
            data: {
                access_token,
                font,
                lang,
                theme
            }
        },
        'courses': {
            functionName: 'loadMetaDataForEnrolledCourses',
            data: {
                access_token,
                font,
                lang,
                theme
            }
        },
        'upgrade-now': {
            functionName: 'loadMetaDataForSubscription',
            data: {
                access_token,
                type: 'linux',
                lang,
                font,
                theme
            }
        },
        'todo-player': {
            functionName: 'loadMetaDataForToDoPlayer',
            data: {
                access_token,
                platform: 'linux',
                tasks,
                total_duration,
                lang,
                font,
                theme,
                intention,
                brain_dump
            }
        },
        'todo-list': {
            functionName: 'loadAccessTokenForToDo',
            data: {
                access_token,
                platform: 'linux',
                lang,
                font,
                theme
            }
        },
        'focus-end': {
            functionName: 'loadTasks',
            data: {
                access_token,
                platform: 'linux',
                tasks,
                total_duration,
                lang,
                theme
            }
        },
        'motivation': {
            functionName: 'loadAccessTokenForInspirationPage',
            data: {
                access_token,
                font,
                lang,
                theme,
                flags,
                motivation_type: 'desktop'
            }
        },
        'stats': {
            functionName: 'loadAccessTokenForStats',
            data: {
                access_token,
                type: 'linux',
                lang,
                font,
                theme
            }
        },
        'survey': {
            functionName: 'loadAccessTokenForSurvey',
            data: {
                access_token,
                platform: 'linux',
                lang
            }
        },
        'blocking_schedule': {
            functionName: 'loadSettingsData',
            data: {
                access_token,
                platform: 'linux',
                font,
                lang,
                flags,
                theme
            }
        }
    };

    return configs[webViewId];
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

export function resizeCurrentWebView(bounds) {
    if (currentActiveWebView) {
        currentActiveWebView.setBounds(bounds);
    }
}

export function getCurrentActiveWebViewId() {
    for (const [id, webView] of webViews.entries()) {
        if (webView === currentActiveWebView) {
            return id;
        }
    }
    return null;
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
        url: 'https://settings.focusbear.io'
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