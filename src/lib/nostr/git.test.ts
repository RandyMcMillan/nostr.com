// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { initRepository } from '../../../electron/git/init.cjs';
import { getRepositoryStatus } from '../../../electron/git/status.cjs';
import { getRepositoryLog } from '../../../electron/git/log.cjs';
import { getRemotes } from '../../../electron/git/remote.cjs';

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
});
