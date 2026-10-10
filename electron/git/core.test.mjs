// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runGit, GitError, isAuthFailureError, describeGitError, getDescriptionForError } from './core.cjs';

describe('electron/git/core', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-core-test-'));
    await runGit(['init'], tmpDir);
    await runGit(['config', 'user.email', 'test@example.com'], tmpDir);
    await runGit(['config', 'user.name', 'Test User'], tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns stdout and exit code 0 for a successful command', async () => {
    const result = await runGit(['rev-parse', '--git-dir'], tmpDir);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('.git');
    expect(result.gitError).toBeNull();
    expect(result.gitErrorDescription).toBeNull();
  });

  it('respects successExitCodes and returns parsed error without throwing', async () => {
    const result = await runGit(['status', '--porcelain'], tmpDir, {
      successExitCodes: new Set([0, 128])
    });
    expect(result.exitCode).toBe(0);
  });

  it('throws a GitError with stderr details for an unparseable failure', async () => {
    await expect(runGit(['show', 'nonexistent-ref'], tmpDir)).rejects.toThrow(GitError);
    try {
      await runGit(['show', 'nonexistent-ref'], tmpDir);
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect(err.result.exitCode).not.toBe(0);
      expect(err.message).toContain('nonexistent-ref');
    }
  });

  it('throws a GitError with a parsed description for a known dugite error', async () => {
    const outsideRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-core-throw-'));
    try {
      await runGit(['status'], outsideRepo);
    } catch (err) {
      expect(err).toBeInstanceOf(GitError);
      expect(err.result.gitError).not.toBeNull();
      expect(err.result.gitErrorDescription).toContain('not a git repository');
    } finally {
      fs.rmSync(outsideRepo, { recursive: true, force: true });
    }
  });

  it('does not throw when the parsed error is in expectedErrors', async () => {
    const outsideRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'nostr-git-core-outside-'));
    try {
      const { GitError: DugiteError } = require('dugite');
      const result = await runGit(['status'], outsideRepo, {
        expectedErrors: new Set([DugiteError.NotAGitRepository])
      });
      expect(result.exitCode).toBe(128);
      expect(result.gitError).toBe(DugiteError.NotAGitRepository);
    } finally {
      fs.rmSync(outsideRepo, { recursive: true, force: true });
    }
  });

  it('describes authentication errors as failures', () => {
    const { GitError: DugiteError } = require('dugite');
    expect(isAuthFailureError(DugiteError.SSHAuthenticationFailed)).toBe(true);
    expect(isAuthFailureError(DugiteError.SSHPermissionDenied)).toBe(true);
    expect(isAuthFailureError(DugiteError.HTTPSAuthenticationFailed)).toBe(true);
    expect(isAuthFailureError(DugiteError.NothingToCommit)).toBe(false);
  });

  it('describes BranchAlreadyExists using the desktop-style message', () => {
    const { GitError: DugiteError } = require('dugite');
    expect(getDescriptionForError(DugiteError.BranchAlreadyExists, '')).toBe(
      'A branch with that name already exists.'
    );
  });

  it('falls back to stderr when describeGitError receives an unknown error', () => {
    expect(describeGitError(null, 'something went wrong')).toBe('something went wrong');
    expect(describeGitError(undefined, 'raw error')).toBe('raw error');
  });
});
