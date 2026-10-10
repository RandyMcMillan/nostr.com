// @ts-nocheck
const { runGit } = require('./core.cjs');

const ResetModes = {
  hard: '--hard',
  soft: '--soft',
  mixed: undefined
};

async function resetRepo(localPath, mode, ref) {
  if (!localPath || !ref) {
    throw new Error('Repository path and target ref are required.');
  }
  const modeFlag = ResetModes[mode] || undefined;
  const args = modeFlag ? ['reset', modeFlag, ref] : ['reset', ref];
  await runGit(args, localPath);
}

module.exports = { resetRepo };
