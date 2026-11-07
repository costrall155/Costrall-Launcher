# Costrall Launcher

Modern, hızlı ve şık bir Minecraft launcher'ı. Electron + Fabric/Modrinth altyapısı.

![Version](https://img.shields.io/badge/Minecraft-1.21.x-8b5cf6) ![Platform](https://img.shields.io/badge/Windows-x64-22d3ee)

## Özellikler

- **Microsoft (device code) girişi** + çevrimdışı hesap desteği, çoklu hesap yöneticisi
- **Vanilla ve Fabric** profilleri (istediğin Minecraft sürümü + Fabric Loader sürümü)
- **Modrinth entegrasyonu**: mod ara, tek tıkla kur, bağımlılıkları otomatik indir, kaldır
- **CurseForge entegrasyonu**: aynı arayüzden CurseForge modlarını ara ve zorunlu bağımlılıklarıyla kur
- **Her yerden mod**: doğrudan `.jar` URL'si veya bilgisayarındaki `.jar` dosyalarıyla kurulum, sayfalama ve kaynak/sıralama seçimi
- **Akıllı indirme**: resmî `.minecraft` klasöründeki dosyaları yeniden kullanır (hard-link), hash doğrulaması yapar
- **Otomatik Java algılama** (sürüme uygun Java 21+ seçimi), RAM/çözünürlük/JVM argüman ayarları
- **Canlı konsol**, indirme hızı göstergesi, modern koyu arayüz (özel titlebar, animasyonlar)
- **Sinematik açılış ekranı**, parçacık arka planı, kart eğim/parlama efektleri, yumuşak sayfa geçişleri, sayaç animasyonları
- **Mod detay penceresi** — indirme/takipçi/lisans bilgileri, kaynak bağlantıları ve tek tıkla kurulum
- **Animasyon anahtarı** — Ayarlar'dan tüm efektleri kapatabilirsin (düşük donanım için)
- **NSIS kurulum dosyası** (`.exe`) üretimi

## Geliştirme

```bash
npm install
npm start          # geliştirme modu
npm run dist       # Windows .exe installer üretir (dist/)
```

> Not: `npm install` sonrası Electron binary'si indirilmediyse:
> `node node_modules/electron/install.js`

## Klasör yapısı

```
electron/
  main.js            # pencere + IPC + akışlar
  preload.js         # güvenli köprü
  lib/
    auth.js          # Microsoft / Xbox / Minecraft kimlik doğrulama
    mcmeta.js        # Mojang sürüm manifesti, kütüphane kuralları, Fabric birleştirme
    installer.js     # istemci, kütüphane, asset, native indirme
    launcher.js      # argüman üretimi + java süreci
    modrinth.js      # Modrinth API
    curseforge.js    # CurseForge API (api.curse.tools proxy)
    net.js           # indirme, hash, eşzamanlılık
    store.js         # ayarlar/profiller/hesaplar (JSON)
renderer/
  index.html         # arayüz
  styles.css         # tema
  app.js             # uygulama mantığı
```

## Veri konumu

`%APPDATA%/Costrall Launcher/`
- `costrall.json` — ayarlar, hesaplar, profiller
- `minecraft/` — sürümler, kütüphaneler, assetler, profiller (`instances/`)

## Güvenlik notları

- Hesap token'ları yerel olarak `costrall.json` içinde saklanır. Ortak kullanılan bir bilgisayarda Microsoft hesabı eklemeyin.
- Launcher yalnızca resmî uçlara (Microsoft/Xbox/Mojang) ve Modrinth API'sine bağlanır.
- Çevrimdışı hesaplar yalnızca `online-mode=false` sunucularda çalışır.

## Lisans

MIT
