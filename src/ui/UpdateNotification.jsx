import React, { useEffect, useState } from 'react';

const DISMISS_STORAGE_KEY = 'focusbear:dismissedUpdateVersion';

const UpdateNotification = function() {
    const [status, setStatus] = useState(null);
    const [dismissedVersion, setDismissedVersion] = useState(() => {
        try { return localStorage.getItem(DISMISS_STORAGE_KEY) || ''; }
        catch { return ''; }
    });

    useEffect(() => {
        if (!window.api) return undefined;

        window.api.getLastUpdateStatus?.().then((cached) => {
            if (cached) setStatus(cached);
        }).catch(() => {});

        const unsubscribe = window.api.onUpdateStatus?.((next) => {
            setStatus(next);
        });

        return () => {
            if (typeof unsubscribe === 'function') unsubscribe();
        };
    }, []);

    if (!status || status.status !== 'update-available') return null;
    if (status.latestVersion && status.latestVersion === dismissedVersion) return null;

    const handleDownload = () => {
        if (status.downloadUrl && window.api?.openUpdateDownload) {
            window.api.openUpdateDownload(status.downloadUrl);
        }
    };

    const handleDismiss = () => {
        try { localStorage.setItem(DISMISS_STORAGE_KEY, status.latestVersion || ''); }
        catch { /* ignore storage failures */ }
        setDismissedVersion(status.latestVersion || '');
    };

    return (
        <div
            role="status"
            aria-live="polite"
            style={{
                padding: '10px 20px',
                backgroundColor: '#fff4d6',
                borderBottom: '1px solid #f0c674',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '15px',
                flexWrap: 'wrap'
            }}
        >
            <span style={{ fontSize: '14px', color: '#5a4500' }}>
                <strong>Focus Bear {status.latestVersion}</strong> is available
                {status.currentVersion ? ` (you have ${status.currentVersion})` : ''}.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
                {status.downloadUrl && (
                    <button
                        onClick={handleDownload}
                        style={{
                            padding: '4px 12px',
                            backgroundColor: '#ff9500',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px'
                        }}
                    >
                        Download
                    </button>
                )}
                <button
                    onClick={handleDismiss}
                    style={{
                        padding: '4px 12px',
                        backgroundColor: 'transparent',
                        color: '#5a4500',
                        border: '1px solid #c9a55a',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                    }}
                >
                    Dismiss
                </button>
            </div>
        </div>
    );
};

export default UpdateNotification;
