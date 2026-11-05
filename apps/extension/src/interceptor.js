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
    let latestSubmission = null;
    let lastTestCaseTime = 0;

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
        const method = (config?.method || (typeof resource === "object" && resource?.method) || "GET").toUpperCase();

        // 1. Explicitly detect test case runs ("Run Code" / /interpret_solution/)
        if (url.includes("/interpret_solution")) {
            lastTestCaseTime = Date.now();
            console.log("[CodeRelay] Ignoring test case run (Run Code).");
            return originalFetch.apply(this, args);
        }

        // 2. Track ONLY actual submissions (/problems/<slug>/submit)
        const isSubmit = url.includes("/submit") && !url.includes("/interpret_solution");
        if (isSubmit && method === "POST") {
            try {
                const slugMatch = url.match(/\/problems\/([^/]+)\/submit/i);
                const questionSlug = slugMatch ? slugMatch[1] : getSlugFromUrl();

                let body = {};
                let rawBody = config?.body;
                if (!rawBody && typeof resource === "object" && resource?.body) {
                    rawBody = resource.body;
                }
                if (typeof rawBody === "string") {
                    try { body = JSON.parse(rawBody); } catch {}
                } else if (typeof rawBody === "object" && rawBody !== null) {
                    body = rawBody;
                }

                const typedCode = body.typed_code || body.code || "";
                const lang = body.lang || body.language || "unknown";
                const questionId = String(body.question_id || body.questionId || "");

                // Immediately record latest submission to eliminate race conditions
                latestSubmission = {
                    code: typedCode,
                    language: lang,
                    questionId,
                    questionSlug,
                    timestamp: Date.now()
                };

                const res = await originalFetch.apply(this, args);
                const clone = res.clone();

                clone.json().then(data => {
                    const subId = data?.submission_id ? String(data.submission_id) : (data?.submissionId ? String(data.submissionId) : "");
                    if (subId) {
                        cleanupOldSubmissions();
                        pendingSubmissions.set(subId, {
                            code: typedCode,
                            language: lang,
                            questionId,
                            questionSlug,
                            timestamp: Date.now()
                        });
                        console.log(`[CodeRelay] Tracking submission ${subId} for problem: ${questionSlug}`);
                    }
                }).catch(err => {
                    console.warn("[CodeRelay] Could not parse submit response JSON:", err);
                });

                return res;
            } catch (err) {
                console.error("[CodeRelay] Error intercepting submit:", err);
            }
        }

        // 3. Track submission result checking
        if (url.includes("/check")) {
            const res = await originalFetch.apply(this, args);
            const clone = res.clone();

            clone.json().then(data => {
                const urlMatch = url.match(/\/submissions\/detail\/([^/?]+)\/check/i);
                const checkId = urlMatch ? urlMatch[1] : (data?.submission_id ? String(data.submission_id) : "");

                // Filter check: must match a pending submission OR recent latestSubmission
                let pending = checkId ? pendingSubmissions.get(checkId) : null;
                if (!pending && latestSubmission && (Date.now() - latestSubmission.timestamp < 60000) && (Date.now() - lastTestCaseTime > 10000)) {
                    pending = latestSubmission;
                }

                if (!pending) {
                    // Test case check or untracked check; ignore
                    return;
                }

                // If check has finished
                if (data?.state === "SUCCESS") {
                    const isAccepted = data?.status_msg === "Accepted" || data?.status_code === 10;

                    if (isAccepted && pending.code && pending.code.trim() !== "") {
                        const questionSlug = pending.questionSlug || getSlugFromUrl();
                        const questionTitle = document.title.replace(/\s*-\s*LeetCode\s*$/i, "").trim() || questionSlug;

                        const payload = {
                            submissionId: checkId || String(data?.submission_id || Date.now()),
                            questionId: pending.questionId || String(data?.question_id || ""),
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
                    } else {
                        console.log(`[CodeRelay] Submission finished with status: ${data?.status_msg || data?.state}`);
                    }

                    if (checkId) {
                        pendingSubmissions.delete(checkId);
                    }
                    latestSubmission = null;
                }
            }).catch(() => {});

            return res;
        }

        return originalFetch.apply(this, args);
    };
})();
