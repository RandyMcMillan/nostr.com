// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { listWorktrees, addWorktree, removeWorktree } from './worktree.cjs';

describe('electron/git/worktree', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-worktree-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v1');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists only the main worktree initially', async () => {
    const worktrees = await listWorktrees(tmpDir);
    expect(worktrees.length).toBe(1);
    expect(worktrees[0].main).toBe(true);
    expect(worktrees[0].path).toBe(fs.realpathSync(tmpDir));
  });

  it('adds and removes a linked worktree', async () => {
    const worktreePath = path.join(os.tmpdir(), `nostr-git-linked-worktree-${Date.now()}`);
    await addWorktree(tmpDir, worktreePath, { createBranch: 'linked-branch' });
    let worktrees = await listWorktrees(tmpDir);
    expect(worktrees.length).toBe(2);
    expect(worktrees.some((wt) => wt.path === fs.realpathSync(worktreePath))).toBe(true);

    await removeWorktree(tmpDir, worktreePath);
    worktrees = await listWorktrees(tmpDir);
    expect(worktrees.length).toBe(1);
    fs.rmSync(worktreePath, { recursive: true, force: true });
  });
});
