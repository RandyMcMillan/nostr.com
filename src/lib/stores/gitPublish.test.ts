import { get } from 'svelte/store';
import { vi } from 'vitest';
import type { NostrEvent, Session } from '$lib/nostr/types';
import {
  GIT_ISSUE_KIND,
  GIT_PATCH_KIND,
  GIT_PR_KIND,
  GIT_PR_UPDATE_KIND,
  GIT_STATUS_CLOSED_KIND
} from '$lib/nostr/kinds';

const clientMocks = vi.hoisted(() => ({
  signEvent: vi.fn(),
  signNote: vi.fn(),
  publishSignedNostrEventToUrls: vi.fn()
}));

vi.mock('$lib/nostr/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/nostr/client')>();
  return {
    ...actual,
    signEvent: clientMocks.signEvent,
    signNote: clientMocks.signNote,
    publishSignedNostrEventToUrls: clientMocks.publishSignedNostrEventToUrls
  };
});

vi.mock('$lib/nostr/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/nostr/cache')>();
  return {
    ...actual,
    cacheEvents: vi.fn()
  };
});

import {
  events,
  publishGitIssue,
  publishGitPullRequest,
  publishGitPullRequestUpdate,
  publishGitPatch,
  publishGitStatus,
  session
} from './app';

function setSignedIn(pubkey = 'a'.repeat(64)) {
  session.set({ pubkey, mode: 'private-key', secret: 'nsec' } satisfies Session);
}

function signedEvent(kind: number, id: string, tags: string[][] = [], content = ''): NostrEvent {
  return {
    id,
    pubkey: 'a'.repeat(64),
    created_at: 1,
    kind,
    tags,
    content,
    sig: 'b'.repeat(128)
  };
}

function repoAddress(pubkey: string, identifier: string) {
  return `30617:${pubkey}:${identifier}`;
}

