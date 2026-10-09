import { browser } from '$app/environment';

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

interface NostrGitBridge {
  list: () => Promise<GitRepoEntry[]>;
  status: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; status?: GitStatus }>;
  log: (payload: { localPath: string; limit?: number }) => Promise<{ ok: boolean; error?: string; commits?: GitCommit[] }>;
  remotes: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; remotes?: GitRemote[] }>;
  fetch: (payload: { localPath: string; remote?: string; prune?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  pull: (payload: { localPath: string; ffOnly?: boolean; rebase?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  branches: (payload: { localPath: string }) => Promise<{ ok: boolean; error?: string; branches?: { name: string; current: boolean }[] }>;
  checkout: (payload: { localPath: string; branchName: string; create?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  deleteBranch: (payload: { localPath: string; branchName: string; force?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  commit: (payload: { localPath: string; message: string; allowEmpty?: boolean; authorName?: string; authorEmail?: string }) => Promise<{ ok: boolean; error?: string }>;
  push: (payload: { localPath: string; remote?: string; branch?: string; forceWithLease?: boolean }) => Promise<{ ok: boolean; error?: string }>;
  diff: (payload: { localPath: string; filePath?: string; staged?: boolean }) => Promise<{ ok: boolean; error?: string; diff?: string }>;
  stage: (payload: { localPath: string; filePath?: string }) => Promise<{ ok: boolean; error?: string }>;
  unstage: (payload: { localPath: string; filePath?: string }) => Promise<{ ok: boolean; error?: string }>;
  refs: (payload: { localPath: string }) => Promise<{
    ok: boolean;
    error?: string;
    refs?: { headBranch: string | null; branches: { name: string; commit: string }[]; tags: { name: string; commit: string }[] };
  }>;
  mergeBase: (payload: { localPath: string; refA: string; refB: string }) => Promise<{ ok: boolean; error?: string; commit?: string }>;
  formatPatch: (payload: { localPath: string; baseRef?: string; single?: string }) => Promise<{ ok: boolean; error?: string; patch?: string }>;
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

export async function getRepoDiff(localPath: string, filePath?: string, staged = false): Promise<string> {
  const result = await bridge()?.diff({ localPath, filePath, staged });
  return result?.ok && typeof result.diff === 'string' ? result.diff : '';
}

export async function stageRepoFile(localPath: string, filePath?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.stage({ localPath, filePath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function unstageRepoFile(localPath: string, filePath?: string): Promise<{ ok: boolean; error?: string }> {
  return (await bridge()?.unstage({ localPath, filePath })) ?? { ok: false, error: 'Git bridge unavailable.' };
}

export async function getRepoRefs(localPath: string): Promise<{
  headBranch: string | null;
  branches: { name: string; commit: string }[];
  tags: { name: string; commit: string }[];
}> {
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

export function onCloneProgress(callback: (data: { address: string; text: string }) => void): () => void {
  if (!browser || !window.nostrGit?.onCloneProgress) {
    return () => {};
  }
  return window.nostrGit.onCloneProgress(callback);
}
