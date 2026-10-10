// @ts-nocheck
const { runGit, GitError } = require('./core.cjs');
const { spawnGit } = require('./spawn.cjs');
const { cloneRepository } = require('./clone.cjs');
const { getRepositoryStatus } = require('./status.cjs');
const { getRepositoryLog } = require('./log.cjs');
const { getRemotes, addRemote, removeRemote } = require('./remote.cjs');
const { initRepository } = require('./init.cjs');
const { fetchRepository } = require('./fetch.cjs');
const { pullRepository } = require('./pull.cjs');
const { getBranches, checkoutBranch, deleteBranch } = require('./branch.cjs');
const { commit } = require('./commit.cjs');
const { pushRepository } = require('./push.cjs');
const { getDiff, stageFile, unstageFile } = require('./diff.cjs');
const { getRefs } = require('./refs.cjs');
const { getMergeBase, formatPatch } = require('./patch.cjs');
const { getTags, createTag, deleteTag } = require('./tag.cjs');
const { resetRepo } = require('./reset.cjs');
const { cherryPick, abortCherryPick } = require('./cherry-pick.cjs');
const { getStashes, createStash, popStash, dropStash } = require('./stash.cjs');
const { updateSubmodules, listSubmodules } = require('./submodule.cjs');
const { listWorktrees, addWorktree, removeWorktree } = require('./worktree.cjs');
const { rebaseRepo, continueRebase, abortRebase, skipRebase } = require('./rebase.cjs');
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
  removeRemote,
  initRepository,
  fetchRepository,
  pullRepository,
  getBranches,
  checkoutBranch,
  deleteBranch,
  commit,
  pushRepository,
  getDiff,
  stageFile,
  unstageFile,
  getRefs,
  getMergeBase,
  formatPatch,
  getTags,
  createTag,
  deleteTag,
  resetRepo,
  cherryPick,
  abortCherryPick,
  getStashes,
  createStash,
  popStash,
  dropStash,
  updateSubmodules,
  listSubmodules,
  listWorktrees,
  addWorktree,
  removeWorktree,
  rebaseRepo,
  continueRebase,
  abortRebase,
  skipRebase,
  store
};
