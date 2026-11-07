const fs = require('fs')
const sharp = require('sharp')

async function main() {
  const svg = fs.readFileSync('build/icon.svg')
  await sharp(svg).resize(512, 512).png().toFile('build/icon.png')
  fs.copyFileSync('build/icon.png', 'assets/icon.png')
  console.log('icon generated')
}
main().catch((e) => { console.error(e); process.exit(1) })
