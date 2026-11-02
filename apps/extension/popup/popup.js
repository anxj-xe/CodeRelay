document.addEventListener("DOMContentLoaded", () => {
    const statusDot = document.getElementById("statusDot");
    const statusText = document.getElementById("statusText");
    const repoPathDisplay = document.getElementById("repoPathDisplay");
    const instructions = document.getElementById("instructions");
    const refreshBtn = document.getElementById("refreshBtn");

    async function checkStatus() {
        statusText.textContent = "Connecting...";
        statusDot.className = "dot";

        chrome.runtime.sendMessage({ action: "CHECK_STATUS" }, (response) => {
            if (chrome.runtime.lastError || !response?.online) {
                statusDot.className = "dot";
                statusText.textContent = "Offline";
                repoPathDisplay.textContent = "Not connected";
                instructions.innerHTML = `Host is not reachable. Run <code>node apps/cli/dist/index.js register</code> to enable Native Messaging.`;
            } else {
                statusDot.className = "dot online";
                statusText.textContent = "Online";
                repoPathDisplay.textContent = response.data?.repoPath || "Configured";
                instructions.innerHTML = `Connected to CodeRelay. Accepted submissions will be automatically captured and committed.`;
            }
        });
    }

    refreshBtn.addEventListener("click", checkStatus);
    checkStatus();
});
