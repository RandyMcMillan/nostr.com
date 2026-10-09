// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initRepository } from '../../../electron/git/init.cjs';
import { getRepositoryStatus } from '../../../electron/git/status.cjs';
import { getRepositoryLog } from '../../../electron/git/log.cjs';
import { getRemotes } from '../../../electron/git/remote.cjs';
import { getBranches, checkoutBranch } from '../../../electron/git/branch.cjs';
import { commit } from '../../../electron/git/commit.cjs';
import { runGit } from '../../../electron/git/core.cjs';

describe('electron/git runtime', () => {
  let repoPath: string;

  beforeEach(() => {
    repoPath = mkdtempSync(join(tmpdir(), 'nostr-git-test-'));
  });

  afterEach(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  it('initializes a repo and reports status', async () => {
    await initRepository(repoPath, 'main');
    const status = await getRepositoryStatus(repoPath);
    expect(status.exists).toBe(true);
    expect(status.branch).toBe('main');
    expect(status.files).toEqual([]);
  });

  it('returns an empty log for a fresh repo', async () => {
    await initRepository(repoPath, 'main');
    const commits = await getRepositoryLog(repoPath);
    expect(commits).toEqual([]);
  });

  it('lists no remotes in a fresh repo', async () => {
    await initRepository(repoPath, 'main');
    const remotes = await getRemotes(repoPath);
    expect(remotes).toEqual([]);
  });

  it('lists branches and checks out a new branch', async () => {
    await initRepository(repoPath, 'main');
    const filePath = join(repoPath, 'readme.md');
    writeFileSync(filePath, '# hello');
    await runGit(['add', 'readme.md'], repoPath);
    await commit(repoPath, 'initial commit');

    await runGit(['branch', 'feature'], repoPath);
    let branches = await getBranches(repoPath);
    expect(branches.map((b) => b.name)).toContain('feature');

    await checkoutBranch(repoPath, 'feature');
    branches = await getBranches(repoPath);
    const current = branches.find((b) => b.current);
    expect(current?.name).toBe('feature');
  });
});
