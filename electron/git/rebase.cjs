// @ts-nocheck
const { runGit, GitError } = require('./core.cjs');

async function rebaseRepo(localPath, ref) {
  if (!localPath || !ref) {
    throw new Error('Repository path and target ref are required.');
  }
  try {
    await runGit(['rebase', ref], localPath);
  } catch (error) {
    if (error instanceof GitError && error.result?.stdout?.includes('CONFLICT')) {
      throw new Error('Rebase resulted in conflicts. Resolve them and run rebase --continue, or abort.');
    }
    throw new Error(error?.message || 'Rebase failed.');
  }
}

async function continueRebase(localPath) {
  await runGit(['rebase', '--continue'], localPath);
}

async function abortRebase(localPath) {
  await runGit(['rebase', '--abort'], localPath, { successExitCodes: new Set([0, 128]) });
}

async function skipRebase(localPath) {
  await runGit(['rebase', '--skip'], localPath);
}

module.exports = { rebaseRepo, continueRebase, abortRebase, skipRebase };
