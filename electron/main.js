'use strict'
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const store = require('./lib/store')
const { Meta } = require('./lib/mcmeta')
const { Installer } = require('./lib/installer')
const { launch, findJava, pickJava } = require('./lib/launcher')
const auth = require('./lib/auth')
const modrinth = require('./lib/modrinth')
const curseforge = require('./lib/curseforge')

app.setAppUserModelId('com.costrall.launcher')
if (process.platform === 'win32') app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling')

const SMOKE = !!process.env.COSTRALL_SMOKE
if (SMOKE) {
  const smokeDir = path.join(os.tmpdir(), 'costrall-smoke')
  fs.mkdirSync(smokeDir, { recursive: true })
  app.setPath('userData', smokeDir)
  const fixture = path.join(smokeDir, 'costrall.json')
  const smokeSettings = { ram: 6144, javaPath: '', jvmArgs: '', width: 1280, height: 720, fullscreen: false, keepOpen: true, showConsole: true, effects: true, language: 'tr', setupDone: true }
  if (!fs.existsSync(fixture)) {
    fs.writeFileSync(fixture, JSON.stringify({
      settings: smokeSettings,
      accounts: [{ id: 'offline:steve', type: 'offline', name: 'Steve', uuid: '5627dd98e6b5485e8c5c4b0e1d3c3d3a' }],
      activeAccount: 'offline:steve',
      instances: [
        { id: 'inst_demo1', name: 'Survival 1.21.11', mcVersion: '1.21.11', loader: 'fabric', loaderVersion: '0.20.1', versionId: '1.21.11-fabric-0.20.1', gameDir: path.join(smokeDir, 'demo1'), createdAt: Date.now() - 86400000, lastPlayed: Date.now() - 3600000, installed: true },
        { id: 'inst_demo2', name: 'Vanilla 1.21.11', mcVersion: '1.21.11', loader: 'vanilla', loaderVersion: null, versionId: '1.21.11', gameDir: path.join(smokeDir, 'demo2'), createdAt: Date.now() - 172800000, lastPlayed: null, installed: false }
      ],
      selectedInstance: 'inst_demo1'
    }, null, 2))
  } else {
    try {
      const data = JSON.parse(fs.readFileSync(fixture, 'utf8'))
      data.settings = { ...smokeSettings, ...(data.settings || {}), setupDone: true, language: data.settings?.language || 'tr' }
      fs.writeFileSync(fixture, JSON.stringify(data, null, 2))
    } catch {}
  }
}

let win = null
const userData = app.getPath('userData')
const rootDir = path.join(userData, 'minecraft')
const assetsDir = path.join(rootDir, 'assets')
const instancesDir = path.join(rootDir, 'instances')
const officialDir = path.join(app.getPath('appData'), '.minecraft')

