<script lang="ts">
  import { onMount } from 'svelte';
  import { FolderOpen, GitBranch, GitCommit, HardDrive, Loader2 } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/nostr/types';
  import { GIT_REPO_KIND } from '$lib/nostr/kinds';
  import {
    isGitBridgeAvailable,
    cloneRepo,
    initRepo,
    removeRepoEntry,
    openRepoFolder,
    getRepoStatus,
    getRepoLog,
    type GitStatus,
    type GitCommit as GitCommitInfo
  } from '$lib/nativeGit';
  import { repoAddress, gitRepoByAddress } from '$lib/stores/gitRepos';

  export let event: NostrEvent;

  const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
  const name = event.tags.find((tag) => tag[0] === 'name')?.[1] ?? dTag ?? 'repo';
  const cloneUrls = event.tags.filter((tag) => tag[0] === 'clone').map((tag) => tag[1]);
  const defaultBranch = event.tags.find((tag) => tag[0] === 'default_branch')?.[1];

  let busy = false;
  let message = '';
  let error = '';
  let status: GitStatus | null = null;
  let commits: GitCommitInfo[] = [];
  let expanded = false;

  $: address = repoAddress(GIT_REPO_KIND, event.pubkey, dTag);
  $: entry = $gitRepoByAddress.get(address);
  $: hasBridge = isGitBridgeAvailable();

  onMount(() => {
    if (entry?.localPath) {
      void loadRepoDetails();
    }
  });

  async function loadRepoDetails() {
    if (!entry?.localPath) return;
    error = '';
    try {
      [status, commits] = await Promise.all([
        getRepoStatus(entry.localPath),
        getRepoLog(entry.localPath, 10)
      ]);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load repo details.';
    }
  }

  async function clone() {
    if (!cloneUrls.length) return;
    busy = true;
    error = '';
    message = 'Cloning...';
    try {
      const result = await cloneRepo({
        kind: GIT_REPO_KIND,
        pubkey: event.pubkey,
        identifier: dTag,
        url: cloneUrls[0],
        defaultBranch,
        branch: defaultBranch
      });
      busy = false;
      if (result.ok && result.localPath) {
        message = 'Cloned';
        await loadRepoDetails();
      } else {
        error = result.error || 'Clone failed.';
        message = '';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Clone failed.';
      message = '';
    }
  }

  async function initialize() {
    busy = true;
    error = '';
    message = 'Initializing...';
    try {
      const result = await initRepo({
        kind: GIT_REPO_KIND,
        pubkey: event.pubkey,
        identifier: dTag,
        defaultBranch
      });
      busy = false;
      if (result.ok) {
        message = 'Initialized';
        await loadRepoDetails();
      } else {
        error = result.error || 'Init failed.';
        message = '';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Init failed.';
      message = '';
    }
  }

  async function forget() {
    busy = true;
    error = '';
    try {
      const result = await removeRepoEntry({
        kind: GIT_REPO_KIND,
        pubkey: event.pubkey,
        identifier: dTag
      });
      busy = false;
      if (result.ok) {
        status = null;
        commits = [];
      } else {
        error = result.error || 'Could not forget repo.';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Could not forget repo.';
    }
  }

  async function openFolder() {
    if (!entry?.localPath) return;
    const result = await openRepoFolder(entry.localPath);
    if (!result.ok) {
      error = result.error || 'Could not open folder.';
    }
  }

  function toggleExpanded() {
    expanded = !expanded;
    if (expanded && entry?.localPath) {
      void loadRepoDetails();
    }
  }
</script>

{#if hasBridge}
  <div class="git-repo-panel">
    <div class="git-repo-actions">
      {#if entry}
        <button class="git-button" on:click={openFolder} disabled={busy}><FolderOpen size={14} /> Open</button>
        <button class="git-button" on:click={toggleExpanded} disabled={busy}>
          <GitCommit size={14} /> {expanded ? 'Hide' : 'Details'}
        </button>
        <button class="git-button" on:click={forget} disabled={busy}>Forget</button>
      {:else}
        {#if cloneUrls.length}
          <button class="git-button primary" on:click={clone} disabled={busy}>
            {#if busy}<Loader2 size={14} class="spin" />{:else}<HardDrive size={14} />{/if} Clone
          </button>
        {/if}
        <button class="git-button" on:click={initialize} disabled={busy || !dTag}>
          {#if busy}<Loader2 size={14} class="spin" />{:else}<GitBranch size={14} />{/if} Init local
        </button>
      {/if}
    </div>

    {#if message}<span class="git-message">{message}</span>{/if}
    {#if error}<span class="git-error">{error}</span>{/if}

    {#if expanded && entry}
      <div class="git-repo-details">
        {#if status}
          <div class="git-status">
            <span><GitBranch size={14} /> {status.branch || 'detached'}</span>
            {#if status.ahead}<span>+{status.ahead}</span>{/if}
            {#if status.behind}<span>-{status.behind}</span>{/if}
            {#if status.files.length}<span>{status.files.length} changed</span>{/if}
          </div>
        {/if}
        {#if commits.length}
          <ul class="git-commits">
            {#each commits as commit (commit.sha)}
              <li>
                <code>{commit.shortSha}</code>
                <span class="git-commit-subject">{commit.subject}</span>
                <span class="git-commit-meta">{commit.author.name}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <span class="git-empty">No commits yet.</span>
        {/if}
      </div>
    {/if}
  </div>
{/if}
