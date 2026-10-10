const { app, BrowserWindow, Notification, ipcMain, safeStorage, shell, dialog, Menu, autoUpdater } = require('electron');
const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');

const {
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
  store: gitStore
} = require('./git/index.cjs');

let server;
let mainWindow;
let appBaseUrl;
let pendingNostrUrl = '';
const secureSessionFile = 'secure-private-key-session.dat';
const appUserModelId = 'com.lnbits.nostr.social';
const windowStateFile = 'window-state.json';
const defaultWindowBounds = { width: 1180, height: 840, x: undefined, y: undefined, maximized: false };

function windowStatePath() {
  return path.join(app.getPath('userData'), windowStateFile);
}

async function readWindowState() {
  try {
    const raw = await fsp.readFile(windowStatePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return { ...defaultWindowBounds, ...parsed };
  } catch {
    return { ...defaultWindowBounds };
  }
}

async function saveWindowState() {
  if (!mainWindow) return;
  const bounds = mainWindow.getBounds();
  const state = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    maximized: mainWindow.isMaximized()
  };
  try {
    await fsp.mkdir(app.getPath('userData'), { recursive: true });
    await fsp.writeFile(windowStatePath(), JSON.stringify(state));
  } catch {
    // Window state is best-effort.
  }
}

function windowBoundsForDisplay(state) {
  const { screen } = require('electron');
  const display = screen.getDisplayMatching({ x: state.x ?? 0, y: state.y ?? 0, width: state.width, height: state.height });
  const workArea = display.workArea;
  const width = Math.min(state.width, workArea.width);
  const height = Math.min(state.height, workArea.height);
  let x = state.x;
  let y = state.y;
  if (x === undefined || y === undefined || x < workArea.x - width + 80 || x > workArea.x + workArea.width - 80 || y < workArea.y - height + 80 || y > workArea.y + workArea.height - 80) {
    x = undefined;
    y = undefined;
  }
  return { width, height, x, y };
}

function createStaticServer() {
  const root = path.join(__dirname, '..', 'build');
  server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
    const cleanPath = decodeURIComponent(requestUrl.pathname).replace(/^\/+/, '');
    const filePath = path.join(root, cleanPath || 'index.html');
    const safePath = filePath.startsWith(root) ? filePath : path.join(root, 'index.html');
    fs.readFile(safePath, (error, content) => {
      if (error) {
        fs.readFile(path.join(root, 'index.html'), (fallbackError, fallback) => {
          if (fallbackError) {
            response.writeHead(404);
            response.end('Not found');
            return;
          }
          response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          response.end(fallback);
        });
        return;
      }
      response.writeHead(200, { 'content-type': contentType(safePath) });
      response.end(content);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

async function createWindow() {
  appBaseUrl = appBaseUrl || (await createStaticServer());
  const state = await readWindowState();
  const bounds = windowBoundsForDisplay(state);
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 420,
    minHeight: 680,
    title: 'Nostr Social',
    icon: path.join(__dirname, '..', 'build', 'icon-512.png'),
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      nativeWindowOpen: true,
      sandbox: true
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isPomegranateLoginUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 560,
          height: 720,
          parent: mainWindow,
          title: 'Pomegranate login',
          backgroundColor: '#0f172a',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            nativeWindowOpen: true,
            sandbox: true
          }
        }
      };
    }
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
  mainWindow.on('resize', () => saveWindowState());
  mainWindow.on('move', () => saveWindowState());
  mainWindow.on('maximize', () => saveWindowState());
  mainWindow.on('unmaximize', () => saveWindowState());
  if (state.maximized) {
    mainWindow.maximize();
  }
  await mainWindow.loadURL(appBaseUrl);
  if (pendingNostrUrl) {
    const url = pendingNostrUrl;
    pendingNostrUrl = '';
    openNostrUrl(url);
  }
}

function registerNostrProtocol() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) app.setAsDefaultProtocolClient('nostr', process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient('nostr');
  }
}

function findNostrUrl(argv = process.argv) {
  return argv.find((argument) => /^nostr:/i.test(argument)) || '';
}

function isPomegranateLoginUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'auth.njump.me' && /^\/login\/(google|email)\/?$/i.test(url.pathname);
  } catch {
    return false;
  }
}

