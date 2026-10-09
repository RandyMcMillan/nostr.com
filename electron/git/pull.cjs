// @ts-nocheck
const { runGit } = require('./core.cjs');

async function pullRepository(repoPath, options = {}) {
  const args = ['pull'];
  if (options.ffOnly) args.push('--ff-only');
  if (options.rebase) args.push('--rebase');
  args.push('--');
  await runGit(args, repoPath);
}

module.exports = { pullRepository };
