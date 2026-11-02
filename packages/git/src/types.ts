export interface GitRepositoryConfig {
    repoPath: string;
    remote?: string;
    branch?: string;
    autoPush?: boolean;
    commitTemplate?: string;
}

export interface CommitResult {
    success: boolean;
    commitHash?: string;
    filesWritten: string[];
    skippedDueToDuplicate?: boolean;
    message?: string;
    error?: string;
}
