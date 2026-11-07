'use strict'
const api = window.costrall

const S = {
  info: null,
  settings: null,
  accounts: [],
  active: null,
  instances: [],
  selected: null,
  versions: [],
  latest: null,
  modsInstance: null,
  modSource: 'modrinth',
  modSort: 'downloads',
  modOffset: 0,
  modTotal: 0,
  modQuery: '',
  searchResults: [],
  installed: [],
  launching: false,
  progressStart: 0,
  progressBytes: 0,
  progressTime: 0,
  lastProgress: null
}

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]

function esc(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function fmtBytes(n) {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++ }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtNum(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(n || 0)
}

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m} dk önce`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} saat önce`
  const d = Math.floor(h / 24)
  return `${d} gün önce`
}

function toast(message, type = 'info', ms = 4200) {
  const el = document.createElement('div')
  el.className = `toast ${type}`
  const icon = type === 'success'
    ? '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>'
    : type === 'error'
      ? '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg>'
      : '<svg class="t-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>'
  el.innerHTML = `${icon}<div>${esc(message)}</div>`
  $('#toasts').appendChild(el)
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(20px)'; el.style.transition = 'all .25s' }, ms - 300)
  setTimeout(() => el.remove(), ms)
}

function openModal(html) {
  $('#modal').innerHTML = html
  $('#modal-backdrop').hidden = false
}
function closeModal() {
  $('#modal-backdrop').hidden = true
  $('#modal').innerHTML = ''
}
$('#modal-backdrop').addEventListener('click', (e) => { if (window.__setupLock) return; if (e.target.id === 'modal-backdrop') closeModal() })

/* ============ Navigation ============ */
$$('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.nav-item').forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')
    const page = btn.dataset.page
    $$('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`))
    if (page === 'mods') loadModsPage()
  })
})

/* ============ Window controls ============ */
$('#win-min').onclick = () => api.window.minimize()
$('#win-max').onclick = () => api.window.maximize()
$('#win-close').onclick = () => api.window.close()

/* ============ Account UI ============ */
function avatarUrl(acc) {
  if (!acc) return null
  const key = acc.uuid || acc.name
  if (!key) return null
  return `https://mc-heads.net/avatar/${encodeURIComponent(key)}/64`
}

function renderAccount() {
  const acc = S.accounts.find((a) => a.id === S.active) || null
  const imgEl = $('#account-skin')
  const fallback = $('#account-avatar-fallback')
  const url = avatarUrl(acc)
  if (imgEl && fallback) {
    imgEl.classList.remove('loaded')
    imgEl.onerror = () => { imgEl.classList.remove('loaded') }
    imgEl.onload = () => { if (imgEl.src) imgEl.classList.add('loaded') }
    if (url) imgEl.src = url
    else imgEl.removeAttribute('src')
    fallback.textContent = acc ? (acc.name || '?').slice(0, 1).toUpperCase() : '?'
  } else {
    const av = $('#account-avatar')
    if (av) av.textContent = acc ? (acc.name || '?').slice(0, 1).toUpperCase() : '?'
  }
  const t = window.CostrallI18n?.t || ((k, f) => f || k)
  const nameEl = $('#account-name')
  const typeEl = $('#account-type')
  if (nameEl) nameEl.textContent = acc ? acc.name : t('not_logged_in', 'Giriş yapılmadı')
  if (typeEl) typeEl.textContent = acc ? (acc.type === 'microsoft' ? 'Microsoft' : 'Çevrimdışı') : t('account_add', 'Hesap ekle')
  renderHome()
}

$('#account-card').addEventListener('click', openAccounts)
$('#account-menu').addEventListener('click', (e) => { e.stopPropagation(); openAccounts() })

function openAccounts() {
  const list = S.accounts.length
    ? S.accounts.map((a) => `
      <div class="installed-item" style="padding:11px 12px;cursor:pointer" data-acc="${esc(a.id)}">
        <div class="avatar" style="width:30px;height:30px;border-radius:8px;font-size:12px">
          ${avatarUrl(a) ? `<img src="${esc(avatarUrl(a))}" onerror="this.remove()" />` : esc(a.name.slice(0, 1).toUpperCase())}
        </div>
        <span>${esc(a.name)}<br><small style="color:var(--muted);font-size:10px">${a.type === 'microsoft' ? 'Microsoft' : 'Çevrimdışı'}</small></span>
        ${a.id === S.active ? '<span class="chip violet" style="font-size:9px;padding:3px 7px">AKTİF</span>' : ''}
        <button class="icon-btn" data-remove="${esc(a.id)}" title="Kaldır"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" fill="none"/></svg></button>
      </div>`).join('')
    : '<div class="empty-mini">Henüz hesap eklenmedi.</div>'

  openModal(`
    <h2>Hesaplar</h2>
    <p class="sub">Microsoft hesabınla giriş yap veya çevrimdışı bir isim kullan.</p>
    <div class="installed-list" style="max-height:220px">${list}</div>
    <div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap">
      <button class="btn ghost" id="acc-offline">Çevrimdışı Ekle</button>
      <button class="btn primary" id="acc-ms">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8.5v8.5H3V3Zm9.5 0H21v8.5h-8.5V3ZM3 12.5h8.5V21H3v-8.5Zm9.5 0H21V21h-8.5v-8.5Z"/></svg>
        Microsoft ile Giriş
      </button>
    </div>
  `)

  $('#modal').querySelectorAll('[data-acc]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-remove]')) return
      const res = await api.accounts.setActive(el.dataset.acc)
      S.accounts = res.accounts; S.active = res.active
      renderAccount(); closeModal(); toast('Hesap değiştirildi', 'success')
    })
  })
  $('#modal').querySelectorAll('[data-remove]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation()
      const res = await api.accounts.remove(el.dataset.remove)
      S.accounts = res.accounts; S.active = res.active
      renderAccount(); openAccounts(); toast('Hesap kaldırıldı', 'info', 2200)
    })
  })
  $('#acc-offline')?.addEventListener('click', () => {
    openModal(`
      <h2>Çevrimdışı Hesap</h2>
      <p class="sub">Sunucu çevrimdışı (offline-mode) değilse giriş yapamazsın.</p>
      <div class="field"><label>Kullanıcı adı</label><input class="input" id="offline-name" maxlength="16" placeholder="Steve" /></div>
      <div class="modal-actions"><button class="btn ghost" id="m-cancel">İptal</button><button class="btn primary" id="offline-add">Ekle</button></div>
    `)
    $('#m-cancel').onclick = closeModal
    const add = async () => {
      const name = $('#offline-name').value.trim()
      try {
        const res = await api.accounts.addOffline(name)
        S.accounts = res.accounts; S.active = res.active
        renderAccount(); closeModal(); toast(`${name} eklendi`, 'success')
      } catch (err) { toast(err.message.replace(/^Error:\s*/, ''), 'error') }
    }
    $('#offline-add').onclick = add
    $('#offline-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') add() })
    setTimeout(() => $('#offline-name')?.focus(), 50)
  })
  $('#acc-ms')?.addEventListener('click', startMicrosoft)
}

