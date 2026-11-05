import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Submission } from "@coderelay/shared";
import { getFileExtensionForLanguage } from "@coderelay/shared";
import type { GitRepositoryConfig, CommitResult } from "./types.js";
import { generateProblemReadme } from "./readme-generator.js";

const execFileAsync = promisify(execFile);

export class GitService {
    private config: GitRepositoryConfig;

    constructor(config: GitRepositoryConfig) {
        this.config = config;
    }

    /**
     * Verifies that the configured path exists and is a valid git repository.
     */
    public async verifyRepository(): Promise<boolean> {
        try {
            await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], {
                cwd: this.config.repoPath
            });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Sanitizes a tag name to be safe for filesystem paths.
     */
    public sanitizeTagName(tag: string): string {
        const cleaned = tag
            .replace(/[\\/:*?"<>|]/g, "-") // Replace illegal path characters
            .replace(/\s+/g, " ")          // Collapse multiple spaces
            .trim();
        return cleaned || "General";
    }

    /**
     * Checks if the problem folder already exists anywhere inside the platform directory.
     * E.g. checks if LeetCode/Two Pointers/0015-3sum or LeetCode/0015-3sum exists.
     */
    public findExistingProblemDir(platformDirPath: string, folderName: string): string | null {
        try {
            if (fsSync.existsSync(platformDirPath)) {
                const entries = fsSync.readdirSync(platformDirPath, { withFileTypes: true });
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        // Check inside tag subfolders: e.g. LeetCode/<Tag>/0015-3sum
                        const candidateSubPath = path.join(platformDirPath, entry.name, folderName);
                        if (fsSync.existsSync(candidateSubPath)) {
                            return path.join(entry.name, folderName);
                        }
                        // Check if previously stored directly at root: e.g. LeetCode/0015-3sum
                        if (entry.name === folderName) {
                            return folderName;
                        }
                    }
                }
            }
        } catch {
            // Ignore filesystem errors and proceed with standard resolution
        }
        return null;
    }

    /**
     * Finds the best matching tag folder inside the platform directory.
     * Matches existing directories case-insensitively, and handles singular/plural variants (e.g. Stack <-> Stacks).
     */
    public resolveTagFolder(platformDirPath: string, rawTag?: string): string {
        const defaultTag = rawTag ? this.sanitizeTagName(rawTag) : "General";

        try {
            if (fsSync.existsSync(platformDirPath)) {
                const entries = fsSync.readdirSync(platformDirPath, { withFileTypes: true });
                const existingFolders = entries.filter(e => e.isDirectory()).map(e => e.name);

                const normalizedTarget = defaultTag.toLowerCase();

                // 1. Exact or case-insensitive match
                const exactOrCaseMatch = existingFolders.find(
                    f => f.toLowerCase() === normalizedTarget
                );
                if (exactOrCaseMatch) {
                    return exactOrCaseMatch;
                }

                // 2. Singular/Plural match (e.g., "Stack" <-> "Stacks")
                const pluralTarget = normalizedTarget.endsWith("s")
                    ? normalizedTarget.slice(0, -1)
                    : `${normalizedTarget}s`;

                const pluralMatch = existingFolders.find(
                    f => f.toLowerCase() === pluralTarget
                );
                if (pluralMatch) {
                    return pluralMatch;
                }
            }
        } catch {
            // Fallback to defaultTag if directory read fails
        }

        return defaultTag;
    }

    /**
     * Resolves directory and filenames for a submission with tag-based organization.
     * Example: LeetCode/Two Pointers/0015-3sum/solution.py
     */
    public resolvePaths(submission: Submission): {
        dirPath: string;
        solutionPath: string;
        readmePath: string;
        relativeDir: string;
    } {
        const paddedId = submission.problemId
            ? submission.problemId.padStart(4, "0")
            : "unknown";
        const folderName = `${paddedId}-${submission.problemSlug}`;
        const platformFolder = this.formatPlatformName(submission.platform);
        const platformDirPath = path.join(this.config.repoPath, platformFolder);

        // 1. Check if problem already exists in an existing folder
        const existingRelDir = this.findExistingProblemDir(platformDirPath, folderName);
        let relativeDir: string;

        if (existingRelDir) {
            relativeDir = path.join(platformFolder, existingRelDir);
        } else {
            // 2. Resolve tag folder (primary tag or "General")
            const primaryTag = submission.tags && submission.tags.length > 0
                ? submission.tags[0]
                : undefined;
            const tagFolder = this.resolveTagFolder(platformDirPath, primaryTag);
            relativeDir = path.join(platformFolder, tagFolder, folderName);
        }

        const dirPath = path.join(this.config.repoPath, relativeDir);

        const ext = submission.languageExtension || getFileExtensionForLanguage(submission.language);
        const solutionPath = path.join(dirPath, `solution.${ext}`);
        const readmePath = path.join(dirPath, "README.md");

        return {
            dirPath,
            solutionPath,
            readmePath,
            relativeDir
        };
    }

    /**
     * Checks if the solution file already exists with identical source code.
     */
    public async isDuplicate(solutionPath: string, code: string): Promise<boolean> {
        try {
            const existingCode = await fs.readFile(solutionPath, "utf-8");
            return existingCode.trim() === code.trim();
        } catch {
            return false;
        }
    }

