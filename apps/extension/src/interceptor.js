/**
 * CodeRelay LeetCode Network Interceptor (runs in MAIN world)
 * Intercepts ONLY actual LeetCode submissions (/submit/) and ignores test cases (/interpret_solution/).
 */
(() => {
    if (window.__CODERELAY_INTERCEPTOR_INITIALIZED__) return;
    window.__CODERELAY_INTERCEPTOR_INITIALIZED__ = true;

    console.log("[CodeRelay] LeetCode network interceptor active.");

    // Maps submissionId (string) -> { code, language, questionId, questionSlug, timestamp }
    const pendingSubmissions = new Map();

    // Helper to clean up expired entries older than 10 minutes
    function cleanupOldSubmissions() {
        const now = Date.now();
        for (const [id, entry] of pendingSubmissions.entries()) {
            if (now - entry.timestamp > 10 * 60 * 1000) {
                pendingSubmissions.delete(id);
            }
        }
    }

    function getSlugFromUrl() {
        const match = window.location.pathname.match(/\/problems\/([^/]+)/);
        return match ? match[1] : "unknown-problem";
    }

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const [resource, config] = args;
        const url = typeof resource === "string" ? resource : resource?.url || "";

        // Track ONLY actual submissions (/problems/<slug>/submit/)
        // Explicitly ignores test case runs (/problems/<slug>/interpret_solution/)
        if (url.includes("/submit/") && config?.method === "POST" && config?.body) {
            try {
                const slugMatch = url.match(/\/problems\/([^/]+)\/submit\/?/);
                const questionSlug = slugMatch ? slugMatch[1] : getSlugFromUrl();

                const body = typeof config.body === "string" ? JSON.parse(config.body) : {};
                const res = await originalFetch.apply(this, args);
                const clone = res.clone();

                clone.json().then(data => {
                    if (data?.submission_id) {
                        cleanupOldSubmissions();
                        pendingSubmissions.set(String(data.submission_id), {
                            code: body.typed_code,
                            language: body.lang,
                            questionId: String(body.question_id || ""),
                            questionSlug,
                            timestamp: Date.now()
                        });
                        console.log(`[CodeRelay] Tracking submission ${data.submission_id} for problem: ${questionSlug}`);
                    }
                }).catch(() => {});

                return res;
            } catch (err) {
                console.error("[CodeRelay] Error intercepting submit:", err);
            }
        }

        // Check if LeetCode is checking a result
        if (url.includes("/check/")) {
            const res = await originalFetch.apply(this, args);
            const clone = res.clone();

            clone.json().then(data => {
                const urlMatch = url.match(/\/submissions\/detail\/([^/]+)\/check\/?/);
                const checkId = urlMatch ? urlMatch[1] : (data?.submission_id ? String(data.submission_id) : "");

                // CRITICAL FILTER: If checkId is not in pendingSubmissions,
                // this check is for a test case run (interpret_solution), NOT an actual submission!
                if (!checkId || !pendingSubmissions.has(checkId)) {
                    return;
                }

                const pending = pendingSubmissions.get(checkId);

                // If check has finished
                if (data?.state === "SUCCESS") {
                    const isAccepted = data?.status_msg === "Accepted" || data?.status_code === 10;

                    if (isAccepted && pending && pending.code && pending.code.trim() !== "") {
                        const questionSlug = pending.questionSlug || getSlugFromUrl();
                        const questionTitle = document.title.replace(/\s*-\s*LeetCode\s*$/i, "").trim() || questionSlug;

                        const payload = {
                            submissionId: checkId,
                            questionId: pending.questionId || String(data.question_id || ""),
                            questionSlug,
                            questionTitle,
                            problemUrl: `https://leetcode.com/problems/${questionSlug}/`,
                            language: pending.language || "unknown",
                            code: pending.code,
                            status: "Accepted",
                            runtimeDisplay: data.status_runtime,
                            runtimePercentile: data.runtime_percentile,
                            memoryDisplay: data.status_memory,
                            memoryPercentile: data.memory_percentile,
                            submittedAt: Date.now()
                        };

                        console.log("[CodeRelay] Accepted submission confirmed:", payload);

                        // Broadcast to isolated content script
                        window.postMessage({
                            type: "CODERELAY_SUBMISSION_ACCEPTED",
                            payload
                        }, "*");
                    }

                    // Once finished (Accepted or Failed), remove from pending
                    pendingSubmissions.delete(checkId);
                }
            }).catch(() => {});

            return res;
        }

        return originalFetch.apply(this, args);
    };
})();
