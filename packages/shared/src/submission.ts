export type Platform =
    | "leetcode"
    | "hackerrank"
    | "codeforces";

export type SubmissionStatus =
    | "accepted";

export type ProblemDifficulty =
    | "Easy"
    | "Medium"
    | "Hard";

export interface Submission {
    platform: Platform;

    platformSubmissionId: string;

    problemId: string;
    problemSlug: string;
    problemTitle: string;

    difficulty?: ProblemDifficulty | string;

    language: string;
    languageExtension?: string;
    sourceCode: string;

    status: SubmissionStatus;

    runtimeDisplay?: string;
    runtimePercentile?: number;

    memoryDisplay?: string;
    memoryPercentile?: number;

    tags?: string[];
    problemDescriptionMarkdown?: string;

    submittedAt: number;
}

/**
 * Standard mapping from coding platform language identifiers to file extensions.
 */
export const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
    python: "py",
    python3: "py",
    py: "py",
    javascript: "js",
    js: "js",
    typescript: "ts",
    ts: "ts",
    java: "java",
    cpp: "cpp",
    "c++": "cpp",
    c: "c",
    csharp: "cs",
    "c#": "cs",
    golang: "go",
    go: "go",
    rust: "rs",
    kotlin: "kt",
    swift: "swift",
    ruby: "rb",
    php: "php",
    scala: "scala",
    sql: "sql",
    mysql: "sql",
    mssql: "sql",
    oraclesql: "sql",
    postgresql: "sql",
    dart: "dart",
    elixir: "ex",
    erlang: "erl",
    racket: "rkt"
};

/**
 * Resolves the appropriate file extension for a given language name or identifier.
 */
export function getFileExtensionForLanguage(language: string): string {
    const normalized = language.trim().toLowerCase();
    return LANGUAGE_EXTENSION_MAP[normalized] ?? "txt";
}