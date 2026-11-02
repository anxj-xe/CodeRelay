import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { GitService } from "../src/git-service.js";
import { generateProblemReadme } from "../src/readme-generator.js";
import type { Submission } from "@coderelay/shared";

describe("GitService & ReadmeGenerator", () => {
    let tempDir: string;
    let gitService: GitService;

    const mockSubmission: Submission = {
        platform: "leetcode",
        platformSubmissionId: "987654",
        problemId: "1",
        problemSlug: "two-sum",
        problemTitle: "Two Sum",
        difficulty: "Easy",
        language: "python3",
        languageExtension: "py",
        sourceCode: "def twoSum(nums, target): return [0, 1]",
        status: "accepted",
        runtimeDisplay: "32 ms",
        runtimePercentile: 94.2,
        memoryDisplay: "16.5 MB",
        memoryPercentile: 82.1,
        tags: ["Array", "Hash Table"],
        problemDescriptionMarkdown: "Given an array of integers `nums` and an integer `target`...",
        submittedAt: 1710000000000
    };

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coderelay-test-"));
        gitService = new GitService({ repoPath: tempDir });
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("should resolve correct path structure with padded problem id", () => {
        const { dirPath, solutionPath, readmePath, relativeDir } = gitService.resolvePaths(mockSubmission);

        expect(relativeDir).toBe(path.join("LeetCode", "0001-two-sum"));
        expect(solutionPath).toBe(path.join(dirPath, "solution.py"));
        expect(readmePath).toBe(path.join(dirPath, "README.md"));
    });

    it("should format a detailed commit message with date, time, and submission state", () => {
        const newMsg = gitService.formatCommitMessage(mockSubmission, false);
        expect(newMsg).toContain("Submitted on:");
        expect(newMsg).toContain("[Python]");
        expect(newMsg).toContain("Time: 32 ms (beats 94.2%)");
        expect(newMsg).toContain("Memory: 16.5 MB (beats 82.1%)");

        const updateMsg = gitService.formatCommitMessage(mockSubmission, true);
        expect(updateMsg).toContain("Updated on:");
        expect(updateMsg).toContain("[Python]");
    });

    it("should generate a rich problem README with badges and metrics", () => {
        const readme = generateProblemReadme(mockSubmission);

        expect(readme).toContain("# 1. Two Sum");
        expect(readme).toContain("**Difficulty:** Easy");
        expect(readme).toContain("**Problem Link:** [https://leetcode.com/problems/two-sum/](https://leetcode.com/problems/two-sum/)");
        expect(readme).toContain("![Difficulty: Easy]");
        expect(readme).toContain("| **Runtime** | 32 ms | Beats 94.2% |");
        expect(readme).toContain("`Array` `Hash Table`");
        expect(readme).toContain("Given an array of integers `nums`");
    });

    it("should detect duplicate solutions correctly", async () => {
        const filePath = path.join(tempDir, "solution.py");
        await fs.writeFile(filePath, "def twoSum(): pass\n", "utf-8");

        const isDup = await gitService.isDuplicate(filePath, "def twoSum(): pass");
        expect(isDup).toBe(true);

        const isNotDup = await gitService.isDuplicate(filePath, "def twoSum(): return 1");
        expect(isNotDup).toBe(false);
    });
});
