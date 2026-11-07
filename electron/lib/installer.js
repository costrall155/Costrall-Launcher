'use strict'
const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const AdmZip = require('adm-zip')
const { fetchJson, download, pool, ensureDir, fileMatches, linkOrCopy } = require('./net')
const { mavenPath } = require('./mcmeta')

const RESOURCES = 'https://resources.download.minecraft.net'

function objectPath(assetsDir, hash) {
  return path.join(assetsDir, 'objects', hash.slice(0, 2), hash)
}

class Installer {
  constructor({ meta, rootDir, officialDir, send }) {
    this.meta = meta
    this.rootDir = rootDir
    this.officialDir = officialDir
    this.send = send || (() => {})
    this.cancelled = false
  }

  log(message, level = 'info') {
    this.send('install:log', { message, level })
  }

  progress(phase, current, total, extra = {}) {
    this.send('install:progress', { phase, current, total, ...extra })
  }

  official(rel) {
    if (!this.officialDir) return null
    return path.join(this.officialDir, rel)
  }

  async install(instance, version) {
    const gameDir = instance.gameDir
    const versionsDir = path.join(this.rootDir, 'versions')
    const libsDir = path.join(this.rootDir, 'libraries')
    const assetsDir = path.join(this.rootDir, 'assets')
    await ensureDir(versionsDir)
    await ensureDir(libsDir)
    await ensureDir(assetsDir)
    await ensureDir(gameDir)

    const videoId = version.id
    const versionDir = path.join(versionsDir, videoId)
    await ensureDir(versionDir)
    const versionFile = path.join(versionDir, `${videoId}.json`)
    const json = { ...version }
    if (json.inheritsFrom) {
      const base = await this.meta.versionJson(json.inheritsFrom)
      for (const key of ['assetIndex', 'assets', 'downloads', 'javaVersion', 'logging', 'complianceLevel', 'minimumLauncherVersion']) {
        if (json[key] == null && base[key] != null) json[key] = base[key]
      }
      if (!json.downloads?.client) json.downloads = { ...(json.downloads || {}), client: base.downloads?.client }
      if (!json.assetIndex) json.assetIndex = base.assetIndex
    }
    fs.writeFileSync(versionFile, JSON.stringify(json, null, 2))

    // 1. client jar
    this.progress('client', 0, 1)
    const client = json.downloads?.client
    if (client?.url) {
      const jarPath = path.join(versionDir, `${videoId}.jar`)
      const baseJar = json.inheritsFrom ? path.join(versionsDir, json.inheritsFrom, `${json.inheritsFrom}.jar`) : null
      await download(client.url, jarPath, {
        sha1: client.sha1,
        size: client.size,
        fallbackPaths: [json.inheritsFrom ? this.official(path.join('versions', json.inheritsFrom, `${json.inheritsFrom}.jar`)) : null],
        onProgress: (c, t) => this.progress('client', c, t)
      })
      // Fabric needs the vanilla jar too
      if (baseJar && !fs.existsSync(baseJar)) {
        const base = await this.meta.versionJson(json.inheritsFrom)
        if (base.downloads?.client?.url) {
          await download(base.downloads.client.url, baseJar, {
            sha1: base.downloads.client.sha1,
            size: base.downloads.client.size,
            fallbackPaths: [this.official(path.join('versions', json.inheritsFrom, `${json.inheritsFrom}.jar`))]
          })
        }
      }
    }
    this.progress('client', 1, 1)

    // 2. libraries
    const libs = this.meta.libraries(json)
    let done = 0
    const totalLibs = libs.length
    const byteTotal = libs.reduce((sum, l) => sum + (l.size || 0), 0)
    let byteDone = 0
    this.progress('libraries', 0, totalLibs, { bytes: 0, byteTotal })
    await pool(libs, 8, async (lib) => {
      if (this.cancelled) return
      const dest = path.join(libsDir, lib.relPath)
      const officialPath = this.official(path.join('libraries', lib.relPath))
      const res = await download(lib.url, dest, {
        sha1: lib.sha1,
        size: lib.size,
        fallbackPaths: [officialPath]
      })
      done++
      byteDone += lib.size || 0
      this.progress('libraries', done, totalLibs, { bytes: byteDone, byteTotal })
    })
    this.log(`${totalLibs} kütüphane hazır.`)

    // 3. natives extraction
    const nativesDir = path.join(instance.gameDir, 'natives', videoId)
    await ensureDir(nativesDir)
    for (const lib of libs.filter((l) => l.natives)) {
      const jar = path.join(libsDir, lib.relPath)
      if (!fs.existsSync(jar)) continue
      try {
        const zip = new AdmZip(jar)
        for (const entry of zip.getEntries()) {
          if (entry.isDirectory) continue
          const name = entry.entryName
          if (lib.natives.exclude.some((ex) => name.startsWith(ex))) continue
          const out = path.join(nativesDir, name)
          await ensureDir(path.dirname(out))
          fs.writeFileSync(out, entry.getData())
        }
      } catch (e) {
        this.log(`Native çıkarma hatası (${lib.name}): ${e.message}`, 'warn')
      }
    }

    // 4. assets
    if (json.assetIndex) {
      const indexUrl = json.assetIndex.url
      const indexFile = path.join(assetsDir, 'indexes', `${json.assetIndex.id}.json`)
      await download(indexUrl, indexFile, {
        sha1: json.assetIndex.sha1,
        size: json.assetIndex.size,
        fallbackPaths: [this.official(path.join('assets', 'indexes', `${json.assetIndex.id}.json`))]
      })
      const index = JSON.parse(await fsp.readFile(indexFile, 'utf8'))
      const objects = Object.values(index.objects || {})
      const unique = new Map()
      for (const obj of objects) if (!unique.has(obj.hash)) unique.set(obj.hash, obj)
      const list = [...unique.values()]
      let adone = 0
      let aBytes = 0
      const aTotal = list.reduce((s, o) => s + (o.size || 0), 0)
      this.progress('assets', 0, list.length, { bytes: 0, byteTotal: aTotal })
      await pool(list, 24, async (obj) => {
        if (this.cancelled) return
        const dest = objectPath(assetsDir, obj.hash)
        await download(`${RESOURCES}/${obj.hash.slice(0, 2)}/${obj.hash}`, dest, {
          sha1: obj.hash,
          size: obj.size,
          fallbackPaths: [this.official(path.join('assets', 'objects', obj.hash.slice(0, 2), obj.hash))]
        })
        adone++
        aBytes += obj.size || 0
        this.progress('assets', adone, list.length, { bytes: aBytes, byteTotal: aTotal })
      })
      this.log(`${list.length} asset hazır.`)
    }

    // 5. logging config
    const logging = json.logging?.client
    if (logging?.file?.url) {
      const dest = path.join(assetsDir, 'log_configs', logging.file.id)
      await download(logging.file.url, dest, { sha1: logging.file.sha1, size: logging.file.size })
      json._loggingFile = dest
    }

    this.progress('done', 1, 1)
    return json
  }
}

module.exports = { Installer, objectPath, RESOURCES }
