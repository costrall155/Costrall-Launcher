'use strict'
const fs = require('fs')
const path = require('path')
const { spawn, spawnSync, execFileSync } = require('child_process')
const { rulesAllow } = require('./mcmeta')

function expandArgs(items, values, features) {
  const out = []
  for (const item of items || []) {
    if (typeof item === 'string') {
      out.push(replaceVars(item, values))
    } else if (item && typeof item === 'object') {
      if (!rulesAllow(item.rules, features)) continue
      const value = Array.isArray(item.value) ? item.value : [item.value]
      for (const v of value) out.push(replaceVars(v, values))
    }
  }
  return out
}

function replaceVars(str, values) {
  if (typeof str !== 'string') return str
  return str.replace(/\$\{([^}]+)\}/g, (m, key) => {
    const v = values[key]
    return v == null ? '' : String(v)
  })
}

function findJava(settingsPath) {
  const candidates = []
  if (settingsPath && fs.existsSync(settingsPath)) candidates.push(settingsPath)
  if (process.env.JAVA_HOME) candidates.push(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'))
  const roots = ['C:\\Program Files\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft']
  for (const root of roots) {
    try {
      for (const dir of fs.readdirSync(root)) {
        candidates.push(path.join(root, dir, 'bin', 'java.exe'))
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const where = execFileSync('where', ['java'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
    candidates.push(...where)
  } catch {
    /* ignore */
  }
  const seen = new Set()
  const valid = []
  for (const c of candidates) {
    const norm = path.resolve(c)
    if (seen.has(norm)) continue
    seen.add(norm)
    if (!fs.existsSync(norm)) continue
    try {
      const r = spawnSync(norm, ['-version'], { encoding: 'utf8', timeout: 8000 })
      const text = `${r.stdout || ''}\n${r.stderr || ''}`
      const m = text.match(/version "(\d+)(?:\.(\d+))?/)
      if (m) valid.push({ path: norm, major: Number(m[1]), version: m[0] })
    } catch {
      /* ignore */
    }
  }
  valid.sort((a, b) => b.major - a.major)
  return valid
}

function buildLaunch(instance, version, account, settings, { rootDir, assetsDir, javaPath }) {
  const libsDir = path.join(rootDir, 'libraries')
  const versionDir = path.join(rootDir, 'versions', version.id)
  const nativesDir = path.join(instance.gameDir, 'natives', version.id)
  const jarPath = path.join(versionDir, `${version.id}.jar`)
  const clientJar = fs.existsSync(jarPath)
    ? jarPath
    : path.join(rootDir, 'versions', version.inheritsFrom || version.id, `${version.inheritsFrom || version.id}.jar`)

  const cp = []
  for (const rel of require('./mcmeta').libraryPaths(version)) {
    const p = path.join(libsDir, rel)
    if (fs.existsSync(p)) cp.push(p)
  }
  if (fs.existsSync(clientJar)) cp.push(clientJar)

  const features = {
    is_demo_user: false,
    has_custom_resolution: !!(settings.width && settings.height),
    has_quick_plays_support: false,
    is_quick_play_singleplayer: false,
    is_quick_play_multiplayer: false,
    is_quick_play_realms: false
  }

  const values = {
    auth_player_name: account.name,
    version_name: version.id,
    game_directory: instance.gameDir,
    assets_root: assetsDir,
    assets_index_name: version.assetIndex?.id || version.assets || 'legacy',
    auth_uuid: account.uuid,
    auth_access_token: account.accessToken || '0',
    auth_session: account.accessToken || '0',
    clientid: 'costrall',
    auth_xuid: account.xuid || '',
    user_type: account.type === 'microsoft' ? 'msa' : 'legacy',
    version_type: version.type || 'release',
    natives_directory: nativesDir,
    launcher_name: 'Costrall',
    launcher_version: '1.0.0',
    classpath: cp.join(';'),
    classpath_separator: ';',
    library_directory: libsDir,
    resolution_width: String(settings.width || 1280),
    resolution_height: String(settings.height || 720)
  }

  const jvm = []
  const minRam = Math.min(1024, Math.floor((settings.ram || 4096) / 4))
  jvm.push(`-Xmx${settings.ram || 4096}M`, `-Xms${minRam}M`)
  if (settings.fullscreen) jvm.push('-Dorg.lwjgl.opengl.Display.allowSoftwareOpenGL=false')
  jvm.push(`-Djava.library.path=${nativesDir}`)

  const versionJvm = expandArgs(version.arguments?.jvm, values, features)
  for (let i = 0; i < versionJvm.length; i++) {
    const a = versionJvm[i]
    if (a === '-cp' || a === '-classpath' || a === '--class-path') { i++; continue }
    if (a === values.classpath) continue
    if (a.startsWith('-Djava.library.path')) continue
    jvm.push(a)
  }
  if (version._loggingFile) {
    const arg = replaceVars(version.logging?.client?.argument || '-Dlog4j.configurationFile=${path}', { path: version._loggingFile })
    jvm.push(arg)
  }
  if (settings.jvmArgs) jvm.push(...String(settings.jvmArgs).split(/\s+/).filter(Boolean))

  let game
  if (version.arguments?.game) {
    game = expandArgs(version.arguments.game, values, features)
  } else if (version.minecraftArguments) {
    game = version.minecraftArguments.split(/\s+/).map((a) => replaceVars(a, values))
  } else {
    game = []
  }

  const args = [...jvm, '-cp', values.classpath, version.mainClass, ...game]
  return { args, javaPath, cwd: instance.gameDir }
}

function launch(instance, version, account, settings, paths, handlers = {}) {
  const built = buildLaunch(instance, version, account, settings, paths)
  handlers.log?.(`Java: ${built.javaPath}`)
  handlers.log?.(`Komut: ${path.basename(built.javaPath)} ${built.args.slice(0, 6).join(' ')} ...`)
  const child = spawn(built.javaPath, built.args, {
    cwd: built.cwd,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.on('data', (d) => handlers.log?.(d.toString()))
  child.stderr.on('data', (d) => handlers.log?.(d.toString(), 'error'))
  child.on('error', (err) => handlers.error?.(err))
  child.on('close', (code) => handlers.exit?.(code))
  return child
}

function pickJava(list, requiredMajor) {
  if (!list.length) return null
  if (requiredMajor) {
    const exact = list.filter((j) => j.major === requiredMajor)
    if (exact.length) return exact[0]
    const newer = list.filter((j) => j.major > requiredMajor).sort((a, b) => a.major - b.major)
    if (newer.length) return newer[0]
  }
  return list[0]
}

module.exports = { launch, buildLaunch, findJava, pickJava, expandArgs, replaceVars }
