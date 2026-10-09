// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getRepositoryLog(repoPath, limit = 20) {
  const format = ['%H', '%h', '%s', '%an', '%ae', '%ad', '%P'].join('<>');
  const result = await runGit(
    ['log', `--max-count=${limit}`, `--pretty=format:${format}`, '--date=iso-strict', '--no-color'],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );

  if (result.exitCode === 128 || !result.stdout.trim()) {
    return [];
  }

  return result.stdout.split('\n').map((line) => {
    const [sha, shortSha, subject, authorName, authorEmail, date, parents] = line.split('<>').map((s) => s.trim());
    return {
      sha,
      shortSha,
      subject,
      author: { name: authorName, email: authorEmail },
      date,
      parents: parents ? parents.split(' ').filter(Boolean) : []
    };
  });
}

module.exports = { getRepositoryLog };
