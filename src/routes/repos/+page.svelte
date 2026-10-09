<script lang="ts">
  import { onMount } from 'svelte';
  import { FolderOpen, GitBranch, Trash2, RefreshCw, Loader2, PencilLine } from '@lucide/svelte';
  import { appPath } from '$lib/paths';
  import { publishGitRepo, type GitRepoAnnouncement } from '$lib/stores/app';
  import {
    isGitBridgeAvailable,
    listLocalRepos,
    getRepoStatus,
    openRepoFolder,
    removeRepoEntry,
    fetchRepo,
    pullRepo,
    getRepoBranches,
    checkoutRepoBranch,
    commitRepo,
    type GitRepoEntry,
    type GitStatus
  } from '$lib/nativeGit';

  let repos: GitRepoEntry[] = [];
  let loading = false;
  let error = '';
  let statuses = new Map<string, GitStatus | null>();
  let branches = new Map<string, { name: string; current: boolean }[]>();
  let selectedBranch: Record<string, string> = {};
  let publishOpen = false;
  let publishing = false;
  let publishError = '';
  let publishForm: GitRepoAnnouncement = {
    name: '',
    identifier: '',
    description: '',
    cloneUrls: [''],
    defaultBranch: 'main'
  };
  let commitOpen = false;
  let commitMessage = '';
  let selectedCommitRepo: GitRepoEntry | null = null;
  let committing = false;
  let commitError = '';

  onMount(() => {
    void loadRepos();
  });

  async function loadRepos() {
    loading = true;
    error = '';
    try {
      repos = await listLocalRepos();
      statuses = new Map();
      await Promise.all(
        repos.map(async (repo) => {
          const status = await getRepoStatus(repo.localPath);
          statuses.set(repo.address, status);
          statuses = statuses;
        })
      );
    } catch (err) {
      error = err instanceof Error ? err.message : 'Could not load repositories.';
    } finally {
      loading = false;
    }
  }

  async function openFolder(repo: GitRepoEntry) {
    const result = await openRepoFolder(repo.localPath);
    if (!result.ok) {
      error = result.error || 'Could not open folder.';
    }
  }

  async function forget(repo: GitRepoEntry) {
    const parts = repo.address.split(':');
    if (parts.length < 3) return;
    const [kind, pubkey, ...rest] = parts;
    const result = await removeRepoEntry({
      kind: Number(kind),
      pubkey,
      identifier: rest.join(':')
    });
    if (result.ok) {
      await loadRepos();
    } else {
      error = result.error || 'Could not forget repository.';
    }
  }

  async function fetch(repo: GitRepoEntry) {
    error = '';
    const result = await fetchRepo(repo.localPath);
    if (!result.ok) {
      error = result.error || 'Fetch failed.';
    } else {
      await loadRepos();
    }
  }

  async function pull(repo: GitRepoEntry) {
    error = '';
    const result = await pullRepo(repo.localPath, { ffOnly: true });
    if (!result.ok) {
      error = result.error || 'Pull failed.';
    } else {
      await loadRepos();
    }
  }

  async function loadBranches(repo: GitRepoEntry) {
    error = '';
    const list = await getRepoBranches(repo.localPath);
    branches.set(repo.address, list);
    branches = branches;
    const current = list.find((b) => b.current);
    if (current) {
      selectedBranch[repo.address] = current.name;
    }
  }

  async function checkout(repo: GitRepoEntry) {
    error = '';
    const branchName = selectedBranch[repo.address];
    if (!branchName) return;
    const result = await checkoutRepoBranch(repo.localPath, branchName);
    if (!result.ok) {
      error = result.error || 'Checkout failed.';
    } else {
      await loadRepos();
      await loadBranches(repo);
    }
  }

  function resetPublishForm() {
    publishForm = {
      name: '',
      identifier: '',
      description: '',
      cloneUrls: [''],
      defaultBranch: 'main'
    };
    publishError = '';
  }

  async function publishRepo() {
    if (!publishForm.name || !publishForm.identifier) return;
    publishing = true;
    publishError = '';
    try {
      await publishGitRepo({
        ...publishForm,
        cloneUrls: publishForm.cloneUrls.filter(Boolean)
      });
      publishing = false;
      publishOpen = false;
      resetPublishForm();
    } catch (err) {
      publishing = false;
      publishError = err instanceof Error ? err.message : 'Publish failed.';
    }
  }

  function openCommit(repo: GitRepoEntry) {
    selectedCommitRepo = repo;
    commitMessage = '';
    commitError = '';
    commitOpen = true;
  }

  async function doCommit() {
    if (!selectedCommitRepo || !commitMessage.trim()) return;
    committing = true;
    commitError = '';
    const result = await commitRepo(selectedCommitRepo.localPath, commitMessage.trim());
    committing = false;
    if (result.ok) {
      commitOpen = false;
      selectedCommitRepo = null;
      commitMessage = '';
      await loadRepos();
    } else {
      commitError = result.error || 'Commit failed.';
    }
  }

  function addCloneUrl() {
    publishForm.cloneUrls = [...publishForm.cloneUrls, ''];
  }

  function removeCloneUrl(index: number) {
    publishForm.cloneUrls = publishForm.cloneUrls.filter((_, i) => i !== index);
  }

  function repoName(repo: GitRepoEntry): string {
    const identifier = repo.address.split(':').slice(2).join(':') || 'repo';
    return identifier;
  }

  function statusLabel(repo: GitRepoEntry): string {
    const status = statuses.get(repo.address);
    if (!status || !status.exists) return 'not a repo';
    const branch = status.branch || 'detached';
    const changes = status.files.length ? ` · ${status.files.length} changed` : '';
    return `${branch}${changes}`;
  }
