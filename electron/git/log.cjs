// @ts-nocheck
const { runGit } = require('./core.cjs');

const fields = ['sha', 'shortSha', 'subject', 'authorName', 'authorEmail', 'date', 'parents'];
const fieldCount = fields.length;

/**
 * Parse NUL-separated git log output into commit objects.
 * Modeled on desktop/app/src/lib/git/log.ts createLogParser approach,
 * but kept compatible with the existing nostr.com return shape.
 */
function parseLogOutput(output) {
  if (!output) return [];

  const tokens = output
    .split('\0')
    // Git may insert a newline between commits; strip it from field edges.
    .map(token => token.replace(/^\n+|\n+$/g, ''));
  // The final token after the trailing NUL is empty.
  if (tokens.length > 0 && tokens[tokens.length - 1] === '') {
    tokens.pop();
  }

  const commits = [];
  for (let i = 0; i < tokens.length; i += fieldCount) {
    if (i + fieldCount > tokens.length) break;
    const chunk = tokens.slice(i, i + fieldCount);
    const [sha, shortSha, subject, authorName, authorEmail, date, parents] = chunk;
    commits.push({
      sha,
      shortSha,
      subject,
      author: { name: authorName, email: authorEmail },
      date,
      parents: parents ? parents.split(' ').filter(Boolean) : []
    });
  }

  return commits;
}

async function getRepositoryLog(repoPath, limit = 20) {
  const format = fields.map((name, index) => {
    switch (index) {
      case 0:
        return '%H';
      case 1:
        return '%h';
      case 2:
        return '%s';
      case 3:
        return '%an';
      case 4:
        return '%ae';
      case 5:
        return '%ad';
      case 6:
        return '%P';
      default:
        return '';
    }
  }).join('%x00') + '%x00';

  const result = await runGit(
    ['log', `--max-count=${limit}`, `--pretty=format:${format}`, '--date=iso-strict', '--no-color'],
    repoPath,
    { successExitCodes: new Set([0, 128]) }
  );

  if (result.exitCode === 128) {
    return [];
  }

  return parseLogOutput(result.stdout);
}

module.exports = {
  getRepositoryLog,
  parseLogOutput
};
