import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (process.platform === "win32") {
    const cscPath = "C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe";
    const launcherCs = path.join(__dirname, "launcher.cs");
    const hostExe = path.join(__dirname, "host.exe");

    if (fs.existsSync(cscPath) && fs.existsSync(launcherCs)) {
        try {
            console.log("[CodeRelay] Compiling native Windows launcher (host.exe)...");
            execSync(`"${cscPath}" /out:"${hostExe}" /target:exe /nologo "${launcherCs}"`);
            console.log("[CodeRelay] Compiled host.exe successfully.");
        } catch (err) {
            console.warn("[CodeRelay] Note: csc compilation failed, falling back to host.bat:", err.message);
        }
    }
}
