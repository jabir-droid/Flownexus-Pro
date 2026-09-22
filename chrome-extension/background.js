/**
 * FlowNexus Pro - Background Service Worker (Manifest V3)
 * Handles Side Panel behaviors and Guaranteed Subfolder Downloads API.
 */

// 1. Enable Side Panel opening on action click
if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
        console.warn('[FlowNexus Pro] SidePanel behavior error:', err);
    });
}

// 2. Helper to sanitize path characters for Windows & Mac
function sanitizeFilename(str) {
    if (!str) return 'flow_' + Date.now();
    return str
        .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .slice(0, 100)
        .replace(/^_|_$/g, '');
}

// Map to guarantee Chrome saves into the specified subfolder
const pendingDownloads = new Map();

// 3. Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'DOWNLOAD_IMAGE') {
        const url = request.url;
        let subfolder = (request.subfolder || 'flow-harvest').trim();
        const baseName = sanitizeFilename(request.filename || ('flow_' + Date.now()));
        const ext = request.ext || 'jpg';

        // Sanitize subfolder: remove disallowed characters and slashes
        subfolder = subfolder.replace(/[\\:*?"<>|]/g, '_').replace(/^\/+|\/+$/g, '').trim();

        // Standardized forward-slash path relative to Downloads
        const targetPath = subfolder
            ? `${subfolder}/${baseName}.${ext}`
            : `${baseName}.${ext}`;

        chrome.downloads.download({
            url: url,
            filename: targetPath,
            conflictAction: 'uniquify',
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('[FlowNexus Pro] Download failed:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                if (downloadId) {
                    pendingDownloads.set(downloadId, targetPath);
                }
                console.log(`[FlowNexus Pro] Download dimulai: ID ${downloadId} -> ${targetPath}`);
                sendResponse({ success: true, downloadId, filename: targetPath });
            }
        });

        return true; // Keep message channel open for async response
    }

    if (request.action === 'GET_ACTIVE_FLOW_TAB') {
        chrome.tabs.query({ url: "*://flow.google.com/*" }, (tabs) => {
            const activeTab = tabs && tabs.length > 0 ? tabs[0] : null;
            sendResponse({ activeTab });
        });
        return true;
    }

    if (request.action === 'OPEN_DOWNLOADS_FOLDER') {
        try {
            chrome.downloads.showDefaultFolder();
            sendResponse({ success: true });
        } catch (e) {
            sendResponse({ success: false, error: e.message });
        }
        return true;
    }

    // 5. Authentic Native Mouse Click via Chrome DevTools Protocol (CDP)
    // Injects an OS-level physical left-click with isTrusted=true directly on Google Flow
    if (request.action === 'NATIVE_CLICK') {
        const tabId = (sender.tab && sender.tab.id) || request.tabId;
        const x = Math.round(request.x);
        const y = Math.round(request.y);

        if (!tabId || isNaN(x) || isNaN(y)) {
            sendResponse({ success: false, error: 'Tab ID atau koordinat tidak valid' });
            return true;
        }

        if (!chrome.debugger) {
            console.warn('[FlowNexus Pro] chrome.debugger API tidak tersedia.');
            sendResponse({ success: false, error: 'debugger API unavailable' });
            return true;
        }

        chrome.debugger.attach({ tabId }, "1.3", () => {
            if (chrome.runtime.lastError) {
                console.warn('[FlowNexus Pro] Debugger attach warning:', chrome.runtime.lastError.message);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                return;
            }

            // Move mouse pointer to target coordinates
            chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
                type: "mouseMoved",
                x: x,
                y: y
            }, () => {
                // Press left mouse button
                chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
                    type: "mousePressed",
                    x: x,
                    y: y,
                    button: "left",
                    clickCount: 1
                }, () => {
                    // Realistic physical human click dwell time
                    setTimeout(() => {
                        // Release left mouse button
                        chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
                            type: "mouseReleased",
                            x: x,
                            y: y,
                            button: "left",
                            clickCount: 1
                        }, () => {
                            // Immediately detach debugger so no UI banner lingers
                            chrome.debugger.detach({ tabId }, () => {
                                console.log(`[FlowNexus Pro] Native CDP click sukses di (${x}, ${y})!`);
                                sendResponse({ success: true, clicked: true });
                            });
                        });
                    }, 80);
                });
            });
        });

        return true;
    }

    // 6. Authentic Native Keyboard Enter via Chrome DevTools Protocol (CDP)
    if (request.action === 'NATIVE_ENTER') {
        const tabId = (sender.tab && sender.tab.id) || request.tabId;
        if (!tabId || !chrome.debugger) {
            sendResponse({ success: false });
            return true;
        }

        chrome.debugger.attach({ tabId }, "1.3", () => {
            if (chrome.runtime.lastError) {
                sendResponse({ success: false });
                return;
            }
            chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                type: "keyDown",
                windowsVirtualKeyCode: 13,
                nativeVirtualKeyCode: 13,
                macCharCode: 13,
                unmodifiedText: "\r",
                text: "\r"
            }, () => {
                setTimeout(() => {
                    chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
                        type: "keyUp",
                        windowsVirtualKeyCode: 13,
                        nativeVirtualKeyCode: 13,
                        macCharCode: 13,
                        unmodifiedText: "\r",
                        text: "\r"
                    }, () => {
                        chrome.debugger.detach({ tabId }, () => {
                            sendResponse({ success: true });
                        });
                    });
                }, 50);
            });
        });

        return true;
    }
});

// 4. Guaranteed Subfolder Filename Determiner (Chrome API)
if (chrome.downloads && chrome.downloads.onDeterminingFilename) {
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
        if (pendingDownloads.has(item.id)) {
            const targetPath = pendingDownloads.get(item.id);
            pendingDownloads.delete(item.id);
            suggest({
                filename: targetPath,
                conflictAction: 'uniquify'
            });
            return true;
        }

        // Fallback: If filename has a relative subfolder path, enforce it
        if (item.filename && item.filename.includes('/')) {
            suggest({
                filename: item.filename,
                conflictAction: 'uniquify'
            });
            return true;
        }
    });
}

// Fallback: Open side panel on action click if setPanelBehavior is not supported
if (chrome.action && chrome.action.onClicked) {
    chrome.action.onClicked.addListener((tab) => {
        if (chrome.sidePanel && chrome.sidePanel.open) {
            chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
        }
    });
}

console.log('[FlowNexus Pro] Background Service Worker active.');
