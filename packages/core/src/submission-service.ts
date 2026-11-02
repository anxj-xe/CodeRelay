import type { Submission, Platform } from "@coderelay/shared";
import { GitService } from "@coderelay/git";
import { LeetCodeSubmissionAdapter } from "@coderelay/leetcode";
import type { CoreConfig, ProcessSubmissionResult } from "./types.js";

export class SubmissionService {
    private config: CoreConfig;
    private gitService: GitService;
    private leetcodeAdapter: LeetCodeSubmissionAdapter;

    constructor(config: CoreConfig) {
        this.config = config;
        this.gitService = new GitService(config);
        this.leetcodeAdapter = new LeetCodeSubmissionAdapter();
    }

    /**
     * Validates submission structure.
     */
    public validateSubmission(submission: Submission): void {
        if (!submission) {
            throw new Error("Submission payload is null or undefined");
        }
        if (!submission.platform) {
            throw new Error("Missing submission platform");
        }
        if (!submission.problemSlug || submission.problemSlug.trim() === "") {
            throw new Error("Missing problem slug");
        }
        if (!submission.sourceCode || submission.sourceCode.trim() === "") {
            throw new Error("Missing solution source code");
        }
        if (submission.status !== "accepted") {
            throw new Error(`Submission status '${submission.status}' is not accepted`);
        }
    }

    /**
     * Ingests and processes a normalized Submission object.
     */
    public async processSubmission(submission: Submission): Promise<ProcessSubmissionResult> {
        try {
            this.validateSubmission(submission);
            const commitResult = await this.gitService.commitSubmission(submission);

            return {
                success: commitResult.success,
                submission,
                commitResult,
                error: commitResult.error
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                submission,
                error: message
            };
        }
    }

    /**
     * Ingests raw platform payload, normalizes it using the platform's adapter,
     * and processes it.
     */
    public async processRaw(platform: Platform, rawData: any): Promise<ProcessSubmissionResult> {
        try {
            let normalized: Submission;

            switch (platform) {
                case "leetcode":
                    normalized = this.leetcodeAdapter.normalize(rawData);
                    break;
                default:
                    throw new Error(`Platform adapter not implemented for '${platform}'`);
            }

            return await this.processSubmission(normalized);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                error: message
            };
        }
    }
}