async function startMicrosoft() {
  openModal(`
    <h2>Microsoft ile Giriş</h2>
    <p class="sub">Tarayıcıda aşağıdaki kodu gir ve hesabını onayla.</p>
    <div class="code-box"><div class="code" id="device-code">····</div><div class="hint" id="device-hint">Kod alınıyor...</div></div>
    <div class="row" style="justify-content:center"><span class="spinner"></span><span class="muted" style="margin-left:8px">Onay bekleniyor...</span></div>
    <div class="modal-actions"><button class="btn ghost" id="ms-cancel">Kapat</button><button class="btn primary" id="ms-open" disabled>Tarayıcıda Aç</button></div>
  `)
  $('#ms-cancel').onclick = closeModal
  const offCode = api.accounts.onCode((data) => {
    $('#device-code').textContent = data.userCode
    $('#device-hint').textContent = 'Bu kod ' + Math.round(data.expiresIn / 60) + ' dakika geçerli'
    const open = $('#ms-open')
    open.disabled = false
    open.onclick = () => api.window.openExternal(data.verificationUri)
  })
  const offDone = api.accounts.onDone((res) => {
    offCode(); offDone()
    if (res.ok) {
      S.accounts = res.accounts; S.active = res.active
      renderAccount(); closeModal(); toast('Microsoft hesabı bağlandı', 'success')
    } else {
      toast(res.error || 'Giriş başarısız', 'error', 6000)
      closeModal()
    }
  })
  try {
    const info = await api.accounts.microsoftStart()
    $('#device-code').textContent = info.userCode
    $('#device-hint').textContent = 'Bu kod ' + Math.round(info.expiresIn / 60) + ' dakika geçerli'
    const open = $('#ms-open')
    open.disabled = false
    open.onclick = () => api.window.openExternal(info.verificationUri)
  } catch (err) {
    toast(err.message.replace(/^Error:\s*/, ''), 'error', 6000)
    closeModal()
  }
}

/* ============ Home ============ */
function selectedInstance() {
  return S.instances.find((i) => i.id === S.selected) || null
}

function renderHome() {
  const inst = selectedInstance()
  $('#hero-instance').textContent = inst ? inst.name : 'Profil yok'
  const chips = $('#hero-chips')
  chips.innerHTML = inst
    ? `<span class="chip violet">Minecraft ${esc(inst.mcVersion)}</span>
       <span class="chip ${inst.loader === 'fabric' ? 'cyan' : ''}">${inst.loader === 'fabric' ? 'Fabric ' + esc(inst.loaderVersion || '') : 'Vanilla'}</span>
       <span class="chip">${inst.installed ? 'Kurulu' : 'İlk açılışta indirilir'}</span>`
    : '<span class="chip">Başlamak için profil oluştur</span>'

  $('#stat-instances').textContent = S.instances.length
  $('#stat-last').textContent = inst?.lastPlayed ? timeAgo(inst.lastPlayed) : '—'
  $('#hero-hint').textContent = !S.active
    ? 'Oynamak için önce bir hesap ekle.'
    : inst
      ? (inst.loader === 'fabric' ? 'Fabric mod desteği aktif.' : 'Vanilla profil. Modlar için Fabric profili oluştur.')
      : 'Profiller sekmesinden yeni bir profil oluştur.'

  const play = $('#hero-play')
  play.classList.toggle('running', S.launching)
  play.querySelector('span').textContent = S.launching ? 'Çalışıyor' : 'Oyna'
}

$('#hero-play').addEventListener('click', () => {
  if (S.launching) { api.game.kill(); return }
  const inst = selectedInstance()
  if (!inst) {
    $$('.nav-item').find((b) => b.dataset.page === 'instances')?.click()
    toast('Önce bir profil oluştur', 'info')
    return
  }
  if (!S.active) { openAccounts(); return }
  launchGame(inst.id)
})

$('#hero-mods').addEventListener('click', () => {
  const inst = selectedInstance()
  if (!inst) { toast('Önce bir profil oluştur', 'info'); return }
  if (inst.loader !== 'fabric') { toast('Modlar için Fabric profili gerekli', 'error'); return }
  S.modsInstance = inst.id
  $$('.nav-item').find((b) => b.dataset.page === 'mods')?.click()
})

$('#home-open-folder').addEventListener('click', () => {
  const inst = selectedInstance()
  if (inst) api.instances.openFolder(inst.id)
  else api.openRoot()
})
$('#open-root').addEventListener('click', () => api.openRoot())

