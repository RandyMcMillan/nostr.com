// @ts-nocheck
const { runGit } = require('./core.cjs');

/**
 * Format a local branch name as a fully qualified ref.
 * Modeled on desktop/app/src/lib/git/refs.ts.
 */
function formatAsLocalRef(name) {
  if (name.startsWith('heads/')) {
    return `refs/${name}`;
  }
  if (!name.startsWith('refs/heads/')) {
    return `refs/heads/${name}`;
  }
  return name;
}

/**
 * Read a symbolic ref, returning null when the ref is not symbolic or missing.
 * Modeled on desktop/app/src/lib/git/refs.ts.
 */
async function getSymbolicRef(repoPath, ref) {
  const result = await runGit(['symbolic-ref', '-q', ref], repoPath, {
    successExitCodes: new Set([0, 1, 128])
  });

  if (result.exitCode === 1 || result.exitCode === 128) {
    return null;
  }

  return result.stdout.trim();
}

async function getRefs(repoPath) {
  const branches = [];
  const tags = [];

  // Use NUL-separated fields so ref names with spaces are parsed safely.
  const format = '%(refname)%00%(objecttype)%00%(objectname)%00%(*objectname)%00';
  const refsResult = await runGit(
    ['for-each-ref', '--format', format, 'refs/heads', 'refs/tags'],
    repoPath,
    { successExitCodes: new Set([0]) }
  );

  const lines = refsResult.stdout.split('\n').filter(line => line.trim() !== '');

  for (const line of lines) {
    const [refName, objectType, objectName, peeledName] = line.split('\0');
    if (!refName || !objectName) continue;

    const commit = objectType === 'tag' && peeledName ? peeledName : objectName;
    if (refName.startsWith('refs/heads/')) {
      branches.push({ name: refName.slice('refs/heads/'.length), commit });
    } else if (refName.startsWith('refs/tags/')) {
      tags.push({ name: refName.slice('refs/tags/'.length), commit });
    }
  }

  const headRef = await getSymbolicRef(repoPath, 'HEAD');
  let headBranch = null;
  if (headRef && headRef.startsWith('refs/heads/')) {
    headBranch = headRef.slice('refs/heads/'.length);
  }

  return { headBranch, branches, tags };
}

module.exports = {
  getRefs,
  getSymbolicRef,
  formatAsLocalRef
};
