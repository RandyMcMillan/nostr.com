// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { runGit } = require('./core.cjs');

function parseWorktreeList(stdout) {
  const blocks = stdout.replace(/\0$/, '').split('\0\0');
  const entries = [];

  for (let i = 0; i < blocks.length; i++) {
    const lines = blocks[i].split('\0');
    let worktreePath = '';
    let head = '';
    let branch = null;
    let isDetached = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        const rawPath = line.substring('worktree '.length);
        try {
          worktreePath = fs.realpathSync(rawPath);
        } catch {
          worktreePath = path.normalize(rawPath);
        }
      } else if (line.startsWith('HEAD ')) {
        head = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        branch = line.substring('branch '.length).replace(/^refs\/heads\//, '');
      } else if (line === 'detached') {
        isDetached = true;
      }
    }

    entries.push({
      path: worktreePath,
      head,
      branch,
      isDetached,
      main: i === 0
    });
  }

  return entries;
}

async function listWorktrees(localPath) {
  const result = await runGit(['worktree', 'list', '--porcelain', '-z'], localPath);
  return parseWorktreeList(result.stdout);
}

async function addWorktree(localPath, worktreePath, options = {}) {
  const args = ['worktree', 'add'];
  if (options.createBranch) {
    args.push('-b', options.createBranch);
  }
  args.push('--', worktreePath);
  if (options.commitish) {
    args.push(options.commitish);
  }
  await runGit(args, localPath);
}

async function removeWorktree(localPath, worktreePath, force = false) {
  const args = ['worktree', 'remove'];
  if (force) args.push('--force');
  args.push(worktreePath);
  await runGit(args, localPath);
}

module.exports = { listWorktrees, addWorktree, removeWorktree };
