// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getDiff(repoPath, options = {}) {
  const args = ['diff', '--no-color', '--no-ext-diff'];
  if (options.staged) args.push('--cached');
  if (options.filePath) args.push('--', options.filePath);
  const result = await runGit(args, repoPath, { successExitCodes: new Set([0]) });
  return result.stdout;
}

async function stageFile(repoPath, filePath) {
  const args = ['add', '--'];
  args.push(filePath || '.');
  await runGit(args, repoPath);
}

async function unstageFile(repoPath, filePath) {
  const args = ['reset', 'HEAD', '--'];
  args.push(filePath || '.');
  await runGit(args, repoPath);
}

module.exports = { getDiff, stageFile, unstageFile };
