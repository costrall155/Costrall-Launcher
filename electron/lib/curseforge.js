'use strict'
const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const API = 'https://api.curse.tools/v1/cf'
const USER_AGENT = 'CostrallLauncher/1.1 (CurseForge proxy)'
const GAME_ID = 432
const CLASS_MODS = 6

const LOADER_IDS = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 }

function loaderId(loader) {
  return LOADER_IDS[String(loader || '').toLowerCase()] || null
}

const SORTS = { relevance: 2, downloads: 6, updated: 3, name: 4, popularity: 2 }

async function api(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`CurseForge hatası (${res.status}): ${body.slice(0, 160)}`)
  }
  return res.json()
}

function normalizeHit(hit) {
  return {
    id: String(hit.id),
    source: 'curseforge',
    slug: hit.slug,
    title: hit.name,
    description: hit.summary || '',
    icon: hit.logo?.thumbnailUrl || hit.logo?.url || null,
    downloads: hit.downloadCount || 0,
    follows: hit.favoriteCount || hit.thumbsUpCount || 0,
    author: (hit.authors || []).map((a) => a.name).join(', '),
    categories: (hit.categories || []).map((c) => c.name),
    versions: (hit.latestFilesIndexes || []).map((v) => v.gameVersion).filter(Boolean)
  }
}

async function search({ query = '', gameVersion, loader, offset = 0, limit = 24, sort = 'downloads' }) {
  const params = new URLSearchParams({
    gameId: String(GAME_ID),
    classId: String(CLASS_MODS),
    index: String(offset),
    pageSize: String(limit),
    sortField: String(SORTS[sort] || SORTS.downloads),
    sortOrder: 'desc'
  })
  if (query) params.set('searchFilter', query)
  if (gameVersion) params.set('gameVersion', gameVersion)
  const lid = loaderId(loader)
  if (lid) params.set('modLoaderType', String(lid))
  const data = await api(`/mods/search?${params.toString()}`)
  const hits = (data.data || []).filter((m) => m && m.id).map(normalizeHit)
  return {
    total: data.pagination?.totalCount ?? hits.length,
    hits
  }
}

async function project(projectId) {
  const data = await api(`/mods/${encodeURIComponent(projectId)}`)
  return data.data
}

async function files(projectId, { gameVersion, loader } = {}) {
  const params = new URLSearchParams({ pageSize: '50' })
  if (gameVersion) params.set('gameVersion', gameVersion)
  const lid = loaderId(loader)
  if (lid) params.set('modLoaderType', String(lid))
  const data = await api(`/mods/${encodeURIComponent(projectId)}/files?${params.toString()}`)
  return (data.data || [])
    .filter((f) => f && f.isAvailable !== false)
    .sort((a, b) => new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime())
}

function pickFile(list) {
  return list.find((f) => f.releaseType === 1) || list[0]
}

function fileUrl(file) {
  if (file.downloadUrl) return file.downloadUrl
  return `https://edge.forgecdn.net/files/${Math.floor(file.id / 1000)}/${file.id % 1000}/${encodeURIComponent(file.fileName)}`
}

async function installMod(instance, projectId, { gameVersion, loader, onLog, seen } = {}) {
  const log = onLog || (() => {})
  const visited = seen || new Set()
  if (visited.has(String(projectId))) return []
  visited.add(String(projectId))

  const list = await files(projectId, { gameVersion, loader })
  const file = pickFile(list)
  if (!file) throw new Error('Bu sürüm için uyumlu CurseForge dosyası bulunamadı')

  const modsDir = path.join(instance.gameDir, 'mods')
  await fsp.mkdir(modsDir, { recursive: true })
  const dest = path.join(modsDir, path.basename(file.fileName))
  const installed = []
  if (!fs.existsSync(dest)) {
    const res = await fetch(fileUrl(file), { headers: { 'User-Agent': USER_AGENT } })
    if (!res.ok) throw new Error(`İndirme hatası (${res.status})`)
    const buf = Buffer.from(await res.arrayBuffer())
    await fsp.writeFile(dest, buf)
    log(`${file.fileName} indirildi`)
  } else {
    log(`${file.fileName} zaten kurulu`)
  }
  installed.push({
    filename: file.fileName,
    projectId: String(projectId),
    title: file.displayName || file.fileName,
    version: file.displayName || String(file.id),
    source: 'curseforge'
  })

  for (const dep of file.dependencies || []) {
    if (dep.relationType !== 3 || !dep.modId) continue
    try {
      const extra = await installMod(instance, dep.modId, { gameVersion, loader, onLog, seen: visited })
      installed.push(...extra)
    } catch (e) {
      log(`Bağımlılık kurulamadı (${dep.modId}): ${e.message}`)
    }
  }
  return installed
}

module.exports = { search, project, files, installMod, loaderId }
