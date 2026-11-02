import fs from "node:fs/promises";
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
     * Resolves directory and filenames for a submission.
     * Example: leetcode/0001-two-sum/solution.py
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
        const relativeDir = path.join(platformFolder, folderName);
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

    /**
     * Generates a standardized commit message.
     */
    public formatCommitMessage(submission: Submission): string {
        const platformName = this.formatPlatformName(submission.platform);
        const idPart = submission.problemId ? `${submission.problemId}. ` : "";
        let msg = `[${platformName}] ${idPart}${submission.problemTitle}`;

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
            const commitMessage = this.formatCommitMessage(submission);
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
