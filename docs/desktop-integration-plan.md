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

### Phase 1 – Port selected operations (in progress)

The following operations have been wired behind the `window.nostrGit` bridge and exposed in the repo panel UI:

- ✅ `tag` create/list/delete
- ✅ `reset` soft/mixed/hard
- ✅ `fetch` / `pull` / `push` buttons
- ✅ `cherry-pick` with abort support
- ✅ `remote` add/list/remove
- ✅ `stash` create/pop/drop/list
- ✅ `submodule` update / list

Still to port:

1. `stash` / `stash pop`
2. `cherry-pick`
3. `rebase` (interactive and non-interactive)
4. `submodule` update
5. `worktree` list/add/remove

Each operation follows the existing `{ ok, error?, ... }` result shape so the SvelteKit UI consumes it without changes to error handling.

### Phase 2 – Improve the Git runner

- `electron/git/core.cjs` already uses `dugite`; align error classification and parsing with `desktop/app/src/lib/git/core.ts`.
- Migrate parsing logic (status, diff, log, refs) to desktop's parsers for consistency and better error messages.
- Keep the IPC payload contracts stable so `src/lib/nativeGit.ts` needs only additive changes.

### Phase 3 – Shared types

- Extract common Git types (status, diff, commit, branch, remote) into a small shared package or `src/lib/git-types.ts`.
- Update both frontends to import from that source, reducing type drift.

### Phase 4 – Optional unified packaging

- If nostr.com wants desktop's full UI chrome, evaluate replacing the Electron shell with desktop's instead of the other way around.
- Until then, keep nostr.com as the host app and desktop as a library source.

## Immediate next step

Continue porting high-value operations (stash, cherry-pick, rebase) behind the bridge with tests and UI actions. Keep commits small and verify with `npm run check`, `npm test`, and periodic desktop builds.
