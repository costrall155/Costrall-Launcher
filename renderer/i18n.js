'use strict'
/* Costrall Launcher - basit i18n */
;(() => {
  const LANGS = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'pt', name: 'Português (BR)', flag: '🇧🇷' }
  ]

  const T = {
    tr: {
      nav_home: 'Ana Sayfa', nav_profiles: 'Profiller', nav_mods: 'Modlar', nav_settings: 'Ayarlar',
      play: 'Oyna', manage_mods: 'Modları Yönet', quick_start: 'Hızlı Başlangıç',
      ready: 'Oynamaya hazır mısın?', create_profile: 'Profil Oluştur', create_profile_first: 'Başlamak için bir profil oluştur.',
      no_account: 'Hesap eklenmedi — çevrimdışı mod kullanılacak.', account_add: 'Hesap ekle', not_logged_in: 'Giriş yapılmadı',
      profiles: 'Profiller', profiles_sub: 'Minecraft sürümlerini ve mod yükleyicilerini yönet', new_profile: '+ Yeni Profil',
      mods: 'Modlar', mods_sub: "Modrinth ve CurseForge'da ara, dosyadan veya URL ile kur",
      settings: 'Ayarlar', settings_sub: 'Launcher ve oyun tercihlerin',
      installed_mods: 'Kurulu Modlar', installed_hint: 'Seçili profile yüklü .jar modları',
      search_mods: 'Mod ara... (ör. sodium, lithium, create, jei)', search: 'Ara', from_file: 'Dosyadan', from_url: "URL'den",
      sort_downloads: 'En çok indirilen', sort_relevance: 'İlgi sırası', sort_updated: 'Son güncellenen', sort_name: 'İsme göre',
      load_more: 'Daha Fazla Yükle', install: 'Kur', installed: 'Kurulu ✓', installing: 'Kuruluyor...',
      details: 'Detaylar', close: 'Kapat', cancel: 'Vazgeç', save: 'Kaydet', remove: 'Kaldır',
      game: 'Oyun', memory: 'Bellek (RAM)', resolution: 'Çözünürlük', fullscreen: 'Tam ekran', java_jvm: 'Java & JVM',
      java_path: 'Java yolu (boş = otomatik)', jvm_args: 'Ek JVM argümanları', behavior: 'Davranış',
      keep_open: 'Başlatırken launcher açık kalsın', show_console: 'Konsolu göster', effects: 'Animasyonlar ve efektler',
      language: 'Dil', folders: 'Klasörler', open_folder: 'Klasörü Aç',
      setup_title: 'Costrall Launcher Kurulumu', setup_sub: 'Başlamadan önce birkaç ayar seç.', setup_lang: 'Dil / Language',
      setup_continue: 'Devam Et', setup_done: 'Kurulumu tamamla',
      recent_news: 'Son Haberler', latest: 'En son', system: 'Sistem', last_play: 'Son oynama',
      fabric_required: 'Fabric profili gerekli', fabric_required_desc: 'Mod kurmak için Profiller sekmesinden bir <strong>Fabric</strong> profili oluştur.',
      no_profiles: 'Henüz profil yok', no_profiles_desc: 'İlk profilinizi oluşturarak başlayın.',
      version_main: 'ana sürümler', mod_loader: 'Yükleyici', mc_version: 'Minecraft sürümü',
      welcome: 'Costrall hazır. İyi oyunlar!', remove_confirm: 'kaldırılsın mı?'
    },
    en: {
      nav_home: 'Home', nav_profiles: 'Profiles', nav_mods: 'Mods', nav_settings: 'Settings',
      play: 'Play', manage_mods: 'Manage Mods', quick_start: 'Quick Start',
      ready: 'Ready to play?', create_profile: 'Create Profile', create_profile_first: 'Create a profile to get started.',
      no_account: 'No account added — offline mode will be used.', account_add: 'Add account', not_logged_in: 'Not signed in',
      profiles: 'Profiles', profiles_sub: 'Manage Minecraft versions and mod loaders', new_profile: '+ New Profile',
      mods: 'Mods', mods_sub: 'Search Modrinth & CurseForge, or install from file/URL',
      settings: 'Settings', settings_sub: 'Launcher and game preferences',
      installed_mods: 'Installed Mods', installed_hint: '.jar mods in the selected profile',
      search_mods: 'Search mods... (e.g. sodium, lithium, create, jei)', search: 'Search', from_file: 'From file', from_url: 'From URL',
      sort_downloads: 'Most downloaded', sort_relevance: 'Relevance', sort_updated: 'Recently updated', sort_name: 'Name',
      load_more: 'Load More', install: 'Install', installed: 'Installed ✓', installing: 'Installing...',
      details: 'Details', close: 'Close', cancel: 'Cancel', save: 'Save', remove: 'Remove',
      game: 'Game', memory: 'Memory (RAM)', resolution: 'Resolution', fullscreen: 'Fullscreen', java_jvm: 'Java & JVM',
      java_path: 'Java path (empty = auto)', jvm_args: 'Extra JVM arguments', behavior: 'Behavior',
      keep_open: 'Keep launcher open while playing', show_console: 'Show console', effects: 'Animations & effects',
      language: 'Language', folders: 'Folders', open_folder: 'Open Folder',
      setup_title: 'Costrall Launcher Setup', setup_sub: 'Choose a few settings before you start.', setup_lang: 'Language',
      setup_continue: 'Continue', setup_done: 'Finish setup',
      recent_news: 'Recent News', latest: 'Latest', system: 'System', last_play: 'Last played',
      fabric_required: 'Fabric profile required', fabric_required_desc: 'Create a <strong>Fabric</strong> profile from Profiles to install mods.',
      no_profiles: 'No profiles yet', no_profiles_desc: 'Create your first profile to get started.',
      version_main: 'release versions', mod_loader: 'Mod loader', mc_version: 'Minecraft version',
      welcome: 'Costrall is ready. Have fun!', remove_confirm: 'remove this mod?'
    },
    es: {
      nav_home: 'Inicio', nav_profiles: 'Perfiles', nav_mods: 'Mods', nav_settings: 'Ajustes',
      play: 'Jugar', manage_mods: 'Gestionar mods', quick_start: 'Inicio rápido',
      ready: '¿Listo para jugar?', create_profile: 'Crear perfil', create_profile_first: 'Crea un perfil para empezar.',
      no_account: 'Sin cuenta — se usará modo sin conexión.', account_add: 'Añadir cuenta', not_logged_in: 'No has iniciado sesión',
      profiles: 'Perfiles', profiles_sub: 'Gestiona versiones de Minecraft y cargadores', new_profile: '+ Nuevo perfil',
      mods: 'Mods', mods_sub: 'Busca en Modrinth y CurseForge, o instala desde archivo/URL',
      settings: 'Ajustes', settings_sub: 'Preferencias del launcher y del juego',
      installed_mods: 'Mods instalados', installed_hint: 'Mods .jar del perfil seleccionado',
      search_mods: 'Buscar mods... (ej. sodium, lithium, create, jei)', search: 'Buscar', from_file: 'Desde archivo', from_url: 'Desde URL',
      sort_downloads: 'Más descargados', sort_relevance: 'Relevancia', sort_updated: 'Actualizados', sort_name: 'Nombre',
      load_more: 'Cargar más', install: 'Instalar', installed: 'Instalado ✓', installing: 'Instalando...',
      details: 'Detalles', close: 'Cerrar', cancel: 'Cancelar', save: 'Guardar', remove: 'Quitar',
      game: 'Juego', memory: 'Memoria (RAM)', resolution: 'Resolución', fullscreen: 'Pantalla completa', java_jvm: 'Java y JVM',
      java_path: 'Ruta de Java (vacío = auto)', jvm_args: 'Argumentos JVM extra', behavior: 'Comportamiento',
      keep_open: 'Mantener el launcher abierto al jugar', show_console: 'Mostrar consola', effects: 'Animaciones y efectos',
      language: 'Idioma', folders: 'Carpetas', open_folder: 'Abrir carpeta',
      setup_title: 'Configuración de Costrall', setup_sub: 'Elige algunos ajustes antes de empezar.', setup_lang: 'Idioma / Language',
      setup_continue: 'Continuar', setup_done: 'Finalizar',
      recent_news: 'Noticias recientes', latest: 'Último', system: 'Sistema', last_play: 'Última partida',
      fabric_required: 'Se requiere perfil Fabric', fabric_required_desc: 'Crea un perfil <strong>Fabric</strong> en Perfiles para instalar mods.',
      no_profiles: 'Aún no hay perfiles', no_profiles_desc: 'Crea tu primer perfil para empezar.',
      version_main: 'versiones principales', mod_loader: 'Cargador', mc_version: 'Versión de Minecraft',
      welcome: 'Costrall está listo. ¡A jugar!', remove_confirm: '¿quitar este mod?'
    },
    de: {
      nav_home: 'Start', nav_profiles: 'Profile', nav_mods: 'Mods', nav_settings: 'Einstellungen',
      play: 'Spielen', manage_mods: 'Mods verwalten', quick_start: 'Schnellstart',
      ready: 'Bereit zum Spielen?', create_profile: 'Profil erstellen', create_profile_first: 'Erstelle ein Profil, um zu starten.',
      no_account: 'Kein Konto — Offline-Modus wird verwendet.', account_add: 'Konto hinzufügen', not_logged_in: 'Nicht angemeldet',
      profiles: 'Profile', profiles_sub: 'Minecraft-Versionen und Mod-Loader verwalten', new_profile: '+ Neues Profil',
      mods: 'Mods', mods_sub: 'Suche auf Modrinth & CurseForge oder installiere per Datei/URL',
      settings: 'Einstellungen', settings_sub: 'Launcher- und Spieleinstellungen',
      installed_mods: 'Installierte Mods', installed_hint: '.jar-Mods im ausgewählten Profil',
      search_mods: 'Mods suchen... (z. B. sodium, lithium, create, jei)', search: 'Suchen', from_file: 'Aus Datei', from_url: 'Von URL',
      sort_downloads: 'Meiste Downloads', sort_relevance: 'Relevanz', sort_updated: 'Zuletzt aktualisiert', sort_name: 'Name',
      load_more: 'Mehr laden', install: 'Installieren', installed: 'Installiert ✓', installing: 'Installiere...',
      details: 'Details', close: 'Schließen', cancel: 'Abbrechen', save: 'Speichern', remove: 'Entfernen',
      game: 'Spiel', memory: 'Arbeitsspeicher (RAM)', resolution: 'Auflösung', fullscreen: 'Vollbild', java_jvm: 'Java & JVM',
      java_path: 'Java-Pfad (leer = auto)', jvm_args: 'Zusätzliche JVM-Argumente', behavior: 'Verhalten',
      keep_open: 'Launcher beim Spielen geöffnet lassen', show_console: 'Konsole anzeigen', effects: 'Animationen & Effekte',
      language: 'Sprache', folders: 'Ordner', open_folder: 'Ordner öffnen',
      setup_title: 'Costrall Launcher Einrichtung', setup_sub: 'Wähle ein paar Einstellungen, bevor du startest.', setup_lang: 'Sprache / Language',
      setup_continue: 'Weiter', setup_done: 'Fertig',
      recent_news: 'Neuigkeiten', latest: 'Neueste', system: 'System', last_play: 'Zuletzt gespielt',
      fabric_required: 'Fabric-Profil erforderlich', fabric_required_desc: 'Erstelle ein <strong>Fabric</strong>-Profil unter Profile, um Mods zu installieren.',
      no_profiles: 'Noch keine Profile', no_profiles_desc: 'Erstelle dein erstes Profil, um zu starten.',
      version_main: 'Hauptversionen', mod_loader: 'Mod-Loader', mc_version: 'Minecraft-Version',
      welcome: 'Costrall ist bereit. Viel Spaß!', remove_confirm: 'diesen Mod entfernen?'
    },
    pt: {
      nav_home: 'Início', nav_profiles: 'Perfis', nav_mods: 'Mods', nav_settings: 'Configurações',
      play: 'Jogar', manage_mods: 'Gerenciar mods', quick_start: 'Início rápido',
      ready: 'Pronto para jogar?', create_profile: 'Criar perfil', create_profile_first: 'Crie um perfil para começar.',
      no_account: 'Nenhuma conta — o modo offline será usado.', account_add: 'Adicionar conta', not_logged_in: 'Não conectado',
      profiles: 'Perfis', profiles_sub: 'Gerencie versões do Minecraft e loaders', new_profile: '+ Novo perfil',
      mods: 'Mods', mods_sub: 'Busque no Modrinth e CurseForge, ou instale por arquivo/URL',
      settings: 'Configurações', settings_sub: 'Preferências do launcher e do jogo',
      installed_mods: 'Mods instalados', installed_hint: 'Mods .jar no perfil selecionado',
      search_mods: 'Buscar mods... (ex.: sodium, lithium, create, jei)', search: 'Buscar', from_file: 'Do arquivo', from_url: 'Da URL',
      sort_downloads: 'Mais baixados', sort_relevance: 'Relevância', sort_updated: 'Atualizados', sort_name: 'Nome',
      load_more: 'Carregar mais', install: 'Instalar', installed: 'Instalado ✓', installing: 'Instalando...',
      details: 'Detalhes', close: 'Fechar', cancel: 'Cancelar', save: 'Salvar', remove: 'Remover',
      game: 'Jogo', memory: 'Memória (RAM)', resolution: 'Resolução', fullscreen: 'Tela cheia', java_jvm: 'Java e JVM',
      java_path: 'Caminho do Java (vazio = auto)', jvm_args: 'Argumentos JVM extras', behavior: 'Comportamento',
      keep_open: 'Manter o launcher aberto ao jogar', show_console: 'Mostrar console', effects: 'Animações e efeitos',
      language: 'Idioma', folders: 'Pastas', open_folder: 'Abrir pasta',
      setup_title: 'Configuração do Costrall', setup_sub: 'Escolha algumas opções antes de começar.', setup_lang: 'Idioma / Language',
      setup_continue: 'Continuar', setup_done: 'Concluir',
      recent_news: 'Notícias recentes', latest: 'Mais recente', system: 'Sistema', last_play: 'Última vez',
      fabric_required: 'Perfil Fabric necessário', fabric_required_desc: 'Crie um perfil <strong>Fabric</strong> em Perfis para instalar mods.',
      no_profiles: 'Nenhum perfil ainda', no_profiles_desc: 'Crie seu primeiro perfil para começar.',
      version_main: 'versões principais', mod_loader: 'Loader', mc_version: 'Versão do Minecraft',
      welcome: 'Costrall pronto. Bom jogo!', remove_confirm: 'remover este mod?'
    }
  }

  let current = 'tr'
  const t = (key, fallback) => (T[current] && T[current][key]) || (T.en && T.en[key]) || fallback || key

  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n')
      if (key) el.textContent = t(key)
    })
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder')
      if (key) el.setAttribute('placeholder', t(key))
    })
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html')
      if (key) el.innerHTML = t(key)
    })
    document.documentElement.lang = current === 'pt' ? 'pt-BR' : current
  }

  function setLang(code) {
    if (T[code]) current = code
    applyI18n()
    window.dispatchEvent(new CustomEvent('costrall:lang', { detail: { code: current } }))
  }

  window.CostrallI18n = { LANGS, t, setLang, applyI18n, getLang: () => current }
})()
