// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { resetRepo } from './reset.cjs';

describe('electron/git/reset', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-reset-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'a');
    await runGit(['add', 'a.txt'], tmpDir);
    await runGit(['commit', '-m', 'first'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'b.txt'), 'b');
    await runGit(['add', 'b.txt'], tmpDir);
    await runGit(['commit', '-m', 'second'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('performs a soft reset to the previous commit', async () => {
    const first = (await runGit(['rev-parse', 'HEAD~1'], tmpDir)).stdout.trim();
    await resetRepo(tmpDir, 'soft', 'HEAD~1');
    const head = (await runGit(['rev-parse', 'HEAD'], tmpDir)).stdout.trim();
    expect(head).toBe(first);
    const status = (await runGit(['status', '--porcelain'], tmpDir)).stdout.trim();
    expect(status).toContain('b.txt');
  });

  it('performs a mixed reset to the previous commit', async () => {
    await resetRepo(tmpDir, 'mixed', 'HEAD~1');
    const status = (await runGit(['status', '--porcelain'], tmpDir)).stdout.trim();
    expect(status).toContain(' b.txt');
  });

  it('performs a hard reset to the previous commit', async () => {
    await resetRepo(tmpDir, 'hard', 'HEAD~1');
    expect(fs.existsSync(path.join(tmpDir, 'b.txt'))).toBe(false);
  });
});
