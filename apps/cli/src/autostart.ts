import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

function getStartupDir(): string {
    const appData = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
}

function getVbsPath(): string {
    return path.join(getStartupDir(), "coderelay.vbs");
}

/**
 * Creates an invisible Windows startup runner (runs silently in the background on boot).
 */
export async function enableAutostart(cliDistIndexPath: string): Promise<string> {
    const vbsPath = getVbsPath();
    const vbsScript = `Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "node """ & "${cliDistIndexPath.replace(/\\/g, "\\\\")}" & """ start", 0, False
`;

    await fs.writeFile(vbsPath, vbsScript, "utf-8");
    return vbsPath;
}

/**
 * Removes the Windows startup runner.
 */
export async function disableAutostart(): Promise<boolean> {
    try {
        await fs.unlink(getVbsPath());
        return true;
    } catch {
        return false;
    }
}
