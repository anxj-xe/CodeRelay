import type { Submission, SubmissionStatus, ProblemDifficulty } from "@coderelay/shared";
import { getFileExtensionForLanguage } from "@coderelay/shared";
import type {
    LeetCodeSubmissionResponse,
    LeetCodeGraphQLSubmissionDetails
} from "./leetcode.types.js";

export interface LeetCodeAdapter {
    normalize(data: LeetCodeSubmissionResponse): Submission;
    normalizeGraphQL(data: LeetCodeGraphQLSubmissionDetails, submissionId: string | number): Submission;
    isAccepted(status: string | number): boolean;
}

export class LeetCodeSubmissionAdapter implements LeetCodeAdapter {
    /**
     * Checks if a status string or numeric code corresponds to an Accepted submission.
     */
    public isAccepted(status: string | number): boolean {
        if (typeof status === "number") {
            return status === 10;
        }
        const s = status.trim().toLowerCase();
        return s === "accepted" || s === "10";
    }

    /**
     * Normalizes a raw LeetCode submission response into the standard CodeRelay Submission format.
     */
    public normalize(data: LeetCodeSubmissionResponse): Submission {
        if (!data) {
            throw new Error("Invalid submission data: payload is null or undefined");
        }

        if (!data.code || typeof data.code !== "string" || data.code.trim() === "") {
            throw new Error("Invalid submission data: source code is empty or missing");
        }

        if (!data.questionSlug) {
            throw new Error("Invalid submission data: questionSlug is required");
        }

        const normalizedStatus: SubmissionStatus = "accepted";
        if (!this.isAccepted(data.status)) {
            throw new Error(`Submission status '${data.status}' is not accepted.`);
        }

        const language = (data.language || "text").trim().toLowerCase();
        const languageExtension = getFileExtensionForLanguage(language);

        let difficulty: ProblemDifficulty | undefined;
        if (data.difficulty) {
            const diff = data.difficulty.trim().toLowerCase();
            if (diff === "easy") difficulty = "Easy";
            else if (diff === "medium") difficulty = "Medium";
            else if (diff === "hard") difficulty = "Hard";
        }

        const submittedAt = data.submittedAt && data.submittedAt > 0
            ? (data.submittedAt < 1e11 ? data.submittedAt * 1000 : data.submittedAt)
            : Date.now();

        const problemUrl = data.problemUrl || `https://leetcode.com/problems/${data.questionSlug.trim()}/`;

        return {
            platform: "leetcode",
            platformSubmissionId: String(data.submissionId),
            problemId: String(data.questionId ?? ""),
            problemSlug: data.questionSlug.trim(),
            problemTitle: data.questionTitle || data.questionSlug,
            problemUrl,
            difficulty,
            language,
            languageExtension,
            sourceCode: data.code,
            status: normalizedStatus,
            runtimeDisplay: data.runtimeDisplay,
            runtimePercentile: data.runtimePercentile,
            memoryDisplay: data.memoryDisplay,
            memoryPercentile: data.memoryPercentile,
            tags: data.tags,
            problemDescriptionMarkdown: data.problemDescriptionMarkdown,
            submittedAt
        };
    }

    /**
     * Normalizes a GraphQL submissionDetails response into a standard Submission.
     */
    public normalizeGraphQL(
        data: LeetCodeGraphQLSubmissionDetails,
        submissionId: string | number
    ): Submission {
        const details = data?.submissionDetails;
        if (!details) {
            throw new Error("Invalid GraphQL payload: submissionDetails is missing");
        }

        const rawResponse: LeetCodeSubmissionResponse = {
            submissionId,
            questionId: details.question.questionId,
            questionSlug: details.question.titleSlug,
            questionTitle: details.question.title,
            difficulty: details.question.difficulty,
            language: details.lang.name,
            code: details.code,
            status: details.statusDisplay,
            runtimeDisplay: details.runtimeDisplay,
            runtimePercentile: details.runtimePercentile,
            memoryDisplay: details.memoryDisplay,
            memoryPercentile: details.memoryPercentile,
            tags: details.question.topicTags?.map(t => t.name),
            problemDescriptionMarkdown: details.question.content,
            submittedAt: details.timestamp
        };

        return this.normalize(rawResponse);
    }
}
