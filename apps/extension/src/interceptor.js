/**
 * CodeRelay LeetCode Network Interceptor (runs in MAIN world)
 * Intercepts LeetCode submit and check endpoints directly without DOM scraping.
 */
(() => {
    if (window.__CODERELAY_INTERCEPTOR_INITIALIZED__) return;
    window.__CODERELAY_INTERCEPTOR_INITIALIZED__ = true;

    console.log("[CodeRelay] LeetCode network interceptor active.");

    const pendingSubmissions = new Map();

    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const [resource, config] = args;
        const url = typeof resource === "string" ? resource : resource?.url || "";

        // Check if user is submitting code
        if (url.includes("/submit/") && config?.method === "POST" && config?.body) {
            try {
                const body = typeof config.body === "string" ? JSON.parse(config.body) : {};
                const res = await originalFetch.apply(this, args);
                const clone = res.clone();

                clone.json().then(data => {
                    if (data?.submission_id) {
                        pendingSubmissions.set(String(data.submission_id), {
                            code: body.typed_code,
                            language: body.lang,
                            questionId: String(body.question_id || "")
                        });
                    }
                }).catch(() => {});

                return res;
            } catch (err) {
                console.error("[CodeRelay] Error intercepting submit:", err);
            }
        }

        // Check if LeetCode is checking submission result
        if (url.includes("/check/")) {
            const res = await originalFetch.apply(this, args);
            const clone = res.clone();

            clone.json().then(data => {
                if (data?.state === "SUCCESS" && data?.status_msg === "Accepted") {
                    const submissionId = String(data.submission_id || "");
                    const pending = pendingSubmissions.get(submissionId) || {};

                    // Extract question slug from URL: /problems/<slug>/
                    const match = window.location.pathname.match(/\/problems\/([^/]+)/);
                    const questionSlug = match ? match[1] : "unknown-problem";

                    const payload = {
                        submissionId,
                        questionId: pending.questionId || String(data.question_id || ""),
                        questionSlug,
                        questionTitle: document.title.replace(/\s*-\s*LeetCode\s*$/i, "").trim() || questionSlug,
                        language: pending.language || "unknown",
                        code: pending.code || "",
                        status: "Accepted",
                        runtimeDisplay: data.status_runtime,
                        runtimePercentile: data.runtime_percentile,
                        memoryDisplay: data.status_memory,
                        memoryPercentile: data.memory_percentile,
                        submittedAt: Date.now()
                    };

                    // Broadcast to isolated content script
                    window.postMessage({
                        type: "CODERELAY_SUBMISSION_ACCEPTED",
                        payload
                    }, "*");

                    pendingSubmissions.delete(submissionId);
                }
            }).catch(() => {});

            return res;
        }

        return originalFetch.apply(this, args);
    };
})();
