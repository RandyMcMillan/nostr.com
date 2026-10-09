// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getMergeBase(repoPath, refA, refB) {
  const result = await runGit(['merge-base', refA, refB], repoPath);
  return result.stdout.trim();
}

async function formatPatch(repoPath, baseRef, options = {}) {
  const args = ['format-patch', '--stdout'];
  if (options.single) {
    args.push('-1', options.single);
  } else if (baseRef) {
    args.push(`${baseRef}..HEAD`);
  }
  const result = await runGit(args, repoPath);
  return result.stdout;
}

module.exports = { getMergeBase, formatPatch };
