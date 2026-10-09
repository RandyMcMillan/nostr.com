// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getRepositoryStatus(repoPath) {
  const result = await runGit(
    ['status', '--porcelain=v1', '--branch', '--untracked-files=all'],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );

  if (result.exitCode === 128) {
    return { exists: false, branch: null, ahead: 0, behind: 0, files: [] };
  }

  const lines = result.stdout.split('\n');
  const branchLine = lines.find((line) => line.startsWith('##'));
  let branch = null;
  let ahead = 0;
  let behind = 0;

  if (branchLine) {
    const noCommitsMatch = branchLine.match(/^##\s+No commits yet on\s+(.+)$/i);
    if (noCommitsMatch) {
      branch = noCommitsMatch[1].trim();
    } else {
      const match = branchLine.match(/^##\s+([^\.\s]+)(?:\.\.\.([^\s]+))?\s*(?:\[([^\]]+)\])?/);
      if (match) {
        branch = match[1] === 'HEAD' || match[1] === '(no branch)' ? null : match[1];
        const tracking = match[3] || '';
        const aheadMatch = tracking.match(/ahead\s+(\d+)/);
        const behindMatch = tracking.match(/behind\s+(\d+)/);
        ahead = aheadMatch ? parseInt(aheadMatch[1], 10) : 0;
        behind = behindMatch ? parseInt(behindMatch[1], 10) : 0;
      }
    }
  }

  const files = lines
    .filter((line) => line.length >= 3 && !line.startsWith('##'))
    .map((line) => ({
      index: line[0],
      workingTree: line[1],
      path: line.slice(3).trim()
    }));

  return { exists: true, branch, ahead, behind, files };
}

module.exports = { getRepositoryStatus };
