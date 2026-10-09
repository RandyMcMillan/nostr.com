// @ts-nocheck
const { runGit } = require('./core.cjs');

async function fetchRepository(repoPath, remote = '--all', prune = true) {
  const args = ['fetch'];
  if (prune) args.push('--prune');
  args.push('--', remote);
  await runGit(args, repoPath);
}

module.exports = { fetchRepository };
