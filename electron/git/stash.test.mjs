// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getStashes, createStash, popStash, dropStash } from './stash.cjs';

describe('electron/git/stash', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-stash-test-'));
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

  it('lists no stashes initially', async () => {
    const stashes = await getStashes(tmpDir);
    expect(stashes).toEqual([]);
  });

  it('creates and lists a stash', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v2');
    await createStash(tmpDir, 'wip');
    const stashes = await getStashes(tmpDir);
    expect(stashes.length).toBe(1);
    expect(stashes[0].message).toContain('wip');
  });

  it('pops a stash', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v2');
    await createStash(tmpDir);
    const stashes = await getStashes(tmpDir);
    await popStash(tmpDir, stashes[0].ref);
    expect((await getStashes(tmpDir)).length).toBe(0);
    expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf8')).toBe('v2');
  });

  it('drops a stash', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'v2');
    await createStash(tmpDir);
    const stashes = await getStashes(tmpDir);
    await dropStash(tmpDir, stashes[0].ref);
    expect((await getStashes(tmpDir)).length).toBe(0);
    expect(fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf8')).toBe('v1');
  });
});
