# Integrating `RandyMcMillan/desktop` into nostr.com

## Goal

Reuse the battle-tested, `dugite`-based Git layer from the GitHub Desktop fork at `/Users/Shared/github/desktop` to extend nostr.com's local repository support beyond the current basic clone/status/commit/push operations.

## Current state

### nostr.com

- Browser side: `src/lib/nativeGit.ts` exposes a `window.nostrGit` bridge.
- Main process: `electron/main.cjs` registers IPC handlers and delegates to `electron/git/index.cjs`.
- Git backend: `electron/git/*.cjs` uses `dugite` for execution and error parsing.

### desktop

- `app/src/lib/git/*.ts` is a rich, typed Git API built on `dugite`.
- It already handles rebase, stash, cherry-pick, submodules, worktrees, LFS progress, hooks, and credential trampolines.
- It depends on desktop-specific models in `app/src/models/` and UI helpers in `app/src/lib/`.

## Integration options

| Option | Approach | Effort | Recommendation |
|---|---|---|---|
| A. Loose coupling | Add desktop as a git submodule and build it as a separate Electron app; link to it from nostr.com via custom protocol / deep links. | Low initial, high UX | Not recommended – two apps is confusing. |
| B. Library reuse | Vendor desktop's `app/src/lib/git` (and minimal models) into nostr.com; wire the operations behind the existing `window.nostrGit` bridge. | Medium | **Recommended** – keeps one app and one bridge. |
| C. UI embedding | Host desktop's React renderer inside nostr.com's SvelteKit shell. | Very high | Avoid – framework mismatch. |

## Recommended plan: Option B in phases

### Phase 0 – Submodule and build wiring (done)

- Added `RandyMcMillan/desktop` as a git submodule at `vendor/github-desktop`.
- Added `.justfile` recipes to init/update the submodule and to build desktop independently for reference.
- Documented the interface boundaries in this file.
- Removed unused release and pages workflows so CI is focused.

### Phase 1 – Port selected operations (complete)

The following operations have been wired behind the `window.nostrGit` bridge and exposed in the repo panel UI:

- ✅ `tag` create/list/delete
- ✅ `reset` soft/mixed/hard
- ✅ `fetch` / `pull` / `push` buttons
- ✅ `cherry-pick` with abort support
- ✅ `remote` add/list/remove
- ✅ `stash` create/pop/drop/list
- ✅ `submodule` update / list
- ✅ `worktree` add / list / remove
- ✅ `rebase` with continue / abort / skip

### Phase 2 – Improve the Git runner (complete)

- Align `electron/git/core.cjs` error classification and parsing with `desktop/app/src/lib/git/core.ts`.
  - ✅ Expanded `getDescriptionForError` to cover all `dugite` `GitError` values.
  - ✅ Added `expectedErrors` support so callers can opt-in to non-zero/parsed errors.
  - ✅ Added `isAuthFailureError` helper.
  - ✅ Added `electron/git/core.test.mjs` covering success exit codes, parsed errors, expected errors, and auth classification.
- Migrate parsing logic (status, diff, log, refs) to desktop's parsers for consistency and better error messages.
  - ✅ Migrated `electron/git/status.cjs` to desktop-style `--porcelain=2 -z` parsing with branch headers, ahead/behind, current tip, and upstream branch.
  - ✅ Added `electron/git/status.test.mjs` covering untracked, staged, modified, renamed, and mocked buffer parsing.
  - ✅ Migrated `electron/git/diff.cjs` to desktop-style `--patch-with-raw -z` output and added `hideWhitespace` option support.
  - ✅ Added `electron/git/diff.test.mjs` covering modified, staged, raw-header stripping, stage, and unstage.
  - ✅ Migrated `electron/git/log.cjs` to NUL-separated field parsing (desktop-style) so subjects/authors containing delimiters are safe.
  - ✅ Added `electron/git/log.test.mjs` covering fresh repos, ordering, limits, and delimiter safety.
  - ✅ Migrated `electron/git/refs.cjs` to NUL-separated `for-each-ref` fields and desktop-style `getSymbolicRef` / `formatAsLocalRef` helpers.
  - ✅ Added `electron/git/refs.test.mjs` covering branches, tags, detached HEAD, ref formatting, and symbolic ref reading.
- Keep the IPC payload contracts stable so `src/lib/nativeGit.ts` needs only additive changes.

### Phase 3 – Shared types (complete)

- ✅ Extracted common Git types into `src/lib/git-types.ts` (`GitRepoEntry`, `GitStatusFile`, `GitStatus`, `GitCommit`, `GitRemote`, `GitBranch`, `GitTag`, `GitRefs`, `GitStash`, `GitSubmodule`, `GitWorktree`).
- ✅ Updated `src/lib/nativeGit.ts` to import and re-export shared types.
- ✅ Updated `src/lib/stores/app.ts` (`GitRepoState`) and `src/routes/repos/+page.svelte` to use `GitRefs`.
- ✅ Added `upstreamBranch` and `currentTip` to `GitStatus` to match the migrated status parser.

### Phase 4 – UI polish and packaging

- ✅ Surface the richer status fields (`upstreamBranch`, `currentTip`) in the repository panel and local repo list.
- ✅ Wire the migrated diff parser's `hideWhitespace` option through the bridge and add a UI toggle in `/repos`.
- ✅ Highlight auth failures in `GitRepoPanel` error messages with a credential hint.
- Evaluate replacing the Electron shell with desktop's full UI chrome vs. keeping nostr.com as the host app.
- Until a packaging decision is made, keep nostr.com as the host app and desktop as a library source.

### NIP-34 kind support

- ✅ Add `NIP34_PATCH_KIND` (30619) and `NIP34_ISSUE_KIND` (30620) constants.
- ✅ Include them in `GIT_ROOT_KINDS` and `isGitEvent` so NIP-34 patches/issues render in feeds and threads.
- ✅ Update `NoteCard` to render NIP-34 patches/issues and allow status changes on them.
- ✅ Add unit tests covering the new kind classifications.

## Immediate next step

Verify the latest changes with a desktop build (`npm run desktop:mac:arm64` or `just desktop-mac-arm64`) and monitor CI. Continue packaging evaluation or add publish-time support for NIP-34 patch/issue kinds as needed.