/* ============ Instances ============ */
function renderInstances() {
  const grid = $('#instance-grid')
  grid.innerHTML = S.instances.map((i) => `
    <article class="panel instance-card ${i.id === S.selected ? 'selected' : ''}" data-id="${esc(i.id)}">
      <div class="ic-head">
        <div class="ic-name">${esc(i.name)}</div>
        <span class="ic-badge ${i.loader === 'fabric' ? 'fabric' : 'vanilla'}">${i.loader === 'fabric' ? 'FABRIC' : 'VANILLA'}</span>
      </div>
      <div class="ic-chips">
        <span class="chip">MC ${esc(i.mcVersion)}</span>
        ${i.loaderVersion ? `<span class="chip">Loader ${esc(i.loaderVersion)}</span>` : ''}
        ${i.running ? '<span class="chip cyan">Çalışıyor</span>' : ''}
      </div>
      <div class="ic-meta">Son oynama: ${i.lastPlayed ? timeAgo(i.lastPlayed) : 'hiç'}</div>
      <div class="ic-actions">
        <button class="btn primary small" data-play="${esc(i.id)}">Oyna</button>
        <button class="btn ghost small" data-folder="${esc(i.id)}">Klasör</button>
        <button class="btn ghost small" data-mods="${esc(i.id)}">Modlar</button>
        <button class="btn danger small" data-del="${esc(i.id)}">Sil</button>
      </div>
    </article>`).join('')

  $('#instances-empty').hidden = S.instances.length > 0

  grid.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => {
    S.selected = b.dataset.play
    api.instances.select(S.selected)
    renderHome(); renderInstances()
    if (!S.active) openAccounts()
    else launchGame(S.selected)
  }))
  grid.querySelectorAll('[data-folder]').forEach((b) => b.addEventListener('click', () => api.instances.openFolder(b.dataset.folder)))
  grid.querySelectorAll('[data-mods]').forEach((b) => b.addEventListener('click', () => {
    const inst = S.instances.find((x) => x.id === b.dataset.mods)
    if (inst?.loader !== 'fabric') return toast('Bu profil Fabric değil', 'error')
    S.modsInstance = inst.id
    $$('.nav-item').find((x) => x.dataset.page === 'mods')?.click()
  }))
  grid.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => confirmDelete(b.dataset.del)))
  grid.querySelectorAll('.instance-card').forEach((card) => card.addEventListener('click', async (e) => {
    if (e.target.closest('button')) return
    S.selected = card.dataset.id
    await api.instances.select(S.selected)
    renderHome(); renderInstances()
  }))
}

function confirmDelete(id) {
  const inst = S.instances.find((i) => i.id === id)
  if (!inst) return
  openModal(`
    <h2>Profili sil</h2>
    <p class="sub"><strong>${esc(inst.name)}</strong> profili ve içindeki modlar/dünyalar silinecek. Emin misin?</p>
    <div class="modal-actions"><button class="btn ghost" id="del-cancel">İptal</button><button class="btn danger" id="del-ok">Sil</button></div>
  `)
  $('#del-cancel').onclick = closeModal
  $('#del-ok').onclick = async () => {
    const res = await api.instances.remove(id)
    S.instances = res.instances; S.selected = res.selected
    closeModal(); renderInstances(); renderHome(); toast('Profil silindi', 'info')
  }
}

$('#new-instance').addEventListener('click', openCreateInstance)
$('#empty-create').addEventListener('click', openCreateInstance)

function openCreateInstance() {
  if (!S.versions.length) {
    toast('Sürüm listesi yükleniyor...', 'info')
    api.versions.list().then((v) => {
      S.versions = v.versions
      S.latest = v.latest
      openCreateInstance()
    }).catch((err) => toast('Sürüm listesi alınamadı: ' + err.message, 'error', 6000))
    return
  }
  const releases = S.versions.filter((v) => v.type === 'release')
  const list = releases.length ? releases : S.versions
  const latest = S.latest?.release || list[0]?.id
  const options = list.map((v) => `<option value="${esc(v.id)}" ${v.id === latest ? 'selected' : ''}>${esc(v.id)}</option>`).join('')
  openModal(`
    <h2>Yeni Profil</h2>
    <p class="sub">Oynamak istediğin Minecraft sürümünü ve yükleyiciyi seç.</p>
    <div class="field"><label>Profil adı</label><input class="input" id="ci-name" placeholder="Örn. Survival 1.21.1" maxlength="48" /></div>
    <div class="field"><label>Minecraft sürümü <span style="color:var(--muted);font-weight:400">(ana sürümler)</span></label>
      <select class="select" id="ci-version" style="max-width:none;width:100%">${options}</select>
    </div>
    <div class="field"><label>Yükleyici</label>
      <div class="segmented" id="ci-loader">
        <button data-loader="vanilla" class="active">Vanilla</button>
        <button data-loader="fabric">Fabric (modlar için)</button>
      </div>
    </div>
    <div class="field" id="ci-fabric-wrap" hidden>
      <label>Fabric Loader</label>
      <select class="select" id="ci-fabric" style="max-width:none;width:100%"><option>Yükleniyor...</option></select>
    </div>
    <div class="modal-actions"><button class="btn ghost" id="ci-cancel">İptal</button><button class="btn primary" id="ci-create">Oluştur</button></div>
  `)
  let loader = 'vanilla'
  $('#ci-cancel').onclick = closeModal
  $('#ci-loader').querySelectorAll('button').forEach((b) => {
    b.onclick = () => {
      loader = b.dataset.loader
      $('#ci-loader').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b))
      $('#ci-fabric-wrap').hidden = loader !== 'fabric'
      if (loader === 'fabric') loadFabricVersions($('#ci-version').value)
    }
  })
  $('#ci-version').onchange = () => { if (loader === 'fabric') loadFabricVersions($('#ci-version').value) }
  $('#ci-create').onclick = async () => {
    const name = $('#ci-name').value.trim() || `Minecraft ${$('#ci-version').value}`
    const btn = $('#ci-create')
    btn.disabled = true
    btn.textContent = 'Oluşturuluyor...'
    try {
      const res = await api.instances.create({
        name,
        mcVersion: $('#ci-version').value,
        loader,
        loaderVersion: loader === 'fabric' ? $('#ci-fabric').value : null
      })
      S.instances = res.instances; S.selected = res.selected
      closeModal(); renderInstances(); renderHome(); toast('Profil oluşturuldu', 'success')
    } catch (err) {
      toast(err.message.replace(/^Error:\s*/, ''), 'error')
      btn.disabled = false
      btn.textContent = 'Oluştur'
    }
  }
  setTimeout(() => $('#ci-name')?.focus(), 50)
}

