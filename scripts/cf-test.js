'use strict'
const path = require('path')
const fs = require('fs')
const os = require('os')
const cf = require('../electron/lib/curseforge')

;(async () => {
  const res = await cf.search({ query: 'jei', gameVersion: '1.21.11', loader: 'fabric', offset: 0, limit: 6, sort: 'downloads' })
  console.log('SEARCH total', res.total)
  console.log(res.hits.map((h) => `${h.id} | ${h.title} | ${h.downloads} | ${h.icon ? 'icon' : 'no-icon'}`).join('\n'))

  const p = await cf.project(res.hits[0].id)
  console.log('PROJECT', p.name, p.slug, p.downloadCount)

  const files = await cf.files(res.hits[0].id, { gameVersion: '1.21.11', loader: 'fabric' })
  console.log('FILES', files.length, files[0] && files[0].fileName)

  const dir = path.join(os.tmpdir(), 'costrall-cf-test-' + Date.now())
  fs.mkdirSync(dir, { recursive: true })
  const inst = { gameDir: dir }
  const installed = await cf.installMod(inst, res.hits[0].id, {
    gameVersion: '1.21.11',
    loader: 'fabric',
    onLog: (m) => console.log('  log:', m)
  })
  console.log('INSTALLED', installed.map((i) => i.filename))
  console.log('DISK', fs.readdirSync(path.join(dir, 'mods')).map((f) => `${f} (${fs.statSync(path.join(dir, 'mods', f)).size} B)`))
})().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
