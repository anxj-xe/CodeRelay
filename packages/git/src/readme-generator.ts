import type { Submission } from "@coderelay/shared";

/**
 * Returns the canonical URL for a problem.
 */
export function getProblemUrl(submission: Submission): string {
    if (submission.problemUrl) {
        return submission.problemUrl;
    }
    switch (submission.platform) {
        case "leetcode":
            return `https://leetcode.com/problems/${submission.problemSlug}/`;
        case "hackerrank":
            return `https://www.hackerrank.com/challenges/${submission.problemSlug}/problem`;
        case "codeforces":
            return `https://codeforces.com/problemset/problem/${submission.problemId}`;
        default:
            return `https://leetcode.com/problems/${submission.problemSlug}/`;
    }
}

/**
 * Generates markdown documentation for a problem submission.
 */
export function generateProblemReadme(submission: Submission): string {
    const lines: string[] = [];

    const difficultyBadge = submission.difficulty
        ? `![Difficulty: ${submission.difficulty}](https://img.shields.io/badge/Difficulty-${submission.difficulty}-${getDifficultyColor(submission.difficulty)})`
        : "";

    lines.push(`# ${submission.problemId ? `${submission.problemId}. ` : ""}${submission.problemTitle}`);
    lines.push("");

    const problemUrl = getProblemUrl(submission);
    lines.push(`**Difficulty:** ${submission.difficulty || "Not Specified"}  `);
    lines.push(`**Problem Link:** [${problemUrl}](${problemUrl})`);

    if (difficultyBadge) {
        lines.push("");
        lines.push(difficultyBadge);
    }

    lines.push("");
    lines.push("## Submission Stats");
    lines.push("");
    lines.push("| Metric | Value | Percentile |");
    lines.push("| :--- | :--- | :--- |");
    lines.push(`| **Language** | \`${submission.language}\` | - |`);
    lines.push(`| **Runtime** | ${submission.runtimeDisplay ?? "N/A"} | ${submission.runtimePercentile !== undefined ? `Beats ${submission.runtimePercentile.toFixed(1)}%` : "N/A"} |`);
    lines.push(`| **Memory** | ${submission.memoryDisplay ?? "N/A"} | ${submission.memoryPercentile !== undefined ? `Beats ${submission.memoryPercentile.toFixed(1)}%` : "N/A"} |`);

    if (submission.tags && submission.tags.length > 0) {
        lines.push("");
        lines.push("### Tags");
        lines.push("");
        lines.push(submission.tags.map(tag => `\`${tag}\``).join(" "));
    }

    if (submission.problemDescriptionMarkdown) {
        lines.push("");
        lines.push("## Problem Description");
        lines.push("");
        lines.push(submission.problemDescriptionMarkdown.trim());
    }

    lines.push("");
    lines.push("---");
    lines.push(`*Captured automatically by [CodeRelay](https://github.com).*`);
    lines.push("");

    return lines.join("\n");
}

function getDifficultyColor(difficulty: string): string {
    switch (difficulty.toLowerCase()) {
        case "easy":
            return "brightgreen";
        case "medium":
            return "orange";
        case "hard":
            return "red";
        default:
            return "blue";
    }
}
