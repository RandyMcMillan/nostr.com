import { describe, it, expect } from 'vitest';
import {
  GIT_REPO_KIND,
  GIT_REPO_STATE_KIND,
  GIT_PATCH_KIND,
  GIT_PR_KIND,
  GIT_ISSUE_KIND,
  NIP34_PATCH_KIND,
  NIP34_ISSUE_KIND,
  GIT_STATUS_OPEN_KIND,
  isGitRootKind,
  isGitStatusKind,
  isGitEvent,
  isAddressableKind
} from './kinds';

describe('git kinds', () => {
  it('recognizes git root kinds', () => {
    expect(isGitRootKind(GIT_REPO_KIND)).toBe(true);
    expect(isGitRootKind(GIT_REPO_STATE_KIND)).toBe(true);
    expect(isGitRootKind(GIT_PATCH_KIND)).toBe(true);
    expect(isGitRootKind(GIT_PR_KIND)).toBe(true);
    expect(isGitRootKind(GIT_ISSUE_KIND)).toBe(true);
    expect(isGitRootKind(NIP34_PATCH_KIND)).toBe(true);
    expect(isGitRootKind(NIP34_ISSUE_KIND)).toBe(true);
    expect(isGitRootKind(1)).toBe(false);
  });

  it('recognizes status kinds', () => {
    expect(isGitStatusKind(GIT_STATUS_OPEN_KIND)).toBe(true);
    expect(isGitStatusKind(9999)).toBe(false);
  });

  it('treats NIP-34 kinds as git events', () => {
    expect(isGitEvent(NIP34_PATCH_KIND)).toBe(true);
    expect(isGitEvent(NIP34_ISSUE_KIND)).toBe(true);
  });

  it('treats NIP-34 kinds as addressable', () => {
    expect(isAddressableKind(NIP34_PATCH_KIND)).toBe(true);
    expect(isAddressableKind(NIP34_ISSUE_KIND)).toBe(true);
  });
});
