// @ts-nocheck
const { runGit, GitError } = require('./core.cjs');
const { spawnGit } = require('./spawn.cjs');
const { cloneRepository } = require('./clone.cjs');
const { getRepositoryStatus } = require('./status.cjs');
const { getRepositoryLog } = require('./log.cjs');
const { getRemotes, addRemote } = require('./remote.cjs');
const { initRepository } = require('./init.cjs');
const { fetchRepository } = require('./fetch.cjs');
const { pullRepository } = require('./pull.cjs');
const { getBranches, checkoutBranch } = require('./branch.cjs');
const { commit } = require('./commit.cjs');
const { pushRepository } = require('./push.cjs');
const { getDiff, stageFile, unstageFile } = require('./diff.cjs');
const store = require('./store.cjs');

module.exports = {
  runGit,
  GitError,
  spawnGit,
  cloneRepository,
  getRepositoryStatus,
  getRepositoryLog,
  getRemotes,
  addRemote,
  initRepository,
  fetchRepository,
  pullRepository,
  getBranches,
  checkoutBranch,
  commit,
  pushRepository,
  getDiff,
  stageFile,
  unstageFile,
  store
};
