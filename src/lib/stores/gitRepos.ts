import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { listLocalRepos, type GitRepoEntry } from '$lib/nativeGit';

export const gitRepoEntries = writable<GitRepoEntry[]>([]);
export const gitReposLoading = writable(false);

export const gitRepoByAddress = derived(gitRepoEntries, (entries) => {
  const map = new Map<string, GitRepoEntry>();
  for (const entry of entries) {
    map.set(entry.address, entry);
  }
  return map;
});

export async function refreshGitRepos() {
  if (!browser) return;
  gitReposLoading.set(true);
  try {
    gitRepoEntries.set(await listLocalRepos());
  } finally {
    gitReposLoading.set(false);
  }
}

export function repoAddress(kind: number, pubkey: string, identifier: string): string {
  return `${kind}:${pubkey}:${identifier}`;
}