const meta = new Meta({ cacheDir: path.join(rootDir, 'meta'), officialDir })

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload)
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240,
    height: 780,
    minWidth: 1000,
    minHeight: 660,
    frame: false,
    backgroundColor: '#0a0b10',
    show: false,
    title: 'Costrall Launcher',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  })
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  win.once('ready-to-show', () => win.show())
  if (process.env.COSTRALL_DEBUG) {
    win.webContents.on('console-message', (event) => {
      const msg = event && event.message ? event.message : ''
      const level = event && event.level != null ? event.level : ''
      if (msg) console.log(`[renderer:${level}] ${msg} (${event.sourceId || ''}:${event.lineNumber || ''})`)
    })
    win.webContents.on('did-fail-load', (_e, code, desc) => console.log('[did-fail-load]', code, desc))
    win.webContents.on('render-process-gone', (_e, d) => console.log('[render-gone]', JSON.stringify(d)))
  }
  if (SMOKE) {
    win.webContents.once('did-finish-load', async () => {
      const shots = path.join(__dirname, '..', 'shots')
      fs.mkdirSync(shots, { recursive: true })
      const capture = async (name, wait = 700) => {
        await new Promise((r) => setTimeout(r, wait))
        const img = await win.webContents.capturePage()
        fs.writeFileSync(path.join(shots, name + '.png'), img.toPNG())
      }
      try {
        await capture('1-home', 3800)
        await win.webContents.executeJavaScript("document.querySelector('[data-page=instances]').click()")
        await capture('2-instances')
        await win.webContents.executeJavaScript("document.querySelector('[data-page=mods]').click()")
        await capture('3-mods', 1600)
        await win.webContents.executeJavaScript("document.querySelector('.mod-card') && document.querySelector('.mod-card').click()")
        await capture('5-mod-detail', 1400)
        await win.webContents.executeJavaScript("document.querySelector('#modal [data-close]') && document.querySelector('#modal [data-close]').click()")
        await win.webContents.executeJavaScript("document.querySelector('#mod-source [data-source=curseforge]').click()")
        await capture('6-curseforge', 2600)
        await win.webContents.executeJavaScript("document.querySelector('.mod-card') && document.querySelector('.mod-card').click()")
        await capture('7-cf-detail', 1800)
        await win.webContents.executeJavaScript("document.querySelector('#modal [data-close]') && document.querySelector('#modal [data-close]').click()")
        await win.webContents.executeJavaScript("document.querySelector('#mods-url').click()")
        await capture('8-url-modal', 700)
        await win.webContents.executeJavaScript("document.querySelector('#modal [data-close]') && document.querySelector('#modal [data-close]').click()")
        await win.webContents.executeJavaScript("document.querySelector('[data-page=settings]').click()")
        await capture('4-settings')
      } catch (e) {
        console.log('[smoke] capture failed', e.message)
      }
      app.quit()
    })
  }
  win.on('maximize', () => send('window:state', { maximized: true }))
  win.on('unmaximize', () => send('window:state', { maximized: false }))
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('closed', () => {
    win = null
  })
}

function ensureDirs() {
  for (const d of [rootDir, assetsDir, instancesDir]) fs.mkdirSync(d, { recursive: true })
}

function publicAccount(a) {
  if (!a) return null
  return {
    id: a.id,
    type: a.type,
    name: a.name,
    uuid: a.uuid,
    skin: a.skin,
    expiresAt: a.expiresAt
  }
}

function instanceView(i) {
  const st = store.get()
  return {
    ...i,
    installed: fs.existsSync(path.join(rootDir, 'versions', `${i.versionId || i.mcVersion}`)) || i.installed === true,
    running: !!i.running
  }
}

async function resolveVersionFor(instance) {
  return meta.resolve(instance.mcVersion, instance.loader, instance.loaderVersion)
}

async function doInstall(instance, version) {
  const installer = new Installer({
    meta,
    rootDir,
    officialDir,
    send: (ch, data) => {
      if (ch === 'install:progress') send('install:progress', data)
      else if (ch === 'install:log') send('install:log', data)
    }
  })
  const json = await installer.install(instance, version)
  return json
}

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
  userData,
  rootDir,
  officialDir,
  totalMem: os.totalmem(),
  cpus: os.cpus().length,
  hostname: os.hostname()
}))

ipcMain.handle('settings:get', () => store.get().settings)
ipcMain.handle('settings:set', (e, patch) => {
  const st = store.get()
  st.settings = { ...st.settings, ...patch }
  store.save()
  return st.settings
})

ipcMain.handle('java:list', () => findJava(store.get().settings.javaPath))

ipcMain.handle('accounts:list', () => ({
  accounts: store.get().accounts.map(publicAccount),
  active: store.get().activeAccount
}))

ipcMain.handle('accounts:setActive', (e, id) => {
  const st = store.get()
  st.activeAccount = id
  store.save()
  return { accounts: st.accounts.map(publicAccount), active: id }
})

