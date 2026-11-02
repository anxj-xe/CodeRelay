import type { Submission } from "@coderelay/shared";
import type { CommitResult, GitRepositoryConfig } from "@coderelay/git";

export interface CoreConfig extends GitRepositoryConfig {
    serverPort?: number;
    authToken?: string;
}

export interface ProcessSubmissionResult {
    success: boolean;
    submission?: Submission;
    commitResult?: CommitResult;
    error?: string;
}
