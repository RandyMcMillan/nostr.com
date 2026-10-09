// @ts-nocheck
const { spawnGit } = require('./spawn.cjs');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');

const unsupportedProtocols = ['ext', 'ext.exe'];

function isClonePathSensitive(clonePath) {
  const resolved = path.resolve(clonePath).toLowerCase();
  const home = path.resolve(os.homedir()).toLowerCase();

  if (resolved === home) return true;

  const sensitive = [
    path.join(home, '.ssh'),
    path.join(home, '.gnupg'),
    path.join(home, '.config'),
    path.join(home, '.config', 'git'),
    path.join(home, '.gitconfig')
  ];

  return sensitive.some((location) => resolved === location || resolved.startsWith(location + path.sep));
}

async function cloneRepository(url, targetPath, options = {}, progressCallback) {
  const unsupported = unsupportedProtocols.find((protocol) => url.startsWith(`${protocol}::`));
  if (unsupported) {
    throw new Error(`The "${unsupported}" transport is not supported for cloning.`);
  }

  if (isClonePathSensitive(targetPath)) {
    throw new Error(`The clone destination targets a sensitive system location.`);
  }

  await fs.mkdir(targetPath, { recursive: true });

  const args = [
    '-c',
    `init.defaultBranch=${options.defaultBranch || 'main'}`,
    '-c',
    'protocol.ext.allow=never',
    '-c',
    'protocol.ext.exe.allow=never',
    'clone',
    '--recursive'
  ];

  if (progressCallback) {
    args.push('--progress');
  }

  if (options.branch) {
    args.push('-b', options.branch);
  }

  args.push('--', url, targetPath);

  if (!progressCallback) {
    const { runGit } = require('./core.cjs');
    await runGit(args, process.cwd());
    return;
  }

  const env = {
    GIT_CLONE_PROTECTION_ACTIVE: 'false'
  };
  const result = await spawnGit(args, process.cwd(), {
    env,
    onStderr: (chunk) => {
      const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      progressCallback(text);
    }
  });
  if (result.exitCode !== 0) {
    const { GitError } = require('./core.cjs');
    throw new GitError(result, args, result.stderr || 'Clone failed.');
  }
}

module.exports = { cloneRepository };
