import http from "node:http";
import type { CoreConfig } from "./types.js";
import { SubmissionService } from "./submission-service.js";

export function createServer(config: CoreConfig, service: SubmissionService): http.Server {
    const server = http.createServer(async (req, res) => {
        // Set CORS headers so the Chrome extension or web page can communicate
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-CodeRelay-Token");

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url ?? "/", `http://${req.headers.host || "localhost"}`);

        // Health check endpoint
        if (req.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/status")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                status: "ok",
                app: "CodeRelay",
                version: "0.1.0",
                repoPath: config.repoPath
            }));
            return;
        }

        // Submission endpoint
        if (req.method === "POST" && url.pathname === "/api/submissions") {
            // Optional auth token verification
            if (config.authToken) {
                const token = req.headers["x-coderelay-token"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
                if (token !== config.authToken) {
                    res.writeHead(401, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: "Unauthorized: Invalid auth token" }));
                    return;
                }
            }

            let body = "";
            req.on("data", chunk => {
                body += chunk;
            });

            req.on("end", async () => {
                try {
                    const payload = JSON.parse(body);

                    let result;
                    if (payload.raw && payload.platform) {
                        result = await service.processRaw(payload.platform, payload.raw);
                    } else if (payload.platform) {
                        result = await service.processSubmission(payload);
                    } else {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ success: false, error: "Invalid payload: missing platform" }));
                        return;
                    }

                    res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(result));
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: false, error: `Failed to parse payload: ${message}` }));
                }
            });
            return;
        }

        // 404 for any other route
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
    });

    return server;
}

export async function startServer(
    config: CoreConfig,
    service?: SubmissionService
): Promise<{ server: http.Server; port: number; url: string }> {
    const submissionService = service || new SubmissionService(config);
    const server = createServer(config, submissionService);
    const port = config.serverPort || 45678;

    return new Promise((resolve, reject) => {
        server.on("error", reject);
        server.listen(port, "127.0.0.1", () => {
            const url = `http://127.0.0.1:${port}`;
            resolve({ server, port, url });
        });
    });
}
