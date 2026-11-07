'use strict'
const fs = require('fs')
const path = require('path')
const { fetchJson, download, ensureDir } = require('./net')

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const FABRIC_META = 'https://meta.fabricmc.net/v2'

function mavenPath(name) {
  // group:artifact:version[:classifier][@ext]
  let ext = 'jar'
  let raw = name
  const at = raw.indexOf('@')
  if (at !== -1) {
    ext = raw.slice(at + 1)
    raw = raw.slice(0, at)
  }
  const parts = raw.split(':')
  const group = parts[0]
  const artifact = parts[1]
  const version = parts[2]
  const classifier = parts[3]
  const file = `${artifact}-${version}${classifier ? '-' + classifier : ''}.${ext}`
  return `${group.replace(/\./g, '/')}/${artifact}/${version}/${file}`
}

function rulesAllow(rules, features = {}) {
  if (!rules || rules.length === 0) return true
  let allowed = false
  for (const rule of rules) {
    let match = true
    if (rule.os) {
      const os = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
      if (rule.os.name && rule.os.name !== os) match = false
      if (match && rule.os.arch && rule.os.arch !== 'x86' && process.arch !== 'x64' && process.arch !== 'arm64') match = false
      if (match && rule.os.arch === 'x86' && process.arch !== 'ia32') match = false
      if (match && rule.os.version) {
        try {
          if (!new RegExp(rule.os.version).test(require('os').release())) match = false
        } catch {
          match = false
        }
      }
    }
    if (match && rule.features) {
      for (const [key, value] of Object.entries(rule.features)) {
        if (Boolean(features[key]) !== Boolean(value)) {
          match = false
          break
        }
      }
    }
    if (match) allowed = rule.action === 'allow'
  }
  return allowed
}

function mergeArguments(a = {}, b = {}) {
  const out = {}
  for (const key of ['game', 'jvm']) {
    const list = []
    for (const item of [...(a[key] || []), ...(b[key] || [])]) {
      if (typeof item === 'string') {
        if (item === '-DFabricMcEmu= net.minecraft.client.main.Main' && list.includes(item)) continue
        list.push(item)
      } else {
        const sig = JSON.stringify(item)
        if (!list.some((x) => typeof x === 'object' && JSON.stringify(x) === sig)) list.push(item)
      }
    }
    out[key] = list
  }
  return out
}

class Meta {
  constructor({ cacheDir, officialDir }) {
    this.cacheDir = cacheDir
    this.officialDir = officialDir
    this.mem = new Map()
  }

  async manifest() {
    if (this.mem.has('manifest')) return this.mem.get('manifest')
    const data = await fetchJson(MANIFEST_URL)
    this.mem.set('manifest', data)
    return data
  }

  async versionEntry(id) {
    const manifest = await this.manifest()
    const entry = manifest.versions.find((v) => v.id === id)
    if (!entry) throw new Error(`Sürüm bulunamadı: ${id}`)
    return entry
  }

  async versionJson(id) {
    const key = `version:${id}`
    if (this.mem.has(key)) return this.mem.get(key)
    const file = path.join(this.cacheDir, 'versions', `${id}.json`)
    let data
    if (fs.existsSync(file)) {
      try {
        data = JSON.parse(fs.readFileSync(file, 'utf8'))
      } catch {
        data = null
      }
    }
    if (!data) {
      const entry = await this.versionEntry(id)
      data = await fetchJson(entry.url)
      await ensureDir(path.dirname(file))
      fs.writeFileSync(file, JSON.stringify(data, null, 2))
    }
    this.mem.set(key, data)
    return data
  }

  async fabricLoaders(gameVersion) {
    const key = `fabric:${gameVersion}`
    if (this.mem.has(key)) return this.mem.get(key)
    const data = await fetchJson(`${FABRIC_META}/versions/loader/${encodeURIComponent(gameVersion)}`)
    const loaders = data
      .filter((x) => x.loader && x.loader.version)
      .map((x) => ({ version: x.loader.version, stable: !!x.loader.stable }))
    this.mem.set(key, loaders)
    return loaders
  }

