'use strict'
const fs = require('fs')
const fsp = fs.promises
const path = require('path')
const crypto = require('crypto')

const USER_AGENT = 'CostrallLauncher/1.0 (Electron)'

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...(opts.headers || {}) }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`)
  return res.json()
}

async function fetchText(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) } })
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${url}`)
  return res.text()
}

function sha1File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1')
    const stream = fs.createReadStream(file)
    stream.on('error', reject)
    stream.on('data', (c) => hash.update(c))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true })
}

async function fileMatches(file, sha1, size) {
  try {
    const st = await fsp.stat(file)
    if (size != null && st.size !== size) return false
    if (!sha1) return true
    return (await sha1File(file)) === sha1.toLowerCase()
  } catch {
    return false
  }
}

async function linkOrCopy(src, dest) {
  try {
    await ensureDir(path.dirname(dest))
    try {
      await fsp.link(src, dest)
    } catch {
      await fsp.copyFile(src, dest)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Download a file with optional sha1 verification and progress callback.
 * Returns { skipped: boolean, bytes: number }
 */
async function download(url, dest, opts = {}) {
  const { sha1, size, onProgress, fallbackPaths = [], retries = 2 } = opts
  if (await fileMatches(dest, sha1, size)) {
    if (onProgress) onProgress(size || (await fsp.stat(dest)).size, size || 0)
    return { skipped: true, bytes: size || 0 }
  }
  for (const p of fallbackPaths) {
    if (p && (await fileMatches(p, sha1, size))) {
      if (await linkOrCopy(p, dest)) {
        if (onProgress) onProgress(size || (await fsp.stat(dest)).size, size || 0)
        return { skipped: true, bytes: size || 0 }
      }
    }
  }
  await ensureDir(path.dirname(dest))
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} - ${url}`)
      const tmp = dest + '.part'
      const out = fs.createWriteStream(tmp)
      const hash = sha1 ? crypto.createHash('sha1') : null
      let received = 0
      const reader = res.body.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          received += value.length
          if (hash) hash.update(value)
          if (!out.write(Buffer.from(value))) {
            await new Promise((r) => out.once('drain', r))
          }
          if (onProgress) onProgress(received, size || Number(res.headers.get('content-length')) || 0)
        }
      } finally {
        out.end()
        await new Promise((r) => out.once('close', r))
      }
      if (hash && sha1 && hash.digest('hex') !== sha1.toLowerCase()) {
        await fsp.unlink(tmp).catch(() => {})
        throw new Error(`Hash mismatch: ${url}`)
      }
      await fsp.rename(tmp, dest)
      return { skipped: false, bytes: received }
    } catch (e) {
      lastError = e
      if (attempt < retries) await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
    }
  }
  throw lastError
}

async function pool(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = index++
      if (i >= items.length) return
      results[i] = await worker(items[i], i)
    }
  })
  await Promise.all(runners)
  return results
}

module.exports = { fetchJson, fetchText, download, sha1File, pool, ensureDir, USER_AGENT, fileMatches, linkOrCopy }
