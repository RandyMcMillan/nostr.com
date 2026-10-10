// @ts-nocheck
const { runGit } = require('./core.cjs');

/**
 * Extract the human-readable patch text from `git diff --patch-with-raw -z`
 * output. The raw header precedes the first NUL; the remainder is the patch.
 * Modeled on desktop/app/src/lib/git/diff.ts.
 */
function extractDiffTextFromRawOutput(output) {
  const pieces = output.split('\0');
  return pieces.at(-1) || '';
}

async function getDiff(repoPath, options = {}) {
  const args = ['diff', '--no-ext-diff', '--patch-with-raw', '-z', '--no-color'];
  if (options.hideWhitespace) args.push('-w');
  if (options.staged) args.push('--cached');
  if (options.filePath) args.push('--', options.filePath);

  const result = await runGit(args, repoPath, { successExitCodes: new Set([0]) });
  return extractDiffTextFromRawOutput(result.stdout);
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

module.exports = {
  getDiff,
  stageFile,
  unstageFile,
  extractDiffTextFromRawOutput
};
