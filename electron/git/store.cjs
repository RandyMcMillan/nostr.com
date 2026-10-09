const { app } = require('electron');
const fs = require('fs/promises');
const path = require('path');

const STORE_FILE = 'nostr-repos.json';

function storePath() {
  return path.join(app.getPath('userData'), STORE_FILE);
}

function repoAddress(kind, pubkey, identifier) {
  return `${kind}:${pubkey}:${identifier}`;
}

async function readStore() {
  try {
    const raw = await fs.readFile(storePath(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return { repos: {}, version: 1 };
  }
}

async function writeStore(store) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(storePath(), JSON.stringify(store, null, 2), { mode: 0o600 });
}

async function getRepoEntry(kind, pubkey, identifier) {
  const store = await readStore();
  return store.repos[repoAddress(kind, pubkey, identifier)] || null;
}

async function listRepos() {
  const store = await readStore();
  return Object.entries(store.repos).map(([address, data]) => ({ address, ...data }));
}

async function setRepoEntry(kind, pubkey, identifier, localPath, metadata = {}) {
  const store = await readStore();
  store.repos[repoAddress(kind, pubkey, identifier)] = {
    localPath,
    ...metadata,
    updatedAt: Date.now()
  };
  await writeStore(store);
  return store.repos[repoAddress(kind, pubkey, identifier)];
}

async function removeRepoEntry(kind, pubkey, identifier) {
  const store = await readStore();
  delete store.repos[repoAddress(kind, pubkey, identifier)];
  await writeStore(store);
}

function deriveRepoFolderName(event) {
  const nameTag = event.tags.find((tag) => tag[0] === 'name');
  const dTag = event.tags.find((tag) => tag[0] === 'd');
  const name = nameTag?.[1] || dTag?.[1] || 'repo';
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

module.exports = {
  repoAddress,
  readStore,
  writeStore,
  getRepoEntry,
  listRepos,
  setRepoEntry,
  removeRepoEntry,
  deriveRepoFolderName
};
