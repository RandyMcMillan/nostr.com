// @ts-nocheck
const { runGit } = require('./core.cjs');

async function initRepository(repoPath, defaultBranch = 'main') {
  await runGit(['-c', `init.defaultBranch=${defaultBranch}`, 'init'], repoPath);
}

module.exports = { initRepository };
