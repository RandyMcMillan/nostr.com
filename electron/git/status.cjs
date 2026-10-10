// @ts-nocheck
const { runGit } = require('./core.cjs');

const conflictStatusCodes = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);

/**
 * Parse a desktop-style porcelain=v2 status buffer.
 *
 * Headers:
 *   # branch.oid <sha>|(initial)
 *   # branch.head (detached)|<name>
 *   # branch.upstream <remote>/<branch>
 *   # branch.ab +<ahead> -<behind>
 *
 * Entries are null-separated. Ordinary entries start with '1 <XY>...' and
 * untracked entries start with '? <path>'.
 *
 * Returns the existing nostr.com shape plus currentTip and upstreamBranch.
 */
function parsePorcelainV2Status(buffer) {
  const text = buffer.toString('utf8');
  const records = text.split('\0');

  let branch = null;
  let upstreamBranch = null;
  let currentTip = null;
  let ahead = 0;
  let behind = 0;
  const files = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;

    if (record.startsWith('# branch.')) {
      const value = record.slice('# branch.'.length);
      const oidMatch = value.match(/^oid ([a-f0-9]+)$/);
      if (oidMatch) currentTip = oidMatch[1];

      const headMatch = value.match(/^head (.*)$/);
      if (headMatch && headMatch[1] !== '(detached)') {
        branch = headMatch[1];
      }

      const upstreamMatch = value.match(/^upstream (.*)$/);
      if (upstreamMatch) upstreamBranch = upstreamMatch[1];

      const abMatch = value.match(/^ab \+(\d+) -(\d+)$/);
      if (abMatch) {
        ahead = parseInt(abMatch[1], 10) || 0;
        behind = parseInt(abMatch[2], 10) || 0;
      }
      continue;
    }

    if (record.startsWith('? ')) {
      files.push({ index: '?', workingTree: '?', path: record.slice(2) });
      continue;
    }

    if (record.startsWith('! ')) {
      // ignored files are not exposed in the current contract
      continue;
    }

    if (record.startsWith('1 ') || record.startsWith('2 ')) {
      // Format: "1 XY ... path" or "2 XY ... score path [origPath]"
      // We split by space to find the fixed tokens and then the path(s).
      const tokens = record.split(' ');
      const type = tokens[0];
      const xy = tokens[1];
      if (!xy || xy.length !== 2) continue;

      const index = xy[0];
      const workingTree = xy[1];

      let path;
      if (type === '1') {
        // tokens: 1 XY sub mH mI mW hH hI path
        path = tokens.slice(8).join(' ');
      } else if (type === '2') {
        // tokens: 2 XY sub mH mI mW hH hI score path [origPath]
        path = tokens.slice(9).join(' ');
        // origPath is in the next record when -z is used; skip it.
        if (i + 1 < records.length) {
          i++;
        }
      }

      if (path) {
        files.push({ index, workingTree, path });
      }
      continue;
    }

    if (record.startsWith('u ')) {
      // Unmerged entries use the same XY status code as ordinary entries.
      const tokens = record.split(' ');
      const xy = tokens[1];
      if (xy && xy.length === 2) {
        const path = tokens.slice(10).join(' ');
        if (path) files.push({ index: xy[0], workingTree: xy[1], path });
      }
    }
  }

  return {
    exists: true,
    branch,
    upstreamBranch,
    currentTip,
    ahead,
    behind,
    files
  };
}

async function getRepositoryStatus(repoPath) {
  const result = await runGit(
    [
      '--no-optional-locks',
      'status',
      '--porcelain=2',
      '-z',
      '--branch',
      '--untracked-files=all'
    ],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );

  if (result.exitCode === 128) {
    return {
      exists: false,
      branch: null,
      upstreamBranch: null,
      currentTip: null,
      ahead: 0,
      behind: 0,
      files: []
    };
  }

  return parsePorcelainV2Status(result.stdout);
}

module.exports = {
  getRepositoryStatus,
  parsePorcelainV2Status,
  conflictStatusCodes
};
