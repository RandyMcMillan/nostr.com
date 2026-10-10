// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { rebaseRepo, continueRebase, abortRebase, skipRebase } from './rebase.cjs';

describe('electron/git/rebase', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-rebase-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'base.txt'), 'base');
    await runGit(['add', 'base.txt'], tmpDir);
    await runGit(['commit', '-m', 'base'], tmpDir);

    await runGit(['checkout', '-b', 'feature'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'feat.txt'), 'feat');
    await runGit(['add', 'feat.txt'], tmpDir);
    await runGit(['commit', '-m', 'feature'], tmpDir);

    await runGit(['checkout', 'main'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'base.txt'), 'main-change');
    fs.writeFileSync(path.join(tmpDir, 'extra.txt'), 'extra');
    await runGit(['add', 'base.txt', 'extra.txt'], tmpDir);
    await runGit(['commit', '-m', 'extra'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rebases the current branch onto another', async () => {
    await runGit(['checkout', 'feature'], tmpDir);
    await rebaseRepo(tmpDir, 'main');
    const log = (await runGit(['log', '--oneline'], tmpDir)).stdout.trim();
    expect(log).toContain('feature');
    expect(log).toContain('extra');
  });

  it('aborts a rebase cleanly when none is in progress', async () => {
    await expect(abortRebase(tmpDir)).resolves.toBeUndefined();
  });

  it('skips a rebase commit', async () => {
    await runGit(['checkout', 'feature'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'base.txt'), 'feature-change');
    await runGit(['add', 'base.txt'], tmpDir);
    await runGit(['commit', '--amend', '-m', 'feature amended'], tmpDir);
    try {
      await rebaseRepo(tmpDir, 'main');
    } catch {
      // Expected conflict.
    }
    await skipRebase(tmpDir);
    const status = (await runGit(['status'], tmpDir)).stdout.trim();
    expect(status).not.toContain('rebasing');
  });
});
