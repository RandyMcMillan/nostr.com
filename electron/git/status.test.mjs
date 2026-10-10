// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getRepositoryStatus, parsePorcelainV2Status } from './status.cjs';

describe('electron/git/status', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-status-test-'));
    await runGit(['init', '--initial-branch=main'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reports no files in an empty repo', async () => {
    const status = await getRepositoryStatus(tmpDir);
    expect(status.exists).toBe(true);
    expect(status.branch).toBe('main');
    expect(status.ahead).toBe(0);
    expect(status.behind).toBe(0);
    expect(status.files).toEqual([]);
  });

  it('detects an untracked file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'hello');
    const status = await getRepositoryStatus(tmpDir);
    expect(status.files).toEqual([{ index: '?', workingTree: '?', path: 'new.txt' }]);
  });

  it('detects a staged file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'staged.txt'), 'hello');
    await runGit(['add', 'staged.txt'], tmpDir);
    const status = await getRepositoryStatus(tmpDir);
    expect(status.files).toContainEqual({ index: 'A', workingTree: '.', path: 'staged.txt' });
  });

  it('detects a modified file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'mod.txt'), 'hello');
    await runGit(['add', 'mod.txt'], tmpDir);
    await runGit(['commit', '-m', 'add mod'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'mod.txt'), 'world');
    const status = await getRepositoryStatus(tmpDir);
    expect(status.files).toContainEqual({ index: '.', workingTree: 'M', path: 'mod.txt' });
  });

  it('detects a renamed file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'old.txt'), 'hello');
    await runGit(['add', 'old.txt'], tmpDir);
    await runGit(['commit', '-m', 'add old'], tmpDir);
    await runGit(['mv', 'old.txt', 'new.txt'], tmpDir);
    const status = await getRepositoryStatus(tmpDir);
    expect(status.files).toContainEqual({ index: 'R', workingTree: '.', path: 'new.txt' });
  });

  it('reports not-a-repo gracefully', async () => {
    const notRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-status-norepo-'));
    try {
      const status = await getRepositoryStatus(notRepo);
      expect(status.exists).toBe(false);
      expect(status.files).toEqual([]);
    } finally {
      fs.rmSync(notRepo, { recursive: true, force: true });
    }
  });

  it('parses ahead/behind from a mocked porcelain=v2 buffer', () => {
    const buffer = Buffer.from(
      '# branch.oid abc123\0# branch.head main\0# branch.upstream origin/main\0# branch.ab +2 -3\0',
      'utf8'
    );
    const status = parsePorcelainV2Status(buffer);
    expect(status.branch).toBe('main');
    expect(status.upstreamBranch).toBe('origin/main');
    expect(status.currentTip).toBe('abc123');
    expect(status.ahead).toBe(2);
    expect(status.behind).toBe(3);
  });

  it('parses untracked and modified entries from a mocked buffer', () => {
    const buffer = Buffer.from(
      '# branch.oid abc123\0# branch.head main\0# branch.ab +0 -0\0' +
      '? untracked.txt\0' +
      '1 .M N... 100644 100644 100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 modified.txt\0',
      'utf8'
    );
    const status = parsePorcelainV2Status(buffer);
    expect(status.files).toContainEqual({ index: '.', workingTree: 'M', path: 'modified.txt' });
    expect(status.files).toContainEqual({ index: '?', workingTree: '?', path: 'untracked.txt' });
  });
});