describe('git publishing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clientMocks.signEvent.mockReset();
    clientMocks.signNote.mockReset();
    clientMocks.publishSignedNostrEventToUrls.mockReset();
    localStorage.removeItem('nostr-pending-publishes');
    events.set([]);
    setSignedIn();
  });

  afterEach(async () => {
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('publishes a NIP-34 issue with relay hint', async () => {
    const pubkey = 'a'.repeat(64);
    const address = repoAddress(pubkey, 'repo');
    const event = signedEvent(GIT_ISSUE_KIND, 'issue1', [
      ['a', address, 'wss://repo.relay'],
      ['p', pubkey],
      ['subject', 'Bug report']
    ]);
    clientMocks.signEvent.mockResolvedValueOnce(event);
    clientMocks.publishSignedNostrEventToUrls.mockResolvedValueOnce(undefined);

    await publishGitIssue({
      repoAddress: address,
      subject: 'Bug report',
      content: 'It is broken',
      repoRelays: ['wss://repo.relay']
    });

    expect(get(events)).toContainEqual(event);
    await vi.runOnlyPendingTimersAsync();
    expect(clientMocks.publishSignedNostrEventToUrls).toHaveBeenCalledTimes(1);
    expect(clientMocks.publishSignedNostrEventToUrls).toHaveBeenCalledWith(
      event,
      expect.arrayContaining(['wss://repo.relay'])
    );
  });

  it('publishes a NIP-34 pull request', async () => {
    const pubkey = 'a'.repeat(64);
    const address = repoAddress(pubkey, 'repo');
    const event = signedEvent(GIT_PR_KIND, 'pr1', [
      ['a', address],
      ['p', pubkey],
      ['subject', 'Fix bug'],
      ['c', 'deadbeef'],
      ['clone', 'https://example.com/repo.git'],
      ['branch-name', 'fix']
    ]);
    clientMocks.signEvent.mockResolvedValueOnce(event);
    clientMocks.publishSignedNostrEventToUrls.mockResolvedValueOnce(undefined);

    await publishGitPullRequest({
      repoAddress: address,
      subject: 'Fix bug',
      content: '',
      tipCommit: 'deadbeef',
      cloneUrls: ['https://example.com/repo.git'],
      branchName: 'fix'
    });

    expect(get(events)).toContainEqual(event);
    await vi.runOnlyPendingTimersAsync();
    expect(clientMocks.publishSignedNostrEventToUrls).toHaveBeenCalledTimes(1);
  });

  it('publishes a standalone NIP-34 patch with t root', async () => {
    const pubkey = 'a'.repeat(64);
    const address = repoAddress(pubkey, 'repo');
    const event = signedEvent(GIT_PATCH_KIND, 'patch1', [
      ['a', address],
      ['p', pubkey],
      ['commit', 'deadbeef'],
      ['parent-commit', 'cafebabe'],
      ['t', 'root']
    ]);
    clientMocks.signEvent.mockResolvedValueOnce(event);
    clientMocks.publishSignedNostrEventToUrls.mockResolvedValueOnce(undefined);

    await publishGitPatch({
      repoAddress: address,
      patch: 'diff --git',
      tipCommit: 'deadbeef',
      parentCommit: 'cafebabe'
    });

    expect(get(events)).toContainEqual(event);
    expect(clientMocks.signEvent).toHaveBeenCalledWith(
      expect.any(Object),
      GIT_PATCH_KIND,
      'diff --git',
      expect.arrayContaining([['t', 'root']])
    );
  });

  it('threads a patch series with e root/reply tags', async () => {
    const pubkey = 'a'.repeat(64);
    const address = repoAddress(pubkey, 'repo');
    const parentPatch: NostrEvent = {
      id: 'parentpatch',
      pubkey: 'b'.repeat(64),
      created_at: 1,
      kind: GIT_PATCH_KIND,
      tags: [
        ['a', address],
        ['p', pubkey],
        ['t', 'root'],
        ['commit', 'aaa'],
        ['parent-commit', '000']
      ],
      content: '',
      sig: 'c'.repeat(128)
    };
    clientMocks.signEvent.mockImplementation(async (_session, kind, content, tags) => ({
      id: 'patch2',
      pubkey: 'a'.repeat(64),
      created_at: 2,
      kind,
      tags,
      content,
      sig: 'd'.repeat(128)
    }));

    await publishGitPatch({
      repoAddress: address,
      patch: 'diff --git 2',
      tipCommit: 'bbb',
      parentCommit: 'aaa',
      parentPatchEvent: parentPatch
    });

    const callTags = clientMocks.signEvent.mock.calls[0][3] as string[][];
    expect(callTags).toContainEqual(['e', 'parentpatch', '', 'root']);
    expect(callTags).toContainEqual(['e', 'parentpatch', '', 'reply']);
    expect(callTags).not.toContainEqual(['t', 'root']);
  });

  it('publishes a NIP-34 PR update referencing the original PR', async () => {
    const pubkey = 'a'.repeat(64);
    const address = repoAddress(pubkey, 'repo');
    const prEvent: NostrEvent = {
      id: 'pr1',
      pubkey: 'b'.repeat(64),
      created_at: 1,
      kind: GIT_PR_KIND,
      tags: [
        ['a', address],
        ['p', pubkey],
        ['subject', 'Fix'],
        ['c', 'deadbeef'],
        ['branch-name', 'fix']
      ],
      content: '',
      sig: 'c'.repeat(128)
    };
    const event = signedEvent(GIT_PR_UPDATE_KIND, 'prupdate1', [
      ['a', address],
      ['e', 'pr1', '', 'root'],
      ['p', 'b'.repeat(64)],
      ['p', pubkey],
      ['c', 'cafebabe'],
      ['branch-name', 'fix']
    ]);
    clientMocks.signEvent.mockResolvedValueOnce(event);
    clientMocks.publishSignedNostrEventToUrls.mockResolvedValueOnce(undefined);

    await publishGitPullRequestUpdate({
      repoAddress: address,
      prEvent,
      tipCommit: 'cafebabe',
      branchName: 'fix'
    });

    expect(get(events)).toContainEqual(event);
    const callTags = clientMocks.signEvent.mock.calls[0][3] as string[][];
    expect(callTags).toContainEqual(['e', 'pr1', '', 'root']);
    expect(callTags).toContainEqual(['c', 'cafebabe']);
  });

  it('publishes a NIP-34 status event referencing the root event', async () => {
    const owner = 'a'.repeat(64);
    const author = 'b'.repeat(64);
    const address = repoAddress(owner, 'repo');
    const issue: NostrEvent = {
      id: 'issue1',
      pubkey: author,
      created_at: 1,
      kind: GIT_ISSUE_KIND,
      tags: [
        ['a', address, 'wss://repo.relay'],
        ['p', owner],
        ['subject', 'Bug']
      ],
      content: '',
      sig: 'd'.repeat(128)
    };
    const event = signedEvent(GIT_STATUS_CLOSED_KIND, 'status1', [
      ['e', 'issue1', '', 'root'],
      ['p', owner],
      ['p', author],
      ['a', address]
    ]);
    clientMocks.signEvent.mockResolvedValueOnce(event);
    clientMocks.publishSignedNostrEventToUrls.mockResolvedValueOnce(undefined);

    await publishGitStatus(issue, GIT_STATUS_CLOSED_KIND);

    expect(get(events)).toContainEqual(event);
    await vi.runOnlyPendingTimersAsync();
    expect(clientMocks.publishSignedNostrEventToUrls).toHaveBeenCalledWith(
      event,
      expect.arrayContaining(['wss://repo.relay'])
    );
  });
});
