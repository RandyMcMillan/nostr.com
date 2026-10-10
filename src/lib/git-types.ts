/**
 * Shared Git types used by the browser bridge and repo panel UI.
 * These mirror the return shapes produced by `electron/git/*.cjs` so that
 * the frontend and backend stay in sync.
 */

export interface GitRepoEntry {
  address: string;
  localPath: string;
  updatedAt: number;
  [key: string]: unknown;
}

export interface GitStatusFile {
  index: string;
  workingTree: string;
  path: string;
}

export interface GitStatus {
  exists: boolean;
  branch: string | null;
  upstreamBranch: string | null;
  currentTip: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFile[];
}

export interface GitCommit {
  sha: string;
  shortSha: string;
  subject: string;
  author: { name: string; email: string };
  date: string;
  parents: string[];
}

export interface GitRemote {
  name: string;
  url: string;
}

export interface GitBranch {
  name: string;
  commit: string;
}

export interface GitTag {
  name: string;
  commitSha: string;
}

export interface GitRefs {
  headBranch: string | null;
  branches: GitBranch[];
  tags: GitTag[];
}

export interface GitStash {
  sha: string;
  ref: string;
  message: string;
}

export interface GitSubmodule {
  sha: string;
  path: string;
  active: boolean;
}

export interface GitWorktree {
  path: string;
  head: string;
  branch: string | null;
  isDetached: boolean;
  main: boolean;
}
