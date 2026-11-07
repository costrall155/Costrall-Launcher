'use strict'
const { contextBridge, ipcRenderer } = require('electron')

function on(channel, callback) {
  const listener = (_event, payload) => callback(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('costrall', {
  info: () => ipcRenderer.invoke('app:info'),
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  java: () => ipcRenderer.invoke('java:list'),
  accounts: {
    list: () => ipcRenderer.invoke('accounts:list'),
    setActive: (id) => ipcRenderer.invoke('accounts:setActive', id),
    remove: (id) => ipcRenderer.invoke('accounts:remove', id),
    addOffline: (name) => ipcRenderer.invoke('accounts:addOffline', name),
    microsoftStart: () => ipcRenderer.invoke('accounts:microsoftStart'),
    onCode: (cb) => on('auth:code', cb),
    onDone: (cb) => on('auth:done', cb)
  },
  versions: {
    list: () => ipcRenderer.invoke('versions:list'),
    fabricLoaders: (v) => ipcRenderer.invoke('fabric:loaders', v)
  },
  instances: {
    list: () => ipcRenderer.invoke('instances:list'),
    create: (data) => ipcRenderer.invoke('instances:create', data),
    update: (id, patch) => ipcRenderer.invoke('instances:update', id, patch),
    remove: (id) => ipcRenderer.invoke('instances:delete', id),
    select: (id) => ipcRenderer.invoke('instances:select', id),
    openFolder: (id) => ipcRenderer.invoke('instances:openFolder', id)
  },
  mods: {
    search: (payload) => ipcRenderer.invoke('mods:search', payload),
    install: (payload) => ipcRenderer.invoke('mods:install', payload),
    installUrl: (payload) => ipcRenderer.invoke('mods:installUrl', payload),
    installFiles: (instanceId) => ipcRenderer.invoke('mods:installFiles', instanceId),
    list: (id) => ipcRenderer.invoke('mods:list', id),
    remove: (payload) => ipcRenderer.invoke('mods:remove', payload),
    project: (payload) => ipcRenderer.invoke('mods:project', payload),
    onLog: (cb) => on('mods:log', cb)
  },
  game: {
    launch: (id) => ipcRenderer.invoke('game:launch', id),
    kill: () => ipcRenderer.invoke('game:kill'),
    onStatus: (cb) => on('game:status', cb),
    onLog: (cb) => on('game:log', cb),
    onStarted: (cb) => on('game:started', cb),
    onExit: (cb) => on('game:exit', cb),
    onError: (cb) => on('game:error', cb)
  },
  install: {
    onProgress: (cb) => on('install:progress', cb),
    onLog: (cb) => on('install:log', cb)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    openExternal: (url) => ipcRenderer.invoke('window:openExternal', url),
    onState: (cb) => on('window:state', cb)
  },
  dialog: {
    pickJava: () => ipcRenderer.invoke('dialog:pickJava')
  },
  openRoot: () => ipcRenderer.invoke('app:openRoot')
})
