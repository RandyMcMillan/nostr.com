// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit } from './core.cjs';
import { updateSubmodules, listSubmodules } from './submodule.cjs';

const fileProtocolEnv = { GIT_CONFIG_PARAMETERS: "'protocol.file.allow=always'" };

describe('electron/git/submodule', () => {
  let tmpDir;
  let sourceDir;

  beforeEach(async () => {
    sourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-submodule-source-'));
    await runGit(['init'], sourceDir);
    await runGit(['config', 'user.email', 'test@example.com'], sourceDir);
    await runGit(['config', 'user.name', 'Test User'], sourceDir);
    fs.writeFileSync(path.join(sourceDir, 'sub.txt'), 'sub');
    await runGit(['add', 'sub.txt'], sourceDir);
    await runGit(['commit', '-m', 'initial'], sourceDir);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-submodule-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);

    await runGit(['submodule', 'add', sourceDir, 'sub'], tmpDir, { env: fileProtocolEnv });
    await runGit(['commit', '-m', 'add submodule'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(sourceDir, { recursive: true, force: true });
  });

  it('lists submodules', async () => {
    const submodules = await listSubmodules(tmpDir);
    expect(submodules.length).toBe(1);
    expect(submodules[0].path).toBe('sub');
    expect(submodules[0].active).toBe(true);
  });

  it('updates submodules', async () => {
    fs.rmSync(path.join(tmpDir, 'sub'), { recursive: true, force: true });
    await updateSubmodules(tmpDir, { env: fileProtocolEnv });
    expect(fs.existsSync(path.join(tmpDir, 'sub', 'sub.txt'))).toBe(true);
  });
});
