// @ts-nocheck
const { runGit } = require('./core.cjs');

async function commit(repoPath, message, options = {}) {
  const args = ['commit', '-m', message];
  if (options.allowEmpty) args.push('--allow-empty');
  args.push('--');
  await runGit(args, repoPath, {
    env: {
      GIT_AUTHOR_NAME: options.authorName || 'Nostr User',
      GIT_AUTHOR_EMAIL: options.authorEmail || 'user@example.com',
      GIT_COMMITTER_NAME: options.committerName || 'Nostr User',
      GIT_COMMITTER_EMAIL: options.committerEmail || 'user@example.com'
    }
  });
}

module.exports = { commit };