ipcMain.handle('accounts:remove', (e, id) => {
  const st = store.get()
  st.accounts = st.accounts.filter((a) => a.id !== id)
  if (st.activeAccount === id) st.activeAccount = st.accounts[0]?.id || null
  store.save()
  return { accounts: st.accounts.map(publicAccount), active: st.activeAccount }
})

ipcMain.handle('accounts:addOffline', (e, name) => {
  const clean = String(name || '').trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(clean)) throw new Error('Kullanıcı adı 3-16 karakter olmalı (harf, rakam, _)')
  const st = store.get()
  const account = {
    id: 'offline:' + clean.toLowerCase(),
    type: 'offline',
    name: clean,
    uuid: auth.offlineUuid(clean),
    accessToken: '0'.repeat(32),
    addedAt: Date.now()
  }
  if (!st.accounts.some((a) => a.id === account.id)) st.accounts.push(account)
  st.activeAccount = account.id
  store.save()
  return { accounts: st.accounts.map(publicAccount), active: st.activeAccount }
})

ipcMain.handle('accounts:microsoftStart', async () => {
  const device = await auth.requestDeviceCode()
  send('auth:code', {
    userCode: device.userCode,
    verificationUri: device.verificationUri,
    expiresIn: device.expiresIn,
    message: device.message
  })
  ;(async () => {
    try {
      const tokens = await auth.waitForToken(device, () => send('auth:tick', { ts: Date.now() }))
      const account = await auth.completeLogin(tokens)
      const st = store.get()
      const id = 'ms:' + account.uuid
      const existing = st.accounts.findIndex((a) => a.id === id)
      const record = { ...account, id }
      if (existing >= 0) st.accounts[existing] = record
      else st.accounts.push(record)
      st.activeAccount = id
      store.save()
      send('auth:done', { ok: true, accounts: st.accounts.map(publicAccount), active: id })
    } catch (e) {
      send('auth:done', { ok: false, error: e.message })
    }
  })()
  return { userCode: device.userCode, verificationUri: device.verificationUri, expiresIn: device.expiresIn, message: device.message }
})

ipcMain.handle('versions:list', async () => {
  const manifest = await meta.manifest()
  const releases = manifest.versions.filter((v) => v.type === 'release')
  return {
    latest: { release: manifest.latest.release },
    versions: releases.map((v) => ({
      id: v.id,
      type: v.type,
      releaseTime: v.releaseTime
    }))
  }
})

ipcMain.handle('fabric:loaders', async (e, gameVersion) => meta.fabricLoaders(gameVersion))

ipcMain.handle('instances:list', () => {
  const st = store.get()
  return { instances: st.instances.map(instanceView), selected: st.selectedInstance }
})

ipcMain.handle('instances:create', async (e, data) => {
  const st = store.get()
  const id = 'inst_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const gameDir = path.join(instancesDir, id)
  fs.mkdirSync(path.join(gameDir, 'mods'), { recursive: true })
  const mcVersion = String(data.mcVersion)
  let loaderVersion = data.loaderVersion || null
  if (data.loader === 'fabric' && !loaderVersion) {
    const loaders = await meta.fabricLoaders(mcVersion)
    loaderVersion = (loaders.find((l) => l.stable) || loaders[0])?.version || null
  }
  const versionId = data.loader === 'fabric' ? `${mcVersion}-fabric-${loaderVersion}` : mcVersion
  const instance = {
    id,
    name: String(data.name || `${mcVersion}${data.loader === 'fabric' ? ' Fabric' : ''}`).slice(0, 48),
    mcVersion,
    loader: data.loader || 'vanilla',
    loaderVersion,
    versionId,
    gameDir,
    createdAt: Date.now(),
    lastPlayed: null,
    installed: false,
    ram: data.ram || null
  }
  st.instances.push(instance)
  st.selectedInstance = id
  store.save()
  return { instances: st.instances.map(instanceView), selected: id, instance: instanceView(instance) }
})

ipcMain.handle('instances:update', (e, id, patch) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === id)
  if (!inst) throw new Error('Profil bulunamadı')
  Object.assign(inst, patch)
  store.save()
  return { instances: st.instances.map(instanceView), selected: st.selectedInstance }
})

