// @ts-nocheck
const { runGit } = require('./core.cjs');

async function getTags(localPath) {
  try {
    const result = await runGit(['show-ref', '--tags', '-d'], localPath, {
      successExitCodes: new Set([0, 1])
    });

    const tags = result.stdout
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        const [commitSha, rawTagName] = line.split(' ');
        const tagName = rawTagName
          .replace(/^refs\/tags\//, '')
          .replace(/\^\{\}$/, '');
        return { name: tagName, commitSha };
      });

    // Annotated tags produce two lines; the last one (with ^{}) holds the commit.
    const byName = new Map();
    for (const tag of tags) {
      byName.set(tag.name, tag.commitSha);
    }

    return Array.from(byName.entries()).map(([name, commitSha]) => ({ name, commitSha }));
  } catch (error) {
    throw new Error(error?.message || 'Could not list tags.');
  }
}

async function createTag(localPath, name, targetCommitSha) {
  if (!name || !targetCommitSha) {
    throw new Error('Tag name and target commit are required.');
  }
  await runGit(['tag', '-a', '-m', '', name, targetCommitSha], localPath);
}

async function deleteTag(localPath, name) {
  if (!name) {
    throw new Error('Tag name is required.');
  }
  await runGit(['tag', '-d', name], localPath);
}

module.exports = { getTags, createTag, deleteTag };
