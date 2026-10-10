// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getStashes(localPath) {
  try {
    const result = await runGit(['stash', 'list', '--format=%H%x00%gd%x00%gs'], localPath, {
      successExitCodes: new Set([0])
    });
    return result.stdout
      .split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => {
        const [sha, ref, message] = line.split('\0');
        return { sha, ref, message };
      });
  } catch (error) {
    return [];
  }
}

async function createStash(localPath, message) {
  const args = message ? ['stash', 'push', '-m', message] : ['stash', 'push'];
  await runGit(args, localPath);
}

async function popStash(localPath, ref) {
  const args = ref ? ['stash', 'pop', ref] : ['stash', 'pop'];
  await runGit(args, localPath);
}

async function dropStash(localPath, ref) {
  const args = ref ? ['stash', 'drop', ref] : ['stash', 'drop'];
  await runGit(args, localPath);
}

module.exports = { getStashes, createStash, popStash, dropStash };
