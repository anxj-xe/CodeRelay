/**
 * Represents raw submission data extracted from LeetCode by the browser extension.
 */
export interface LeetCodeSubmissionResponse {
    submissionId: string | number;
    questionId: string;
    questionSlug: string;
    questionTitle: string;
    problemUrl?: string;
    difficulty?: "Easy" | "Medium" | "Hard" | string;
    language: string;
    code: string;
    status: string; // e.g. "Accepted" or "10"
    runtimeDisplay?: string;
    runtimePercentile?: number;
    memoryDisplay?: string;
    memoryPercentile?: number;
    tags?: string[];
    problemDescriptionMarkdown?: string;
    submittedAt?: number;
}

/**
 * Shape of LeetCode's HTTP check endpoint:
 * https://leetcode.com/submissions/detail/<submission_id>/check/
 */
export interface LeetCodeCheckResponse {
    status_code: number;
    status_msg: string;
    state: "SUCCESS" | "PENDING" | "STARTED" | string;
    run_success?: boolean;
    status_runtime?: string;
    status_memory?: string;
    runtime_percentile?: number;
    memory_percentile?: number;
    total_correct?: number;
    total_testcases?: number;
    question_id?: string;
    submission_id?: string | number;
    code_output?: string;
    std_output?: string;
    last_testcase?: string;
}

/**
 * Shape of LeetCode GraphQL submissionDetails query result.
 */
export interface LeetCodeGraphQLSubmissionDetails {
    submissionDetails: {
        code: string;
        timestamp: number;
        statusDisplay: string;
        runtimeDisplay?: string;
        runtimePercentile?: number;
        memoryDisplay?: string;
        memoryPercentile?: number;
        lang: {
            name: string;
            verboseName?: string;
        };
        question: {
            questionId: string;
            titleSlug: string;
            title: string;
            difficulty?: string;
            topicTags?: Array<{
                name: string;
                slug: string;
            }>;
            content?: string;
        };
    };
}