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
