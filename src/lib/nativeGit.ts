import { browser } from '$app/environment';
import type {
  GitRepoEntry,
  GitStatusFile,
  GitStatus,
  GitCommit,
  GitRemote,
  GitRefs,
  GitStash,
  GitSubmodule,
  GitWorktree,
  GitTag
} from './git-types';

export type {
  GitRepoEntry,
  GitStatusFile,
  GitStatus,
  GitCommit,
  GitRemote,
  GitRefs,
  GitStash,
  GitSubmodule,
  GitWorktree,
  GitTag
};

interface NostrGitBridge {
  list: () => Promise<GitRepoEntry[]>;
  status: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; status?: GitStatus }>;
  log: (payload: { localPath: string; limit?: number }) => Promise<{ ok: boolean; error?: string; commits?: GitCommit[] }>;
  remotes: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; remotes?: GitRemote[] }>;
  addRemote: (payload: { localPath: string; name: string; url: string }) => Promise<{ ok: boolean; error?: string; remote?: GitRemote }>;
  removeRemote: (payload: { localPath: string; name: string }) => Promise<{ ok: boolean; error?: string }>;
  fetch: (payload: { localPath: string; remote?: string; prune?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  pull: (payload: { localPath: string; ffOnly?: boolean; rebase?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  branches: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; branches?: { name: string; current: boolean }[] }>;
  checkout: (payload: { localPath: string; branchName: string; create?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  deleteBranch: (payload: { localPath: string; branchName: string; force?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  commit: (payload: { localPath: string; message: string; allowEmpty?: boolean; authorName?: string; authorEmail?: string }) => Promise<{ ok: boolean; error?: string }>;
  push: (payload: { localPath: string; remote?: string; branch?: string; forceWithLease?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  diff: (payload: { localPath: string; filePath?: string; staged?: boolean; hideWhitespace?: boolean }) => Promise<{ ok: boolean; error?: string; diff?: string }>;
  stage: (payload: { localPath: string; filePath?: string }) => Promise<{ ok: boolean; error?: string }>;
  unstage: (payload: { localPath: string; filePath?: string }) => Promise<{ ok: boolean; error?: string }>;
  refs: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; refs?: GitRefs }>;
  mergeBase: (payload: { localPath: string; refA: string; refB: string }) => Promise<{ ok: boolean; error?: string; commit?: string }>;
  formatPatch: (payload: { localPath: string; baseRef?: string; single?: string }) => Promise<{ ok: boolean; error?: string; patch?: string }>;
  tags: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; tags?: GitTag[] }>;
  createTag: (payload: { localPath: string; name: string; targetCommitSha: string }) => Promise<{ ok: boolean; error?: string }>;
  deleteTag: (payload: { localPath: string; name: string }) => Promise<{ ok: boolean; error?: string }>;
  reset: (payload: { localPath: string; mode: 'soft' | 'mixed' | 'hard'; ref: string }) => Promise<{ ok: boolean; error?: string }>;
  cherryPick: (payload: { localPath: string; sha: string }) => Promise<{ ok: boolean; error?: string }>;
  abortCherryPick: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string }>;
  stashes: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; stashes?: GitStash[] }>;
  createStash: (payload: { localPath: string; message?: string }) => Promise<{ ok: boolean; error?: string }>;
  popStash: (payload: { localPath: string; ref?: string }) => Promise<{ ok: boolean; error?: string }>;
  dropStash: (payload: { localPath: string; ref: string }) => Promise<{ ok: boolean; error?: string }>;
  submodules: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; submodules?: GitSubmodule[] }>;
  updateSubmodules: (payload: { localPath: string; force?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  worktrees: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; worktrees?: GitWorktree[] }>;
  addWorktree: (payload: { localPath: string; worktreePath: string; createBranch?: string; commitish?: string }) => Promise<{ ok: boolean; error?: string }>;
  removeWorktree: (payload: { localPath: string; worktreePath: string; force?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  rebase: (payload: { localPath: string; ref: string }) => Promise<{ ok: boolean; error?: string }>;
  continueRebase: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string }>;
  abortRebase: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string }>;
  skipRebase: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string }>;
  clone: (payload: {
    kind: number;
    pubkey: string;
    identifier: string;
    url: string;
    defaultBranch?: string;
    branch?: string;
  }) => Promise<{ ok: boolean; error?: string; localPath?: string }>;
  init: (payload: {
    kind: number;
    pubkey: string;
    identifier: string;
    defaultBranch?: string;
  }) => Promise<{ ok: boolean; error?: string; localPath?: string }>;
  remove: (payload: { kind: number; pubkey: string; identifier: string }) => Promise<{ ok: boolean; error?: string }>;
  openFolder: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string }>;
  chooseFolder: () => Promise<{ ok: boolean; error?: string; canceled?: boolean; localPath?: string }>;
  onCloneProgress: (callback: (data: { address: string; text: string }) => void) => () => void;
}

declare global {
  interface Window {
    nostrGit?: NostrGitBridge;
  }
}

function bridge(): NostrGitBridge | undefined {
  if (!browser) return undefined;
  return window.nostrGit;
}

export function isGitBridgeAvailable(): boolean {
  return Boolean(bridge());
}

export async function listLocalRepos(): Promise<GitRepoEntry[]> {
  return (await bridge()?.list()) ?? [];
}

export async function getRepoStatus(localPath: string): Promise<GitStatus | null> {
  const result = await bridge()?.status({ localPath });
  return result?.ok && result.status ? result.status : null;
}

export async function getRepoLog(localPath: string, limit = 20): Promise<GitCommit[]> {
  const result = await bridge()?.log({ localPath, limit });
  return result?.ok && result.commits ? result.commits : [];
}

export async function getRepoRemotes(localPath: string): Promise<GitRemote[]> {
  const result = await bridge()?.remotes({ localPath });
  return result?.ok && result.remotes ? result.remotes : [];
}

export async function addRepoRemote(localPath: string, name: string, url: string): Promise<{ ok: boolean; error?: string; remote?: GitRemote }> {
  return (await bridge()?.addRemote({ localPath, name, url })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function removeRepoRemote(localPath: string, name: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.removeRemote({ localPath, name })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function fetchRepo(localPath: string, remote?: string, prune = true): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.fetch({ localPath, remote, prune })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function pullRepo(localPath: string, options: { ffOnly?: boolean; rebase?: boolean } = {}): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.pull({ localPath, ...options })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoBranches(localPath: string): Promise<{ name: string; current: boolean }[]> {
  const result = await bridge()?.branches({ localPath });
  return result?.ok && result.branches ? result.branches : [];
}

export async function checkoutRepoBranch(localPath: string, branchName: string, create = false): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.checkout({ localPath, branchName, create })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function deleteRepoBranch(localPath: string, branchName: string, force = false): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.deleteBranch({ localPath, branchName, force })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function commitRepo(
  localPath: string,
  message: string,
  options: { allowEmpty?: boolean; authorName?: string; authorEmail?: string; all?: boolean } = {}
): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.commit({ localPath, message, ...options })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function pushRepo(localPath: string, remote?: string, branch?: string, forceWithLease = false): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.push({ localPath, remote, branch, forceWithLease })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoDiff(
  localPath: string,
  options: { filePath?: string; staged?: boolean; hideWhitespace?: boolean } = {}
): Promise<string> {
  const result = await bridge()?.diff({ localPath, ...options });
  return result?.ok && typeof result.diff === 'string' ? result.diff : '';
}

export async function stageRepoFile(localPath: string, filePath?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.stage({ localPath, filePath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function unstageRepoFile(localPath: string, filePath?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.unstage({ localPath, filePath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoRefs(localPath: string): Promise<GitRefs> {
  const result = await bridge()?.refs({ localPath });
  return result?.ok && result.refs
    ? result.refs
    : { headBranch: null, branches: [], tags: [] };
}

export async function getRepoMergeBase(localPath: string, refA: string, refB: string): Promise<string> {
  const result = await bridge()?.mergeBase({ localPath, refA, refB });
  return result?.ok && result.commit ? result.commit : '';
}

export async function getRepoFormatPatch(localPath: string, baseRef?: string, single?: string): Promise<string> {
  const result = await bridge()?.formatPatch({ localPath, baseRef, single });
  return result?.ok && typeof result.patch === 'string' ? result.patch : '';
}

export async function cloneRepo(payload: {
  kind: number;
  pubkey: string;
  identifier: string;
  url: string;
  defaultBranch?: string;
  branch?: string;
}): Promise<{ ok: boolean; error?: string; localPath?: string }> {
  return (await bridge()?.clone(payload)) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function initRepo(payload: {
  kind: number;
  pubkey: string;
  identifier: string;
  defaultBranch?: string;
}): Promise<{ ok: boolean; error?: string; localPath?: string }> {
  return (await bridge()?.init(payload)) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function removeRepoEntry(payload: {
  kind: number;
  pubkey: string;
  identifier: string;
}): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.remove(payload)) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function openRepoFolder(localPath: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.openFolder({ localPath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function chooseRepoFolder(): Promise<{ ok: boolean; error?: string; canceled?: boolean; localPath?: string }> {
  return (await bridge()?.chooseFolder()) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoTags(localPath: string): Promise<GitTag[]> {
  const result = await bridge()?.tags({ localPath });
  return result?.ok && Array.isArray(result.tags) ? result.tags : [];
}

export async function createRepoTag(
  localPath: string,
  name: string,
  targetCommitSha: string
): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.createTag({ localPath, name, targetCommitSha })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function deleteRepoTag(localPath: string, name: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.deleteTag({ localPath, name })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function resetRepo(
  localPath: string,
  mode: 'soft' | 'mixed' | 'hard',
  ref: string
): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.reset({ localPath, mode, ref })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function cherryPickRepo(localPath: string, sha: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.cherryPick({ localPath, sha })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function abortCherryPickRepo(localPath: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.abortCherryPick({ localPath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoStashes(localPath: string): Promise<GitStash[]> {
  const result = await bridge()?.stashes({ localPath });
  return result?.ok && Array.isArray(result.stashes) ? result.stashes : [];
}

export async function createRepoStash(localPath: string, message?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.createStash({ localPath, message })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function popRepoStash(localPath: string, ref?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.popStash({ localPath, ref })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function dropRepoStash(localPath: string, ref: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.dropStash({ localPath, ref })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoSubmodules(localPath: string): Promise<GitSubmodule[]> {
  const result = await bridge()?.submodules({ localPath });
  return result?.ok && Array.isArray(result.submodules) ? result.submodules : [];
}

export async function updateRepoSubmodules(localPath: string, force = false): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.updateSubmodules({ localPath, force })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoWorktrees(localPath: string): Promise<GitWorktree[]> {
  const result = await bridge()?.worktrees({ localPath });
  return result?.ok && Array.isArray(result.worktrees) ? result.worktrees : [];
}

export async function addRepoWorktree(
  localPath: string,
  worktreePath: string,
  options: { createBranch?: string; commitish?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.addWorktree({ localPath, worktreePath, ...options })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function removeRepoWorktree(localPath: string, worktreePath: string, force = false): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.removeWorktree({ localPath, worktreePath, force })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function rebaseRepo(localPath: string, ref: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.rebase({ localPath, ref })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function continueRepoRebase(localPath: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.continueRebase({ localPath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function abortRepoRebase(localPath: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.abortRebase({ localPath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function skipRepoRebase(localPath: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.skipRebase({ localPath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export function isAuthFailure(message: string): boolean {
  return /Authentication failed/i.test(message);
}

export function onCloneProgress(callback: (data: { address: string; text: string }) => void): () => void {
  if (!browser || !window.nostrGit?.onCloneProgress) {
    return () => {};
  }
  return window.nostrGit.onCloneProgress(callback);
}
