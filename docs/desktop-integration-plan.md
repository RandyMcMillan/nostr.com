# Integrating `RandyMcMillan/desktop` into nostr.com

## Goal

Reuse the battle-tested, `dugite`-based Git layer from the GitHub Desktop fork at `/Users/Shared/github/desktop` to extend nostr.com's local repository support beyond the current basic clone/status/commit/push operations.

## Current state

### nostr.com

- Browser side: `src/lib/nativeGit.ts` exposes a `window.nostrGit` bridge.
- Main process: `electron/main.cjs` registers IPC handlers and delegates to `electron/git/index.cjs`.
- Git backend: `electron/git/*.cjs` shells out to the system `git` executable directly.

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

### Phase 0 – Submodule and build wiring (this commit)

- Add `RandyMcMillan/desktop` as a git submodule at `vendor/desktop`.
- Add `.justfile` recipes to init/update the submodule and to build desktop independently for reference.
- Document the interface boundaries in this file.

### Phase 1 – Port selected operations

Identify the highest-value desktop operations missing from nostr.com and add them to `electron/git/index.cjs`, exposing new methods through `preload.cjs` and `src/lib/nativeGit.ts`:

1. `stash` / `stash pop`
2. `cherry-pick`
3. `rebase` (interactive and non-interactive)
4. `reset` (soft/mixed/hard)
5. `tag` create/delete
6. `submodule` update
7. `worktree` list/add/remove

Each operation should follow the existing `{ ok, error?, ... }` result shape so the SvelteKit UI can consume it without changes to its error handling.

### Phase 2 – Replace the Git runner

- Introduce `dugite` in `electron/git/core.cjs` (or a new `electron/git/dugite.cjs`) modelled on `desktop/app/src/lib/git/core.ts`.
- Migrate parsing logic (status, diff, log, refs) to desktop's parsers for consistency and better error messages.
- Keep the IPC payload contracts stable so `src/lib/nativeGit.ts` needs only additive changes.

### Phase 3 – Shared types

- Extract common Git types (status, diff, commit, branch, remote) into a small shared package or `src/lib/git-types.ts`.
- Update both frontends to import from that source, reducing type drift.

### Phase 4 – Optional unified packaging

- If nostr.com wants desktop's full UI chrome, evaluate replacing the Electron shell with desktop's instead of the other way around.
- Until then, keep nostr.com as the host app and desktop as a library source.

## Immediate next step

Add the submodule and the `.justfile` helper recipes, then open a PR so CI continues to pass while the porting work proceeds in small, reviewable commits.