function nostrIdentifierFromUrl(url = '') {
  const clean = String(url).trim();
  if (!/^nostr:/i.test(clean)) return '';
  try {
    return decodeURIComponent(clean.replace(/^nostr:(?:\/\/)?/i, '').replace(/^\/+/, '').split(/[?#]/, 1)[0] || '').trim();
  } catch {
    return clean.replace(/^nostr:(?:\/\/)?/i, '').replace(/^\/+/, '').split(/[?#]/, 1)[0] || '';
  }
}

function openNostrUrl(url) {
  const identifier = nostrIdentifierFromUrl(url);
  if (!identifier) return;
  pendingNostrUrl = url;
  if (!mainWindow || !appBaseUrl) return;
  pendingNostrUrl = '';
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  void mainWindow.loadURL(`${appBaseUrl}/${encodeURIComponent(identifier)}`);
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.json' || extension === '.webmanifest') return 'application/json; charset=utf-8';
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  return 'application/octet-stream';
}

function secureSessionPath() {
  return path.join(app.getPath('userData'), secureSessionFile);
}

function canUseSecureSessionStorage() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  if (process.platform !== 'linux') return true;
  const backend = safeStorage.getSelectedStorageBackend();
  return backend !== 'basic_text' && backend !== 'unknown';
}

async function readSecureSession() {
  if (!canUseSecureSessionStorage()) return null;
  try {
    const encoded = await fsp.readFile(secureSessionPath(), 'utf8');
    return safeStorage.decryptString(Buffer.from(encoded, 'base64'));
  } catch {
    return null;
  }
}

async function writeSecureSession(value) {
  if (!canUseSecureSessionStorage()) return false;
  const encrypted = safeStorage.encryptString(value);
  await fsp.mkdir(app.getPath('userData'), { recursive: true });
  await fsp.writeFile(secureSessionPath(), encrypted.toString('base64'), { mode: 0o600 });
  return true;
}

async function clearSecureSession() {
  try {
    await fsp.rm(secureSessionPath(), { force: true });
  } catch {
    // Logout should still succeed if the secure session file is already gone.
  }
}

function registerSecureSessionHandlers() {
  ipcMain.handle('secure-session:available', () => canUseSecureSessionStorage());
  ipcMain.handle('secure-session:read', () => readSecureSession());
  ipcMain.handle('secure-session:write', (_event, value) => (typeof value === 'string' ? writeSecureSession(value) : false));
  ipcMain.handle('secure-session:clear', () => clearSecureSession());
}

function registerUploadHandlers() {
  ipcMain.handle('upload:nostr-build', async (_event, payload) => {
    try {
      return await uploadToNostrBuild(payload);
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { message: error?.message || 'Could not reach nostr.build for upload.' },
        error: error?.message || 'Could not reach nostr.build for upload.'
      };
    }
  });
}

function registerNotificationHandlers() {
  ipcMain.handle('notification:available', () => Notification.isSupported());
  ipcMain.handle('notification:show', (_event, payload) => {
    if (!Notification.isSupported()) return false;
    const title = typeof payload?.title === 'string' ? payload.title.slice(0, 120) : '';
    const body = typeof payload?.body === 'string' ? payload.body.slice(0, 500) : '';
    const route = typeof payload?.route === 'string' && payload.route.startsWith('/') ? payload.route : '';
    if (!title) return false;

    const notification = new Notification({
      title,
      body,
      icon: path.join(__dirname, '..', 'build', 'icon-512.png')
    });
    notification.on('click', () => {
      if (!mainWindow) {
        pendingNostrUrl = '';
        void createWindow().then(() => {
          if (route) openAppRoute(route);
        });
        return;
      }
      if (route) openAppRoute(route);
      else {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notification.show();
    return true;
  });
}

function registerAppInfoHandlers() {
  ipcMain.handle('app-info:version', () => app.getVersion());
}

function reposBasePath() {
  return path.join(app.getPath('userData'), 'nostr-repos');
}

function sanitizeFolderName(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120) || 'repo';
}

function repoLocalPath(kind, pubkey, identifier) {
  const folderName = `${kind}_${pubkey.slice(0, 16)}_${sanitizeFolderName(identifier)}`;
  return path.join(reposBasePath(), folderName);
}

function validateRepoIdentity(payload) {
  const kind = Number(payload?.kind);
  const pubkey = typeof payload?.pubkey === 'string' ? payload.pubkey : '';
  const identifier = typeof payload?.identifier === 'string' ? payload.identifier : '';
  if (!Number.isFinite(kind) || kind < 1) throw new Error('Invalid repo kind.');
  if (!pubkey) throw new Error('Missing repo pubkey.');
  if (!identifier) throw new Error('Missing repo identifier.');
  return { kind, pubkey, identifier };
}

function registerNostrGitHandlers() {
  ipcMain.handle('nostr-git:list', async () => gitStore.listRepos());

  ipcMain.handle('nostr-git:status', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const status = await getRepositoryStatus(localPath);
      return { ok: true, status };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not read status.' };
    }
  });

  ipcMain.handle('nostr-git:log', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const limit = Number.isFinite(payload?.limit) ? payload.limit : 20;
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const commits = await getRepositoryLog(localPath, limit);
      return { ok: true, commits };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not read log.' };
    }
  });

  ipcMain.handle('nostr-git:remotes', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const remotes = await getRemotes(localPath);
      return { ok: true, remotes };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not read remotes.' };
    }
  });

  ipcMain.handle('nostr-git:add-remote', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const name = typeof payload?.name === 'string' ? payload.name : '';
    const url = typeof payload?.url === 'string' ? payload.url : '';
    if (!localPath || !name || !url) return { ok: false, error: 'Missing local path, remote name, or URL.' };
    try {
      const remote = await addRemote(localPath, name, url);
      return { ok: true, remote };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not add remote.' };
    }
  });

  ipcMain.handle('nostr-git:remove-remote', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const name = typeof payload?.name === 'string' ? payload.name : '';
    if (!localPath || !name) return { ok: false, error: 'Missing local path or remote name.' };
    try {
      await removeRemote(localPath, name);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not remove remote.' };
    }
  });

  ipcMain.handle('nostr-git:fetch', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await fetchRepository(localPath, payload?.remote, payload?.prune !== false);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Fetch failed.' };
    }
  });

  ipcMain.handle('nostr-git:pull', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await pullRepository(localPath, { ffOnly: payload?.ffOnly, rebase: payload?.rebase });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Pull failed.' };
    }
  });

  ipcMain.handle('nostr-git:branches', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const branches = await getBranches(localPath);
      return { ok: true, branches };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not list branches.' };
    }
  });

  ipcMain.handle('nostr-git:checkout', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const branchName = typeof payload?.branchName === 'string' ? payload.branchName : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    if (!branchName) return { ok: false, error: 'Missing branch name.' };
    try {
      await checkoutBranch(localPath, branchName, payload?.create);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Checkout failed.' };
    }
  });

  ipcMain.handle('nostr-git:delete-branch', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const branchName = typeof payload?.branchName === 'string' ? payload.branchName : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    if (!branchName) return { ok: false, error: 'Missing branch name.' };
    try {
      await deleteBranch(localPath, branchName, payload?.force);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Delete branch failed.' };
    }
  });

  ipcMain.handle('nostr-git:commit', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const message = typeof payload?.message === 'string' ? payload.message : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    if (!message) return { ok: false, error: 'Missing commit message.' };
    try {
      await commit(localPath, message, {
        allowEmpty: payload?.allowEmpty,
        authorName: payload?.authorName,
        authorEmail: payload?.authorEmail
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Commit failed.' };
    }
  });

  ipcMain.handle('nostr-git:push', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await pushRepository(localPath, payload?.remote, payload?.branch, {
        forceWithLease: payload?.forceWithLease
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Push failed.' };
    }
  });

  ipcMain.handle('nostr-git:diff', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const diff = await getDiff(localPath, {
        filePath: payload?.filePath,
        staged: payload?.staged
      });
      return { ok: true, diff };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not read diff.' };
    }
  });

  ipcMain.handle('nostr-git:stage', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await stageFile(localPath, payload?.filePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Stage failed.' };
    }
  });

  ipcMain.handle('nostr-git:unstage', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await unstageFile(localPath, payload?.filePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Unstage failed.' };
    }
  });

  ipcMain.handle('nostr-git:refs', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const refs = await getRefs(localPath);
      return { ok: true, refs };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not read refs.' };
    }
  });

  ipcMain.handle('nostr-git:merge-base', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const refA = typeof payload?.refA === 'string' ? payload.refA : '';
    const refB = typeof payload?.refB === 'string' ? payload.refB : '';
    if (!localPath || !refA || !refB) return { ok: false, error: 'Missing path or refs.' };
    try {
      const commit = await getMergeBase(localPath, refA, refB);
      return { ok: true, commit };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not compute merge base.' };
    }
  });

  ipcMain.handle('nostr-git:format-patch', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const patch = await formatPatch(localPath, payload?.baseRef, {
        single: payload?.single
      });
      return { ok: true, patch };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not format patch.' };
    }
  });

  ipcMain.handle('nostr-git:tags', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const tags = await getTags(localPath);
      return { ok: true, tags };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not list tags.' };
    }
  });

  ipcMain.handle('nostr-git:create-tag', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const name = typeof payload?.name === 'string' ? payload.name : '';
    const targetCommitSha = typeof payload?.targetCommitSha === 'string' ? payload.targetCommitSha : '';
    if (!localPath || !name || !targetCommitSha) {
      return { ok: false, error: 'Missing local path, tag name, or target commit.' };
    }
    try {
      await createTag(localPath, name, targetCommitSha);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not create tag.' };
    }
  });

  ipcMain.handle('nostr-git:delete-tag', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const name = typeof payload?.name === 'string' ? payload.name : '';
    if (!localPath || !name) return { ok: false, error: 'Missing local path or tag name.' };
    try {
      await deleteTag(localPath, name);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not delete tag.' };
    }
  });

  ipcMain.handle('nostr-git:reset', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const mode = typeof payload?.mode === 'string' ? payload.mode : 'mixed';
    const ref = typeof payload?.ref === 'string' ? payload.ref : '';
    if (!localPath || !ref) return { ok: false, error: 'Missing local path or target ref.' };
    try {
      await resetRepo(localPath, mode, ref);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not reset.' };
    }
  });

  ipcMain.handle('nostr-git:cherry-pick', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const sha = typeof payload?.sha === 'string' ? payload.sha : '';
    if (!localPath || !sha) return { ok: false, error: 'Missing local path or commit SHA.' };
    try {
      await cherryPick(localPath, sha);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Cherry-pick failed.' };
    }
  });

  ipcMain.handle('nostr-git:abort-cherry-pick', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await abortCherryPick(localPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not abort cherry-pick.' };
    }
  });

  ipcMain.handle('nostr-git:stashes', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const stashes = await getStashes(localPath);
      return { ok: true, stashes };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not list stashes.' };
    }
  });

  ipcMain.handle('nostr-git:create-stash', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const message = typeof payload?.message === 'string' ? payload.message : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await createStash(localPath, message);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not create stash.' };
    }
  });

  ipcMain.handle('nostr-git:pop-stash', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const ref = typeof payload?.ref === 'string' ? payload.ref : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await popStash(localPath, ref);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not pop stash.' };
    }
  });

  ipcMain.handle('nostr-git:drop-stash', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const ref = typeof payload?.ref === 'string' ? payload.ref : '';
    if (!localPath || !ref) return { ok: false, error: 'Missing local path or stash ref.' };
    try {
      await dropStash(localPath, ref);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not drop stash.' };
    }
  });

  ipcMain.handle('nostr-git:submodules', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const submodules = await listSubmodules(localPath);
      return { ok: true, submodules };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not list submodules.' };
    }
  });

  ipcMain.handle('nostr-git:update-submodules', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await updateSubmodules(localPath, { force: payload?.force === true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not update submodules.' };
    }
  });

  ipcMain.handle('nostr-git:worktrees', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      const worktrees = await listWorktrees(localPath);
      return { ok: true, worktrees };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not list worktrees.' };
    }
  });

  ipcMain.handle('nostr-git:add-worktree', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const worktreePath = typeof payload?.worktreePath === 'string' ? payload.worktreePath : '';
    if (!localPath || !worktreePath) return { ok: false, error: 'Missing local path or worktree path.' };
    try {
      await addWorktree(localPath, worktreePath, {
        createBranch: typeof payload?.createBranch === 'string' ? payload.createBranch : undefined,
        commitish: typeof payload?.commitish === 'string' ? payload.commitish : undefined
      });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not add worktree.' };
    }
  });

  ipcMain.handle('nostr-git:remove-worktree', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const worktreePath = typeof payload?.worktreePath === 'string' ? payload.worktreePath : '';
    if (!localPath || !worktreePath) return { ok: false, error: 'Missing local path or worktree path.' };
    try {
      await removeWorktree(localPath, worktreePath, payload?.force === true);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not remove worktree.' };
    }
  });

  ipcMain.handle('nostr-git:rebase', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    const ref = typeof payload?.ref === 'string' ? payload.ref : '';
    if (!localPath || !ref) return { ok: false, error: 'Missing local path or target ref.' };
    try {
      await rebaseRepo(localPath, ref);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Rebase failed.' };
    }
  });

  ipcMain.handle('nostr-git:continue-rebase', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await continueRebase(localPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not continue rebase.' };
    }
  });

  ipcMain.handle('nostr-git:abort-rebase', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await abortRebase(localPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not abort rebase.' };
    }
  });

  ipcMain.handle('nostr-git:skip-rebase', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    try {
      await skipRebase(localPath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Could not skip rebase commit.' };
    }
  });

  ipcMain.handle('nostr-git:open-folder', async (_event, payload) => {
    const localPath = typeof payload?.localPath === 'string' ? payload.localPath : '';
    if (!localPath) return { ok: false, error: 'Missing local path.' };
    const error = await shell.openPath(localPath);
    return { ok: !error, error: error || undefined };
  });

  ipcMain.handle('nostr-git:choose-folder', async () => {
    if (!mainWindow) return { ok: false, error: 'No main window.' };
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { ok: false, canceled: true };
    }
    return { ok: true, localPath: result.filePaths[0] };
  });

  ipcMain.handle('nostr-git:clone', async (event, payload) => {
    try {
      const { kind, pubkey, identifier } = validateRepoIdentity(payload);
      const url = typeof payload?.url === 'string' ? payload.url : '';
      if (!url) return { ok: false, error: 'Missing clone URL.' };

      const address = gitStore.repoAddress(kind, pubkey, identifier);
      const localPath = repoLocalPath(kind, pubkey, identifier);
      await cloneRepository(url, localPath, {
        defaultBranch: payload?.defaultBranch,
        branch: payload?.branch
      }, (text) => {
        event.sender.send('nostr-git:clone-progress', { address, text });
      });

      const metadata = { url, clonedAt: Date.now() };
      await gitStore.setRepoEntry(kind, pubkey, identifier, localPath, metadata);
      return { ok: true, localPath };
    } catch (error) {
      return { ok: false, error: error?.message || 'Clone failed.' };
    }
  });

  ipcMain.handle('nostr-git:init', async (_event, payload) => {
    try {
      const { kind, pubkey, identifier } = validateRepoIdentity(payload);
      const localPath = repoLocalPath(kind, pubkey, identifier);
      await initRepository(localPath, payload?.defaultBranch);
      await gitStore.setRepoEntry(kind, pubkey, identifier, localPath, { initializedAt: Date.now() });
      return { ok: true, localPath };
    } catch (error) {
      return { ok: false, error: error?.message || 'Init failed.' };
    }
  });

  ipcMain.handle('nostr-git:remove', async (_event, payload) => {
    try {
      const { kind, pubkey, identifier } = validateRepoIdentity(payload);
      await gitStore.removeRepoEntry(kind, pubkey, identifier);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || 'Remove failed.' };
    }
  });
}