ipcMain.handle('instances:delete', (e, id) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === id)
  if (inst) {
    try {
      fs.rmSync(inst.gameDir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
  st.instances = st.instances.filter((i) => i.id !== id)
  if (st.selectedInstance === id) st.selectedInstance = st.instances[0]?.id || null
  store.save()
  return { instances: st.instances.map(instanceView), selected: st.selectedInstance }
})

ipcMain.handle('instances:select', (e, id) => {
  const st = store.get()
  st.selectedInstance = id
  store.save()
  return id
})

ipcMain.handle('instances:openFolder', (e, id) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === id)
  if (inst) shell.openPath(inst.gameDir)
})

async function searchSource(source, inst, opts) {
  if (source === 'curseforge') {
    return curseforge.search({
      query: opts.query,
      gameVersion: inst.mcVersion,
      loader: inst.loader,
      offset: opts.offset,
      limit: opts.limit,
      sort: opts.sort
    })
  }
  return modrinth.search({
    query: opts.query,
    gameVersion: inst.mcVersion,
    loader: inst.loader,
    offset: opts.offset,
    limit: opts.limit,
    sort: opts.sort
  })
}

function normalizeProject(p, source) {
  if (source === 'curseforge') {
    return {
      id: String(p.id),
      source: 'curseforge',
      title: p.name,
      slug: p.slug,
      description: p.summary || '',
      icon_url: p.logo?.url || p.logo?.thumbnailUrl || null,
      downloads: p.downloadCount || 0,
      followers: p.favoriteCount || p.thumbsUpCount || 0,
      categories: (p.categories || []).map((c) => c.name),
      license: { id: p.license?.name || p.licenseType || '—' },
      source_url: p.links?.sourceUrl || '',
      issues_url: p.links?.issuesUrl || '',
      website_url: p.links?.websiteUrl || ''
    }
  }
  return {
    id: p.id,
    source: 'modrinth',
    title: p.title,
    slug: p.slug,
    description: p.description || '',
    icon_url: p.icon_url || null,
    downloads: p.downloads || 0,
    followers: p.followers || 0,
    categories: p.categories || [],
    license: p.license || { id: '—' },
    source_url: p.source_url || '',
    issues_url: p.issues_url || '',
    website_url: p.source_url || ''
  }
}

ipcMain.handle('mods:search', (e, { instanceId, query, offset, limit, source = 'modrinth', sort = 'downloads' }) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  return searchSource(source, inst, { query, offset, limit, sort })
})

ipcMain.handle('mods:install', async (e, { instanceId, projectId, source = 'modrinth' }) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  if (inst.loader !== 'fabric') throw new Error('Mod kurulumu için Fabric profili seç')
  const opts = {
    gameVersion: inst.mcVersion,
    loader: inst.loader,
    onLog: (m) => send('mods:log', m)
  }
  const installed = source === 'curseforge'
    ? await curseforge.installMod(inst, projectId, opts)
    : await modrinth.installMod(inst, projectId, opts)
  return installed
})

ipcMain.handle('mods:installUrl', async (e, { instanceId, url }) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  if (inst.loader !== 'fabric') throw new Error('Mod kurulumu için Fabric profili seç')
  return modrinth.installFromUrl(inst, url, { onLog: (m) => send('mods:log', m) })
})

ipcMain.handle('mods:installFiles', async (e, instanceId) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  if (inst.loader !== 'fabric') throw new Error('Mod kurulumu için Fabric profili seç')
  const res = await dialog.showOpenDialog(win, {
    title: 'Mod dosyaları seç',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Minecraft modları', extensions: ['jar'] }]
  })
  if (res.canceled || !res.filePaths.length) return []
  return modrinth.installFromFiles(inst, res.filePaths, { onLog: (m) => send('mods:log', m) })
})