</script>

<article class="info-view article-info-view">
  <header class="info-head article-info-head">
    <a class="info-back" href={appPath('/')} aria-label="Back to feed">← Feed</a>
    <div class="info-title-row">
      <h1>Local Repositories</h1>
    </div>
    <p>Git repositories you have cloned or initialized through Nostr.</p>
  </header>

  {#if !isGitBridgeAvailable()}
    <div class="empty-state compact">
      <strong>Desktop only</strong>
      <p>Repository management is only available in the Nostr Social desktop app.</p>
    </div>
  {:else}
    <div class="relay-add-wrap" style="margin-bottom: 14px;">
      <button on:click={loadRepos} disabled={loading}>
        {#if loading}<Loader2 size={16} class="spin" />{:else}<RefreshCw size={16} />{/if} Refresh
      </button>
      <button class="primary" on:click={() => { resetPublishForm(); publishOpen = true; }}>
        Publish repo
      </button>
    </div>

    {#if error}<p class="error">{error}</p>{/if}

    {#if repos.length === 0 && !loading}
      <div class="empty-state compact">
        <strong>No local repositories</strong>
        <p>Clone or initialize a repo from a NIP-34 repository announcement.</p>
      </div>
    {:else}
      <div class="repo-list">
        {#each repos as repo (repo.address)}
          <div class="repo-row">
            <div class="repo-meta">
              <strong>{repoName(repo)}</strong>
              <span class="repo-path">{repo.localPath}</span>
              <span class="repo-status"><GitBranch size={13} /> {statusLabel(repo)}</span>
            </div>
            <div class="repo-actions">
              <button class="icon-button" title="Fetch" on:click={() => fetch(repo)}><RefreshCw size={16} /></button>
              <button class="icon-button" title="Pull" on:click={() => pull(repo)}><GitBranch size={16} /></button>
              <button class="icon-button" title="Commit" on:click={() => openCommit(repo)}><PencilLine size={16} /></button>
              <button class="icon-button" title="Open folder" on:click={() => openFolder(repo)}><FolderOpen size={16} /></button>
              <button class="icon-button danger-icon" title="Forget" on:click={() => forget(repo)}><Trash2 size={16} /></button>
            </div>
            <div class="repo-branch-row">
              <select bind:value={selectedBranch[repo.address]} on:click={() => !branches.has(repo.address) && loadBranches(repo)}>
                {#each branches.get(repo.address) ?? [] as branch (branch.name)}
                  <option value={branch.name}>{branch.current ? '* ' : ''}{branch.name}</option>
                {:else}
                  <option value="">branch...</option>
                {/each}
              </select>
              <button disabled={!selectedBranch[repo.address]} on:click={() => checkout(repo)}>Checkout</button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</article>

{#if commitOpen && selectedCommitRepo}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !committing && (commitOpen = false)}>
    <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="commit-repo-title">
      <div class="dialog-head">
        <h2 id="commit-repo-title">Commit changes</h2>
        <button class="icon-button small" aria-label="Close" disabled={committing} on:click={() => (commitOpen = false)}>×</button>
      </div>
      <div class="profile-editor">
        <label>
          Commit message
          <textarea bind:value={commitMessage} placeholder="Describe your changes" rows="3"></textarea>
        </label>
        {#if commitError}<p class="error">{commitError}</p>{/if}
        <div class="dialog-actions">
          <button disabled={committing} on:click={() => (commitOpen = false)}>Cancel</button>
          <button class="primary" disabled={committing || !commitMessage.trim()} on:click={doCommit}>
            {committing ? 'Committing...' : 'Commit'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if publishOpen}
  <div class="dialog-backdrop" role="presentation" tabindex="-1" on:click={(event) => event.target === event.currentTarget && !publishing && (publishOpen = false)}>
    <div class="dialog-panel" role="dialog" aria-modal="true" aria-labelledby="publish-repo-title">
      <div class="dialog-head">
        <h2 id="publish-repo-title">Publish repository</h2>
        <button class="icon-button small" aria-label="Close" disabled={publishing} on:click={() => (publishOpen = false)}>×</button>
      </div>
      <div class="profile-editor">
        <label>
          Name
          <input type="text" bind:value={publishForm.name} placeholder="my-project" />
        </label>
        <label>
          Identifier
          <input type="text" bind:value={publishForm.identifier} placeholder="my-project" />
        </label>
        <label>
          Description
          <textarea bind:value={publishForm.description} placeholder="Short description of the repository" rows="3"></textarea>
        </label>
        <label>
          Default branch
          <input type="text" bind:value={publishForm.defaultBranch} placeholder="main" />
        </label>
        <div class="repo-clone-urls">
          <span class="field-label">Clone URLs</span>
          {#each publishForm.cloneUrls as _, index (index)}
            <div class="relay-editor">
              <input type="text" bind:value={publishForm.cloneUrls[index]} placeholder="https://git.example.com/repo.git" />
              <button class="icon-button" disabled={publishForm.cloneUrls.length <= 1} on:click={() => removeCloneUrl(index)}><Trash2 size={16} /></button>
            </div>
          {/each}
          <button on:click={addCloneUrl}>Add URL</button>
        </div>
        {#if publishError}<p class="error">{publishError}</p>{/if}
        <div class="dialog-actions">
          <button disabled={publishing} on:click={() => (publishOpen = false)}>Cancel</button>
          <button class="primary" disabled={publishing || !publishForm.name || !publishForm.identifier} on:click={publishRepo}>
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
