import { describe, it, expect } from "vitest";
import { LeetCodeSubmissionAdapter } from "../src/adapter.js";
import type {
    LeetCodeSubmissionResponse,
    LeetCodeGraphQLSubmissionDetails
} from "../src/leetcode.types.js";

describe("LeetCodeSubmissionAdapter", () => {
    const adapter = new LeetCodeSubmissionAdapter();

    it("should correctly identify accepted status", () => {
        expect(adapter.isAccepted("Accepted")).toBe(true);
        expect(adapter.isAccepted("accepted")).toBe(true);
        expect(adapter.isAccepted(10)).toBe(true);
        expect(adapter.isAccepted("10")).toBe(true);
        expect(adapter.isAccepted("Wrong Answer")).toBe(false);
        expect(adapter.isAccepted(11)).toBe(false);
    });

    it("should normalize a valid LeetCodeSubmissionResponse", () => {
        const raw: LeetCodeSubmissionResponse = {
            submissionId: "123456789",
            questionId: "1",
            questionSlug: "two-sum",
            questionTitle: "Two Sum",
            difficulty: "Easy",
            language: "python3",
            code: "class Solution:\n    def twoSum(self, nums, target):\n        return []",
            status: "Accepted",
            runtimeDisplay: "45 ms",
            runtimePercentile: 91.5,
            memoryDisplay: "17.2 MB",
            memoryPercentile: 80.4,
            tags: ["Array", "Hash Table"],
            submittedAt: 1710000000
        };

        const normalized = adapter.normalize(raw);

        expect(normalized.platform).toBe("leetcode");
        expect(normalized.platformSubmissionId).toBe("123456789");
        expect(normalized.problemId).toBe("1");
        expect(normalized.problemSlug).toBe("two-sum");
        expect(normalized.problemTitle).toBe("Two Sum");
        expect(normalized.difficulty).toBe("Easy");
        expect(normalized.language).toBe("python3");
        expect(normalized.languageExtension).toBe("py");
        expect(normalized.status).toBe("accepted");
        expect(normalized.runtimeDisplay).toBe("45 ms");
        expect(normalized.runtimePercentile).toBe(91.5);
        expect(normalized.memoryDisplay).toBe("17.2 MB");
        expect(normalized.memoryPercentile).toBe(80.4);
        expect(normalized.tags).toEqual(["Array", "Hash Table"]);
        expect(normalized.submittedAt).toBe(1710000000000); // Converted from seconds to ms
    });

    it("should throw an error for non-accepted submissions", () => {
        const raw: LeetCodeSubmissionResponse = {
            submissionId: "999",
            questionId: "1",
            questionSlug: "two-sum",
            questionTitle: "Two Sum",
            language: "cpp",
            code: "int main() {}",
            status: "Wrong Answer"
        };

        expect(() => adapter.normalize(raw)).toThrowError(/not accepted/i);
    });

    it("should throw an error when code is empty", () => {
        const raw: LeetCodeSubmissionResponse = {
            submissionId: "999",
            questionId: "1",
            questionSlug: "two-sum",
            questionTitle: "Two Sum",
            language: "python3",
            code: "   ",
            status: "Accepted"
        };

        expect(() => adapter.normalize(raw)).toThrowError(/source code is empty/i);
    });

    it("should normalize a GraphQL submissionDetails payload", () => {
        const graphqlData: LeetCodeGraphQLSubmissionDetails = {
            submissionDetails: {
                code: "function twoSum() {}",
                timestamp: 1705000000,
                statusDisplay: "Accepted",
                runtimeDisplay: "55 ms",
                runtimePercentile: 88.0,
                memoryDisplay: "43.1 MB",
                memoryPercentile: 65.2,
                lang: {
                    name: "javascript",
                    verboseName: "JavaScript"
                },
                question: {
                    questionId: "1",
                    titleSlug: "two-sum",
                    title: "Two Sum",
                    difficulty: "Easy",
                    topicTags: [{ name: "Array", slug: "array" }],
                    content: "<p>Given an array of integers...</p>"
                }
            }
        };

        const normalized = adapter.normalizeGraphQL(graphqlData, 555666);

        expect(normalized.platformSubmissionId).toBe("555666");
        expect(normalized.language).toBe("javascript");
        expect(normalized.languageExtension).toBe("js");
        expect(normalized.problemDescriptionMarkdown).toContain("Given an array of integers");
        expect(normalized.tags).toEqual(["Array"]);
    });
});