async function loadFabricVersions(mcVersion) {
  const sel = $('#ci-fabric')
  if (!sel) return
  sel.innerHTML = '<option>Yükleniyor...</option>'
  try {
    const loaders = await api.versions.fabricLoaders(mcVersion)
    sel.innerHTML = loaders.map((l) => `<option value="${esc(l.version)}" ${l.stable ? 'selected' : ''}>${esc(l.version)}${l.stable ? ' (stable)' : ''}</option>`).join('')
    if (!loaders.length) sel.innerHTML = '<option value="">Bulunamadı</option>'
  } catch {
    sel.innerHTML = '<option value="">Yüklenemedi</option>'
  }
}

/* ============ Launch ============ */
async function launchGame(id) {
  S.launching = true
  renderHome()
  const log = $('#console-log')
  log.innerHTML = ''
  api.settings.get().then((s) => { if (s.showConsole) $('#console-drawer').hidden = false })
  try {
    await api.game.launch(id)
  } catch (err) {
    S.launching = false
    renderHome()
    $('#progress-overlay').hidden = true
    toast(err.message.replace(/^Error:\s*/, ''), 'error', 6000)
  }
}

api.game.onStatus((st) => {
  if (st.state === 'error') {
    toast(st.message, 'error', 6000)
    $('#progress-overlay').hidden = true
    S.launching = false
    renderHome()
  } else if (st.state === 'preparing' || st.state === 'auth') {
    $('#progress-overlay').hidden = false
    $('#progress-title').textContent = st.state === 'auth' ? 'Oturum yenileniyor' : 'Hazırlanıyor'
    $('#progress-sub').textContent = st.message
  } else if (st.state === 'launching') {
    $('#progress-title').textContent = 'Başlatılıyor'
    $('#progress-sub').textContent = st.message
  }
})

api.install.onProgress((p) => {
  const overlay = $('#progress-overlay')
  if (overlay.hidden) { overlay.hidden = false; $('#progress-title').textContent = 'Dosyalar indiriliyor' }
  const names = { client: 'İstemci', libraries: 'Kütüphaneler', assets: 'Oyun dosyaları', done: 'Tamamlandı' }
  $('#progress-phase').textContent = names[p.phase] || p.phase
  const pct = p.total ? Math.min(100, Math.round((p.current / p.total) * 100)) : 0
  $('#progress-pct').textContent = pct + '%'
  $('#progress-fill').style.width = pct + '%'
  $('#progress-sub').textContent = `${names[p.phase] || p.phase} hazırlanıyor...`
  if (p.byteTotal) {
    const now = Date.now()
    if (!S.progressTime || now - S.progressTime > 500) {
      const speed = S.progressTime ? (p.bytes - S.progressBytes) / ((now - S.progressTime) / 1000) : 0
      if (speed > 0) $('#progress-stats').textContent = `${fmtBytes(p.bytes)} / ${fmtBytes(p.byteTotal)} · ${fmtBytes(speed)}/s`
      else $('#progress-stats').textContent = `${fmtBytes(p.bytes)} / ${fmtBytes(p.byteTotal)}`
      S.progressTime = now; S.progressBytes = p.bytes
    }
  } else {
    $('#progress-stats').textContent = `${p.current} / ${p.total}`
  }
})

api.install.onLog((d) => appendLog(d.message, d.level))

api.game.onLog((d) => appendLog(d.message, d.level))
api.game.onError((d) => appendLog('HATA: ' + d.message, 'error'))
api.game.onStarted(() => {
  S.launching = true
  renderHome(); renderInstances()
  $('#progress-overlay').hidden = true
  $('#progress-stats').textContent = ''
  toast('Minecraft başlatıldı', 'success', 2600)
})
api.game.onExit(({ code }) => {
  S.launching = false
  renderHome(); renderInstances()
  $('#progress-overlay').hidden = true
  appendLog(`— Oyun kapandı (kod ${code}) —`)
  if (S.settings?.keepOpen === false) api.window.close()
})
api.mods.onLog((m) => appendLog('[mods] ' + m))

function appendLog(message, level = 'info') {
  const log = $('#console-log')
  const line = document.createElement('div')
  if (level === 'error') line.className = 'err'
  if (level === 'warn') line.className = 'warn'
  line.textContent = message
  log.appendChild(line)
  while (log.childElementCount > 900) log.firstElementChild.remove()
  log.scrollTop = log.scrollHeight
}

$('#console-close').onclick = () => { $('#console-drawer').hidden = true }
$('#console-clear').onclick = () => { $('#console-log').innerHTML = '' }

