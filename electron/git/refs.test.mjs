// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getRefs, getSymbolicRef, formatAsLocalRef } from './refs.cjs';

describe('electron/git/refs', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-refs-test-'));
    await runGit(['init', '--initial-branch=main'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists branches and tags in a repo with a commit', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);
    await runGit(['tag', 'v1.0.0'], tmpDir);

    const refs = await getRefs(tmpDir);
    expect(refs.headBranch).toBe('main');
    expect(refs.branches).toHaveLength(1);
    expect(refs.branches[0].name).toBe('main');
    expect(refs.branches[0].commit).toHaveLength(40);
    expect(refs.tags).toHaveLength(1);
    expect(refs.tags[0].name).toBe('v1.0.0');
    expect(refs.tags[0].commit).toHaveLength(40);
  });

  it('returns empty arrays for a fresh repo', async () => {
    const refs = await getRefs(tmpDir);
    expect(refs.headBranch).toBe('main');
    expect(refs.branches).toEqual([]);
    expect(refs.tags).toEqual([]);
  });

  it('reports detached HEAD', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);
    const sha = (await runGit(['rev-parse', 'HEAD'], tmpDir)).stdout.trim();
    await runGit(['checkout', sha, '--detach'], tmpDir);

    const refs = await getRefs(tmpDir);
    expect(refs.headBranch).toBeNull();
  });

  it('formats local refs correctly', () => {
    expect(formatAsLocalRef('main')).toBe('refs/heads/main');
    expect(formatAsLocalRef('refs/heads/main')).toBe('refs/heads/main');
    expect(formatAsLocalRef('heads/feature')).toBe('refs/heads/feature');
  });

  it('reads the HEAD symbolic ref', async () => {
    const ref = await getSymbolicRef(tmpDir, 'HEAD');
    expect(ref).toBe('refs/heads/main');
  });

  it('returns null for a non-symbolic ref', async () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);
    const sha = (await runGit(['rev-parse', 'HEAD'], tmpDir)).stdout.trim();
    const ref = await getSymbolicRef(tmpDir, sha);
    expect(ref).toBeNull();
  });
});