ipcMain.handle('mods:list', async (e, instanceId) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) return { mods: [] }
  return { mods: await modrinth.listInstalled(inst) }
})

ipcMain.handle('mods:remove', async (e, { instanceId, filename }) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  await modrinth.removeMod(inst, filename)
  return { mods: await modrinth.listInstalled(inst) }
})

ipcMain.handle('mods:project', async (e, payload) => {
  const { projectId, source = 'modrinth' } = typeof payload === 'string' ? { projectId: payload } : payload
  const p = source === 'curseforge' ? await curseforge.project(projectId) : await modrinth.project(projectId)
  return normalizeProject(p, source)
})

let runningChild = null

ipcMain.handle('game:launch', async (e, instanceId) => {
  const st = store.get()
  const inst = st.instances.find((i) => i.id === instanceId)
  if (!inst) throw new Error('Profil bulunamadı')
  const account = st.accounts.find((a) => a.id === st.activeAccount)
  if (!account) throw new Error('Önce bir hesap ekle')
  if (runningChild) throw new Error('Oyun zaten çalışıyor')

  try {
    send('game:status', { state: 'preparing', message: 'Sürüm hazırlanıyor...' })
    const version = await resolveVersionFor(inst)

    // refresh microsoft token if needed
    let useAccount = account
    if (account.type === 'microsoft' && account.refreshToken && account.expiresAt && account.expiresAt < Date.now() + 60000) {
      send('game:status', { state: 'auth', message: 'Oturum yenileniyor...' })
      try {
        const tokens = await auth.refresh(account.refreshToken)
        const fresh = await auth.completeLogin(tokens)
        useAccount = { ...account, ...fresh, id: account.id }
        const idx = st.accounts.findIndex((a) => a.id === account.id)
        if (idx >= 0) st.accounts[idx] = useAccount
        store.save()
      } catch (err) {
        send('game:log', { message: 'Oturum yenilenemedi: ' + err.message, level: 'warn' })
      }
    }

    const json = await doInstall(inst, version)
    const javaList = findJava(st.settings.javaPath)
    if (!javaList.length) throw new Error('Java bulunamadı. Ayarlardan Java yolunu seç (Java 21+ gerekli).')
    const javaPath = pickJava(javaList, json.javaVersion?.majorVersion)?.path || javaList[0].path
    send('game:status', { state: 'launching', message: 'Oyun başlatılıyor...' })

    const child = launch(inst, json, useAccount, st.settings, {
      rootDir,
      assetsDir,
      javaPath
    }, {
      log: (message, level = 'info') => send('game:log', { message: String(message).replace(/\n$/, ''), level }),
      error: (err) => send('game:error', { message: err.message }),
      exit: (code) => {
        runningChild = null
        send('game:exit', { code })
        const cur = store.get()
        const target = cur.instances.find((i) => i.id === instanceId)
        if (target) {
          target.running = false
          target.lastPlayed = Date.now()
          store.save()
        }
      }
    })
    runningChild = child
    inst.running = true
    inst.installed = true
    inst.lastPlayed = Date.now()
    store.save()
    send('game:started', { pid: child.pid })
    return { ok: true, pid: child.pid }
  } catch (err) {
    send('game:status', { state: 'error', message: err.message })
    throw err
  }
})

ipcMain.handle('game:kill', () => {
  if (runningChild) {
    runningChild.kill()
    runningChild = null
    return true
  }
  return false
})

ipcMain.handle('window:minimize', () => win?.minimize())
ipcMain.handle('window:maximize', () => {
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})
ipcMain.handle('window:close', () => win?.close())
ipcMain.handle('window:openExternal', (e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url)
})
ipcMain.handle('dialog:pickJava', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'java.exe seç',
    properties: ['openFile'],
    filters: [{ name: 'Java', extensions: ['exe'] }]
  })
  return res.canceled ? null : res.filePaths[0]
})
ipcMain.handle('app:openRoot', () => shell.openPath(rootDir))

app.whenReady().then(() => {
  ensureDirs()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
