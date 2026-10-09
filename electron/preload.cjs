const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nostrDesktopSecureStorage', {
  isAvailable: () => ipcRenderer.invoke('secure-session:available'),
  read: () => ipcRenderer.invoke('secure-session:read'),
  write: (value) => ipcRenderer.invoke('secure-session:write', value),
  clear: () => ipcRenderer.invoke('secure-session:clear')
});

contextBridge.exposeInMainWorld('nostrDesktopUpload', {
  uploadToNostrBuild: (payload) => ipcRenderer.invoke('upload:nostr-build', payload)
});

contextBridge.exposeInMainWorld('nostrDesktopNotifications', {
  isAvailable: () => ipcRenderer.invoke('notification:available'),
  show: (payload) => ipcRenderer.invoke('notification:show', payload)
});

contextBridge.exposeInMainWorld('nostrDesktopApp', {
  version: () => ipcRenderer.invoke('app-info:version')
});

contextBridge.exposeInMainWorld('nostrGit', {
  list: () => ipcRenderer.invoke('nostr-git:list'),
  status: (payload) => ipcRenderer.invoke('nostr-git:status', payload),
  log: (payload) => ipcRenderer.invoke('nostr-git:log', payload),
  remotes: (payload) => ipcRenderer.invoke('nostr-git:remotes', payload),
  fetch: (payload) => ipcRenderer.invoke('nostr-git:fetch', payload),
  pull: (payload) => ipcRenderer.invoke('nostr-git:pull', payload),
  branches: (payload) => ipcRenderer.invoke('nostr-git:branches', payload),
  checkout: (payload) => ipcRenderer.invoke('nostr-git:checkout', payload),
  deleteBranch: (payload) => ipcRenderer.invoke('nostr-git:delete-branch', payload),
  commit: (payload) => ipcRenderer.invoke('nostr-git:commit', payload),
  push: (payload) => ipcRenderer.invoke('nostr-git:push', payload),
  diff: (payload) => ipcRenderer.invoke('nostr-git:diff', payload),
  stage: (payload) => ipcRenderer.invoke('nostr-git:stage', payload),
  unstage: (payload) => ipcRenderer.invoke('nostr-git:unstage', payload),
  refs: (payload) => ipcRenderer.invoke('nostr-git:refs', payload),
  mergeBase: (payload) => ipcRenderer.invoke('nostr-git:merge-base', payload),
  formatPatch: (payload) => ipcRenderer.invoke('nostr-git:format-patch', payload),
  clone: (payload) => ipcRenderer.invoke('nostr-git:clone', payload),
  init: (payload) => ipcRenderer.invoke('nostr-git:init', payload),
  remove: (payload) => ipcRenderer.invoke('nostr-git:remove', payload),
  openFolder: (payload) => ipcRenderer.invoke('nostr-git:open-folder', payload),
  chooseFolder: () => ipcRenderer.invoke('nostr-git:choose-folder'),
  onCloneProgress: (callback) => {
    const channel = 'nostr-git:clone-progress';
    const listener = (_event, data) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.off(channel, listener);
  }
});
