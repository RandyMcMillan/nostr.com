// @ts-nocheck
const { runGit } = require('./core.cjs');

async function pushRepository(repoPath, remote = 'origin', branch, options = {}) {
  const args = ['push'];
  if (options.forceWithLease) args.push('--force-with-lease');
  args.push('--', remote);
  if (branch) args.push(branch);
  await runGit(args, repoPath);
}

module.exports = { pushRepository };
