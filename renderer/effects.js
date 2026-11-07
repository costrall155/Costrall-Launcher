'use strict'
/* Costrall Launcher - ambient effects & micro-interactions */
;(() => {
  const $ = (sel) => document.querySelector(sel)

  /* ---------------- Splash ---------------- */
  const splash = $('#splash')
  const splashBar = $('#splash-bar')
  const splashStatus = $('#splash-status')
  const statuses = [
    'Arayüz hazırlanıyor',
    'Sürümler kontrol ediliyor',
    'Mod kütüphanesi bağlanıyor',
    'Neredeyse hazır'
  ]
  let progress = 6
  let stage = 0
  let finished = false

  const setBar = (value) => {
    if (!splashBar) return
    progress = Math.max(progress, Math.min(96, value))
    splashBar.style.width = progress + '%'
  }

  if (splashStatus) splashStatus.textContent = statuses[0]
  const splashTimer = setInterval(() => {
    if (finished) return
    setBar(progress + 4 + Math.random() * 7)
    const next = Math.min(statuses.length - 1, Math.floor((progress / 96) * statuses.length))
    if (next !== stage && splashStatus) {
      stage = next
      splashStatus.style.opacity = '0'
      setTimeout(() => {
        if (!splashStatus) return
        splashStatus.textContent = statuses[stage]
        splashStatus.style.opacity = '1'
      }, 160)
    }
    if (progress > 88) setBar(93)
  }, 420)

  const finishSplash = () => {
    if (finished || !splash) return
    finished = true
    clearInterval(splashTimer)
    setBar(100)
    if (splashStatus) splashStatus.textContent = 'Hoş geldin'
    setTimeout(() => {
      splash.classList.add('done')
      setTimeout(() => splash.remove(), 900)
    }, 320)
  }

  window.__costrallSplashStatus = (text) => {
    if (splashStatus && !finished) {
      splashStatus.style.opacity = '0'
      setTimeout(() => {
        if (!splashStatus) return
        splashStatus.textContent = text
        splashStatus.style.opacity = '1'
      }, 150)
    }
  }
  window.__costrallReady = finishSplash
  setTimeout(finishSplash, 7000)

  /* ---------------- Canvas particle field ---------------- */
  const canvas = $('#fx-canvas')
  const ctx = canvas ? canvas.getContext('2d') : null
  let W = 0
  let H = 0
  let dpr = 1
  let particles = []
  let shooting = null
  let shootingAt = 0
  let scrolling = false
  let scrollTimer = 0
  let frameSkip = 0

  const resize = () => {
    if (!canvas) return
    dpr = Math.min(1.25, window.devicePixelRatio || 1)
    W = window.innerWidth
    H = window.innerHeight
    canvas.width = Math.floor(W * dpr)
    canvas.height = Math.floor(H * dpr)
    canvas.style.width = W + 'px'
    canvas.style.height = H + 'px'
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.max(16, Math.min(36, Math.round((W * H) / 52000)))
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: Math.random() * 1.4 + 0.5,
      a: Math.random() * 0.38 + 0.12,
      hue: Math.random()
    }))
  }

  const palette = ['rgba(167,139,250,', 'rgba(103,232,249,', 'rgba(226,232,240,']

  const draw = (t) => {
    if (!ctx) return
    if (document.hidden || document.body.classList.contains('no-fx')) {
      requestAnimationFrame(draw)
      return
    }
    // Scroll sırasında ağır canvas işini atla — takılmayı önler
    if (scrolling) {
      frameSkip = (frameSkip + 1) % 3
      if (frameSkip !== 0) {
        requestAnimationFrame(draw)
        return
      }
    }
    ctx.clearRect(0, 0, W, H)
    // links (scroll'da çizme)
    if (!scrolling) {
      ctx.lineWidth = 0.6
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j]
          const dx = p.x - q.x
          const dy = p.y - q.y
          const dist = dx * dx + dy * dy
          if (dist < 10000) {
            const alpha = (1 - dist / 10000) * 0.1
            ctx.strokeStyle = 'rgba(148,163,214,' + alpha.toFixed(3) + ')'
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        }
      }
    }
    // dots
    for (const p of particles) {
      if (!scrolling) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -20) p.x = W + 20
        if (p.x > W + 20) p.x = -20
        if (p.y < -20) p.y = H + 20
        if (p.y > H + 20) p.y = -20
      }
      const twinkle = 0.7 + Math.sin(t / 1400 + p.x * 0.01) * 0.3
      ctx.fillStyle = palette[Math.floor(p.hue * palette.length)] + (p.a * twinkle).toFixed(3) + ')'
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    // shooting star (scroll'da duraklat)
    if (!scrolling && !shooting && t - shootingAt > 11000) {
      shootingAt = t
      shooting = { x: Math.random() * W * 0.7, y: Math.random() * H * 0.4, vx: 4.6, vy: 1.9, life: 0 }
    }
    if (shooting && !scrolling) {
      shooting.life++
      shooting.x += shooting.vx
      shooting.y += shooting.vy
      const fade = Math.max(0, 1 - shooting.life / 65)
      const grad = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - 90, shooting.y - 37)
      grad.addColorStop(0, 'rgba(196,181,253,' + (0.7 * fade).toFixed(3) + ')')
      grad.addColorStop(1, 'rgba(196,181,253,0)')
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(shooting.x, shooting.y)
      ctx.lineTo(shooting.x - 90, shooting.y - 37)
      ctx.stroke()
      if (shooting.life > 65 || shooting.x > W + 100 || shooting.y > H + 100) shooting = null
    }
    requestAnimationFrame(draw)
  }

  if (canvas && ctx) {
    resize()
    window.addEventListener('resize', resize)
    // Scroll performansı: içerik kaydırılırken canvas ve efektleri hafiflet
    const contentEl = document.querySelector('.content')
    if (contentEl) {
      contentEl.addEventListener('scroll', () => {
        scrolling = true
        document.body.classList.add('is-scrolling')
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          scrolling = false
          document.body.classList.remove('is-scrolling')
        }, 140)
      }, { passive: true })
    }
    requestAnimationFrame(draw)
  }

  /* ---------------- Mouse parallax (arka plan tepkisi, "guide" takip yerine) ---------------- */
  const parallaxEl = $('#blobs-parallax')
  let mouseX = window.innerWidth / 2
  let mouseY = window.innerHeight / 2
  let parX = 0
  let parY = 0
  let hasMouse = false

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX
    mouseY = e.clientY
    hasMouse = true
  }, { passive: true })
  window.addEventListener('pointerleave', () => { hasMouse = false })

  const parallaxLoop = () => {
    if (parallaxEl && !scrolling && !document.body.classList.contains('no-fx') && hasMouse) {
      const tx = (mouseX / window.innerWidth - 0.5) * 2
      const ty = (mouseY / window.innerHeight - 0.5) * 2
      parX += (tx - parX) * 0.035
      parY += (ty - parY) * 0.035
      parallaxEl.style.transform = `translate3d(${(parX * 14).toFixed(1)}px, ${(parY * 10).toFixed(1)}px, 0)`
    }
    requestAnimationFrame(parallaxLoop)
  }
  requestAnimationFrame(parallaxLoop)

  /* ---------------- Button ripples ---------------- */
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.btn, .nav-item, .win-btn, .icon-btn, .option-list button')
    if (!el || el.disabled) return
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.7
    const span = document.createElement('span')
    span.className = 'ripple'
    span.style.width = size + 'px'
    span.style.height = size + 'px'
    span.style.left = (e.clientX - rect.left - size / 2) + 'px'
    span.style.top = (e.clientY - rect.top - size / 2) + 'px'
    el.appendChild(span)
    setTimeout(() => span.remove(), 700)
  })

  /* ---------------- Card tilt + glow follow ---------------- */
  let tiltCard = null
  let tiltRaf = 0
  document.addEventListener('pointermove', (e) => {
    if (scrolling) return
    const card = e.target.closest('.instance-card, .mod-card')
    if (!card) return
    tiltCard = card
    if (tiltRaf) return
    tiltRaf = requestAnimationFrame(() => {
      tiltRaf = 0
      if (!tiltCard || scrolling) return
      const rect = tiltCard.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width
      const py = (e.clientY - rect.top) / rect.height
      tiltCard.style.setProperty('--rx', ((0.5 - py) * 4.5).toFixed(2) + 'deg')
      tiltCard.style.setProperty('--ry', ((px - 0.5) * 5.5).toFixed(2) + 'deg')
      tiltCard.style.setProperty('--mx', (px * 100).toFixed(1) + '%')
      tiltCard.style.setProperty('--my', (py * 100).toFixed(1) + '%')
    })
  }, { passive: true })
  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.instance-card, .mod-card')
    if (!card) return
    if (card.contains(e.relatedTarget)) return
    card.style.setProperty('--rx', '0deg')
    card.style.setProperty('--ry', '0deg')
  })

  /* ---------------- Sliding nav indicator ---------------- */
  const nav = $('.nav')
  if (nav) {
    const glider = document.createElement('span')
    glider.className = 'nav-glider'
    nav.prepend(glider)
    const place = () => {
      const active = nav.querySelector('.nav-item.active')
      if (!active) {
        glider.style.opacity = '0'
        return
      }
      const nr = nav.getBoundingClientRect()
      const ar = active.getBoundingClientRect()
      glider.style.opacity = '1'
      glider.style.height = ar.height + 'px'
      glider.style.transform = `translateY(${(ar.top - nr.top).toFixed(1)}px)`
    }
    new MutationObserver(place).observe(nav, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    })
    window.addEventListener('resize', place)
    requestAnimationFrame(place)
    setTimeout(place, 250)
  }

  /* ---------------- Animated stat counters ---------------- */
  const animateNumber = (el, from, to) => {
    const start = performance.now()
    const dur = 520
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      const value = Math.round(from + (to - from) * eased)
      el.textContent = String(value)
      if (p < 1) requestAnimationFrame(tick)
      else {
        el.textContent = String(to)
        el.classList.add('bump')
        setTimeout(() => el.classList.remove('bump'), 500)
      }
    }
    requestAnimationFrame(tick)
  }

  const watchStat = (el) => {
    if (!el) return
    let current = parseInt(el.textContent, 10) || 0
    let busy = false
    new MutationObserver(() => {
      const target = parseInt(el.textContent, 10)
      if (Number.isNaN(target) || busy) return
      if (target === current) return
      busy = true
      animateNumber(el, current, target)
      current = target
      setTimeout(() => { busy = false }, 600)
    }).observe(el, { childList: true, characterData: true, subtree: true })
  }
  watchStat($('#stat-instances'))
  watchStat($('#stat-mods'))

  /* ---------------- Launch spark burst ---------------- */
  const burst = (x, y) => {
    const colors = ['#a78bfa', '#22d3ee', '#e9d5ff', '#67e8f9', '#c4b5fd']
    for (let i = 0; i < 16; i++) {
      const el = document.createElement('span')
      el.className = 'burst'
      el.style.left = x + 'px'
      el.style.top = y + 'px'
      el.style.background = colors[i % colors.length]
      el.style.boxShadow = '0 0 10px ' + colors[i % colors.length]
      document.body.appendChild(el)
      const angle = (Math.PI * 2 * i) / 16 + Math.random() * 0.4
      const dist = 34 + Math.random() * 62
      const anim = el.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist + 26}px)) scale(0.2)`, opacity: 0 }
        ],
        { duration: 620 + Math.random() * 260, easing: 'cubic-bezier(.15,.7,.3,1)' }
      )
      anim.onfinish = () => el.remove()
    }
  }
  document.addEventListener('click', (e) => {
    const play = e.target.closest('#hero-play, [data-play]')
    if (play && !play.classList.contains('running')) burst(e.clientX, e.clientY)
  })

  /* ---------------- Copy device code on click ---------------- */
  document.addEventListener('click', (e) => {
    const code = e.target.closest('#device-code')
    if (!code) return
    const text = code.textContent.trim()
    if (!text || text.includes('·')) return
    navigator.clipboard?.writeText(text).then(() => {
      const hint = document.querySelector('#device-hint')
      if (hint) {
        const old = hint.textContent
        hint.textContent = 'Kopyalandı ✓'
        setTimeout(() => { if (hint) hint.textContent = old }, 1500)
      }
    }).catch(() => {})
  })
})()
