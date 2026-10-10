// @ts-nocheck
const { runGit, GitError } = require('./core.cjs');

async function cherryPick(localPath, sha) {
  if (!localPath || !sha) {
    throw new Error('Repository path and commit SHA are required.');
  }
  try {
    await runGit(['cherry-pick', sha], localPath);
  } catch (error) {
    if (error instanceof GitError && error.result?.stdout?.includes('CONFLICT')) {
      throw new Error('Cherry-pick resulted in conflicts. Resolve them and commit, or abort.');
    }
    throw new Error(error?.message || 'Cherry-pick failed.');
  }
}

async function abortCherryPick(localPath) {
  await runGit(['cherry-pick', '--abort'], localPath, {
    successExitCodes: new Set([0, 128])
  });
}

module.exports = { cherryPick, abortCherryPick };
