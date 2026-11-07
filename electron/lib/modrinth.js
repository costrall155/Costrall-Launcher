'use strict'
const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const API = 'https://api.modrinth.com/v2'
const USER_AGENT = 'CostrallLauncher/1.0 (github.com/costrall)'

async function api(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Modrinth hatası (${res.status}): ${text.slice(0, 200)}`)
  }
  return res.json()
}

function facets({ gameVersion, loader }) {
  const list = [['project_type:mod']]
  if (loader && loader !== 'vanilla') list.push([`categories:${loader}`])
  if (gameVersion) list.push([`versions:${gameVersion}`])
  return JSON.stringify(list)
}

async function search({ query = '', gameVersion, loader, offset = 0, limit = 24, sort = 'downloads' }) {
  const index = sort === 'updated' ? 'updated' : sort === 'name' ? 'relevance' : sort === 'relevance' && query ? 'relevance' : 'downloads'
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    offset: String(offset),
    index: query && sort === 'relevance' ? 'relevance' : index,
    facets: facets({ gameVersion, loader })
  })
  const data = await api(`/search?${params.toString()}`)
  return {
    total: data.total_hits,
    hits: (data.hits || []).map((h) => ({
      id: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      icon: h.icon_url,
      downloads: h.downloads,
      follows: h.follows,
      author: h.author,
      categories: h.categories,
      versions: h.versions,
      featured: h.featured
    }))
  }
}

async function versions(projectId, { gameVersion, loader }) {
  const params = new URLSearchParams()
  if (gameVersion) params.set('game_versions', JSON.stringify([gameVersion]))
  if (loader && loader !== 'vanilla') params.set('loaders', JSON.stringify([loader]))
  const data = await api(`/project/${encodeURIComponent(projectId)}/version?${params.toString()}`)
  return data
}

async function project(projectId) {
  return api(`/project/${encodeURIComponent(projectId)}`)
}

async function installMod(instance, projectId, { gameVersion, loader, onLog }) {
  const log = onLog || (() => {})
  const vers = await versions(projectId, { gameVersion, loader })
  if (!vers.length) throw new Error('Bu sürüm için uyumlu mod sürümü bulunamadı')
  const v = vers.sort((a, b) => new Date(b.date_published) - new Date(a.date_published))[0]
  const file = (v.files || []).find((f) => f.primary) || v.files?.[0]
  if (!file) throw new Error('Mod dosyası bulunamadı')
  const modsDir = path.join(instance.gameDir, 'mods')
  await fsp.mkdir(modsDir, { recursive: true })
  const dest = path.join(modsDir, file.filename)
  const installed = []
  if (!fs.existsSync(dest)) {
    const res = await fetch(file.url, { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`İndirme hatası (${res.status})`)
    const buf = Buffer.from(await res.arrayBuffer())
    await fsp.writeFile(dest, buf)
    log(`${file.filename} indirildi`)
  } else {
    log(`${file.filename} zaten kurulu`)
  }
  installed.push({ filename: file.filename, projectId, title: v.name, version: v.version_number })

  for (const dep of v.dependencies || []) {
    if (dep.dependency_type !== 'required' || !dep.project_id) continue
    try {
      const extra = await installMod(instance, dep.project_id, { gameVersion, loader, onLog })
      installed.push(...extra)
    } catch (e) {
      log(`Bağımlılık kurulamadı: ${e.message}`)
    }
  }
  return installed
}

async function listInstalled(instance) {
  const dir = path.join(instance.gameDir, 'mods')
  try {
    const files = await fsp.readdir(dir)
    return files.filter((f) => f.toLowerCase().endsWith('.jar'))
  } catch {
    return []
  }
}

async function removeMod(instance, filename) {
  const target = path.join(instance.gameDir, 'mods', path.basename(filename))
  await fsp.unlink(target).catch(() => {})
}

async function installFromUrl(instance, url, { onLog } = {}) {
  const log = onLog || (() => {})
  let parsed
  try {
    parsed = new URL(String(url).trim())
  } catch {
    throw new Error('Geçersiz URL')
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Sadece http/https bağlantıları destekleniyor')
  let filename = path.basename(decodeURIComponent(parsed.pathname))
  if (!filename.toLowerCase().endsWith('.jar')) throw new Error('Bağlantı doğrudan bir .jar dosyasına işaret etmeli')
  filename = filename.replace(/[^\w.\-+ ()]/g, '_')
  const modsDir = path.join(instance.gameDir, 'mods')
  await fsp.mkdir(modsDir, { recursive: true })
  const dest = path.join(modsDir, filename)
  const res = await fetch(parsed.toString(), { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`İndirme hatası (${res.status})`)
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error('İndirilen dosya geçerli bir .jar değil (ZIP imzası yok)')
  const tmp = dest + '.part'
  await fsp.writeFile(tmp, buf)
  await fsp.rename(tmp, dest)
  log(`${filename} indirildi`)
  return [{ filename, projectId: null, title: filename, version: 'url', source: 'url' }]
}

async function installFromFiles(instance, filePaths, { onLog } = {}) {
  const log = onLog || (() => {})
  const modsDir = path.join(instance.gameDir, 'mods')
  await fsp.mkdir(modsDir, { recursive: true })
  const installed = []
  for (const src of filePaths) {
    if (!src.toLowerCase().endsWith('.jar')) continue
    const filename = path.basename(src)
    const dest = path.join(modsDir, filename)
    if (path.resolve(src) !== path.resolve(dest)) await fsp.copyFile(src, dest)
    log(`${filename} eklendi`)
    installed.push({ filename, projectId: null, title: filename, version: 'local', source: 'local' })
  }
  if (!installed.length) throw new Error('Seçilen dosyalar arasında .jar bulunamadı')
  return installed
}

module.exports = { search, versions, project, installMod, listInstalled, removeMod, installFromUrl, installFromFiles }
