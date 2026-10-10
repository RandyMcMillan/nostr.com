// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { getTags, createTag, deleteTag } from './tag.cjs';

describe('electron/git/tag', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-tag-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'hello');
    await runGit(['add', 'file.txt'], tmpDir);
    await runGit(['commit', '-m', 'initial'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('lists no tags in a fresh repo', async () => {
    const tags = await getTags(tmpDir);
    expect(tags).toEqual([]);
  });

  it('creates and lists a lightweight tag', async () => {
    const log = await runGit(['rev-parse', 'HEAD'], tmpDir);
    const sha = log.stdout.trim();
    await createTag(tmpDir, 'v1.0.0', sha);
    const tags = await getTags(tmpDir);
    expect(tags).toEqual([{ name: 'v1.0.0', commitSha: sha }]);
  });

  it('creates and lists an annotated tag using the tag target commit', async () => {
    const log = await runGit(['rev-parse', 'HEAD'], tmpDir);
    const sha = log.stdout.trim();
    await runGit(['tag', '-a', '-m', 'release', 'v2.0.0', sha], tmpDir);
    const tags = await getTags(tmpDir);
    expect(tags).toEqual([{ name: 'v2.0.0', commitSha: sha }]);
  });

  it('deletes a tag', async () => {
    const log = await runGit(['rev-parse', 'HEAD'], tmpDir);
    const sha = log.stdout.trim();
    await createTag(tmpDir, 'v1.0.0', sha);
    await deleteTag(tmpDir, 'v1.0.0');
    const tags = await getTags(tmpDir);
    expect(tags).toEqual([]);
  });
});