  async fabricProfile(gameVersion, loaderVersion) {
    const key = `fabricprofile:${gameVersion}:${loaderVersion}`
    if (this.mem.has(key)) return this.mem.get(key)
    const data = await fetchJson(`${FABRIC_META}/versions/loader/${encodeURIComponent(gameVersion)}/${encodeURIComponent(loaderVersion)}/profile/json`)
    this.mem.set(key, data)
    return data
  }

  async resolve(id, loader = 'vanilla', loaderVersion = null) {
    const base = await this.versionJson(id)
    if (!loader || loader === 'vanilla') return { ...base }
    if (loader === 'fabric') {
      let lv = loaderVersion
      if (!lv) {
        const loaders = await this.fabricLoaders(id)
        lv = (loaders.find((l) => l.stable) || loaders[0])?.version
      }
      if (!lv) throw new Error('Fabric loader sürümü bulunamadı')
      const profile = await this.fabricProfile(id, lv)
      const mergedLibraries = [...(base.libraries || []), ...(profile.libraries || [])]
      return {
        ...base,
        id: `${id}-fabric-${lv}`,
        mainClass: profile.mainClass || base.mainClass,
        libraries: mergedLibraries,
        arguments: mergeArguments(base.arguments, profile.arguments),
        inheritsFrom: id,
        fabricLoader: lv,
        type: 'release'
      }
    }
    throw new Error('Desteklenmeyen loader: ' + loader)
  }

  libraries(version) {
    const out = []
    for (const lib of version.libraries || []) {
      if (!rulesAllow(lib.rules)) continue
      const artifact = lib.downloads?.artifact
      if (artifact?.url) {
        out.push({
          name: lib.name,
          relPath: artifact.path,
          url: artifact.url,
          sha1: artifact.sha1,
          size: artifact.size,
          natives: null
        })
      } else if (lib.name && lib.url) {
        const rel = mavenPath(lib.name)
        out.push({
          name: lib.name,
          relPath: rel,
          url: lib.url.replace(/\/?$/, '/') + rel,
          sha1: null,
          size: null,
          natives: null
        })
      }
      const natives = lib.natives
      if (natives) {
        const osKey = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'osx' : 'linux'
        const classifier = natives[osKey]
        if (classifier) {
          const key = `natives-${classifier}`
          const nativeArtifact = lib.downloads?.classifiers?.[key]
          if (nativeArtifact?.url) {
            out.push({
              name: lib.name,
              relPath: nativeArtifact.path,
              url: nativeArtifact.url,
              sha1: nativeArtifact.sha1,
              size: nativeArtifact.size,
              natives: { exclude: lib.extract?.exclude || ['META-INF/'] }
            })
          } else if (lib.name) {
            const baseName = lib.name.split(':').slice(0, 3).join(':').replace(/@.*$/, '')
            const rel = mavenPath(`${baseName}:${classifier}`)
            out.push({
              name: lib.name,
              relPath: rel,
              url: (lib.url || 'https://libraries.minecraft.net/').replace(/\/?$/, '/') + rel,
              sha1: null,
              size: null,
              natives: { exclude: lib.extract?.exclude || ['META-INF/'] }
            })
          }
        }
      }
    }
    return out
  }

  assetIndex(version) {
    return version.assetIndex || null
  }
}

function libraryPaths(version) {
  const out = []
  for (const lib of version.libraries || []) {
    if (!rulesAllow(lib.rules)) continue
    if (lib.downloads?.artifact?.path) out.push(lib.downloads.artifact.path)
    else if (lib.name && lib.url) out.push(mavenPath(lib.name))
  }
  return out
}

module.exports = { Meta, mavenPath, rulesAllow, libraryPaths }
