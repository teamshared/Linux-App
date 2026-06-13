import { app, net, shell } from 'electron';

const GITHUB_REPO = 'Focus-Bear/Linux-App';
const DEFAULT_UPDATE_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 15 * 1000;

let pollTimer = null;
let lastResult = null;

function getUpdateUrl() {
    return process.env.FOCUSBEAR_UPDATE_URL || DEFAULT_UPDATE_URL;
}

// GitHub release tags are usually "v1.2.3"; strip the prefix and split on the
// usual separators. Numeric segments compare numerically so "1.2.10" > "1.2.9";
// non-numeric segments (pre-release tags like "1.2.0-beta") fall back to
// lexicographic comparison, which keeps pre-releases below their final.
function isNewer(remote, current) {
    if (!remote || !current) return false;
    const norm = (v) => String(v).replace(/^v/i, '').split(/[.+-]/);
    const a = norm(remote);
    const b = norm(current);
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
        const ai = a[i] ?? '0';
        const bi = b[i] ?? '0';
        const an = Number(ai);
        const bn = Number(bi);
        if (!Number.isNaN(an) && !Number.isNaN(bn)) {
            if (an > bn) return true;
            if (an < bn) return false;
        } else {
            if (ai > bi) return true;
            if (ai < bi) return false;
        }
    }
    return false;
}

function fetchJson(url) {
    return new Promise((resolve, reject) => {
        const request = net.request({ method: 'GET', url, redirect: 'follow' });
        request.setHeader('Accept', 'application/vnd.github+json');
        request.setHeader('User-Agent', `FocusBear/${app.getVersion()}`);

        let body = '';
        request.on('response', (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(`HTTP ${response.statusCode}`));
                response.on('data', () => {});
                response.on('end', () => {});
                return;
            }
            response.on('data', (chunk) => { body += chunk.toString('utf8'); });
            response.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (err) { reject(new Error(`Invalid JSON: ${err.message}`)); }
            });
            response.on('error', reject);
        });
        request.on('error', reject);
        request.end();
    });
}

// Pick the first Linux package asset we recognise so the renderer's "Download"
// link goes straight to a usable file rather than the release page.
function pickAsset(assets) {
    if (!Array.isArray(assets)) return '';
    const preferred = ['.AppImage', '.deb', '.rpm'];
    for (const ext of preferred) {
        const match = assets.find((a) => typeof a?.name === 'string' && a.name.toLowerCase().endsWith(ext.toLowerCase()));
        if (match?.browser_download_url) return match.browser_download_url;
    }
    return '';
}

export async function checkForUpdates({ silent = false } = {}) {
    const currentVersion = app.getVersion();
    const url = getUpdateUrl();
    try {
        const release = await fetchJson(url);
        const remoteVersion = release?.tag_name || release?.name;
        if (!remoteVersion) {
            const result = { status: 'error', error: 'Release missing tag_name', currentVersion };
            lastResult = result;
            return result;
        }

        if (isNewer(remoteVersion, currentVersion)) {
            const result = {
                status: 'update-available',
                currentVersion,
                latestVersion: String(remoteVersion).replace(/^v/i, ''),
                releaseNotes: release.body || '',
                downloadUrl: pickAsset(release.assets) || release.html_url || ''
            };
            lastResult = result;
            return result;
        }

        const result = { status: 'up-to-date', currentVersion, latestVersion: String(remoteVersion).replace(/^v/i, '') };
        lastResult = result;
        return result;
    } catch (err) {
        const result = { status: 'error', error: err.message, currentVersion };
        lastResult = result;
        if (!silent) console.warn('[UpdateChecker] Check failed:', err.message);
        return result;
    }
}

export function startUpdateChecker(notify) {
    const tick = async () => {
        const result = await checkForUpdates({ silent: true });
        try { notify?.(result); } catch (err) { console.error('[UpdateChecker] notify failed:', err); }
    };

    setTimeout(tick, INITIAL_DELAY_MS);
    pollTimer = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopUpdateChecker() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

export function getLastResult() {
    return lastResult;
}

export function openDownloadUrl(url) {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
        shell.openExternal(url);
    }
}
