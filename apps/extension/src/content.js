/**
 * CodeRelay Content Script (runs in isolated world)
 * Listens to intercepted submissions from MAIN world, enriches with GraphQL/DOM metadata,
 * and transfers to CodeRelay local host.
 */
(() => {
    console.log("[CodeRelay] Content script initialized.");

    /**
     * Fetches reliable question metadata (difficulty, tags, clean title) via LeetCode GraphQL.
     */
    async function fetchLeetCodeMetadata(titleSlug) {
        try {
            const response = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    query: `
                        query getQuestionDetail($titleSlug: String!) {
                            question(titleSlug: $titleSlug) {
                                questionId
                                questionFrontendId
                                title
                                titleSlug
                                difficulty
                                topicTags {
                                    name
                                    slug
                                }
                                content
                            }
                        }
                    `,
                    variables: { titleSlug }
                })
            });

            if (response.ok) {
                const json = await response.json();
                return json?.data?.question || null;
            }
        } catch (err) {
            console.warn("[CodeRelay] GraphQL metadata query failed, using DOM fallback:", err);
        }
        return null;
    }

    /**
     * DOM fallback to detect difficulty if GraphQL request fails.
     */
    function getDifficultyFromDOM() {
        const easy = document.querySelector('[class*="text-difficulty-easy"], [class*="text-easy"], [class*="text-olive"]');
        if (easy) return "Easy";

        const med = document.querySelector('[class*="text-difficulty-medium"], [class*="text-medium"], [class*="text-yellow"]');
        if (med) return "Medium";

        const hard = document.querySelector('[class*="text-difficulty-hard"], [class*="text-hard"], [class*="text-pink"], [class*="text-red"]');
        if (hard) return "Hard";

        const candidates = document.querySelectorAll("div, span, p");
        for (const c of candidates) {
            if (c.children.length === 0) {
                const txt = c.textContent?.trim();
                if (txt === "Easy" || txt === "Medium" || txt === "Hard") {
                    return txt;
                }
            }
        }
        return undefined;
    }

    // Listen for messages dispatched by the interceptor
    window.addEventListener("message", async (event) => {
        if (event.source !== window) return;
        if (event.data?.type !== "CODERELAY_SUBMISSION_ACCEPTED") return;

        const payload = event.data.payload;
        console.log("[CodeRelay] Accepted submission captured:", payload);

        showToast("[CodeRelay] Accepted solution detected. Syncing with Git...", "info");

        // Fetch rich metadata via GraphQL
        const meta = await fetchLeetCodeMetadata(payload.questionSlug);

        if (meta) {
            payload.difficulty = meta.difficulty || getDifficultyFromDOM() || "Not Specified";
            if (meta.title) payload.questionTitle = meta.title;
            if (meta.questionFrontendId) payload.questionId = meta.questionFrontendId;
            if (meta.topicTags && Array.isArray(meta.topicTags)) {
                payload.tags = meta.topicTags.map(t => t.name);
            }
            if (meta.content) {
                payload.problemDescriptionMarkdown = meta.content;
            }
        } else {
            payload.difficulty = getDifficultyFromDOM() || "Not Specified";
        }

        // Ensure problem URL is explicitly set
        payload.problemUrl = `https://leetcode.com/problems/${payload.questionSlug}/`;

        // If description still missing, check DOM
        if (!payload.problemDescriptionMarkdown) {
            try {
                const descEl = document.querySelector('[data-track-load="description_content"]');
                if (descEl) {
                    payload.problemDescriptionMarkdown = descEl.textContent || "";
                }
            } catch {}
        }

        // Send to background service worker to forward to local host
        chrome.runtime.sendMessage(
            { action: "SYNC_SUBMISSION", payload },
            (response) => {
                if (chrome.runtime.lastError) {
                    showToast(`[CodeRelay Error] ${chrome.runtime.lastError.message}`, "error");
                    return;
                }

                if (response?.success) {
                    const msg = response.result?.commitResult?.message || "Synced to Git repository.";
                    showToast(`[CodeRelay] ${msg}`, "success");
                } else {
                    const err = response?.error || "Failed to reach CodeRelay host. Run 'node apps/cli/dist/index.js register'.";
                    showToast(`[CodeRelay Sync Failed] ${err}`, "error");
                }
            }
        );
    });

    /**
     * Displays a clean toast notification in the corner of the LeetCode UI.
     */
    function showToast(message, type = "info") {
        let toast = document.getElementById("coderelay-toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.id = "coderelay-toast";
            toast.style.position = "fixed";
            toast.style.bottom = "24px";
            toast.style.right = "24px";
            toast.style.padding = "12px 18px";
            toast.style.borderRadius = "8px";
            toast.style.fontSize = "14px";
            toast.style.fontFamily = "system-ui, -apple-system, sans-serif";
            toast.style.fontWeight = "500";
            toast.style.zIndex = "999999";
            toast.style.boxShadow = "0 8px 24px rgba(0,0,0,0.25)";
            toast.style.transition = "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)";
            toast.style.maxWidth = "420px";
            document.body.appendChild(toast);
        }

        if (type === "success") {
            toast.style.background = "#0f5132";
            toast.style.color = "#d1e7dd";
            toast.style.border = "1px solid #198754";
        } else if (type === "error") {
            toast.style.background = "#842029";
            toast.style.color = "#f8d7da";
            toast.style.border = "1px solid #dc3545";
        } else {
            toast.style.background = "#055160";
            toast.style.color = "#cff4fc";
            toast.style.border = "1px solid #0dcaf0";
        }

        toast.textContent = message;
        toast.style.display = "block";
        toast.style.opacity = "1";

        setTimeout(() => {
            if (toast) {
                toast.style.opacity = "0";
                setTimeout(() => {
                    toast.style.display = "none";
                }, 300);
            }
        }, 5000);
    }
})();
