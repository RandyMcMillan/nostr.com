const { spawn } = require('dugite');
const path = require('path');

function spawnGit(args, cwd, options = {}) {
  const cwdPath = path.resolve(cwd || '.');
  const { onStdout, onStderr, ...rest } = options;
  const opts = {
    env: {
      TERM: 'dumb',
      GIT_TERMINAL_PROMPT: '0',
      ...rest.env
    },
    ...rest
  };

  return new Promise((resolve, reject) => {
    const child = spawn(args, cwdPath, opts);
    const stdout = [];
    const stderr = [];

    child.stdout?.on('data', (chunk) => {
      stdout.push(chunk);
      onStdout?.(chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr.push(chunk);
      onStderr?.(chunk);
    });

    child.on('error', (error) => reject(error));
    child.on('close', (exitCode) => {
      const stdoutBuffer = Buffer.concat(stdout.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c))));
      const stderrBuffer = Buffer.concat(stderr.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c))));
      resolve({
        exitCode,
        stdout: stdoutBuffer.toString('utf8'),
        stderr: stderrBuffer.toString('utf8'),
        path: cwdPath
      });
    });
  });
}

module.exports = { spawnGit };
