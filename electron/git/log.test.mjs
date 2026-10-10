// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getRepositoryLog, parseLogOutput } from './log.cjs';

describe('electron/git/log', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-log-test-'));
    await runGit(['init', '--initial-branch=main'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns an empty array for a repo with no commits', async () => {
    const log = await getRepositoryLog(tmpDir);
    expect(log).toEqual([]);
  });

  it('returns commits in reverse chronological order', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), '1');
    await runGit(['add', 'a.txt'], tmpDir);
    await runGit(['commit', '-m', 'first'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'b.txt'), '2');
    await runGit(['add', 'b.txt'], tmpDir);
    await runGit(['commit', '-m', 'second'], tmpDir);

    const log = await getRepositoryLog(tmpDir);
    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe('second');
    expect(log[1].subject).toBe('first');
    expect(log[0].parents).toEqual([log[1].sha]);
    expect(log[0].author.name).toBe('Test User');
    expect(log[0].author.email).toBe('test@example.com');
  });

  it('respects the limit option', async () => {
    fs.writeFileSync(path.join(tmpDir, 'a.txt'), '1');
    await runGit(['add', 'a.txt'], tmpDir);
    await runGit(['commit', '-m', 'first'], tmpDir);

    fs.writeFileSync(path.join(tmpDir, 'b.txt'), '2');
    await runGit(['add', 'b.txt'], tmpDir);
    await runGit(['commit', '-m', 'second'], tmpDir);

    const log = await getRepositoryLog(tmpDir, 1);
    expect(log).toHaveLength(1);
    expect(log[0].subject).toBe('second');
  });

  it('handles subjects containing the old delimiter safely', () => {
    const output = [
      'sha1',
      'short1',
      'subject with <> chars',
      'Author',
      'a@b.com',
      '2024-01-01T00:00:00+00:00',
      '',
      'sha2',
      'short2',
      'second',
      'Author2',
      'a2@b.com',
      '2024-01-02T00:00:00+00:00',
      'sha1'
    ].join('\0') + '\0';

    const log = parseLogOutput(output);
    expect(log).toHaveLength(2);
    expect(log[0].subject).toBe('subject with <> chars');
    expect(log[0].parents).toEqual([]);
    expect(log[1].subject).toBe('second');
    expect(log[1].parents).toEqual(['sha1']);
  });
});