/* ============ Mods ============ */
async function loadModsPage() {
  const fabricInstances = S.instances.filter((i) => i.loader === 'fabric')
  const sel = $('#mods-instance')
  if (!fabricInstances.length) {
    sel.innerHTML = '<option value="">Fabric profil yok</option>'
    $('#mod-results').innerHTML = `<div class="mod-empty" style="padding:40px 16px"><img src="assets/sparkle.gif" alt="" aria-hidden="true" /><strong>Fabric profili gerekli</strong><p>Mod kurmak için Profiller sekmesinden bir <strong>Fabric</strong> profili oluştur.</p></div>`
    $('#installed-list').innerHTML = '<div class="installed-empty"><img src="assets/package.gif" alt="" aria-hidden="true" /><p>Profil seçilince kurulu modlar burada görünecek.</p></div>'
    $('#installed-count').textContent = '0'
    $('#mods-count').textContent = ''
    return
  }
  const current = S.modsInstance && fabricInstances.some((i) => i.id === S.modsInstance) ? S.modsInstance : fabricInstances[0].id
  S.modsInstance = current
  sel.innerHTML = fabricInstances.map((i) => `<option value="${esc(i.id)}" ${i.id === current ? 'selected' : ''}>${esc(i.name)} · Fabric ${esc(i.loaderVersion || '')}</option>`).join('')
  sel.onchange = () => {
    S.modsInstance = sel.value
    S.searchResults = []
    S.modOffset = 0
    loadModsPage()
  }
  syncModToolbar()
  if (!S.searchResults.length) doSearch(true)
  await refreshInstalled()
}

function syncModToolbar() {
  $$('#mod-source button').forEach((b) => b.classList.toggle('active', b.dataset.source === S.modSource))
  const sort = $('#mods-sort')
  if (sort) sort.value = S.modSort
}

async function doSearch(reset) {
  const inst = S.instances.find((i) => i.id === S.modsInstance)
  if (!inst) return
  const query = $('#mods-search').value.trim()
  S.modQuery = query
  if (reset) {
    S.searchResults = []
    S.modOffset = 0
  }
  const btn = $('#mods-search-btn')
  const more = $('#mods-more')
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:14px;height:14px"></span>' }
  if (more) { more.hidden = true; more.disabled = false }
  if (reset) showModSkeletons()
  try {
    const res = await api.mods.search({
      instanceId: S.modsInstance,
      query,
      offset: S.modOffset,
      limit: 24,
      source: S.modSource,
      sort: S.modSort
    })
    const prevLen = S.searchResults.length
    if (reset) S.searchResults = res.hits
    else S.searchResults.push(...res.hits)
    S.modTotal = res.total || S.searchResults.length
    S.modOffset = S.searchResults.length
    renderModResults(reset ? 0 : prevLen)
    const label = S.modSource === 'curseforge' ? 'CurseForge' : 'Modrinth'
    $('#mods-count').textContent = `${S.modTotal.toLocaleString('tr-TR')} sonuç · ${label} · ${S.searchResults.length} gösteriliyor`
    if (more) more.hidden = S.searchResults.length >= S.modTotal || !res.hits.length
  } catch (err) {
    if (reset) $('#mod-results').innerHTML = `<div class="empty-mini" style="grid-column:1/-1">Hata: ${esc(err.message)}</div>`
    else toast('Yüklenemedi: ' + err.message.replace(/^Error:\s*/, ''), 'error')
    $('#mods-count').textContent = reset ? '' : $('#mods-count').textContent
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Ara' }
  }
}

