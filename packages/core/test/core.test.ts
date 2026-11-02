import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import http from "node:http";
import { SubmissionService } from "../src/submission-service.js";
import { startServer } from "../src/server.js";
import type { Submission } from "@coderelay/shared";

describe("SubmissionService & Core HTTP Server", () => {
    let tempDir: string;
    let service: SubmissionService;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coderelay-core-test-"));
        service = new SubmissionService({ repoPath: tempDir });
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should validate and reject incomplete submissions", () => {
        expect(() => service.validateSubmission(null as any)).toThrowError();
        expect(() => service.validateSubmission({} as any)).toThrowError(/Missing submission platform/i);
        expect(() => service.validateSubmission({
            platform: "leetcode",
            problemSlug: "",
            sourceCode: "print(1)",
            status: "accepted"
        } as any)).toThrowError(/Missing problem slug/i);
    });

    it("should reject non-accepted submissions", () => {
        expect(() => service.validateSubmission({
            platform: "leetcode",
            problemSlug: "two-sum",
            sourceCode: "print(1)",
            status: "wrong_answer" as any
        } as any)).toThrowError(/not accepted/i);
    });

    it("should respond to health check on local HTTP server", async () => {
        const { server, port, url } = await startServer({ repoPath: tempDir, serverPort: 49999 }, service);

        try {
            const res = await fetch(`${url}/health`);
            expect(res.status).toBe(200);

            const data = await res.json() as any;
            expect(data.status).toBe("ok");
            expect(data.app).toBe("CodeRelay");
            expect(data.version).toBe("0.1.0");
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });

    it("should reject invalid submissions posted to /api/submissions", async () => {
        const { server, port, url } = await startServer({ repoPath: tempDir, serverPort: 49998 }, service);

        try {
            const res = await fetch(`${url}/api/submissions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invalid: true })
            });

            expect(res.status).toBe(400);
            const data = await res.json() as any;
            expect(data.success).toBe(false);
            expect(data.error).toContain("missing platform");
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
        }
    });
});
