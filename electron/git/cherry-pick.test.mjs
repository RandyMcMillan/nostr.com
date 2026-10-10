// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { cherryPick, abortCherryPick } from './cherry-pick.cjs';

describe('electron/git/cherry-pick', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-cherry-pick-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    await runGit(['add', 'a.txt'], tmpDir);
    await runGit(['commit', '-m', 'first'], tmpDir);
    await runGit(['branch', '-m', 'main'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    await runGit(['add', 'b.txt'], tmpDir);
    await runGit(['commit', '-m', 'second'], tmpDir);

    await runGit(['checkout', '-b', 'target', 'HEAD~1'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('cherry-picks a commit onto the current branch', async () => {
    const secondSha = (await runGit(['rev-parse', 'main'], tmpDir)).stdout.trim();
    await cherryPick(tmpDir, secondSha);
    const log = (await runGit(['log', '--oneline'], tmpDir)).stdout.trim();
    expect(log).toContain('second');
    expect(fs.existsSync(path.join(tmpDir, 'b.txt'))).toBe(true);
  });

  it('aborts a cherry-pick cleanly when none is in progress', async () => {
    await expect(abortCherryPick(tmpDir)).resolves.toBeUndefined();
  });
});
