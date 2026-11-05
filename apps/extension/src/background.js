/**
 * CodeRelay Background Service Worker (Manifest V3)
 * Supports Chrome Native Messaging (Zero-RAM, on-demand execution)
 * with automatic fallback to local HTTP server if needed.
 */

const NATIVE_HOST_NAME = "com.coderelay.host";
const DEFAULT_SERVER_URL = "http://127.0.0.1:45678";

async function getServerUrl() {
    const data = await chrome.storage.local.get(["serverUrl"]);
    return data.serverUrl || DEFAULT_SERVER_URL;
}

/**
 * Sends a message to the Native Messaging host (spawns on-demand, 0 RAM idle)
 */
function sendNativeMessageAsync(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(response);
            }
        });
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "CHECK_STATUS") {
        (async () => {
            // First check if Native Messaging Host is available
            try {
                const nativeRes = await sendNativeMessageAsync({ action: "CHECK_STATUS" });
                if (nativeRes?.success || nativeRes?.online) {
                    sendResponse({
                        online: true,
                        mode: "native",
                        data: {
                            app: "CodeRelay",
                            mode: "Native Messaging (0 RAM, On-Demand)",
                            repoPath: nativeRes.repoPath || "Configured"
                        }
                    });
                    return;
                }
            } catch (err) {
                // Native messaging not installed or unavailable, fallback to HTTP check
            }

            // Fallback: check local HTTP server
            try {
                const serverUrl = await getServerUrl();
                const res = await fetch(`${serverUrl}/health`);
                if (res.ok) {
                    const data = await res.json();
                    sendResponse({ online: true, mode: "http", data });
                    return;
                }
            } catch (err) {
                // HTTP not available either
            }

            sendResponse({
                online: false,
                error: "Native host not registered and local server not running."
            });
        })();
        return true;
    }

    if (request.action === "SYNC_SUBMISSION") {
        (async () => {
            // Priority 1: Native Messaging (Runs on-demand, 0 RAM, 0 ports)
            try {
                const nativeRes = await sendNativeMessageAsync({
                    action: "SYNC_SUBMISSION",
                    platform: "leetcode",
                    payload: request.payload
                });

                if (nativeRes && typeof nativeRes === "object") {
                    if (nativeRes.success) {
                        sendResponse({ success: true, mode: "native", result: nativeRes });
                        return;
                    } else {
                        sendResponse({ success: false, error: nativeRes.error || "Native host reported sync failure" });
                        return;
                    }
                }
            } catch (nativeErr) {
                console.warn("[CodeRelay] Native host communication error, attempting HTTP fallback:", nativeErr.message);
            }

            // Priority 2: Local HTTP server fallback
            try {
                const serverUrl = await getServerUrl();
                const res = await fetch(`${serverUrl}/api/submissions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        platform: "leetcode",
                        raw: request.payload
                    })
                });

                const result = await res.json();
                if (res.ok && result.success) {
                    sendResponse({ success: true, mode: "http", result });
                } else {
                    sendResponse({ success: false, error: result.error || `HTTP ${res.status}` });
                }
            } catch (httpErr) {
                sendResponse({
                    success: false,
                    error: `Could not connect to CodeRelay. Run 'coderelay register' once to enable native zero-RAM mode!`
                });
            }
        })();
        return true;
    }
});
