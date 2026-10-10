// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getDiff, stageFile, unstageFile, extractDiffTextFromRawOutput } from './diff.cjs';

describe('electron/git/diff', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-diff-test-'));
    await runGit(['init', '--initial-branch=main'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an empty string when there are no changes', async () => {
    const diff = await getDiff(tmpDir);
    expect(diff).toBe('');
  });

  it('returns a patch for a modified tracked file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'world');
    const diff = await getDiff(tmpDir, { filePath: 'file.txt' });
    expect(diff).toContain('diff --git');
    expect(diff).toContain('-hello');
    expect(diff).toContain('+world');
  });

  it('returns a staged patch when staged option is true', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    const diff = await getDiff(tmpDir, { staged: true });
    expect(diff).toContain('diff --git');
    expect(diff).toContain('+hello');
  });

  it('strips raw header from patch-with-raw output', () => {
    const raw = ':100644 100644 abc123 def456 M\tfile.txt\0diff --git a/file.txt b/file.txt\n+change';
    const text = extractDiffTextFromRawOutput(raw);
    expect(text).toBe('diff --git a/file.txt b/file.txt\n+change');
    expect(text).not.toContain(':100644');
  });

  it('stages a file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'content');
    await stageFile(tmpDir, 'a.txt');
    const status = await runGit(['status', '--porcelain'], tmpDir);
    expect(status.stdout).toContain('A  a.txt');
  });

  it('unstages a file', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), 'content');
    await runGit(['add', 'a.txt'], tmpDir);
    await unstageFile(tmpDir, 'a.txt');
    const status = await runGit(['status', '--porcelain'], tmpDir);
    expect(status.stdout).toContain('?? a.txt');
  });
});
