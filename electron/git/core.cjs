const { exec, parseError } = require('dugite');
const path = require('path');

const GitErrorDescriptions = {
  SSHAuthenticationFailed: 'SSH authentication failed. Check your SSH key and agent.',
  SSHPermissionDenied: 'SSH permission denied. Check your SSH key and access rights.',
  HTTPSAuthenticationFailed: 'HTTPS authentication failed. Check your credentials.',
  HTTPSRepositoryNotFound: 'The repository was not found or you do not have access.',
  SSHRepositoryNotFound: 'The repository was not found or you do not have access.',
  NotAGitRepository: 'This directory is not a git repository.',
  BranchAlreadyExists: 'A branch with that name already exists.',
  RemoteAlreadyExists: 'A remote with that name already exists.',
  PathDoesNotExist: 'The path does not exist on disk.',
  LocalPermissionDenied: 'Permission denied.',
  LockFileAlreadyExists: 'A lock file already exists in the repository.',
  NothingToCommit: 'There are no changes to commit.'
};

function describeGitError(error, stderr) {
  if (GitErrorDescriptions[error]) return GitErrorDescriptions[error];
  if (stderr) return stderr.trim();
  return `Git error: ${error}`;
}

class GitError extends Error {
  constructor(result, args, message) {
    super(message || `git ${args.join(' ')} failed with exit code ${result.exitCode}`);
    this.name = 'GitError';
    this.result = result;
    this.args = args;
  }
}

async function runGit(args, cwd, options = {}) {
  const cwdPath = path.resolve(cwd || '.');
  const opts = {
    successExitCodes: new Set([0]),
    env: {
      TERM: 'dumb',
      GIT_TERMINAL_PROMPT: '0',
      ...options.env
    },
    ...options
  };

  const result = await exec(args, cwdPath, opts);
  const exitCode = result.exitCode;
  const acceptableExitCode = opts.successExitCodes.has(exitCode);

  let gitError = null;
  let gitErrorDescription = null;
  if (!acceptableExitCode) {
    gitError = parseError(result.stderr) || parseError(result.stdout) || 'Unknown';
    gitErrorDescription = describeGitError(gitError, result.stderr || result.stdout);
  }

  const gitResult = {
    ...result,
    gitError,
    gitErrorDescription,
    path: cwdPath
  };

  if (!acceptableExitCode) {
    throw new GitError(gitResult, args, gitErrorDescription);
  }

  return gitResult;
}

module.exports = {
  GitError,
  runGit,
  describeGitError
};