    public formatPlatformName(platform: string): string {
        switch (platform.toLowerCase()) {
            case "leetcode":
                return "LeetCode";
            case "hackerrank":
                return "HackerRank";
            case "codeforces":
                return "Codeforces";
            default:
                return platform.charAt(0).toUpperCase() + platform.slice(1);
        }
    }

    public formatDate(timestamp?: number): string {
        const d = timestamp ? new Date(timestamp) : new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    public formatLanguageName(lang?: string): string {
        if (!lang) return "";
        const l = lang.trim().toLowerCase();
        switch (l) {
            case "python":
            case "python3":
            case "py":
                return "Python";
            case "cpp":
            case "c++":
                return "C++";
            case "c":
                return "C";
            case "java":
                return "Java";
            case "javascript":
            case "js":
                return "JavaScript";
            case "typescript":
            case "ts":
                return "TypeScript";
            case "golang":
            case "go":
                return "Go";
            case "rust":
            case "rs":
                return "Rust";
            case "csharp":
            case "c#":
                return "C#";
            case "kotlin":
            case "kt":
                return "Kotlin";
            case "swift":
                return "Swift";
            case "ruby":
                return "Ruby";
            default:
                return lang.charAt(0).toUpperCase() + lang.slice(1);
        }
    }

    /**
     * Generates a standardized commit message with date, time, submission state, and stats.
     */
    public formatCommitMessage(submission: Submission, isUpdate = false): string {
        const action = isUpdate ? "Updated on:" : "Submitted on:";
        const dateStr = this.formatDate(submission.submittedAt);
        const langStr = submission.language ? ` [${this.formatLanguageName(submission.language)}]` : "";

        let msg = `${action} ${dateStr}${langStr}`;

        const details: string[] = [];
        if (submission.runtimeDisplay) {
            const beats = submission.runtimePercentile !== undefined ? ` (beats ${submission.runtimePercentile.toFixed(1)}%)` : "";
            details.push(`Time: ${submission.runtimeDisplay}${beats}`);
        }
        if (submission.memoryDisplay) {
            const beats = submission.memoryPercentile !== undefined ? ` (beats ${submission.memoryPercentile.toFixed(1)}%)` : "";
            details.push(`Memory: ${submission.memoryDisplay}${beats}`);
        }

        if (details.length > 0) {
            msg += ` - ${details.join(", ")}`;
        }

        return msg;
    }

    /**
     * Saves the solution and README to disk, stages them, commits, and pushes if configured.
     */
    public async commitSubmission(submission: Submission): Promise<CommitResult> {
        const isRepo = await this.verifyRepository();
        if (!isRepo) {
            return {
                success: false,
                filesWritten: [],
                error: `Configured path is not a valid git repository: ${this.config.repoPath}`
            };
        }

        const { dirPath, solutionPath, readmePath } = this.resolvePaths(submission);

        // Check if solution file already exists before writing
        let isUpdate = false;
        try {
            await fs.access(solutionPath);
            isUpdate = true;
        } catch {
            isUpdate = false;
        }

        // Check for duplicate code
        const duplicate = await this.isDuplicate(solutionPath, submission.sourceCode);
        if (duplicate) {
            return {
                success: true,
                skippedDueToDuplicate: true,
                filesWritten: [],
                message: "Identical solution already exists on disk. Skipped commit."
            };
        }

        // Ensure directories exist
        await fs.mkdir(dirPath, { recursive: true });

        // Write solution and README
        await fs.writeFile(solutionPath, submission.sourceCode, "utf-8");
        const readmeContent = generateProblemReadme(submission);
        await fs.writeFile(readmePath, readmeContent, "utf-8");

        const filesWritten = [solutionPath, readmePath];

        try {
            // Stage files
            await execFileAsync("git", ["add", solutionPath, readmePath], {
                cwd: this.config.repoPath
            });

            // Commit
            const commitMessage = this.formatCommitMessage(submission, isUpdate);
            await execFileAsync("git", ["commit", "-m", commitMessage], {
                cwd: this.config.repoPath
            });

            // Get commit hash
            const { stdout: hashOut } = await execFileAsync("git", ["rev-parse", "HEAD"], {
                cwd: this.config.repoPath
            });
            const commitHash = hashOut.trim();

            // Push if enabled
            if (this.config.autoPush !== false) {
                const remote = this.config.remote || "origin";
                const branch = this.config.branch || "main";
                try {
                    await execFileAsync("git", ["push", remote, branch], {
                        cwd: this.config.repoPath
                    });
                } catch (pushErr: unknown) {
                    const errMessage = pushErr instanceof Error ? pushErr.message : String(pushErr);
                    return {
                        success: true,
                        commitHash,
                        filesWritten,
                        message: `Committed locally (${commitHash}), but push to ${remote}/${branch} failed: ${errMessage}`
                    };
                }
            }

            return {
                success: true,
                commitHash,
                filesWritten,
                message: `Successfully synchronized submission (${commitHash})`
            };
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                filesWritten,
                error: `Git operation failed: ${errMessage}`
            };
        }
    }
}
