// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getBranches(repoPath) {
  const result = await runGit(
    ['branch', '-a', '--no-color'],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );
  if (result.exitCode === 128) return [];

  return result.stdout.split('\n').filter(Boolean).map((line) => {
    const current = line.startsWith('*');
    const name = line.replace(/^\*\s*/, '').trim();
    return { name, current };
  });
}

async function checkoutBranch(repoPath, branchName, create = false) {
  const args = ['checkout'];
  if (create) args.push('-b');
  args.push(branchName);
  await runGit(args, repoPath);
}

module.exports = { getBranches, checkoutBranch };