async function uploadToNostrBuild(payload) {
  const authorization = typeof payload?.authorization === 'string' ? payload.authorization : '';
  const mediaType = ['avatar', 'banner', 'media'].includes(payload?.mediaType) ? payload.mediaType : 'media';
  const name = safeUploadName(typeof payload?.name === 'string' && payload.name ? payload.name : 'upload');
  const type = typeof payload?.type === 'string' && payload.type ? payload.type : 'application/octet-stream';
  const size = Number.isFinite(payload?.size) ? String(payload.size) : '';
  const bytes = Buffer.isBuffer(payload?.bytes) ? payload.bytes : Buffer.from(payload?.bytes ?? []);
  if (!authorization.startsWith('Nostr ') || !bytes.length) return { ok: false, status: 400, data: { message: 'Missing upload data.' } };

  const form = new FormData();
  form.set('file', new Blob([bytes], { type }), name);
  form.set('media_type', mediaType);
  form.set('content_type', type);
  form.set('size', size || String(bytes.length));

  const response = await fetch('https://nostr.build/api/v2/upload/files', {
    method: 'POST',
    headers: { Authorization: authorization },
    body: form
  });
  const text = await response.text().catch(() => '');
  return {
    ok: response.ok,
    status: response.status,
    location: response.headers.get('location') || '',
    data: parseJsonOrText(text)
  };
}

function safeUploadName(name) {
  return name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 180) || 'upload';
}

function parseJsonOrText(text) {
  if (!text) return '';
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function openAppRoute(route = '/') {
  if (!mainWindow || !appBaseUrl || !route.startsWith('/')) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  void mainWindow.loadURL(`${appBaseUrl}${route}`);
}

function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front' },
              { type: 'separator' },
              { role: 'window' }
            ]
          : [])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://nostr.com');
          }
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function registerUpdaterStub() {
  try {
    autoUpdater.on('error', () => {});
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  } catch {
    // Updater is a stub until a feed URL is configured.
  }
}

if (process.platform === 'win32') app.setAppUserModelId(appUserModelId);
registerNostrProtocol();
openNostrUrl(findNostrUrl());

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    openNostrUrl(findNostrUrl(argv));
  });

  app.on('open-url', (event, url) => {
    event.preventDefault();
    openNostrUrl(url);
  });

  app.whenReady().then(() => {
    createApplicationMenu();
    registerAppInfoHandlers();
    registerSecureSessionHandlers();
    registerUploadHandlers();
    registerNotificationHandlers();
    registerNostrGitHandlers();
    registerUpdaterStub();
    return createWindow();
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on('before-quit', () => {
  server?.close();
});
