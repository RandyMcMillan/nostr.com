<script lang="ts">
  import { onMount } from 'svelte';
  import { FolderOpen, GitBranch, GitCommit, HardDrive, Loader2, MessageSquare, GitPullRequest, FileDiff, Tag } from '@lucide/svelte';
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
    getRepoTags,
    createRepoTag,
    deleteRepoTag,
    resetRepo,
    fetchRepo,
    pullRepo,
    pushRepo,
    cherryPickRepo,
    abortCherryPickRepo,
    addRepoRemote,
    removeRepoRemote,
    getRepoStashes,
    createRepoStash,
    popRepoStash,
    dropRepoStash,
    getRepoSubmodules,
    updateRepoSubmodules,
    getRepoWorktrees,
    addRepoWorktree,
    removeRepoWorktree,
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
  let tags: { name: string; commitSha: string }[] = [];
  let tagOpen = false;
  let tagName = '';
  let tagTarget = '';
  let tagPublishing = false;
  let tagError = '';
  let resetOpen = false;
  let resetMode: 'soft' | 'mixed' | 'hard' = 'mixed';
  let resetRef = '';
  let resetPublishing = false;
  let resetError = '';
  let cherryPickOpen = false;
  let cherryPickSha = '';
  let cherryPickPublishing = false;
  let cherryPickError = '';
  let remoteOpen = false;
  let remoteName = '';
  let remoteUrl = '';
  let remotePublishing = false;
  let remoteError = '';
  let stashes: { sha: string; ref: string; message: string }[] = [];
  let stashOpen = false;
  let stashMessage = '';
  let stashPublishing = false;
  let stashError = '';
  let submodules: { sha: string; path: string; active: boolean }[] = [];
  let worktrees: { path: string; head: string; branch: string | null; isDetached: boolean; main: boolean }[] = [];
  let worktreeOpen = false;
  let worktreePath = '';
  let worktreeBranch = '';
  let worktreePublishing = false;
  let worktreeError = '';

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
      [status, commits, tags, prRemotes, stashes, submodules, worktrees] = await Promise.all([
        getRepoStatus(entry.localPath),
        getRepoLog(entry.localPath, 10),
        getRepoTags(entry.localPath),
        getRepoRemotes(entry.localPath),
        getRepoStashes(entry.localPath),
        getRepoSubmodules(entry.localPath),
        getRepoWorktrees(entry.localPath)
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

  function openTag() {
    tagName = '';
    tagTarget = commits[0]?.sha ?? '';
    tagError = '';
    tagOpen = true;
  }

  async function publishTag() {
    if (!entry?.localPath || !tagName.trim() || !tagTarget.trim()) return;
    tagPublishing = true;
    tagError = '';
    try {
      const result = await createRepoTag(entry.localPath, tagName.trim(), tagTarget.trim());
      tagPublishing = false;
      if (result.ok) {
        tagOpen = false;
        tagName = '';
        tagTarget = '';
        await loadRepoDetails();
      } else {
        tagError = result.error || 'Could not create tag.';
      }
    } catch (err) {
      tagPublishing = false;
      tagError = err instanceof Error ? err.message : 'Could not create tag.';
    }
  }

  async function removeTag(name: string) {
    if (!entry?.localPath) return;
    error = '';
    try {
      const result = await deleteRepoTag(entry.localPath, name);
      if (result.ok) {
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not delete tag.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not delete tag.';
    }
  }

  function openReset() {
    resetMode = 'mixed';
    resetRef = commits[0]?.sha ?? '';
    resetError = '';
    resetOpen = true;
  }

  async function publishReset() {
    if (!entry?.localPath || !resetRef.trim()) return;
    resetPublishing = true;
    resetError = '';
    try {
      const result = await resetRepo(entry.localPath, resetMode, resetRef.trim());
      resetPublishing = false;
      if (result.ok) {
        resetOpen = false;
        resetRef = '';
        await loadRepoDetails();
      } else {
        resetError = result.error || 'Could not reset.';
      }
    } catch (err) {
      resetPublishing = false;
      resetError = err instanceof Error ? err.message : 'Could not reset.';
    }
  }

  async function fetch() {
    if (!entry?.localPath) return;
    busy = true;
    error = '';
    try {
      const result = await fetchRepo(entry.localPath);
      busy = false;
      if (result.ok) {
        message = 'Fetched';
        await loadRepoDetails();
      } else {
        error = result.error || 'Fetch failed.';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Fetch failed.';
    }
  }

  async function pull() {
    if (!entry?.localPath) return;
    busy = true;
    error = '';
    try {
      const result = await pullRepo(entry.localPath);
      busy = false;
      if (result.ok) {
        message = 'Pulled';
        await loadRepoDetails();
      } else {
        error = result.error || 'Pull failed.';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Pull failed.';
    }
  }

  async function push() {
    if (!entry?.localPath) return;
    busy = true;
    error = '';
    try {
      const result = await pushRepo(entry.localPath);
      busy = false;
      if (result.ok) {
        message = 'Pushed';
        await loadRepoDetails();
      } else {
        error = result.error || 'Push failed.';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Push failed.';
    }
  }

  function openCherryPick() {
    cherryPickSha = commits[0]?.sha ?? '';
    cherryPickError = '';
    cherryPickOpen = true;
  }

  async function publishCherryPick() {
    if (!entry?.localPath || !cherryPickSha.trim()) return;
    cherryPickPublishing = true;
    cherryPickError = '';
    try {
      const result = await cherryPickRepo(entry.localPath, cherryPickSha.trim());
      cherryPickPublishing = false;
      if (result.ok) {
        cherryPickOpen = false;
        cherryPickSha = '';
        await loadRepoDetails();
      } else {
        cherryPickError = result.error || 'Cherry-pick failed.';
      }
    } catch (err) {
      cherryPickPublishing = false;
      cherryPickError = err instanceof Error ? err.message : 'Cherry-pick failed.';
    }
  }

  async function abortCherryPick() {
    if (!entry?.localPath) return;
    error = '';
    try {
      const result = await abortCherryPickRepo(entry.localPath);
      if (result.ok) {
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not abort cherry-pick.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not abort cherry-pick.';
    }
  }

  function openRemote() {
    remoteName = '';
    remoteUrl = '';
    remoteError = '';
    remoteOpen = true;
  }

  async function publishRemote() {
    if (!entry?.localPath || !remoteName.trim() || !remoteUrl.trim()) return;
    remotePublishing = true;
    remoteError = '';
    try {
      const result = await addRepoRemote(entry.localPath, remoteName.trim(), remoteUrl.trim());
      remotePublishing = false;
      if (result.ok) {
        remoteOpen = false;
        remoteName = '';
        remoteUrl = '';
        prRemotes = await getRepoRemotes(entry.localPath);
      } else {
        remoteError = result.error || 'Could not add remote.';
      }
    } catch (err) {
      remotePublishing = false;
      remoteError = err instanceof Error ? err.message : 'Could not add remote.';
    }
  }

  async function deleteRemote(name: string) {
    if (!entry?.localPath) return;
    error = '';
    try {
      const result = await removeRepoRemote(entry.localPath, name);
      if (result.ok) {
        prRemotes = await getRepoRemotes(entry.localPath);
      } else {
        error = result.error || 'Could not remove remote.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not remove remote.';
    }
  }

  function openStash() {
    stashMessage = '';
    stashError = '';
    stashOpen = true;
  }

  async function publishStash() {
    if (!entry?.localPath) return;
    stashPublishing = true;
    stashError = '';
    try {
      const result = await createRepoStash(entry.localPath, stashMessage.trim() || undefined);
      stashPublishing = false;
      if (result.ok) {
        stashOpen = false;
        stashMessage = '';
        await loadRepoDetails();
      } else {
        stashError = result.error || 'Could not create stash.';
      }
    } catch (err) {
      stashPublishing = false;
      stashError = err instanceof Error ? err.message : 'Could not create stash.';
    }
  }

  async function applyStash(ref: string) {
    if (!entry?.localPath || !ref) return;
    error = '';
    try {
      const result = await popRepoStash(entry.localPath, ref);
      if (result.ok) {
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not pop stash.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not pop stash.';
    }
  }

  async function discardStash(ref: string) {
    if (!entry?.localPath || !ref) return;
    error = '';
    try {
      const result = await dropRepoStash(entry.localPath, ref);
      if (result.ok) {
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not drop stash.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not drop stash.';
    }
  }

  async function updateSubmodules() {
    if (!entry?.localPath) return;
    busy = true;
    error = '';
    try {
      const result = await updateRepoSubmodules(entry.localPath);
      busy = false;
      if (result.ok) {
        message = 'Submodules updated';
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not update submodules.';
      }
    } catch (err) {
      busy = false;
      error = err instanceof Error ? err.message : 'Could not update submodules.';
    }
  }

  function openWorktree() {
    worktreePath = '';
    worktreeBranch = '';
    worktreeError = '';
    worktreeOpen = true;
  }

  async function publishWorktree() {
    if (!entry?.localPath || !worktreePath.trim()) return;
    worktreePublishing = true;
    worktreeError = '';
    try {
      const result = await addRepoWorktree(entry.localPath, worktreePath.trim(), {
        createBranch: worktreeBranch.trim() || undefined
      });
      worktreePublishing = false;
      if (result.ok) {
        worktreeOpen = false;
        worktreePath = '';
        worktreeBranch = '';
        await loadRepoDetails();
      } else {
        worktreeError = result.error || 'Could not add worktree.';
      }
    } catch (err) {
      worktreePublishing = false;
      worktreeError = err instanceof Error ? err.message : 'Could not add worktree.';
    }
  }

  async function deleteWorktree(worktreePathToRemove: string) {
    if (!entry?.localPath || !worktreePathToRemove) return;
    error = '';
    try {
      const result = await removeRepoWorktree(entry.localPath, worktreePathToRemove);
      if (result.ok) {
        await loadRepoDetails();
      } else {
        error = result.error || 'Could not remove worktree.';
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not remove worktree.';
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
        <button class="git-button" on:click={fetch} disabled={busy}>Fetch</button>
        <button class="git-button" on:click={pull} disabled={busy}>Pull</button>
        <button class="git-button" on:click={push} disabled={busy}>Push</button>
        <button class="git-button" on:click={openPr} disabled={busy}><GitPullRequest size={14} /> New PR</button>
        {#if existingPrs.length}
          <button class="git-button" on:click={() => (prUpdateOpen = true)} disabled={busy}><GitPullRequest size={14} /> Update PR</button>
        {/if}
        <button class="git-button" on:click={openPatch} disabled={busy}><FileDiff size={14} /> New patch</button>
        <button class="git-button" on:click={openTag} disabled={busy}><Tag size={14} /> Tag</button>
        <button class="git-button" on:click={openCherryPick} disabled={busy}>Cherry-pick</button>
        <button class="git-button" on:click={openReset} disabled={busy}>Reset</button>
        <button class="git-button" on:click={openRemote} disabled={busy}>Remote</button>
        <button class="git-button" on:click={openStash} disabled={busy}>Stash</button>
        <button class="git-button" on:click={updateSubmodules} disabled={busy}>Submodules</button>
        <button class="git-button" on:click={openWorktree} disabled={busy}>Worktree</button>
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
        {#if tags.length}
          <div class="git-tags">
            <h4>Tags</h4>
            <ul>
              {#each tags as tag (tag.name)}
                <li>
                  <span class="git-tag-name"><Tag size={12} /> {tag.name}</span>
                  <code>{tag.commitSha.slice(0, 7)}</code>
                  <button class="icon-button small" aria-label="Delete tag" on:click={() => removeTag(tag.name)}>×</button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if prRemotes.length}
          <div class="git-remotes">
            <h4>Remotes</h4>
            <ul>
              {#each prRemotes as remote (remote.name)}
                <li>
                  <span class="git-remote-name">{remote.name}</span>
                  <span class="git-remote-url">{remote.url}</span>
                  <button class="icon-button small" aria-label="Remove remote" on:click={() => deleteRemote(remote.name)}>×</button>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if stashes.length}
          <div class="git-stashes">
            <h4>Stashes</h4>
            <ul>
              {#each stashes as stash (stash.ref)}
                <li>
                  <code>{stash.ref}</code>
                  <span class="git-stash-message">{stash.message}</span>
                  <span>
                    <button class="git-button small" on:click={() => applyStash(stash.ref)}>Pop</button>
                    <button class="icon-button small" aria-label="Drop stash" on:click={() => discardStash(stash.ref)}>×</button>
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if submodules.length}
          <div class="git-submodules">
            <h4>Submodules</h4>
            <ul>
              {#each submodules as submodule (submodule.path)}
                <li>
                  <code>{submodule.sha.slice(0, 7)}</code>
                  <span class="git-submodule-path">{submodule.path}</span>
                  <span class="git-submodule-status">{submodule.active ? 'active' : 'inactive'}</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if worktrees.length > 1}
          <div class="git-worktrees">
            <h4>Worktrees</h4>
            <ul>
              {#each worktrees as worktree (worktree.path)}
                {#if !worktree.main}
                  <li>
                    <code>{worktree.head.slice(0, 7)}</code>
                    <span class="git-worktree-path">{worktree.path}</span>
                    <span class="git-worktree-branch">{worktree.branch ?? 'detached'}</span>
                    <button class="icon-button small" aria-label="Remove worktree" on:click={() => deleteWorktree(worktree.path)}>×</button>
                  </li>
                {/if}
              {/each}
            </ul>
          </div>
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

  {#if tagOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !tagPublishing && (tagOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="tag-repo-title">
        <div class="dialog-head">
          <h2 id="tag-repo-title">Create tag</h2>
          <button class="icon-button small" aria-label="Close" disabled={tagPublishing} on:click={() => (tagOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Name
            <input type="text" bind:value={tagName} placeholder="v1.0.0" />
          </label>
          <label>
            Target commit
            <input type="text" bind:value={tagTarget} placeholder={commits[0]?.sha ?? ''} />
          </label>
          {#if tagError}<p class="error">{tagError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={tagPublishing} on:click={() => (tagOpen = false)}>Cancel</button>
            <button class="primary" disabled={tagPublishing || !tagName.trim() || !tagTarget.trim()} on:click={publishTag}>
              {tagPublishing ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if resetOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !resetPublishing && (resetOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="reset-repo-title">
        <div class="dialog-head">
          <h2 id="reset-repo-title">Reset branch</h2>
          <button class="icon-button small" aria-label="Close" disabled={resetPublishing} on:click={() => (resetOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <p class="git-description warning">This can discard local changes. Use with care.</p>
          <label>
            Mode
            <select bind:value={resetMode}>
              <option value="soft">Soft (keep changes staged)</option>
              <option value="mixed">Mixed (keep changes unstaged)</option>
              <option value="hard">Hard (discard changes)</option>
            </select>
          </label>
          <label>
            Target commit / ref
            <input type="text" bind:value={resetRef} placeholder={commits[0]?.sha ?? 'HEAD~1'} />
          </label>
          {#if resetError}<p class="error">{resetError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={resetPublishing} on:click={() => (resetOpen = false)}>Cancel</button>
            <button class="primary" disabled={resetPublishing || !resetRef.trim()} on:click={publishReset}>
              {resetPublishing ? 'Resetting...' : 'Reset'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if cherryPickOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !cherryPickPublishing && (cherryPickOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="cherry-pick-repo-title">
        <div class="dialog-head">
          <h2 id="cherry-pick-repo-title">Cherry-pick commit</h2>
          <button class="icon-button small" aria-label="Close" disabled={cherryPickPublishing} on:click={() => (cherryPickOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Commit SHA
            <input type="text" bind:value={cherryPickSha} placeholder={commits[0]?.sha ?? ''} />
          </label>
          {#if cherryPickError}<p class="error">{cherryPickError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={cherryPickPublishing} on:click={() => (cherryPickOpen = false)}>Cancel</button>
            <button disabled={cherryPickPublishing} on:click={abortCherryPick}>Abort</button>
            <button class="primary" disabled={cherryPickPublishing || !cherryPickSha.trim()} on:click={publishCherryPick}>
              {cherryPickPublishing ? 'Applying...' : 'Cherry-pick'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if remoteOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !remotePublishing && (remoteOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="remote-repo-title">
        <div class="dialog-head">
          <h2 id="remote-repo-title">Add remote</h2>
          <button class="icon-button small" aria-label="Close" disabled={remotePublishing} on:click={() => (remoteOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Name
            <input type="text" bind:value={remoteName} placeholder="origin" />
          </label>
          <label>
            URL
            <input type="text" bind:value={remoteUrl} placeholder="https://github.com/user/repo.git" />
          </label>
          {#if remoteError}<p class="error">{remoteError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={remotePublishing} on:click={() => (remoteOpen = false)}>Cancel</button>
            <button class="primary" disabled={remotePublishing || !remoteName.trim() || !remoteUrl.trim()} on:click={publishRemote}>
              {remotePublishing ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if stashOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !stashPublishing && (stashOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="stash-repo-title">
        <div class="dialog-head">
          <h2 id="stash-repo-title">Create stash</h2>
          <button class="icon-button small" aria-label="Close" disabled={stashPublishing} on:click={() => (stashOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Message (optional)
            <input type="text" bind:value={stashMessage} placeholder="Work in progress" />
          </label>
          {#if stashError}<p class="error">{stashError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={stashPublishing} on:click={() => (stashOpen = false)}>Cancel</button>
            <button class="primary" disabled={stashPublishing} on:click={publishStash}>
              {stashPublishing ? 'Stashing...' : 'Stash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if worktreeOpen}
    <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !worktreePublishing && (worktreeOpen = false)}>
      <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="worktree-repo-title">
        <div class="dialog-head">
          <h2 id="worktree-repo-title">Add worktree</h2>
          <button class="icon-button small" aria-label="Close" disabled={worktreePublishing} on:click={() => (worktreeOpen = false)}>×</button>
        </div>
        <div class="profile-editor">
          <label>
            Path
            <input type="text" bind:value={worktreePath} placeholder="/path/to/worktree" />
          </label>
          <label>
            New branch (optional)
            <input type="text" bind:value={worktreeBranch} placeholder="feature-branch" />
          </label>
          {#if worktreeError}<p class="error">{worktreeError}</p>{/if}
          <div class="dialog-actions">
            <button disabled={worktreePublishing} on:click={() => (worktreeOpen = false)}>Cancel</button>
            <button class="primary" disabled={worktreePublishing || !worktreePath.trim()} on:click={publishWorktree}>
              {worktreePublishing ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
{/if}
