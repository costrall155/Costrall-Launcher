'use strict'
const { app } = require('electron')
const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  settings: {
    ram: 4096,
    javaPath: '',
    jvmArgs: '',
    width: 1280,
    height: 720,
    fullscreen: false,
    keepOpen: true,
    showConsole: true,
    effects: true,
    language: 'tr',
    setupDone: false
  },
  accounts: [],
  activeAccount: null,
  instances: [],
  selectedInstance: null
}

let state = null
let filePath = null

function storeFile() {
  if (!filePath) filePath = path.join(app.getPath('userData'), 'costrall.json')
  return filePath
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function load() {
  if (state) return state
  try {
    const raw = fs.readFileSync(storeFile(), 'utf8')
    const parsed = JSON.parse(raw)
    state = { ...clone(DEFAULTS), ...parsed, settings: { ...clone(DEFAULTS.settings), ...(parsed.settings || {}) } }
  } catch {
    state = clone(DEFAULTS)
  }
  return state
}

function save() {
  const dir = path.dirname(storeFile())
  fs.mkdirSync(dir, { recursive: true })
  const tmp = storeFile() + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8')
  fs.renameSync(tmp, storeFile())
}

function get() {
  return load()
}

module.exports = { get, save, storeFile }
