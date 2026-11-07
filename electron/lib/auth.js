'use strict'
const crypto = require('crypto')

const CLIENT_ID = '00000000402b5328'
const SCOPE = 'service::user.auth.xboxlive.com::MBI_SSL'
const DEVICE_CODE_URL = 'https://login.live.com/oauth20_connect.srf'
const TOKEN_URL = 'https://login.live.com/oauth20_token.srf'

function form(params) {
  return new URLSearchParams(params).toString()
}

async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'User-Agent': 'CostrallLauncher/1.0', Accept: 'application/json', ...(opts.headers || {}) } })
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = { error: 'parse', error_description: `HTTP ${res.status}` }
  }
  return { status: res.status, data }
}

async function postForm(url, params) {
  const { data } = await jsonFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form(params)
  })
  return data
}

async function postJson(url, body, headers = {}) {
  const { data } = await jsonFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
    body: JSON.stringify(body)
  })
  return data
}

async function requestDeviceCode() {
  const res = await postForm(DEVICE_CODE_URL, {
    client_id: CLIENT_ID,
    scope: SCOPE,
    response_type: 'device_code'
  })
  if (!res.device_code) throw new Error(res.error_description || 'Cihaz kodu alınamadı')
  return {
    deviceCode: res.device_code,
    userCode: res.user_code,
    verificationUri: res.verification_uri,
    interval: Math.max(2, Number(res.interval) || 5),
    expiresIn: Number(res.expires_in) || 900,
    message: res.message
  }
}

async function waitForToken(device, onTick) {
  const deadline = Date.now() + device.expiresIn * 1000
  let interval = device.interval
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000))
    if (onTick) onTick()
    let res
    try {
      res = await postForm(TOKEN_URL, {
        client_id: CLIENT_ID,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: device.deviceCode
      })
    } catch (e) {
      res = { error: 'network', error_description: e.message }
    }
    if (res.access_token) {
      return { accessToken: res.access_token, refreshToken: res.refresh_token, expiresIn: res.expires_in }
    }
    if (res.error === 'authorization_pending') continue
    if (res.error === 'slow_down') {
      interval += 5
      continue
    }
    if (res.error === 'expired_token') throw new Error('Giriş kodu süresi doldu, tekrar dene')
    if (res.error === 'authorization_declined' || res.error === 'access_denied') throw new Error('Giriş tarayıcıda reddedildi')
    if (res.error === 'invalid_grant') throw new Error('Giriş kodu geçersiz, tekrar dene')
    throw new Error(res.error_description || 'Microsoft girişi başarısız')
  }
  throw new Error('Giriş zaman aşımına uğradı')
}

async function refresh(refreshToken) {
  const res = await postForm(TOKEN_URL, {
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  })
  if (!res.access_token) throw new Error(res.error_description || 'Oturum yenilenemedi')
  return { accessToken: res.access_token, refreshToken: res.refresh_token || refreshToken, expiresIn: res.expires_in }
}

async function xboxAuthenticate(accessToken) {
  const res = await postJson('https://user.auth.xboxlive.com/user/authenticate', {
    Properties: {
      AuthMethod: 'RPS',
      SiteName: 'user.auth.xboxlive.com',
      RpsTicket: `d=${accessToken}`
    },
    RelyingParty: 'http://auth.xboxlive.com',
    TokenType: 'JWT'
  })
  return res.Token
}

async function xstsAuthorize(xblToken) {
  const res = await postJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    Properties: { SandboxId: 'RETAIL', UserTokens: [xblToken] },
    RelyingParty: 'rp://api.minecraftservices.com/',
    TokenType: 'JWT'
  })
  if (!res.Token) {
    const xerr = res.XErr
    if (xerr === 2148916233) throw new Error('Bu Microsoft hesabının Xbox profili yok. Xbox.com üzerinden profil oluştur.')
    if (xerr === 2148916238) throw new Error('Bu hesap bir aile grubuna bağlı (çocuk hesabı).')
    throw new Error('Xbox kimlik doğrulaması başarısız: ' + (res.Message || `HTTP ${res.error || ''}`))
  }
  const uhs = res.DisplayClaims?.xui?.[0]?.uhs
  return { token: res.Token, uhs }
}

async function loginWithXbox(uhs, xstsToken) {
  const res = await postJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    identityToken: `XBL3.0 x=${uhs};${xstsToken}`
  })
  if (!res.access_token) throw new Error('Minecraft oturumu açılamadı (oyun sahipliği yok olabilir)')
  return res.access_token
}

async function getProfile(accessToken) {
  const { data } = await jsonFetch('https://api.minecraftservices.com/minecraft/profile', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!data.id) throw new Error('Minecraft profili alınamadı (hesapta oyun yok olabilir)')
  return data
}

function offlineUuid(name) {
  const hash = crypto.createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest('hex')
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20)}`
}

async function completeLogin(tokens) {
  const xbl = await xboxAuthenticate(tokens.accessToken)
  const { token: xsts, uhs } = await xstsAuthorize(xbl)
  const mcToken = await loginWithXbox(uhs, xsts)
  const profile = await getProfile(mcToken)
  return {
    type: 'microsoft',
    name: profile.name,
    uuid: profile.id,
    accessToken: mcToken,
    refreshToken: tokens.refreshToken,
    expiresAt: Date.now() + (tokens.expiresIn || 86400) * 1000,
    skin: profile.skins?.[0]?.url || null,
    addedAt: Date.now()
  }
}

module.exports = { requestDeviceCode, waitForToken, refresh, completeLogin, offlineUuid, CLIENT_ID }
