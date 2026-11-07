const path = require('path')
const fs = require('fs')
const os = require('os')
const { Meta } = require('../electron/lib/mcmeta')
const { findJava, buildLaunch } = require('../electron/lib/launcher')
const modrinth = require('../electron/lib/modrinth')

async function main() {
  const cache = path.join(os.tmpdir(), 'costrall-test-cache')
  const meta = new Meta({ cacheDir: cache, officialDir: path.join(process.env.APPDATA || '', '.minecraft') })
  const manifest = await meta.manifest()
  console.log('manifest versions:', manifest.versions.length, 'latest:', manifest.latest.release)
  const target = process.argv[2] || manifest.latest.release
  const base = await meta.versionJson(target)
  console.log('version json:', base.id, '| main:', base.mainClass, '| libs:', base.libraries.length, '| assets:', base.assetIndex?.id)
  const loaders = await meta.fabricLoaders(target)
  console.log('fabric loaders:', loaders.length, 'stable:', loaders.find((l) => l.stable)?.version)
  const stable = loaders.find((l) => l.stable) || loaders[0]
  const merged = await meta.resolve(target, 'fabric', stable.version)
  console.log('fabric merged main:', merged.mainClass, '| libs:', merged.libraries.length, '| jvm args:', merged.arguments?.jvm?.length)
  const libs = meta.libraries(merged)
  console.log('resolved library artifacts:', libs.length, 'natives:', libs.filter((l) => l.natives).length)
  const javas = findJava()
  console.log('java:', javas.slice(0, 3))
  const inst = { gameDir: path.join(os.tmpdir(), 'costrall-test-instance') }
  const built = buildLaunch(inst, merged, { name: 'Test', uuid: '00000000-0000-0000-0000-000000000000', accessToken: 'x', type: 'offline' }, { ram: 4096, width: 1280, height: 720, jvmArgs: '' }, { rootDir: path.join(os.tmpdir(), 'costrall-test-root'), assetsDir: path.join(os.tmpdir(), 'costrall-test-assets'), javaPath: javas[0]?.path })
  console.log('launch args head:', built.args.slice(0, 12).join(' '))
  console.log('has main class:', built.args.includes(merged.mainClass))
  const search = await modrinth.search({ query: 'sodium', gameVersion: target, loader: 'fabric', limit: 3 })
  console.log('modrinth:', search.total, search.hits.map((h) => h.title).join(', '))
  const vers = await modrinth.versions(search.hits[0].id, { gameVersion: target, loader: 'fabric' })
  console.log('sodium versions for target:', vers.length, vers[0]?.version_number)
}
main().catch((e) => { console.error('FAIL', e); process.exit(1) })
