import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface StoredConfig {
    repoPath: string;
    remote?: string;
    branch?: string;
    autoPush?: boolean;
    serverPort?: number;
    authToken?: string;
}

const CONFIG_PATH = path.join(os.homedir(), ".coderelayrc.json");

export async function loadConfig(): Promise<StoredConfig> {
    try {
        const raw = await fs.readFile(CONFIG_PATH, "utf-8");
        return JSON.parse(raw);
    } catch {
        return {
            repoPath: process.cwd(),
            serverPort: 45678,
            autoPush: true,
            remote: "origin",
            branch: "main"
        };
    }
}

export async function saveConfig(config: StoredConfig): Promise<void> {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigPath(): string {
    return CONFIG_PATH;
}