function showModSkeletons(count = 6) {
  const grid = $('#mod-results')
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="sk-card">
      <div style="display:flex;gap:11px">
        <div class="sk sk-icon"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px">
          <div class="sk sk-title" style="width:78%"></div>
          <div class="sk sk-sub"></div>
        </div>
      </div>
      <div class="sk sk-body"></div>
      <div class="sk sk-foot"></div>
    </div>`).join('')
}

function modCardHtml(m) {
  const source = m.source || S.modSource
  const sourceLabel = source === 'curseforge' ? 'CurseForge' : 'Modrinth'
  const icon = m.icon ? `<img class="mod-icon" src="${esc(m.icon)}" onerror="this.style.display='none'" alt="" loading="lazy" decoding="async" />` : ''
  return `
    <article class="panel mod-card" data-project="${esc(m.id)}" data-source="${esc(source)}">
      <div class="mod-top">
        <div class="mod-icon-wrap">${icon}<span class="mod-icon-fallback" aria-hidden="true">◈</span></div>
        <div class="mod-head-text">
          <div class="mod-title" title="${esc(m.title)}">${esc(m.title)}</div>
          <div class="mod-meta-row">
            <span class="mod-author">${esc(m.author || sourceLabel)}</span>
            <span class="mod-source ${source}">${sourceLabel}</span>
          </div>
        </div>
      </div>
      <div class="mod-desc">${esc(m.description || 'Açıklama yok.')}</div>
      <div class="mod-foot">
        <span class="mod-dl" title="${Number(m.downloads||0).toLocaleString('tr-TR')} indirme">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16"/></svg>
          ${fmtNum(m.downloads)}
        </span>
        <button class="btn primary small" data-install="${esc(m.id)}">Kur</button>
      </div>
    </article>`
}

function renderModResults(appendFrom = 0) {
  const grid = $('#mod-results')
  if (!S.searchResults.length) {
    grid.innerHTML = `<div class="mod-empty"><img src="assets/package.gif" alt="" aria-hidden="true" /><strong>Sonuç bulunamadı</strong><p>Farklı bir anahtar kelime dene veya kaynağı değiştir.</p></div>`
    return
  }
  // "Daha Fazla Yükle"de tüm listeyi yeniden çizme — sadece yenileri ekle (stutter fix)
  if (appendFrom > 0 && grid.querySelector('.mod-card')) {
    grid.insertAdjacentHTML('beforeend', S.searchResults.slice(appendFrom).map(modCardHtml).join(''))
    return
  }
  grid.innerHTML = S.searchResults.map(modCardHtml).join('')
}

;(function bindModGrid() {
  const grid = $('#mod-results')
  if (!grid || grid._bound) return
  grid._bound = true
  grid.addEventListener('click', (e) => {
    const installBtn = e.target.closest('[data-install]')
    if (installBtn) {
      e.stopPropagation()
      const card = installBtn.closest('.mod-card')
      installFromButton(installBtn, installBtn.dataset.install, card?.dataset.source || S.modSource)
      return
    }
    const card = e.target.closest('.mod-card')
    if (card && card.dataset.project) openModDetail(card.dataset.project, card.dataset.source)
  })
})()

async function installFromButton(btn, projectId, source = S.modSource) {
  const original = btn.textContent
  btn.disabled = true
  btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>'
  try {
    const installed = await api.mods.install({ instanceId: S.modsInstance, projectId, source })
    toast(`${installed.length} mod kuruldu${source === 'curseforge' ? ' · CurseForge' : ''}`, 'success')
    btn.textContent = 'Kuruldu ✓'
    await refreshInstalled()
  } catch (err) {
    toast(err.message.replace(/^Error:\s*/, ''), 'error', 6000)
    btn.disabled = false
    btn.textContent = original || 'Kur'
  }
}

async function openModDetail(projectId, source = S.modSource) {
  openModal(`
    <div class="mod-detail-loading">
      <span class="spinner"></span>
      <span class="muted">Mod bilgileri yükleniyor...</span>
    </div>
  `)
  try {
    const p = await api.mods.project({ projectId, source })
    const cats = (p.categories || []).slice(0, 6).map((c) => `<span class="chip">${esc(c)}</span>`).join('')
    const links = [
      p.website_url ? `<button class="btn ghost small" data-link="${esc(p.website_url)}">Sayfa</button>` : '',
      p.source_url ? `<button class="btn ghost small" data-link="${esc(p.source_url)}">Kaynak</button>` : '',
      p.issues_url ? `<button class="btn ghost small" data-link="${esc(p.issues_url)}">Sorunlar</button>` : ''
    ].join('')
    const installed = S.installed.some((f) => f.toLowerCase().includes(String(p.slug || '').toLowerCase())) ||
      S.installed.some((f) => f.toLowerCase().startsWith(String(p.slug || '').toLowerCase()))
    const sourceLabel = source === 'curseforge' ? 'CurseForge' : 'Modrinth'
    openModal(`
      <div class="mod-detail">
        <div class="mod-detail-head">
          <img class="mod-detail-icon" src="${esc(p.icon_url || '')}" onerror="this.style.visibility='hidden'" alt="" />
          <div style="min-width:0">
            <h2>${esc(p.title)}</h2>
            <div class="mod-detail-sub">${esc(p.slug || '')} · ${fmtNum(p.downloads || 0)} indirme · ${fmtNum(p.followers || 0)} takipçi</div>
            <div style="margin-top:6px"><span class="mod-source ${source}">${sourceLabel}</span></div>
          </div>
        </div>
        <p class="sub" style="margin:14px 0 12px">${esc(p.description || '')}</p>
        <div class="chips" style="margin-bottom:16px">${cats || '<span class="chip">Mod</span>'}</div>
        <div class="mod-detail-stats">
          <div><span>İndirme</span><strong>${fmtNum(p.downloads || 0)}</strong></div>
          <div><span>Takipçi</span><strong>${fmtNum(p.followers || 0)}</strong></div>
          <div><span>Lisans</span><strong>${esc(p.license?.id || '—')}</strong></div>
        </div>
        <div class="modal-actions" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
          <div class="row" style="gap:8px">${links}</div>
          <div class="row" style="gap:8px">
            <button class="btn ghost" data-close>Kapat</button>
            <button class="btn primary" data-install-detail="${esc(p.id)}" ${installed ? 'disabled' : ''}>${installed ? 'Kurulu ✓' : 'Modu Kur'}</button>
          </div>
        </div>
      </div>
    `)
    $('#modal').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal))
    $('#modal').querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => api.window.openExternal(b.dataset.link)))
    const installBtn = $('#modal').querySelector('[data-install-detail]')
    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        await installFromButton(installBtn, projectId)
        closeModal()
      })
    }
  } catch (err) {
    openModal(`
      <h2>Yüklenemedi</h2>
      <p class="sub">${esc(err.message.replace(/^Error:\s*/, ''))}</p>
      <div class="modal-actions"><button class="btn ghost" data-close>Kapat</button></div>
    `)
    $('#modal').querySelector('[data-close]').onclick = closeModal
  }
}

$('#mods-search-btn').onclick = () => doSearch(true)
$('#mods-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(true) })

/* Mod kaynağı sekmeleri */
$$('#mod-source button').forEach((b) => b.addEventListener('click', () => {
  if (S.modSource === b.dataset.source) return
  S.modSource = b.dataset.source
  syncModToolbar()
  S.searchResults = []
  doSearch(true)
}))

$('#mods-sort').addEventListener('change', (e) => {
  S.modSort = e.target.value
  S.searchResults = []
  doSearch(true)
})

$('#mods-more').addEventListener('click', () => doSearch(false))

$('#mods-file').addEventListener('click', async () => {
  if (!S.modsInstance) return toast('Önce bir Fabric profili seç', 'error')
  const btn = $('#mods-file')
  const original = btn.textContent
  btn.disabled = true
  btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>'
  try {
    const installed = await api.mods.installFiles(S.modsInstance)
    if (!installed.length) return
    toast(`${installed.length} mod dosyadan eklendi`, 'success')
    await refreshInstalled()
  } catch (err) {
    toast(err.message.replace(/^Error:\s*/, ''), 'error', 6000)
  } finally {
    btn.disabled = false
    btn.textContent = original
  }
})

$('#mods-url').addEventListener('click', () => {
  if (!S.modsInstance) return toast('Önce bir Fabric profili seç', 'error')
  openModal(`
    <h2>URL'den Mod Kur</h2>
    <p class="sub" style="margin-top:6px">Bir <strong>.jar</strong> dosyasının doğrudan indirme bağlantısını yapıştır.</p>
    <div class="field" style="margin-top:16px">
      <label>Jar bağlantısı</label>
      <input class="input" id="url-input" placeholder="https://.../mod.jar" spellcheck="false" />
    </div>
    <p class="sub" style="font-size:11px;margin-top:10px;line-height:1.5">
      CurseForge sayfa adresleri (<em>/minecraft/mc-mods/...</em>) çalışmaz; dosya sekmesindeki
      <strong>doğrudan indirme</strong> linkini kullan. GitHub Releases, Modrinth CDN ve kendi barındırdığın linkler desteklenir.
    </p>
    <div class="modal-actions">
      <button class="btn ghost" data-close>Vazgeç</button>
      <button class="btn primary" id="url-install">Kur</button>
    </div>
  `)
  $('#modal').querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModal))
  const input = $('#url-input')
  input.focus()
  const submit = async () => {
    const url = input.value.trim()
    if (!url) return
    const btn = $('#url-install')
    btn.disabled = true
    btn.innerHTML = '<span class="spinner" style="width:13px;height:13px;border-width:2px"></span>'
    try {
      await api.mods.installUrl({ instanceId: S.modsInstance, url })
      toast('Mod URL\'den kuruldu', 'success')
      closeModal()
      await refreshInstalled()
    } catch (err) {
      toast(err.message.replace(/^Error:\s*/, ''), 'error', 6000)
      btn.disabled = false
      btn.textContent = 'Kur'
    }
  }
  $('#url-install').addEventListener('click', submit)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit() })
})

function prettyModName(filename) {
  return String(filename || '')
    .replace(/\.jar$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b(fabric|forge|neoforge|quilt|mc\d[\w.]*)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || filename
}

async function refreshInstalled() {
  if (!S.modsInstance) return
  try {
    const res = await api.mods.list(S.modsInstance)
    S.installed = res.mods
    $('#installed-count').textContent = res.mods.length
    const jarIcon = `<svg viewBox="0 0 24 24"><path d="M21 8l-9-5-9 5v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/></svg>`
    $('#installed-list').innerHTML = res.mods.length
      ? res.mods.map((f) => `
        <div class="installed-item" title="${esc(f)}">
          <div class="installed-file-icon">${jarIcon}</div>
          <div class="installed-meta">
            <span class="installed-name">${esc(prettyModName(f))}</span>
            <span class="installed-file">${esc(f)}</span>
          </div>
          <button class="icon-btn" data-uninstall="${esc(f)}" title="Kaldır">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`).join('')
      : `<div class="installed-empty">
           <img src="assets/sparkle.gif" alt="" aria-hidden="true" />
           <p>Bu profilde henüz mod yok.<br>Soldan arayıp <strong>Kur</strong> diyebilirsin.</p>
         </div>`
    $('#installed-list').querySelectorAll('[data-uninstall]').forEach((b) => b.addEventListener('click', async () => {
      if (!confirm(`"${b.dataset.uninstall}" kaldırılsın mı?`)) return
      await api.mods.remove({ instanceId: S.modsInstance, filename: b.dataset.uninstall })
      toast('Mod kaldırıldı', 'info', 2200)
      refreshInstalled()
    }))
    const inst = selectedInstance()
    if (inst) {
      $('#stat-mods').textContent = inst.id === S.modsInstance ? res.mods.length : $('#stat-mods').textContent
    }
  } catch {
    /* ignore */
  }
}

