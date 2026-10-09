// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getRefs(repoPath) {
  const branches = [];
  const tags = [];

  const refsResult = await runGit(
    ['for-each-ref', '--format', '%(refname) %(objecttype) %(objectname) %(*objectname)', 'refs/heads', 'refs/tags'],
    repoPath,
    { successExitCodes: new Set([0]) }
  );

  for (const line of refsResult.stdout.split('\n').filter(Boolean)) {
    const [refName, objectType, objectName, peeledName] = line.split(' ');
    if (!refName || !objectName) continue;
    const commit = objectType === 'tag' && peeledName ? peeledName : objectName;
    if (refName.startsWith('refs/heads/')) {
      branches.push({ name: refName.slice('refs/heads/'.length), commit });
    } else if (refName.startsWith('refs/tags/')) {
      tags.push({ name: refName.slice('refs/tags/'.length), commit });
    }
  }

  let headBranch = null;
  try {
    const headResult = await runGit(['symbolic-ref', '--short', 'HEAD'], repoPath, {
      successExitCodes: new Set([0])
    });
    const name = headResult.stdout.trim();
    if (name && name !== 'HEAD') headBranch = name;
  } catch {
    // Detached HEAD; leave headBranch null.
  }

  return { headBranch, branches, tags };
}

module.exports = { getRefs };
