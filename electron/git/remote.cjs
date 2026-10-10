// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getRemotes(repoPath) {
  const result = await runGit(
    ['remote', '-v'],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );

  if (result.exitCode === 128) {
    return [];
  }

  const remotes = new Map();
  for (const line of result.stdout.split('\n')) {
    const match = line.match(/^([^\s]+)\s+([^\s]+)\s+\((fetch|push)\)$/);
    if (!match) continue;
    const [, name, url] = match;
    if (!remotes.has(name)) {
      remotes.set(name, { name, url });
    }
  }

  return Array.from(remotes.values());
}

async function addRemote(repoPath, name, url) {
  await runGit(['remote', 'add', '--', name, url], repoPath);
  return { name, url };
}

async function removeRemote(repoPath, name) {
  await runGit(['remote', 'remove', '--', name], repoPath);
}

module.exports = { getRemotes, addRemote, removeRemote };