/* ============ Settings ============ */
function renderSettings() {
  const s = S.settings
  const ram = $('#ram-slider')
  ram.value = s.ram
  ram.style.setProperty('--fill', `${((s.ram - 1024) / (32768 - 1024)) * 100}%`)
  $('#ram-value').textContent = `${(s.ram / 1024).toFixed(s.ram % 1024 ? 1 : 0)} GB`
  $('#res-width').value = s.width
  $('#res-height').value = s.height
  $('#fullscreen').checked = !!s.fullscreen
  $('#java-path').value = s.javaPath || ''
  $('#jvm-args').value = s.jvmArgs || ''
  $('#keep-open').checked = s.keepOpen !== false
  $('#show-console').checked = s.showConsole !== false
  $('#effects').checked = s.effects !== false
  document.body.classList.toggle('no-fx', s.effects === false)
  const langSel = $('#lang-select')
  if (langSel && window.CostrallI18n) {
    const langs = window.CostrallI18n.LANGS
    if (!langSel.options.length) {
      langSel.innerHTML = langs.map((l) => `<option value="${l.code}">${l.flag} ${l.name}</option>`).join('')
    }
    langSel.value = s.language || 'tr'
  }
}

async function saveSettings(patch) {
  S.settings = await api.settings.set(patch)
  renderSettings()
  return S.settings
}

$('#ram-slider').addEventListener('input', (e) => {
  const v = Number(e.target.value)
  e.target.style.setProperty('--fill', `${((v - 1024) / (32768 - 1024)) * 100}%`)
  $('#ram-value').textContent = `${(v / 1024).toFixed(v % 1024 ? 1 : 0)} GB`
})
$('#ram-slider').addEventListener('change', (e) => saveSettings({ ram: Number(e.target.value) }))
$('#res-width').addEventListener('change', (e) => saveSettings({ width: Number(e.target.value) || 1280 }))
$('#res-height').addEventListener('change', (e) => saveSettings({ height: Number(e.target.value) || 720 }))
$('#fullscreen').addEventListener('change', (e) => saveSettings({ fullscreen: e.target.checked }))
$('#jvm-args').addEventListener('change', (e) => saveSettings({ jvmArgs: e.target.value }))
$('#java-path').addEventListener('change', (e) => { saveSettings({ javaPath: e.target.value.trim() }); refreshJava() })
$('#keep-open').addEventListener('change', (e) => saveSettings({ keepOpen: e.target.checked }))
$('#show-console').addEventListener('change', (e) => saveSettings({ showConsole: e.target.checked }))
$('#effects').addEventListener('change', async (e) => { await saveSettings({ effects: e.target.checked }) })
$('#lang-select')?.addEventListener('change', async (e) => {
  const language = e.target.value
  window.CostrallI18n?.setLang(language)
  await saveSettings({ language })
  renderAccount()
})
$('#java-pick').onclick = async () => {
  const p = await api.dialog.pickJava()
  if (p) { await saveSettings({ javaPath: p }); refreshJava() }
}
$('#open-data').onclick = () => api.openRoot()

