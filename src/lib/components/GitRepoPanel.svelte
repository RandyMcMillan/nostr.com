<script lang="ts">
  import { onMount } from 'svelte';
  import { FolderOpen, GitBranch, GitCommit, HardDrive, Loader2, MessageSquare, GitPullRequest, FileDiff } from '@lucide/svelte';
  import type { NostrEvent } from '$lib/nostr/types';
  import { GIT_REPO_KIND, GIT_PR_KIND, GIT_PATCH_KIND } from '$lib/nostr/kinds';
  import {
    isGitBridgeAvailable,
    cloneRepo,
    initRepo,
    removeRepoEntry,
    openRepoFolder,
    getRepoStatus,
    getRepoLog,
    getRepoRemotes,
    getRepoMergeBase,
    getRepoFormatPatch,
    onCloneProgress,
    type GitStatus,
    type GitCommit as GitCommitInfo,
    type GitRemote
  } from '$lib/nativeGit';
  import { repoAddress, gitRepoByAddress } from '$lib/stores/gitRepos';
  import { events, publishGitIssue, publishGitPullRequest, publishGitPullRequestUpdate, publishGitPatch, session } from '$lib/stores/app';

  export let event: NostrEvent;

  const dTag = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? '';
  const name = event.tags.find((tag) => tag[0] === 'name')?.[1] ?? dTag ?? 'repo';
  const cloneUrls = event.tags.filter((tag) => tag[0] === 'clone').map((tag) => tag[1]);
  const defaultBranch = event.tags.find((tag) => tag[0] === 'default_branch')?.[1];
  const repoRelays = event.tags.filter((tag) => tag[0] === 'relays').map((tag) => tag[1]);

  let busy = false;
  let message = '';
  let error = '';
  let status: GitStatus | null = null;
  let commits: GitCommitInfo[] = [];
  let expanded = false;
  let progressText = '';
  let issueOpen = false;
  let issueSubject = '';
  let issueBody = '';
  let issueLabels = '';
  let issuePublishing = false;
  let issueError = '';
  let prOpen = false;
  let prSubject = '';
  let prBody = '';
  let prLabels = '';
  let prPublishing = false;
  let prError = '';
  let prRemotes: GitRemote[] = [];
  let patchOpen = false;
  let patchTargetBranch = '';
  let patchPublishing = false;
  let patchError = '';
  let patchParentEvent: NostrEvent | null = null;
  let prUpdateOpen = false;
  let prUpdatePublishing = false;
  let prUpdateError = '';

  $: address = repoAddress(GIT_REPO_KIND, event.pubkey, dTag);
  $: existingPrs = $events.filter(
    (event) =>
      event.kind === GIT_PR_KIND &&
      event.pubkey === $session?.pubkey &&
      event.tags.some((tag) => tag[0] === 'a' && tag[1] === address)
  );
  $: existingPatches = $events.filter(
    (event) =>
      event.kind === GIT_PATCH_KIND &&
      event.tags.some((tag) => tag[0] === 'a' && tag[1] === address)
  );
  $: entry = $gitRepoByAddress.get(address);
  $: hasBridge = isGitBridgeAvailable();

  onMount(() => {
    if (entry?.localPath) {
      void loadRepoDetails();
    }
    return onCloneProgress((data) => {
      if (data.address !== address) return;
      progressText = data.text;
    });
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
    progressText = '';
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
      progressText = '';
      if (result.ok && result.localPath) {
        message = 'Cloned';
        await loadRepoDetails();
      } else {
        error = result.error || 'Clone failed.';
        message = '';
      }
    } catch (err) {
      busy = false;
      progressText = '';
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

  function openIssue() {
    issueSubject = '';
    issueBody = '';
    issueLabels = '';
    issueError = '';
    issueOpen = true;
  }

  async function publishIssue() {
    if (!issueSubject.trim()) return;
    issuePublishing = true;
    issueError = '';
    try {
      await publishGitIssue({
        repoAddress: address,
        subject: issueSubject.trim(),
        content: issueBody.trim(),
        labels: issueLabels.split(',').map((l) => l.trim()).filter(Boolean),
        repoRelays
      });
      issuePublishing = false;
      issueOpen = false;
      issueSubject = '';
      issueBody = '';
      issueLabels = '';
    } catch (err) {
      issuePublishing = false;
      issueError = err instanceof Error ? err.message : 'Could not publish issue.';
    }
  }

  async function openPr() {
    prSubject = '';
    prBody = '';
    prLabels = '';
    prError = '';
    prRemotes = entry?.localPath ? await getRepoRemotes(entry.localPath) : [];
    prOpen = true;
  }

  async function publishPr() {
    if (!prSubject.trim() || !entry?.localPath) return;
    const branch = status?.branch || '';
    const tip = commits[0]?.sha;
    if (!branch || !tip) {
      prError = 'Could not determine current branch or tip commit.';
      return;
    }
    prPublishing = true;
    prError = '';
    try {
      await publishGitPullRequest({
        repoAddress: address,
        subject: prSubject.trim(),
        content: prBody.trim(),
        tipCommit: tip,
        cloneUrls: prRemotes.map((remote) => remote.url),
        branchName: branch,
        labels: prLabels.split(',').map((l) => l.trim()).filter(Boolean),
        repoRelays
      });
      prPublishing = false;
      prOpen = false;
      prSubject = '';
      prBody = '';
      prLabels = '';
      prRemotes = [];
    } catch (err) {
      prPublishing = false;
      prError = err instanceof Error ? err.message : 'Could not publish pull request.';
    }
  }

  async function updatePr(prEvent: NostrEvent) {
    if (!entry?.localPath) return;
    const branch = status?.branch || '';
    const tip = commits[0]?.sha;
    if (!tip) {
      prUpdateError = 'Could not determine current tip commit.';
      return;
    }
    prUpdatePublishing = true;
    prUpdateError = '';
    try {
      await publishGitPullRequestUpdate({
        repoAddress: address,
        prEvent,
        tipCommit: tip,
        cloneUrls: prRemotes.map((remote) => remote.url),
        branchName: branch,
        repoRelays
      });
      prUpdatePublishing = false;
      prUpdateOpen = false;
    } catch (err) {
      prUpdatePublishing = false;
      prUpdateError = err instanceof Error ? err.message : 'Could not update pull request.';
    }
  }

  function openPatch() {
    patchTargetBranch = defaultBranch || 'main';
    patchError = '';
    patchParentEvent = null;
    patchOpen = true;
  }

  async function publishPatch() {
    if (!entry?.localPath) return;
    const branch = status?.branch || '';
    const tip = commits[0];
    if (!branch || !tip?.sha) {
      patchError = 'Could not determine current branch or tip commit.';
      return;
    }
    patchPublishing = true;
    patchError = '';
    try {
      const remoteRef = `origin/${patchTargetBranch}`;
      const base = await getRepoMergeBase(entry.localPath, 'HEAD', remoteRef);
      if (!base) {
        patchPublishing = false;
        patchError = `Could not find merge base with ${remoteRef}. Fetch the remote first.`;
        return;
      }
      const patch = await getRepoFormatPatch(entry.localPath, base);
      if (!patch.trim()) {
        patchPublishing = false;
        patchError = 'No commits to publish as a patch.';
        return;
      }
      await publishGitPatch({
        repoAddress: address,
        patch,
        tipCommit: tip.sha,
        parentCommit: tip.parents[0] ?? '',
        repoRelays,
        parentPatchEvent: patchParentEvent ?? undefined
      });
      patchPublishing = false;
      patchOpen = false;
      patchTargetBranch = defaultBranch || 'main';
      patchParentEvent = null;
    } catch (err) {
      patchPublishing = false;
      patchError = err instanceof Error ? err.message : 'Could not publish patch.';
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
        <button class="git-button" on:click={openPr} disabled={busy}><GitPullRequest size={14} /> New PR</button>
        {#if existingPrs.length}
          <button class="git-button" on:click={() => (prUpdateOpen = true)} disabled={busy}><GitPullRequest size={14} /> Update PR</button>
        {/if}
        <button class="git-button" on:click={openPatch} disabled={busy}><FileDiff size={14} /> New patch</button>
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
    <div class="git-repo-actions">
      <button class="git-button" on:click={openIssue} disabled={busy}><MessageSquare size={14} /> New issue</button>
    </div>

    {#if message}<span class="git-message">{message}</span>{/if}
    {#if progressText}<span class="git-message progress">{progressText}</span>{/if}
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

  {#if issueOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !issuePublishing && (issueOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="issue-repo-title">
        <div class="dialog-head">
          <h2 id="issue-repo-title">New issue</h2>
          <button class="icon-button small" aria-label="Close" disabled={issuePublishing} on:click={() => (issueOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Subject
            <input type="text" bind:value={issueSubject} placeholder="Short summary" />
          </label>
          <label>
            Body
            <textarea bind:value={issueBody} placeholder="Describe the issue" rows="5"></textarea>
          </label>
          <label>
            Labels
            <input type="text" bind:value={issueLabels} placeholder="bug, enhancement" />
          </label>
          {#if issueError}<p class="error">{issueError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={issuePublishing} on:click={() => (issueOpen = false)}>Cancel</button>
            <button class="primary" disabled={issuePublishing || !issueSubject.trim()} on:click={publishIssue}>
              {issuePublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if prOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !prPublishing && (prOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="pr-repo-title">
        <div class="dialog-head">
          <h2 id="pr-repo-title">New pull request</h2>
          <button class="icon-button small" aria-label="Close" disabled={prPublishing} on:click={() => (prOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Subject
            <input type="text" bind:value={prSubject} placeholder="Short summary" />
          </label>
          <label>
            Body
            <textarea bind:value={prBody} placeholder="Describe the changes" rows="5"></textarea>
          </label>
          <label>
            Labels
            <input type="text" bind:value={prLabels} placeholder="feature, wip" />
          </label>
          {#if prRemotes.length}
            <p class="git-description">Clone URLs: {prRemotes.map((r) => r.url).join(', ')}</p>
          {/if}
          {#if prError}<p class="error">{prError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={prPublishing} on:click={() => (prOpen = false)}>Cancel</button>
            <button class="primary" disabled={prPublishing || !prSubject.trim()} on:click={publishPr}>
              {prPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if patchOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !patchPublishing && (patchOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="patch-repo-title">
        <div class="dialog-head">
          <h2 id="patch-repo-title">New patch</h2>
          <button class="icon-button small" aria-label="Close" disabled={patchPublishing} on:click={() => (patchOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Target branch
            <input type="text" bind:value={patchTargetBranch} placeholder="main" />
          </label>
          <p class="git-description">Publishes commits between origin/{patchTargetBranch} and HEAD as a kind 1617 patch.</p>
          {#if existingPatches.length}
            <label>
              Thread on previous patch (optional)
              <select bind:value={patchParentEvent}>
                <option value={null}>None (start a new series)</option>
                {#each existingPatches as patch (patch.id)}
                  <option value={patch}>{patch.tags.find((tag) => tag[0] === 'commit')?.[1]?.slice(0, 8) ?? patch.id.slice(0, 8)}</option>
                {/each}
              </select>
            </label>
          {/if}
          {#if patchError}<p class="error">{patchError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={patchPublishing} on:click={() => (patchOpen = false)}>Cancel</button>
            <button class="primary" disabled={patchPublishing || !patchTargetBranch.trim()} on:click={publishPatch}>
              {patchPublishing ? 'Publishing...' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if prUpdateOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !prUpdatePublishing && (prUpdateOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="pr-update-title">
        <div class="dialog-head">
          <h2 id="pr-update-title">Update pull request</h2>
          <button class="icon-button small" aria-label="Close" disabled={prUpdatePublishing} on:click={() => (prUpdateOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <p class="git-description">Select a pull request to update to the current branch tip <code>{commits[0]?.shortSha ?? ''}</code>.</p>
          {#if existingPrs.length}
            <ul class="git-pr-list">
              {#each existingPrs as pr (pr.id)}
                <li>
                  <span class="git-pr-subject">{pr.tags.find((tag) => tag[0] === 'subject')?.[1] ?? 'Untitled'}</span>
                  <span class="git-pr-meta">{pr.tags.find((tag) => tag[0] === 'branch-name')?.[1] ?? ''}</span>
                  <button class="git-button" disabled={prUpdatePublishing} on:click={() => updatePr(pr)}>
                    {prUpdatePublishing ? 'Updating...' : 'Update'}
                  </button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="git-empty">No existing pull requests found.</p>
          {/if}
          {#if prUpdateError}<p class="error">{prUpdateError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={prUpdatePublishing} on:click={() => (prUpdateOpen = false)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}
