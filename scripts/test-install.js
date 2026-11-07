const path = require('path')
const fs = require('fs')
const os = require('os')
const { Meta } = require('../electron/lib/mcmeta')
const { Installer } = require('../electron/lib/installer')
const { launch, findJava, pickJava } = require('../electron/lib/launcher')

const rootDir = path.join(os.tmpdir(), 'costrall-run', 'minecraft')
const instance = { id: 'test', gameDir: path.join(rootDir, 'instances', 'test') }
const officialDir = path.join(process.env.APPDATA || '', '.minecraft')

async function main() {
  fs.mkdirSync(instance.gameDir, { recursive: true })
  const meta = new Meta({ cacheDir: path.join(rootDir, 'meta'), officialDir })
  const version = await meta.resolve('1.21.11', 'fabric')
  console.log('resolved', version.id, 'main', version.mainClass)
  let last = 0
  const installer = new Installer({
    meta, rootDir, officialDir,
    send: (ch, data) => {
      if (ch === 'install:progress') {
        const now = Date.now()
        if (now - last > 2500 || data.phase === 'done') {
          last = now
          console.log(`[${data.phase}] ${data.current}/${data.total}`, data.byteTotal ? `${Math.round((data.bytes / data.byteTotal) * 100)}%` : '')
        }
      } else if (ch === 'install:log') {
        console.log('[log]', data.message)
      }
    }
  })
  const json = await installer.install(instance, version)
  console.log('INSTALL OK, logging file:', json._loggingFile)
  if (process.argv.includes('--run')) {
    const javas = findJava()
    const java = pickJava(javas, json.javaVersion?.majorVersion)
    console.log('launching with', java.path)
    let out = 0
    const child = launch(instance, json, { name: 'TestPlayer', uuid: '00000000-0000-0000-0000-000000000000', accessToken: '0'.repeat(32), type: 'offline' },
      { ram: 4096, width: 1280, height: 720, jvmArgs: '' },
      { rootDir, assetsDir: path.join(rootDir, 'assets'), javaPath: java.path },
      {
        log: (m, l) => { out++; if (out < 60 || l === 'error') console.log('[game]', m.slice(0, 300)) },
        error: (e) => console.log('[game:error]', e.message),
        exit: (c) => console.log('[game:exit]', c)
      })
    setTimeout(() => { console.log('--- killing after 30s ---'); child.kill() }, 30000)
    child.on('close', () => process.exit(0))
  }
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
