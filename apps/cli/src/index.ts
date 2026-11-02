#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CODERELAY_VERSION } from "@coderelay/shared";
import { GitService } from "@coderelay/git";
import { startServer, SubmissionService } from "@coderelay/core";
import { loadConfig, saveConfig, getConfigPath } from "./config.js";
import { registerNativeHost, unregisterNativeHost, HOST_NAME, EXTENSION_ID } from "./register-host.js";
import { enableAutostart, disableAutostart } from "./autostart.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_DIR = path.resolve(__dirname, "..");

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || "help";

    switch (command) {
        case "version":
        case "-v":
        case "--version":
            console.log(`CodeRelay CLI v${CODERELAY_VERSION}`);
            break;

        case "init": {
            let targetPath = args[1] ? path.resolve(args[1]) : "";

            // If no path was passed, check if sibling dsa-progress exists
            if (!targetPath) {
                const siblingDsa = path.resolve(process.cwd(), "..", "dsa-progress");
                try {
                    await fs.access(siblingDsa);
                    targetPath = siblingDsa;
                    console.log(`[Auto-Detected] Found sibling repository: ${targetPath}`);
                } catch {
                    targetPath = process.cwd();
                }
            }

            const config = await loadConfig();
            config.repoPath = targetPath;

            const gitService = new GitService(config);
            const isValid = await gitService.verifyRepository();

            await saveConfig(config);

            console.log(`\n=== CodeRelay Initialized ===`);
            console.log(`Repository Path: ${targetPath}`);
            console.log(`Git Repository Valid: ${isValid ? "YES" : "NO (Warning: Ensure git is initialized here)"}`);
            console.log(`Configuration saved to: ${getConfigPath()}`);
            console.log(`\nNext step: Run 'node apps/cli/dist/index.js register' to enable Zero-RAM Chrome Native Sync!\n`);
            break;
        }

        case "register": {
            console.log(`Registering Chrome Native Messaging Host (${HOST_NAME})...`);
            const { manifestPath } = await registerNativeHost(CLI_DIR);
            console.log(`\n=== Native Messaging Registered Successfully ===`);
            console.log(`Host Name:     ${HOST_NAME}`);
            console.log(`Extension ID:  ${EXTENSION_ID}`);
            console.log(`Manifest Path: ${manifestPath}`);
            console.log(`\nZero-RAM mode is now active! Chrome will automatically execute CodeRelay on-demand when you submit on LeetCode. No background server needed!`);
            break;
        }

        case "unregister": {
            await unregisterNativeHost();
            console.log(`\n=== Native Messaging Unregistered ===`);
            break;
        }

        case "autostart": {
            const sub = args[1] || "enable";
            if (sub === "disable") {
                await disableAutostart();
                console.log(`\nWindows silent background autostart disabled.`);
            } else {
                const vbsPath = await enableAutostart(__filename);
                console.log(`\n=== Windows Background Autostart Enabled ===`);
                console.log(`CodeRelay will run invisibly on boot without opening any terminal window.`);
                console.log(`Startup script: ${vbsPath}`);
            }
            break;
        }

        case "status": {
            const config = await loadConfig();
            const gitService = new GitService(config);
            const isRepoValid = await gitService.verifyRepository();

            console.log(`\n=== CodeRelay Status ===`);
            console.log(`Version:       ${CODERELAY_VERSION}`);
            console.log(`Config file:   ${getConfigPath()}`);
            console.log(`Target Repo:   ${config.repoPath}`);
            console.log(`Git Valid:     ${isRepoValid ? "YES" : "NO"}`);
            console.log(`Server Port:   ${config.serverPort ?? 45678}`);
            console.log(`Auto Push:     ${config.autoPush !== false ? "Enabled" : "Disabled"}\n`);
            break;
        }

        case "start": {
            const config = await loadConfig();

            const portIndex = args.indexOf("--port");
            if (portIndex !== -1 && args[portIndex + 1]) {
                config.serverPort = parseInt(args[portIndex + 1], 10);
            }

            const repoIndex = args.indexOf("--repo");
            if (repoIndex !== -1 && args[repoIndex + 1]) {
                config.repoPath = path.resolve(args[repoIndex + 1]);
            }

            const gitService = new GitService(config);
            const isRepoValid = await gitService.verifyRepository();
            if (!isRepoValid) {
                console.warn(`[WARNING] Repository path "${config.repoPath}" is not a valid git repository.`);
                console.warn(`Run 'git init' in that folder or run 'coderelay init <path>'.\n`);
            }

            const service = new SubmissionService(config);
            console.log(`\nStarting CodeRelay local server...`);
            const { url } = await startServer(config, service);

            console.log(`========================================`);
            console.log(`  CodeRelay Server v${CODERELAY_VERSION} Running`);
            console.log(`  URL:         ${url}`);
            console.log(`  Target Repo: ${config.repoPath}`);
            console.log(`  Ready to receive submissions from Chrome Extension!`);
            console.log(`========================================\n`);

            process.on("SIGINT", () => {
                console.log("\nShutting down CodeRelay server.");
                process.exit(0);
            });
            break;
        }

        case "help":
        case "--help":
        case "-h":
        default:
            console.log(`
CodeRelay CLI - Automatically capture and sync coding submissions to Git.

Usage:
  coderelay <command> [options]

Commands:
  init [path]            Initialize target Git repository (defaults to auto-detecting ../dsa-progress)
  register               Register Chrome Native Messaging (Recommended: 0 RAM, 0 background process, on-demand execution)
  unregister             Unregister Chrome Native Messaging
  autostart [enable|disable]  Configure silent Windows boot startup (runs daemon invisibly in background)
  start                  Start the local HTTP receiver server manually
  status                 Check CodeRelay configuration and Git repository status
  version                Print CodeRelay version
  help                   Display this help message
`);
            break;
    }
}

main().catch(err => {
    console.error("Error executing coderelay:", err);
    process.exit(1);
});