async function refreshJava() {
  const el = $('#java-detected')
  el.textContent = 'Java aranıyor...'
  el.classList.remove('ok')
  try {
    const list = await api.java()
    if (!list.length) {
      el.textContent = 'Java bulunamadı. Java 21+ kurmalısın.'
      $('#sys-java-tag').textContent = 'Java yok'
      return
    }
    const best = list[0]
    el.textContent = `Bulundu: Java ${best.major} · ${best.path}`
    el.classList.add('ok')
    $('#sys-java-tag').textContent = `Java ${best.major}`
  } catch {
    el.textContent = 'Java kontrolü başarısız'
  }
}

/* ============ Init ============ */
function showSetupWizard() {
  const I = window.CostrallI18n
  if (!I) return Promise.resolve()
  const t = I.t
  let selected = S.settings.language || 'tr'
  return new Promise((resolve) => {
    window.__setupLock = true
    const render = () => {
      I.setLang(selected)
      openModal(`
        <div class="setup-wizard">
          <img class="setup-gif" src="assets/rocket.gif" alt="" aria-hidden="true" />
          <h2>${esc(t('setup_title'))}</h2>
          <p class="sub">${esc(t('setup_sub'))}</p>
          <div class="field" style="margin-top:16px">
            <label>${esc(t('setup_lang'))}</label>
            <div class="lang-grid" id="setup-langs">
              ${I.LANGS.map((l) => `<button type="button" class="lang-opt ${l.code===selected?'active':''}" data-lang="${l.code}"><span class="lang-flag">${l.flag}</span><span>${esc(l.name)}</span></button>`).join('')}
            </div>
          </div>
          <div class="modal-actions" style="margin-top:18px">
            <button class="btn primary" id="setup-finish">${esc(t('setup_done'))}</button>
          </div>
        </div>
      `)
      $('#modal').querySelectorAll('.lang-opt').forEach((b) => b.addEventListener('click', () => {
        selected = b.dataset.lang
        render()
      }))
      $('#setup-finish').addEventListener('click', async () => {
        await saveSettings({ language: selected, setupDone: true })
        window.__setupLock = false
        closeModal()
        I.applyI18n()
        renderAccount()
        resolve()
      })
    }
    render()
  })
}

async function init() {
  const status = (text) => window.__costrallSplashStatus?.(text)

  status('Sistem bilgileri okunuyor')
  S.info = await api.info()
  $('#app-version').textContent = S.info.version
  $('#sys-ram').textContent = `${(S.info.totalMem / 1073741824).toFixed(0)} GB`
  $('#sys-cpu').textContent = `${S.info.cpus} çekirdek`
  $('#sys-platform').textContent = `${S.info.platform} · ${S.info.arch}`

  status('Ayarlar yükleniyor')
  S.settings = await api.settings.get()
  window.CostrallI18n?.setLang(S.settings.language || 'tr')
  renderSettings()
  window.CostrallI18n?.applyI18n()
  if (S.settings.setupDone === false) {
    await showSetupWizard()
  }

  status('Hesaplar hazırlanıyor')
  const acc = await api.accounts.list()
  S.accounts = acc.accounts
  S.active = acc.active
  renderAccount()

  status('Profiller yükleniyor')
  const inst = await api.instances.list()
  S.instances = inst.instances
  S.selected = inst.selected
  renderInstances()
  renderHome()

  refreshJava()

  // Load the version manifest in the background so the UI appears instantly
  loadVersions()

  const instSel = selectedInstance()
  if (instSel) {
    api.mods.list(instSel.id).then((r) => {
      if (instSel.id === S.selected) $('#stat-mods').textContent = r.mods.length
    }).catch(() => {})
  }

  // Replay entrance animation after data is ready
  refreshEntrance()
  window.__costrallReady?.()
  setTimeout(() => {
    const t = window.CostrallI18n?.t || ((k,f)=>f||k)
    toast(t('welcome','Costrall hazır. İyi oyunlar!'), 'success', 3400)
  }, 900)
}

async function loadVersions() {
  try {
    const v = await api.versions.list()
    S.versions = v.versions
    S.latest = v.latest
  } catch (err) {
    toast('Sürüm listesi alınamadı: ' + err.message, 'error', 6000)
  }
}

function refreshEntrance() {
  const page = $('.page.active')
  if (!page) return
  page.classList.remove('active')
  void page.offsetWidth
  page.classList.add('active')
}

/* Keyboard navigation: Ctrl+1..4 */
document.addEventListener('keydown', (e) => {
  if (!e.ctrlKey || e.altKey || e.shiftKey) return
  const map = { 1: 'home', 2: 'instances', 3: 'mods', 4: 'settings' }
  const page = map[e.key]
  if (!page) return
  e.preventDefault()
  $$('.nav-item').find((b) => b.dataset.page === page)?.click()
})

init().catch((err) => {
  console.error(err)
  window.__costrallReady?.()
  toast('Başlatma hatası: ' + err.message, 'error', 8000)
})
