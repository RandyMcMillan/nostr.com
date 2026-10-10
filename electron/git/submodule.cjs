// @ts-nocheck
const { runGit } = require('./core.cjs');

async function updateSubmodules(localPath, options = {}) {
  const args = ['submodule', 'update', '--init', '--recursive'];
  if (options.force) args.push('--force');
  if (options.depth) {
    args.push('--depth', String(options.depth));
  }
  await runGit(args, localPath, options.env ? { env: options.env } : undefined);
}

async function listSubmodules(localPath) {
  const result = await runGit(
    ['submodule', 'status', '--recursive'],
    localPath,
    { successExitCodes: new Set([0]) }
  );
  return result.stdout
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => {
      const parts = line.trim().split(' ');
      return {
        sha: parts[0]?.replace(/^[-+]/, '') ?? '',
        path: parts[1] ?? '',
        active: !line.startsWith('-')
      };
    });
}

module.exports = { updateSubmodules, listSubmodules };
