#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { SubmissionService } from "@coderelay/core";
import { loadConfig } from "./config.js";
import { encodeNativeMessage, readNativeMessage } from "./native-messaging.js";

async function runNativeHost() {
    try {
        const message = await readNativeMessage(process.stdin);
        const config = await loadConfig();

        // Check if sibling "dsa-progress" exists if repoPath is default
        if (!config.repoPath || config.repoPath === process.cwd()) {
            const siblingDsa = path.resolve(process.cwd(), "..", "dsa-progress");
            try {
                await fs.access(siblingDsa);
                config.repoPath = siblingDsa;
            } catch {
                // Keep existing repoPath
            }
        }

        let response: any = { success: false };

        if (message.action === "PING" || message.action === "CHECK_STATUS") {
            response = {
                success: true,
                online: true,
                app: "CodeRelay",
                version: "0.1.0",
                repoPath: config.repoPath
            };
        } else if (message.action === "SYNC_SUBMISSION" && message.payload) {
            const service = new SubmissionService(config);
            const platform = message.platform || message.payload.platform || "leetcode";
            const rawData = message.payload.raw || message.payload;

            const result = await service.processRaw(platform, rawData);
            response = {
                success: result.success,
                commitResult: result.commitResult,
                error: result.error
            };
        } else {
            response = {
                success: false,
                error: `Unknown action: ${message.action}`
            };
        }

        process.stdout.write(encodeNativeMessage(response));
        process.exit(0);
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        process.stdout.write(encodeNativeMessage({ success: false, error: errorMsg }));
        process.exit(1);
    }
}

runNativeHost();
