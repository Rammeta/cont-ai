const { app, BrowserWindow, ipcMain, dialog, shell, Notification, Menu, Tray, nativeImage } = require('electron');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.contai.difal');
}
const path = require('path');
const fs = require('fs');
const SefazManager = require('./sefaz/sefazManager.cjs');
const { getStateDatabase } = require('./sefaz/stateDatabase.cjs');
const { CnpjService } = require('./sefaz/cnpjService.cjs');
const { rodarCaptacaoNfseEmpresa } = require('./nfse/robotNfse.cjs');
const { consultarTomadasSP, gerarPdfPadraoSp } = require('./nfse/spService.cjs');
const { decryptPassword } = require('./nfse/cryptoUtils.cjs');
const {
  scanNotasEmpresa,
  invalidateNfseCache,
  calcularMetricas,
  gerarCsvRelatorio,
  gerarPacoteZip
} = require('./nfse/reportsNfse.cjs');
const DANFSe = require('./nfse/danfse.cjs');
const dpsService = require('./nfse/dpsService.cjs');
const PDFLib = require('pdf-lib');
const qrcode = require('qrcode-generator');

// Buffer rotativo em memória para registro de diagnóstico de suporte
const rollingLogs = [];
const MAX_ROLLING_LOGS = 350;

function pushDiagnosticLog(level, args) {
  try {
    const msg = args.map(a => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
      if (typeof a === 'object' && a !== null) {
        try { return JSON.stringify(a); } catch (_) { return String(a); }
      }
      return String(a);
    }).join(' ');
    const entry = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${msg}`;
    rollingLogs.push(entry);
    if (rollingLogs.length > MAX_ROLLING_LOGS) {
      rollingLogs.shift();
    }
  } catch (_) {}
}

// Cache em memória de alta performance para métricas de empresas (TTL 60s)
const companiesMetricsCache = new Map();
function invalidateCompanyMetrics(cnpj) {
  if (!cnpj) {
    invalidateNfseCache();
    return;
  }
  const clean = String(cnpj).replace(/\D/g, '');
  companiesMetricsCache.delete(clean);
  invalidateNfseCache(clean);
}

const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = function(...args) {
  pushDiagnosticLog('info', args);
  origLog.apply(console, args);
};
console.warn = function(...args) {
  pushDiagnosticLog('warn', args);
  origWarn.apply(console, args);
};
console.error = function(...args) {
  pushDiagnosticLog('error', args);
  origError.apply(console, args);
};

function loadNfseState(companyDir, cnpj) {
  const matchCnpj = String(companyDir || '').match(/(\d{14})/);
  const clean = String(cnpj || (matchCnpj ? matchCnpj[1] : path.basename(companyDir))).replace(/\D/g, '');
  const db = getStateDatabase(app.getPath('userData'));
  db.migrateLegacyFiles(companyDir, clean);
  return db.getState(clean, 'nfse', { ultimoNsuNfse: 0, lastSync: null });
}

function saveNfseState(companyDir, data, cnpj) {
  const matchCnpj = String(companyDir || '').match(/(\d{14})/);
  const clean = String(cnpj || (matchCnpj ? matchCnpj[1] : path.basename(companyDir))).replace(/\D/g, '');
  const db = getStateDatabase(app.getPath('userData'));
  const current = loadNfseState(companyDir, clean);
  const updated = { ...current, ...data };
  db.saveState(clean, 'nfse', updated);
  return updated;
}

// Garantir instancia unica em execucao
const gotTheLock = process.env.CAPTURE_SCREENS === '1' ? true : app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let tray = null;
let isQuitting = false;
let hasNotifiedBackground = false;

// Diretório base para armazenar dados e XMLs das empresas
const defaultStorageDir = path.join(app.getPath('userData'), 'sefaz_empresas');
const settingsPath = path.join(app.getPath('userData'), 'app_settings.json');
getStateDatabase(app.getPath('userData'));

function loadSettings() {
  const defaults = {
    customStorageDir: defaultStorageDir,
    customServerCertDir: '',
    modelSchedulers: {
      nfe: { enabled: false, time: '08:00', lastRunDate: null },
      nfce: { enabled: false, time: '18:30', lastRunDate: null },
      cte: { enabled: false, time: '08:30', lastRunDate: null },
      nfse: { enabled: false, time: '09:00', lastRunDate: null }
    },
    scheduler: {
      enabled: false,
      time: '08:00',
      lastRunDate: null
    },
    nfseScheduler: {
      enabled: false,
      time: '18:00',
      lastRunDate: null
    }
  };
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const savedModels = data.modelSchedulers || {};
      const mergedModels = {
        nfe: {
          ...defaults.modelSchedulers.nfe,
          ...(data.scheduler || {}),
          ...(savedModels.nfe || {})
        },
        nfce: {
          ...defaults.modelSchedulers.nfce,
          ...(savedModels.nfce || {})
        },
        cte: {
          ...defaults.modelSchedulers.cte,
          ...(savedModels.cte || {})
        },
        nfse: {
          ...defaults.modelSchedulers.nfse,
          ...(data.nfseScheduler || {}),
          ...(savedModels.nfse || {})
        }
      };
      return {
        ...defaults,
        ...data,
        modelSchedulers: mergedModels,
        scheduler: { ...defaults.scheduler, ...(data.scheduler || {}), ...mergedModels.nfe },
        nfseScheduler: { ...defaults.nfseScheduler, ...(data.nfseScheduler || {}), ...mergedModels.nfse }
      };
    }
  } catch (e) {
    console.error('Erro ao ler app_settings.json:', e);
  }
  return defaults;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {
    console.error('Erro ao salvar app_settings.json:', e);
  }
}

const currentSettings = loadSettings();
const initialDataDir = (currentSettings.customStorageDir && typeof currentSettings.customStorageDir === 'string')
  ? currentSettings.customStorageDir
  : defaultStorageDir;

const sefazManager = new SefazManager(initialDataDir);
const cnpjService = new CnpjService(initialDataDir);

function updateTrayMenu() {
  if (!tray) return;

  const settings = loadSettings();
  const ms = settings.modelSchedulers || {};
  const activeModels = [];
  if (ms.nfe?.enabled) activeModels.push(`NF-e (${ms.nfe.time})`);
  if (ms.nfce?.enabled) activeModels.push(`NFC-e (${ms.nfce.time})`);
  if (ms.cte?.enabled) activeModels.push(`CT-e (${ms.cte.time})`);
  if (ms.nfse?.enabled) activeModels.push(`NFS-e (${ms.nfse.time})`);

  const schedulerStatusText = activeModels.length > 0
    ? `Agendadores: ${activeModels.join(' | ')}`
    : 'Agendadores: Desativados';

  let isAutoStart = false;
  try {
    isAutoStart = app.getLoginItemSettings().openAtLogin;
  } catch (e) {}

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir CONT-AI',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Sincronizar Todas as Empresas',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('scheduler:trigger-sync');
        }
      }
    },
    { type: 'separator' },
    {
      label: schedulerStatusText,
      enabled: false
    },
    {
      label: 'Iniciar com o Windows',
      type: 'checkbox',
      checked: isAutoStart,
      click: (menuItem) => {
        app.setLoginItemSettings({
          openAtLogin: menuItem.checked,
          openAsHidden: true
        });
        updateTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Sair do CONT-AI',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function loadAppIcon() {
  const icoPath = path.join(__dirname, 'assets', 'icon.ico');
  const pngPath = path.join(__dirname, 'assets', 'logo.png');
  try {
    if (fs.existsSync(icoPath)) {
      const img = nativeImage.createFromBuffer(fs.readFileSync(icoPath));
      if (!img.isEmpty()) return img;
    }
    if (fs.existsSync(pngPath)) {
      const img = nativeImage.createFromBuffer(fs.readFileSync(pngPath));
      if (!img.isEmpty()) return img;
    }
  } catch (e) {
    console.error('Erro ao carregar icone do app:', e);
  }
  return fs.existsSync(icoPath) ? icoPath : undefined;
}

function createTray() {
  const appIcon = loadAppIcon();
  if (!appIcon) return;

  tray = new Tray(appIcon);
  tray.setToolTip('CONT-AI | Gestor de Movimento Fiscal');

  tray.on('double-click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  tray.on('click', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  updateTrayMenu();
}

function createWindow () {
  const appIcon = loadAppIcon();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 560,
    backgroundColor: '#0F172A',
    title: 'CONT-AI | Gestor de Movimento Fiscal',
    icon: appIcon,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  if (appIcon && typeof mainWindow.setIcon === 'function') {
    try { mainWindow.setIcon(appIcon); } catch (_) {}
  }

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.error(`[Renderer Log ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error(`[Renderer did-fail-load] Code ${code}: ${desc}`);
  });

  mainWindow.webContents.on('render-process-gone', (e, details) => {
    console.error('[Renderer gone]', details);
  });

  // Remove completamente a barra de menus padrão do Electron
  mainWindow.setMenu(null);
  Menu.setApplicationMenu(null);

  // Ao clicar no botao de fechar, oculta a janela na bandeja em vez de encerrar
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (!hasNotifiedBackground && Notification && Notification.isSupported()) {
        hasNotifiedBackground = true;
        try {
          const notif = new Notification({
            title: 'CONT-AI | Gestor de Movimento Fiscal',
            body: 'O aplicativo continua em execucao em segundo plano para realizar as rotinas agendadas.',
            icon: iconPath,
            silent: true
          });
          notif.show();
        } catch (e) {}
      }
      return false;
    }
  });

  // Em modo de desenvolvimento, se houver VITE_DEV_SERVER_URL carrega URL, senão carrega dist
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

// ----------------------------------------------------
// IPC HANDLERS PARA SEFAZ E ARQUIVOS
// ----------------------------------------------------

// 1. Diálogo nativo para selecionar o arquivo .pfx (com proteção para unidades de rede e fallback seguro)
ipcMain.handle('dialog:open-cert', async (event, currentPath) => {
  try {
    let defaultPath = undefined;
    if (currentPath && typeof currentPath === 'string') {
      try {
        if (fs.existsSync(currentPath)) {
          const stat = fs.statSync(currentPath);
          defaultPath = stat.isDirectory() ? currentPath : path.dirname(currentPath);
        }
      } catch (e) {
        defaultPath = undefined;
      }
    }

    if (!defaultPath) {
      if (fs.existsSync('C:\\Certificados')) {
        defaultPath = 'C:\\Certificados';
      } else if (fs.existsSync('Z:\\CERTIFICADOS')) {
        defaultPath = 'Z:\\CERTIFICADOS';
      } else {
        defaultPath = app.getPath('desktop');
      }
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Certificado Digital A1 (.pfx ou .p12)',
      defaultPath,
      filters: [
        { name: 'Certificado Digital (*.pfx, *.p12)', extensions: ['pfx', 'p12'] },
        { name: 'Todos os Arquivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  } catch (err) {
    console.error('Erro ao abrir diálogo nativo na pasta de rede:', err.message);
    // Fallback de emergência caso o Windows rejeite o caminho de rede no Explorer nativo
    try {
      const fallbackResult = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar Certificado Digital A1 (.pfx ou .p12)',
        defaultPath: app.getPath('desktop'),
        filters: [
          { name: 'Certificado Digital (*.pfx, *.p12)', extensions: ['pfx', 'p12'] },
          { name: 'Todos os Arquivos', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      if (fallbackResult.canceled || fallbackResult.filePaths.length === 0) {
        return null;
      }
      return fallbackResult.filePaths[0];
    } catch (e2) {
      return null;
    }
  }
});

// Helper para busca recursiva de certificados (.pfx / .p12)
function scanDirForCerts(dir, depth = 0, maxDepth = 3) {
  let certs = [];
  if (!dir || typeof dir !== 'string') return certs;
  try {
    if (!fs.existsSync(dir)) return certs;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.pfx' || ext === '.p12') {
          const pwdMatch = entry.name.match(/_senha[ _]+([^_]+?)_/i)
                        || entry.name.match(/senha[ _]+([^_.]+)/i)
                        || entry.name.match(/_([0-9]{4,8})_/);
          certs.push({
            name: entry.name,
            fullPath,
            extractedPassword: pwdMatch ? pwdMatch[1].trim() : '',
            dir,
            relativePath: path.relative(dir, fullPath)
          });
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && depth < maxDepth) {
        certs = certs.concat(scanDirForCerts(fullPath, depth + 1, maxDepth));
      }
    }
  } catch (err) {
    console.warn(`Erro ao escanear diretório ${dir}:`, err.message);
  }
  return certs;
}

// 1.1. Listar certificados disponíveis na rede ou servidor
ipcMain.handle('sefaz:list-network-certs', async (event, customDir) => {
  try {
    const settings = loadSettings();
    const candidateDirs = [];

    // Prioridade 1: Diretório customizado passado como parâmetro da chamada
    if (customDir && typeof customDir === 'string' && customDir.trim()) {
      candidateDirs.push(customDir.trim());
    }

    // Prioridade 2: Diretório do servidor configurado nas preferências
    if (settings.customServerCertDir && typeof settings.customServerCertDir === 'string' && settings.customServerCertDir.trim()) {
      const sDir = settings.customServerCertDir.trim();
      if (!candidateDirs.includes(sDir)) {
        candidateDirs.push(sDir);
      }
    }

    // Prioridade 3: Diretórios candidatos usuais no ambiente corporativo
    const commonDirs = [
      'C:\\Certificados',
      'Z:\\CERTIFICADOS',
      'Z:\\DIVERSOS\\CERTIFICADOS',
      'Y:\\CERTIFICADOS',
      'D:\\Certificados',
      path.join(app.getPath('desktop'), 'Certificados'),
      path.join(__dirname, 'certs')
    ];

    for (const d of commonDirs) {
      if (!candidateDirs.includes(d)) {
        candidateDirs.push(d);
      }
    }

    let foundDir = null;
    let allFoundCerts = [];

    for (const dir of candidateDirs) {
      try {
        if (fs.existsSync(dir)) {
          const certs = scanDirForCerts(dir, 0, 3);
          if (certs.length > 0) {
            foundDir = dir;
            allFoundCerts = certs;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (allFoundCerts.length > 0) {
      return { success: true, dir: foundDir, certs: allFoundCerts };
    }

    const firstAccessibleDir = candidateDirs.find((d) => {
      try { return fs.existsSync(d); } catch { return false; }
    });

    return {
      success: false,
      dir: firstAccessibleDir || settings.customServerCertDir || candidateDirs[0] || '',
      certs: [],
      error: 'Nenhum certificado digital (.pfx ou .p12) foi localizado no diretório configurado. Utilize o botão "Alterar Pasta" para selecionar a pasta correta da rede ou servidor.'
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 1.2. Listar certificados digitais instalados no Windows Certificate Store
ipcMain.handle('system:list-installed-certs', async () => {
  return new Promise((resolve) => {
    try {
      const psScript = `
$certs = Get-ChildItem -Path Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.HasPrivateKey } | ForEach-Object {
    $c = $_
    $exp = $false
    try {
        $bytes = $c.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, 'probe')
        if ($bytes -and $bytes.Length -gt 0) { $exp = $true }
    } catch {}
    
    $doc = ''
    if ($c.Subject -match '(?::| - |\\s)(\\d{14}|\\d{11})(?:,|$|\\s)') {
        $doc = $matches[1]
    } elseif ($c.Subject -match '(\\d{14})') {
        $doc = $matches[1]
    } elseif ($c.Subject -match '(\\d{11})') {
        $doc = $matches[1]
    }

    $cn = ''
    if ($c.Subject -match 'CN=([^,]+)') {
        $cn = $matches[1].Trim()
    }
    $cleanName = $cn -replace ':\\d{11,14}$', '' -replace ' - \\d{11,14}$', ''

    $issuerCn = ''
    if ($c.Issuer -match 'CN=([^,]+)') {
        $issuerCn = $matches[1].Trim()
    } else {
        $issuerCn = $c.Issuer
    }
    
    [PSCustomObject]@{
        Subject = $c.Subject
        CommonName = $cn
        CleanName = $cleanName
        Issuer = $issuerCn
        Thumbprint = $c.Thumbprint
        SerialNumber = $c.SerialNumber
        NotBefore = $c.NotBefore.ToString('yyyy-MM-ddTHH:mm:ss')
        NotAfter = $c.NotAfter.ToString('yyyy-MM-ddTHH:mm:ss')
        HasPrivateKey = $c.HasPrivateKey
        IsExportable = $exp
        Documento = $doc
    }
}
ConvertTo-Json -InputObject $certs -Compress
`;
      const cp = require('child_process');
      const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
      cp.exec(
        `powershell -NoProfile -EncodedCommand ${b64}`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 15000 },
        (err, stdout) => {
          if (err) {
            console.error('Erro ao listar certificados instalados no Windows:', err);
            return resolve({ success: false, error: err.message, certs: [] });
          }
          try {
            const raw = stdout ? stdout.trim() : '';
            if (!raw) {
              return resolve({ success: true, certs: [] });
            }
            const parsed = JSON.parse(raw);
            const list = Array.isArray(parsed) ? parsed : [parsed];

            // Deduplica por Thumbprint e calcula validade
            const seen = new Set();
            const now = new Date();
            const processed = [];

            for (const item of list) {
              if (!item.Thumbprint || seen.has(item.Thumbprint)) continue;
              seen.add(item.Thumbprint);

              const notAfterDate = new Date(item.NotAfter);
              const daysRemaining = Math.ceil((notAfterDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              const isExpired = now > notAfterDate;

              processed.push({
                ...item,
                daysRemaining,
                isExpired
              });
            }

            // Ordena pelos válidos primeiro, depois por dias restantes decrescente
            processed.sort((a, b) => {
              if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
              return b.daysRemaining - a.daysRemaining;
            });

            return resolve({ success: true, certs: processed });
          } catch (pe) {
            console.error('Erro ao converter JSON de certificados:', pe.message);
            return resolve({ success: false, error: pe.message, certs: [] });
          }
        }
      );
    } catch (e) {
      return resolve({ success: false, error: e.message, certs: [] });
    }
  });
});

// 1.3. Exportar certificado instalado no Windows (se a chave for exportável)
ipcMain.handle('system:export-installed-cert', async (event, { thumbprint, password }) => {
  return new Promise((resolve) => {
    try {
      if (!thumbprint) return resolve({ success: false, error: 'Thumbprint não informado.' });

      const cacheDir = path.join(app.getPath('userData'), 'cached_certs');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      const pfxPassword = password || `cont_ai_${thumbprint.slice(0, 8)}`;
      const destFile = path.join(cacheDir, `${thumbprint}.pfx`);

      if (fs.existsSync(destFile)) {
        return resolve({ success: true, pfxPath: destFile, password: pfxPassword });
      }

      const psScript = `
$c = Get-ChildItem -Path Cert:\\CurrentUser\\My, Cert:\\LocalMachine\\My -ErrorAction SilentlyContinue | Where-Object { $_.Thumbprint -eq '${thumbprint}' } | Select-Object -First 1
if (-not $c) {
    Write-Output "CERT_NOT_FOUND"
    exit 1
}
$secPass = ConvertTo-SecureString -String '${pfxPassword}' -Force -AsPlainText
try {
    Export-PfxCertificate -Cert $c -FilePath '${destFile.replace(/\\/g, '\\\\')}' -Password $secPass | Out-Null
    Write-Output "SUCCESS"
} catch {
    Write-Output ("EXPORT_ERROR:" + $_.Exception.Message)
    exit 2
}
`;
      const cp = require('child_process');
      const b64 = Buffer.from(psScript, 'utf16le').toString('base64');
      cp.exec(`powershell -NoProfile -EncodedCommand ${b64}`, { timeout: 10000 }, (err, stdout) => {
        const out = stdout ? stdout.trim() : '';
        if (out.includes('SUCCESS') && fs.existsSync(destFile)) {
          return resolve({ success: true, pfxPath: destFile, password: pfxPassword });
        } else {
          return resolve({
            success: false,
            error: out.replace('EXPORT_ERROR:', '') || err?.message || 'Chave privada protegida pelo Windows e não exportável.'
          });
        }
      });
    } catch (e) {
      return resolve({ success: false, error: e.message });
    }
  });
});

// 2. Testar certificado
ipcMain.handle('sefaz:test-cert', async (event, payload) => {
  try {
    const norm = typeof payload === 'object' && payload !== null ? {
      ...payload,
      thumbprint: payload.thumbprint || payload.certThumbprint || '',
      certThumbprint: payload.certThumbprint || payload.thumbprint || ''
    } : payload;
    const info = sefazManager.testCertificate(norm || {});
    return { success: true, info };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3. Sincronizar notas da SEFAZ
ipcMain.handle('sefaz:sync-company', async (event, payload) => {
  try {
    const company = payload.company || payload;
    const resetNsu = !!payload.resetNsu;
    const clearManifestations = !!payload.clearManifestations;
    const targetNsu = payload.targetNsu || '0';
    const forceSync = !!payload.forceSync;

    const result = await sefazManager.syncCompany({
      company,
      resetNsu,
      clearManifestations,
      targetNsu,
      forceSync,
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sefaz:sync-progress', {
            status: String(info?.status || 'info'),
            message: String(info?.message || '')
          });
        }
      }
    });

    if (result && result.isCooldown) {
      return { success: false, ...result };
    }

    invalidateCompanyMetrics(company?.cnpj);
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3.1. Obter estado do NSU e estatísticas da empresa
ipcMain.handle('sefaz:get-company-state', async (event, { cnpj, razaoSocial }) => {
  try {
    const result = sefazManager.getCompanyState({ cnpj, razaoSocial });
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 3.2. Reiniciar ponteiro de NSU da empresa
ipcMain.handle('sefaz:reset-nsu', async (event, { cnpj, targetNsu, clearManifestations, razaoSocial, clearFiles }) => {
  try {
    const result = sefazManager.resetCompanyNsu({ cnpj, targetNsu, clearManifestations, razaoSocial, clearFiles });
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 4. Listar meses com notas baixadas
ipcMain.handle('sefaz:list-months', async (event, { cnpj, razaoSocial }) => {
  try {
    const months = sefazManager.listAvailableMonths({ cnpj, razaoSocial });
    return { success: true, months };
  } catch (err) {
    return { success: false, error: err.message, months: [] };
  }
});

// 5. Ler e carregar XMLs para o cálculo do DIFAL
ipcMain.handle('sefaz:list-xmls', async (event, { cnpj, razaoSocial, yearMonth }) => {
  try {
    const xmls = sefazManager.listCompanyXmls({ cnpj, razaoSocial, yearMonth });
    return { success: true, xmls };
  } catch (err) {
    return { success: false, error: err.message, xmls: [] };
  }
});

// 5.1. Ler o conteúdo de XMLs específicos sob demanda (para cálculo do DIFAL)
ipcMain.handle('sefaz:read-xmls-content', async (event, { filePaths }) => {
  try {
    const results = sefazManager.readXmlsContent(filePaths);
    return { success: true, results };
  } catch (err) {
    return { success: false, error: err.message, results: [] };
  }
});

// 5.2. Sincronizar NFC-e (Saídas Modelo 65 - SAE SEFAZ-SP)
ipcMain.handle('sefaz:sync-nfce', async (event, payload) => {
  try {
    const company = payload.company || payload;
    const diasRetroativos = Number(payload.diasRetroativos) || 90;
    const forceFullScan = !!payload.forceFullScan;

    const result = await sefazManager.syncCompanyNfce({
      company,
      diasRetroativos,
      forceFullScan,
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sefaz:sync-nfce-progress', info);
        }
      }
    });

    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.3. Listar NFC-e da Empresa
ipcMain.handle('sefaz:list-nfce', async (event, { cnpj, razaoSocial, yearMonth }) => {
  try {
    const list = sefazManager.listCompanyNfceXmls({ cnpj, razaoSocial, yearMonth });
    const months = sefazManager.listAvailableNfceMonths({ cnpj, razaoSocial });
    return { success: true, list, months };
  } catch (err) {
    return { success: false, error: err.message, list: [], months: [] };
  }
});

// 5.3.1. Obter Estado do Cache de NFC-e
ipcMain.handle('sefaz:get-nfce-cache-state', async (event, { cnpj, razaoSocial }) => {
  try {
    const state = sefazManager.getCompanyNfceCacheState({ cnpj, razaoSocial });
    return { success: true, result: state, state };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.3.2. Reiniciar Cache de NFC-e da Empresa
ipcMain.handle('sefaz:reset-nfce-cache', async (event, { cnpj, razaoSocial, clearFiles }) => {
  try {
    const res = sefazManager.resetCompanyNfceCache({ cnpj, razaoSocial, clearFiles });
    return { success: true, ...res };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function findLatestModelFolder(companyDir, modelName) {
  if (!fs.existsSync(companyDir)) {
    fs.mkdirSync(companyDir, { recursive: true });
    return companyDir;
  }
  try {
    const years = fs.readdirSync(companyDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && /^\d{4}$/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();
    for (const year of years) {
      const yearPath = path.join(companyDir, year);
      const months = fs.readdirSync(yearPath, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort()
        .reverse();
      for (const month of months) {
        const candidate = path.join(yearPath, month, modelName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  } catch (_) {}
  return companyDir;
}

// 5.4. Abrir Pasta de NFC-e da Empresa
ipcMain.handle('sefaz:open-nfce-folder', async (event, { cnpj, razaoSocial }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = sefazManager.getCompanyDir(cleanCnpj, razaoSocial);
    const targetDir = findLatestModelFolder(companyDir, 'NFCE');
    await shell.openPath(targetDir);
    return { success: true, dir: targetDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.5. Abrir ou Gerar sob demanda DANFE PDF de NFC-e
ipcMain.handle('sefaz:open-nfce-pdf', async (event, { pdfPath, xmlPath }) => {
  try {
    if (pdfPath && fs.existsSync(pdfPath)) {
      await shell.openPath(pdfPath);
      return { success: true };
    }
    if (xmlPath && fs.existsSync(xmlPath)) {
      const DanfeService = require('./sefaz/danfeService.cjs');
      const danfe = new DanfeService();
      const generatedPdfPath = xmlPath.replace(/(-nfce)?\.xml$/i, '-danfe.pdf');
      await danfe.gerarDanfeFromFile(xmlPath, generatedPdfPath);
      if (fs.existsSync(generatedPdfPath)) {
        await shell.openPath(generatedPdfPath);
        return { success: true, pdfPath: generatedPdfPath };
      }
    }
    return { success: false, error: 'DANFE não localizado.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.6. Exportar competência de NFC-e em ZIP (XMLs, DANFEs ou Ambos)
ipcMain.handle('sefaz:export-nfce-competencia', async (event, { cnpj, razaoSocial, yearMonth, exportType = 'all' }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const compLabel = yearMonth && yearMonth !== 'all' ? yearMonth : 'Todas_Competencias';
    const typeLabel = exportType === 'all' ? 'Completo_XML_PDF' : (exportType === 'pdf' ? 'DANFEs_PDF' : 'XMLs');
    const safeName = (razaoSocial || 'Empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const defaultFilename = `NFCE_${safeName}_${compLabel}_${typeLabel}.zip`;

    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Arquivo Compactado (.zip) das NFC-e',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo ZIP (*.zip)', extensions: ['zip'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    const result = sefazManager.exportNfceCompetencia({
      cnpj: cleanCnpj,
      razaoSocial,
      yearMonth,
      exportType,
      targetZipPath: saveDialog.filePath
    });

    shell.showItemInFolder(saveDialog.filePath);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.7. Salvar XML individual de NFC-e
ipcMain.handle('sefaz:save-single-nfce-xml', async (event, { cnpj, razaoSocial, chNFe, xmlPath }) => {
  try {
    let sourceXml = xmlPath;
    if (!sourceXml || !fs.existsSync(sourceXml)) {
      const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
      sourceXml = sefazManager.getXmlPath({ cnpj: cleanCnpj, razaoSocial, chNFe });
    }

    if (!sourceXml || !fs.existsSync(sourceXml)) {
      return { success: false, error: 'Arquivo XML da NFC-e não localizado.' };
    }

    const defaultFilename = `${chNFe}-nfce.xml`;
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Arquivo XML da NFC-e',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo XML (*.xml)', extensions: ['xml'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    fs.copyFileSync(sourceXml, saveDialog.filePath);
    return { success: true, filePath: saveDialog.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.8. Sincronizar CT-e da Empresa (Ambiente Nacional via CTeDistribuicaoDFe)
ipcMain.handle('sefaz:sync-cte', async (event, { company }) => {
  try {
    const result = await sefazManager.syncCompanyCte({
      company,
      onProgress: (p) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sefaz:sync-cte-progress', p);
        }
      }
    });
    invalidateCompanyMetrics(company?.cnpj);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.9. Listar CT-e da Empresa
ipcMain.handle('sefaz:list-cte', async (event, { cnpj, razaoSocial, yearMonth }) => {
  try {
    const list = sefazManager.listCompanyCteXmls({ cnpj, razaoSocial, yearMonth });
    const months = sefazManager.listAvailableCteMonths({ cnpj, razaoSocial });
    return { success: true, list, months };
  } catch (err) {
    return { success: false, error: err.message, list: [], months: [] };
  }
});

// 5.10. Abrir Pasta de CT-e da Empresa
ipcMain.handle('sefaz:open-cte-folder', async (event, { cnpj, razaoSocial }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = sefazManager.getCompanyDir(cleanCnpj, razaoSocial);
    const targetDir = findLatestModelFolder(companyDir, 'CTE');
    await shell.openPath(targetDir);
    return { success: true, dir: targetDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.11. Abrir ou Gerar sob demanda DACTE PDF de CT-e
ipcMain.handle('sefaz:open-cte-pdf', async (event, { pdfPath, xmlPath }) => {
  try {
    if (pdfPath && fs.existsSync(pdfPath)) {
      await shell.openPath(pdfPath);
      return { success: true };
    }
    if (xmlPath && fs.existsSync(xmlPath)) {
      const DacteService = require('./sefaz/dacteService.cjs');
      const dacte = new DacteService();
      const generatedPdfPath = xmlPath.replace(/(-cte)?\.xml$/i, '-danfe.pdf');
      await dacte.gerarDacteFromFile(xmlPath, generatedPdfPath);
      if (fs.existsSync(generatedPdfPath)) {
        await shell.openPath(generatedPdfPath);
        return { success: true, pdfPath: generatedPdfPath };
      }
    }
    return { success: false, error: 'DACTE PDF não localizado.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.12. Exportar competência de CT-e em ZIP (XMLs, DACTEs ou Ambos)
ipcMain.handle('sefaz:export-cte-competencia', async (event, { cnpj, razaoSocial, yearMonth, exportType = 'all' }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const compLabel = yearMonth && yearMonth !== 'all' ? yearMonth : 'Todas_Competencias';
    const typeLabel = exportType === 'all' ? 'Completo_XML_DACTE' : (exportType === 'pdf' ? 'DACTEs_PDF' : 'XMLs');
    const safeName = (razaoSocial || 'Empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const defaultFilename = `CTE_${safeName}_${compLabel}_${typeLabel}.zip`;

    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Exportar Arquivo Compactado (.zip) dos CT-e',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo ZIP (*.zip)', extensions: ['zip'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    const result = sefazManager.exportCteCompetencia({
      cnpj: cleanCnpj,
      razaoSocial,
      yearMonth,
      exportType,
      targetZipPath: saveDialog.filePath
    });

    shell.showItemInFolder(saveDialog.filePath);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.13. Salvar XML individual de CT-e
ipcMain.handle('sefaz:save-single-cte-xml', async (event, { cnpj, razaoSocial, chCTe, xmlPath }) => {
  try {
    let sourceXml = xmlPath;
    if (!sourceXml || !fs.existsSync(sourceXml)) {
      const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
      sourceXml = sefazManager.getXmlPath({ cnpj: cleanCnpj, razaoSocial, chNFe: chCTe });
    }

    if (!sourceXml || !fs.existsSync(sourceXml)) {
      return { success: false, error: 'Arquivo XML do CT-e não localizado.' };
    }

    const defaultFilename = `${chCTe}-cte.xml`;
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Arquivo XML do CT-e',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo XML (*.xml)', extensions: ['xml'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    fs.copyFileSync(sourceXml, saveDialog.filePath);
    return { success: true, filePath: saveDialog.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.13.1. Obter estado do NSU de CT-e
ipcMain.handle('sefaz:get-cte-nsu-state', async (event, { cnpj, razaoSocial }) => {
  try {
    const result = sefazManager.getCompanyCteNsuState({ cnpj, razaoSocial });
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.13.2. Reiniciar NSU de CT-e
ipcMain.handle('sefaz:reset-cte-nsu', async (event, { cnpj, razaoSocial, targetNsu, clearFiles }) => {
  try {
    const result = sefazManager.resetCompanyCteNsu({ cnpj, razaoSocial, targetNsu, clearFiles });
    invalidateCompanyMetrics(cnpj);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 5.14. Salvar configurações de agendamento por modelo
ipcMain.handle('settings:save-model-schedulers', async (event, modelSchedulers) => {
  try {
    const settings = loadSettings();
    const prev = settings.modelSchedulers || {};
    settings.modelSchedulers = {
      nfe: {
        ...(prev.nfe || {}),
        ...(modelSchedulers?.nfe || {}),
        enabled: Boolean(modelSchedulers?.nfe?.enabled),
        time: modelSchedulers?.nfe?.time || prev.nfe?.time || '08:00'
      },
      nfce: {
        ...(prev.nfce || {}),
        ...(modelSchedulers?.nfce || {}),
        enabled: Boolean(modelSchedulers?.nfce?.enabled),
        time: modelSchedulers?.nfce?.time || prev.nfce?.time || '18:30'
      },
      cte: {
        ...(prev.cte || {}),
        ...(modelSchedulers?.cte || {}),
        enabled: Boolean(modelSchedulers?.cte?.enabled),
        time: modelSchedulers?.cte?.time || prev.cte?.time || '08:30'
      },
      nfse: {
        ...(prev.nfse || {}),
        ...(modelSchedulers?.nfse || {}),
        enabled: Boolean(modelSchedulers?.nfse?.enabled),
        time: modelSchedulers?.nfse?.time || prev.nfse?.time || '09:00'
      }
    };
    settings.scheduler = { ...(settings.scheduler || {}), ...settings.modelSchedulers.nfe };
    settings.nfseScheduler = { ...(settings.nfseScheduler || {}), ...settings.modelSchedulers.nfse };
    saveSettings(settings);
    updateTrayMenu();
    return { success: true, modelSchedulers: settings.modelSchedulers };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 6. Abrir DANFE PDF no leitor padrão do Windows (com geração instantânea sob demanda se não existir)
ipcMain.handle('danfe:open-pdf', async (event, { cnpj, razaoSocial, chNFe, yearMonth }) => {
  try {
    let pdfPath = sefazManager.getDanfePath({ cnpj, razaoSocial, chNFe, yearMonth });
    if (pdfPath && fs.existsSync(pdfPath)) {
      await shell.openPath(pdfPath);
      return { success: true, pdfPath };
    }

    // Se o PDF ainda não foi gerado, gera sob demanda a partir do XML em ~200ms!
    const xmlPath = sefazManager.getXmlPath({ cnpj, razaoSocial, chNFe, yearMonth });
    if (xmlPath && fs.existsSync(xmlPath)) {
      const DanfeService = require('./sefaz/danfeService.cjs');
      const danfe = new DanfeService();
      const targetDir = path.dirname(xmlPath);
      const generatedPdfPath = path.join(targetDir, `${chNFe}-danfe.pdf`);
      await danfe.gerarDanfeFromFile(xmlPath, generatedPdfPath);
      if (fs.existsSync(generatedPdfPath)) {
        await shell.openPath(generatedPdfPath);
        return { success: true, pdfPath: generatedPdfPath };
      }
    }

    return { success: false, error: 'Arquivo DANFE em PDF não encontrado para esta nota.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 7. Retornar diretório de dados
ipcMain.handle('sefaz:get-data-dir', () => {
  return sefazManager.getBaseDataDir();
});

// 8. Exportar competência ou período em arquivo .ZIP (XMLs, DANFEs ou Ambos)
ipcMain.handle('sefaz:export-competencia', async (event, { cnpj, companyName, yearMonth, exportType, specificKeys, startDate, endDate, periodLabel }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const compLabel = periodLabel || (yearMonth && yearMonth !== 'all' ? yearMonth : (startDate && endDate ? `${startDate}_a_${endDate}` : 'TodasCompetencias'));
    const typeLabel = exportType === 'all' ? 'Completo_XML_PDF' : (exportType === 'pdf' ? 'DANFEs_PDF' : 'XMLs');
    const safeName = (companyName || 'Empresa').replace(/[^a-zA-Z0-9_-]/g, '_');
    const defaultFilename = `${safeName}_${compLabel}_${typeLabel}.zip`;

    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Arquivo Compactado (.zip) das Notas Fiscais',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo ZIP (*.zip)', extensions: ['zip'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    const result = sefazManager.exportCompetencia({
      cnpj: cleanCnpj,
      yearMonth,
      startDate,
      endDate,
      specificKeys,
      exportType,
      targetZipPath: saveDialog.filePath
    });

    // Revela o arquivo exportado na pasta do usuário
    shell.showItemInFolder(saveDialog.filePath);

    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 9. Abrir pasta de XMLs ou DANFEs no Windows Explorer
ipcMain.handle('sefaz:open-folder', async (event, { cnpj, razaoSocial, subfolder }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = sefazManager.getCompanyDir(cleanCnpj, razaoSocial);
    if (subfolder && fs.existsSync(path.join(companyDir, subfolder))) {
      const targetDir = path.join(companyDir, subfolder);
      await shell.openPath(targetDir);
      return { success: true, targetDir };
    }
    const latestNfeDir = findLatestModelFolder(companyDir, 'NFE ENTRADAS');
    if (fs.existsSync(latestNfeDir)) {
      await shell.openPath(latestNfeDir);
      return { success: true, targetDir: latestNfeDir };
    }
    return { success: false, error: 'Diretório não encontrado no disco.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 10. Salvar XML individual da NF-e
ipcMain.handle('sefaz:save-single-xml', async (event, { cnpj, chNFe, yearMonth }) => {
  try {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const defaultFilename = `${chNFe}-nfe.xml`;

    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Arquivo XML da NF-e',
      defaultPath: defaultFilename,
      filters: [{ name: 'Arquivo XML (*.xml)', extensions: ['xml'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    const result = sefazManager.saveSingleXml({
      cnpj: cleanCnpj,
      chNFe,
      yearMonth,
      targetFilePath: saveDialog.filePath
    });

    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 11. Consultar CNPJ individual
ipcMain.handle('cnpj:consultar', async (event, payload) => {
  if (payload && typeof payload === 'object' && payload.cnpj !== undefined) {
    return await cnpjService.consultar(payload.cnpj, { forceRefresh: Boolean(payload.forceRefresh) });
  }
  return await cnpjService.consultar(payload);
});

// 12. Consultar lote de CNPJs com progresso
ipcMain.handle('cnpj:consultar-lote', async (event, payload) => {
  const cnpjs = Array.isArray(payload) ? payload : (payload?.cnpjs || []);
  const forceRefresh = Boolean(payload?.forceRefresh);
  return await cnpjService.consultarLote(cnpjs, (info) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cnpj:consultar-progresso', info);
    }
  }, { forceRefresh });
});

// 13. Obter todos os CNPJs já cacheados
ipcMain.handle('cnpj:obter-cache', () => {
  return cnpjService.getAllCached();
});

// 14. Buscar e baixar NF-e pontual diretamente pela Chave de Acesso (com manifestação se necessário)
ipcMain.handle('sefaz:fetch-by-chave', async (event, { company, chNFe }) => {
  try {
    const result = await sefazManager.fetchSingleByChave({
      company,
      chNFe,
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sefaz:sync-progress', info);
        }
      }
    });
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 15. Configurações de Armazenamento e Agendamento
ipcMain.handle('settings:get', () => {
  const settings = loadSettings();
  return {
    customStorageDir: sefazManager.getBaseDataDir(),
    customServerCertDir: settings.customServerCertDir || '',
    defaultStorageDir,
    modelSchedulers: settings.modelSchedulers,
    scheduler: settings.scheduler,
    nfseScheduler: settings.nfseScheduler
  };
});

ipcMain.handle('settings:select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Pasta de Armazenamento das Notas Fiscais',
      defaultPath: sefazManager.getBaseDataDir(),
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selectedDir = result.filePaths[0];
    const settings = loadSettings();
    settings.customStorageDir = selectedDir;
    saveSettings(settings);

    sefazManager.setBaseDataDir(selectedDir);

    return {
      success: true,
      customStorageDir: selectedDir
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:open-storage-folder', async () => {
  try {
    const currentDir = sefazManager.getBaseDataDir();
    if (!fs.existsSync(currentDir)) {
      fs.mkdirSync(currentDir, { recursive: true });
    }
    await shell.openPath(currentDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Handlers dedicados para a Pasta de Certificados do Servidor / Rede
ipcMain.handle('settings:select-server-cert-dir', async () => {
  try {
    const settings = loadSettings();
    const defaultP = (settings.customServerCertDir && fs.existsSync(settings.customServerCertDir))
      ? settings.customServerCertDir
      : app.getPath('desktop');

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecionar Pasta de Certificados Digitais do Servidor / Rede',
      defaultPath: defaultP,
      properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const selectedDir = result.filePaths[0];
    settings.customServerCertDir = selectedDir;
    saveSettings(settings);

    return {
      success: true,
      customServerCertDir: selectedDir
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:save-server-cert-dir', async (event, dir) => {
  try {
    const settings = loadSettings();
    settings.customServerCertDir = String(dir || '').trim();
    saveSettings(settings);
    return { success: true, customServerCertDir: settings.customServerCertDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:open-server-cert-dir', async (event, customDir) => {
  try {
    const settings = loadSettings();
    const targetDir = customDir || settings.customServerCertDir;
    if (!targetDir || !fs.existsSync(targetDir)) {
      return { success: false, error: 'Pasta de certificados não existe ou não está acessível no momento.' };
    }
    await shell.openPath(targetDir);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:save-scheduler', (event, schedulerData) => {
  try {
    const settings = loadSettings();
    settings.scheduler = {
      ...settings.scheduler,
      ...schedulerData
    };
    if (!settings.modelSchedulers) settings.modelSchedulers = {};
    settings.modelSchedulers.nfe = {
      ...(settings.modelSchedulers.nfe || {}),
      ...schedulerData
    };
    saveSettings(settings);
    updateTrayMenu();
    return { success: true, scheduler: settings.scheduler, modelSchedulers: settings.modelSchedulers };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('settings:save-nfse-scheduler', (event, nfseSchedulerData) => {
  try {
    const settings = loadSettings();
    settings.nfseScheduler = {
      ...(settings.nfseScheduler || { enabled: false, time: '09:00', lastRunDate: null }),
      ...nfseSchedulerData
    };
    if (!settings.modelSchedulers) settings.modelSchedulers = {};
    settings.modelSchedulers.nfse = {
      ...(settings.modelSchedulers.nfse || {}),
      ...nfseSchedulerData
    };
    saveSettings(settings);
    updateTrayMenu();
    return { success: true, nfseScheduler: settings.nfseScheduler, modelSchedulers: settings.modelSchedulers };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('app:get-auto-start', () => {
  try {
    return app.getLoginItemSettings().openAtLogin;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('app:set-auto-start', (event, enabled) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!enabled,
      openAsHidden: true
    });
    updateTrayMenu();
    return { success: true, openAtLogin: !!enabled };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 16. Sincronizar todas as empresas sequencialmente com proteção anti-bloqueio (NF-e, NFC-e, CT-e, NFS-e)
ipcMain.handle('sefaz:sync-all', async (event, { companies }) => {
  try {
    const result = await sefazManager.syncAllCompanies({
      companies,
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('sefaz:sync-all-progress', info);
        }
      },
      syncNfseFn: async (company, onNfseProgress) => {
        return await executarCaptacaoUnificadaNfse({
          company,
          onProgress: onNfseProgress
        });
      }
    });

    if (Notification && Notification.isSupported()) {
      try {
        const notif = new Notification({
          title: 'CONT-AI | Gestor de Movimento Fiscal',
          body: `Varredura geral concluída para todas as ${result.total || 0} empresas nos modelos habilitados (NF-e, NFC-e, CT-e e NFS-e).`,
          icon: path.join(__dirname, 'assets', 'icon.ico')
        });
        notif.show();
      } catch (eNotif) {}
    }

    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ----------------------------------------------------
// IPC HANDLERS PARA NFS-E (PORTAL NACIONAL & PREF. SÃO PAULO)
// ----------------------------------------------------

function resolveCompanyNfseDir(cnpj, razaoSocial) {
  const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
  let companyDir = sefazManager.getCompanyDir(cnpj, razaoSocial);

  if (!fs.existsSync(companyDir)) {
    try {
      const baseDir = sefazManager.getBaseDataDir();
      if (fs.existsSync(baseDir)) {
        const entries = fs.readdirSync(baseDir, { withFileTypes: true });
        const matched = entries.find(e => e.isDirectory() && (e.name.endsWith(`(${cleanCnpj})`) || e.name === cleanCnpj || e.name.includes(cleanCnpj)));
        if (matched) {
          companyDir = path.join(baseDir, matched.name);
        }
      }
    } catch (_) {}
  }

  if (!fs.existsSync(companyDir)) {
    try { fs.mkdirSync(companyDir, { recursive: true }); } catch (_) {}
  }

  return { companyDir, companyNfseDir: companyDir };
}

async function executarCaptacaoUnificadaNfse({ company, targetNsu, onProgress }) {
  const { companyDir, companyNfseDir } = resolveCompanyNfseDir(company.cnpj, company.razaoSocial);
  const nfseState = loadNfseState(companyDir, company.cnpj);
  const isResetRun = targetNsu !== undefined && targetNsu !== null && Number(targetNsu) === 0;

  // 1. Captação de Serviços Tomados na Prefeitura de São Paulo (PMSP) PRIMEIRO
  // (Garante que as notas de SP fiquem no padrão oficial de São Paulo e evita duplicidade no ADN)
  let baixadasSp = 0;
  let canceladasSp = 0;
  let ultimaDataSp = nfseState.ultimaDataSp || null;

  try {
    const empDescript = {
      ...company,
      caminhoPfx: company.certPath,
      senhaPfx: company.password ? decryptPassword(company.password) : ''
    };
    const resSp = await consultarTomadasSP(empDescript, companyNfseDir, {
      ultimaDataSp: isResetRun ? null : nfseState.ultimaDataSp,
      onProgress
    });
    if (resSp && resSp.sucesso) {
      baixadasSp = Number(resSp.totalBaixadas || 0);
      canceladasSp = Number(resSp.totalCanceladas || 0);
      if (resSp.ultimaDataSp) ultimaDataSp = resSp.ultimaDataSp;
    }
  } catch (errSp) {
    if (onProgress) {
      onProgress({
        message: `[Prefeitura SP] Aviso: ${errSp.message}`,
        type: 'warn',
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    }
  }

  // 2. Captação no Portal Nacional (ADN)
  // (Ignora automaticamente notas que já foram baixadas pelo Portal SP ou que já existem na pasta)
  const safeCompany = {
    ...company,
    ultimoNsuNfse: (targetNsu !== undefined && targetNsu !== null) ? targetNsu : (nfseState.ultimoNsuNfse || 0)
  };

  const resNacional = await rodarCaptacaoNfseEmpresa({
    company: safeCompany,
    companyOutputDir: companyNfseDir,
    targetNsu,
    onProgress
  });

  const baixadasNacional = Number(resNacional?.totalDocsBaixados || 0);
  const novoNsu = (resNacional && resNacional.novoNsu !== undefined)
    ? resNacional.novoNsu
    : safeCompany.ultimoNsuNfse;

  saveNfseState(companyDir, {
    ultimoNsuNfse: novoNsu,
    ultimaDataSp,
    lastSync: new Date().toISOString()
  }, company.cnpj);

  const totalDocsBaixados = baixadasNacional + baixadasSp;

  return {
    sucesso: true,
    totalDocsBaixados,
    baixadasNacional,
    baixadasSp,
    canceladasSp,
    novoNsu
  };
}

// 17. Sincronizar NFS-e Unificada (Portal Nacional ADN + Prefeitura de São Paulo PMSP)
ipcMain.handle('nfse:sync-company', async (event, { company, targetNsu }) => {
  try {
    const result = await executarCaptacaoUnificadaNfse({
      company,
      targetNsu,
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('nfse:sync-progress', { ...info, cnpj: company?.cnpj });
        }
      }
    });

    invalidateCompanyMetrics(company?.cnpj);
    return { success: true, ...result };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 18. Sincronizar NFS-e Tomadas da Prefeitura de São Paulo (PMSP)
ipcMain.handle('nfse:sync-sp', async (event, { company, params }) => {
  try {
    const { companyNfseDir } = resolveCompanyNfseDir(company.cnpj, company.razaoSocial);
    const empDescript = {
      ...company,
      caminhoPfx: company.certPath,
      senhaPfx: company.password ? decryptPassword(company.password) : ''
    };

    const resultado = await consultarTomadasSP(empDescript, companyNfseDir, {
      ...(params || {}),
      onProgress: (info) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('nfse:sync-progress', { ...info, cnpj: company?.cnpj });
        }
      }
    });
    return { success: true, ...resultado };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 19. Obter Métricas Consolidadas de NFS-e
ipcMain.handle('nfse:get-metrics', async (event, { cnpj, razaoSocial, ano, mes, tipo }) => {
  try {
    const { companyNfseDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const notas = scanNotasEmpresa(companyNfseDir, razaoSocial, cnpj, ano, mes, tipo);
    const metricas = calcularMetricas(notas);
    return { success: true, metricas, totalNotas: notas.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 20. Listar Notas Fiscais de Serviço (NFS-e)
ipcMain.handle('nfse:list-notas', async (event, { cnpj, razaoSocial, ano, mes, tipo }) => {
  try {
    const { companyNfseDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const notas = scanNotasEmpresa(companyNfseDir, razaoSocial, cnpj, ano, mes, tipo);
    const metricas = calcularMetricas(notas);
    return { success: true, notas, metricas };
  } catch (err) {
    return { success: false, error: err.message, notas: [] };
  }
});

// 21. Obter Estado do Cursor NSU e Sincronização de NFS-e
ipcMain.handle('nfse:get-state', async (event, { cnpj, razaoSocial }) => {
  try {
    const { companyDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const state = loadNfseState(companyDir, cnpj);
    return { success: true, state };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 22. Resetar Cursor NSU de NFS-e
ipcMain.handle('nfse:reset-nsu', async (event, { cnpj, razaoSocial, targetNsu = 0 }) => {
  try {
    const { companyDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const state = saveNfseState(companyDir, {
      ultimoNsuNfse: parseInt(String(targetNsu), 10) || 0,
      ultimaDataSp: null
    }, cnpj);
    return { success: true, state };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 22.1. Resetar NSU e Ponteiros de TODOS os Modelos (NF-e, NFC-e, CT-e, NFS-e)
ipcMain.handle('sefaz:reset-all-models-nsu', async (event, { cnpj, razaoSocial, scope = 'single', companies = [], clearFiles = false, clearManifestations = false }) => {
  try {
    if (scope === 'all') {
      const result = sefazManager.resetAllCompaniesAllModelsNsu({ companies, clearFiles, clearManifestations });
      companiesMetricsCache.clear();
      return { success: true, ...result };
    } else {
      const result = sefazManager.resetCompanyAllModelsNsu({ cnpj, razaoSocial, clearFiles, clearManifestations });
      invalidateCompanyMetrics(cnpj);
      return { success: true, ...result };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 23. Exportar Relatório de NFS-e em CSV (Tomados ou Prestados)
ipcMain.handle('nfse:export-csv', async (event, { cnpj, razaoSocial, ano, mes, tipo, dataInicio, dataFim }) => {
  try {
    const { companyNfseDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const notas = scanNotasEmpresa(companyNfseDir, razaoSocial, cnpj, ano, mes, tipo, dataInicio, dataFim);
    if (!notas || notas.length === 0) {
      return { success: false, error: 'Nenhuma nota localizada para o período e tipo selecionados.' };
    }
    const csvContent = gerarCsvRelatorio(notas, tipo);
    const tipoSlug = String(tipo || '').toLowerCase().includes('prest') ? 'prestados' : 'tomados';
    const periodoSlug = (ano && ano !== 'todos')
      ? `${ano}${mes && mes !== 'todos' ? `_${mes}` : ''}`
      : 'geral';
    const defaultFilename = `relatorio_nfse_${tipoSlug}_${cnpj || 'empresa'}_${periodoSlug}.csv`;

    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: `Exportar Relatório NFS-e (${tipoSlug === 'prestados' ? 'Serviços Prestados' : 'Serviços Tomados'}) em CSV`,
      defaultPath: path.join(app.getPath('downloads'), defaultFilename),
      filters: [{ name: 'CSV (*.csv)', extensions: ['csv'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(saveResult.filePath, csvContent, 'utf8');
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 24. Baixar Pacote de Notas NFS-e (ZIP)
ipcMain.handle('nfse:download-zip', async (event, { cnpj, razaoSocial, ano, mes, tipo, dataInicio, dataFim }) => {
  try {
    const { companyNfseDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const notas = scanNotasEmpresa(companyNfseDir, razaoSocial, cnpj, ano, mes, tipo, dataInicio, dataFim);
    if (!notas || notas.length === 0) {
      return { success: false, error: 'Nenhuma nota localizada para o período selecionado.' };
    }
    const zipBuffer = gerarPacoteZip(notas);
    const defaultFilename = `nfse_${cnpj || 'empresa'}_${ano || 'geral'}_${mes || ''}.zip`;

    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Baixar Pacote de Notas NFS-e (ZIP)',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename),
      filters: [{ name: 'ZIP (*.zip)', extensions: ['zip'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(saveResult.filePath, zipBuffer);
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 25. Abrir DANFSe PDF (com geração sob demanda se ausente)
ipcMain.handle('nfse:open-pdf', async (event, payload) => {
  try {
    let pdfPath = typeof payload === 'string' ? payload : (payload?.pdfPath || '');
    let xmlPath = typeof payload === 'object' ? payload?.xmlPath : null;
    let xmlContent = typeof payload === 'object' ? (payload?.xmlContent || null) : null;
    const forceRegenerate = typeof payload === 'object' ? !!payload?.forceRegenerate : false;

    if (!pdfPath && xmlPath) {
      pdfPath = xmlPath.replace(/\.xml$/i, '.pdf');
    }

    if (!xmlPath && pdfPath) {
      const candidateXml = pdfPath.replace(/\.pdf$/i, '.xml');
      if (fs.existsSync(candidateXml)) xmlPath = candidateXml;
    }

    if (!xmlContent && xmlPath && fs.existsSync(xmlPath)) {
      xmlContent = fs.readFileSync(xmlPath, 'utf8');
    }

    // Se o XML existe em memória ou no disco, garante a geração do DANFSe PDF Padrão Nacional / PMSP
    if (xmlContent) {
      const os = require('os');
      const targetPdfPath = pdfPath || (xmlPath ? xmlPath.replace(/\.xml$/i, '.pdf') : path.join(os.tmpdir(), `DANFSE_OFICIAL_${Date.now()}.pdf`));

      const isPortalSp = (
        /<OrigemCaptacao>PORTAL_SP<\/OrigemCaptacao>/i.test(xmlContent) ||
        /PMSP_WebServices/i.test(xmlContent) ||
        /prefeitura\.sp\.gov\.br/i.test(xmlContent) ||
        /<NFe[\s>]/i.test(xmlContent) ||
        /<ChaveNFe>/i.test(xmlContent)
      );

      if (isPortalSp) {
        if (!pdfPath || !fs.existsSync(pdfPath) || forceRegenerate) {
          // Mantém sempre o Padrão Oficial da Prefeitura de São Paulo (PMSP) para notas de SP
          const pdfBytes = await gerarPdfPadraoSp(xmlContent);
          fs.writeFileSync(targetPdfPath, Buffer.from(pdfBytes));
        }
      } else {
        let logoBytes = null;
        const logoFile = path.join(__dirname, 'assets/nfse-logo.png');
        if (fs.existsSync(logoFile)) {
          try { logoBytes = new Uint8Array(fs.readFileSync(logoFile)); } catch (_) {}
        }

        let marcaDagua = '';
        const isCancFile = /CANCELAD/i.test(xmlPath) || /<cStat>\s*2\s*<\/cStat>/i.test(xmlContent);
        if (isCancFile) {
          marcaDagua = 'CANCELADA';
          const evPath = xmlPath.replace(/\.xml$/i, ' - EVENTO_CANCELAMENTO.xml');
          if (fs.existsSync(evPath)) {
            try {
              const evXml = fs.readFileSync(evPath, 'utf8');
              if (evXml.includes('105102') || /substitui/i.test(evXml)) marcaDagua = 'SUBSTITUÍDA';
            } catch (_) {}
          }
        }

        const pdfBytes = await DANFSe.gerarDanfse(xmlContent, {
          PDFLib,
          qrcode,
          logoBytes,
          destacarRet: true,
          marcaDagua
        });

        fs.writeFileSync(targetPdfPath, Buffer.from(pdfBytes));
      }

      await shell.openPath(targetPdfPath);
      return { success: true };
    }

    if (pdfPath && fs.existsSync(pdfPath)) {
      await shell.openPath(pdfPath);
      return { success: true };
    }

    return { success: false, error: 'Arquivo PDF e XML não localizados.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 25.1 Salvar XML individual de NFS-e
ipcMain.handle('nfse:save-xml', async (event, { xmlPath, defaultName, xmlContent }) => {
  try {
    let contentToSave = xmlContent;
    if (!contentToSave && xmlPath && fs.existsSync(xmlPath)) {
      contentToSave = fs.readFileSync(xmlPath, 'utf8');
    }

    if (!contentToSave && (!xmlPath || !fs.existsSync(xmlPath))) {
      return { success: false, error: 'Arquivo XML não localizado.' };
    }

    const fileName = defaultName || (xmlPath ? path.basename(xmlPath) : 'NFSe.xml');
    const saveResult = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Arquivo XML da NFS-e',
      defaultPath: path.join(app.getPath('downloads'), fileName.endsWith('.xml') ? fileName : `${fileName}.xml`),
      filters: [{ name: 'XML (*.xml)', extensions: ['xml'] }]
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { canceled: true };
    }

    if (xmlPath && fs.existsSync(xmlPath) && !xmlContent) {
      fs.copyFileSync(xmlPath, saveResult.filePath);
    } else {
      fs.writeFileSync(saveResult.filePath, contentToSave, 'utf8');
    }
    return { success: true, filePath: saveResult.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 26. Abrir Pasta de NFS-e da Empresa
ipcMain.handle('nfse:open-folder', async (event, { cnpj, razaoSocial }) => {
  try {
    const { companyDir } = resolveCompanyNfseDir(cnpj, razaoSocial);
    const targetDir = findLatestModelFolder(companyDir, 'NFSE');
    await shell.openPath(targetDir);
    return { success: true, dir: targetDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 26b. Transmitir e Emitir DPS NFS-e Padrão Nacional
ipcMain.handle('nfse:transmitir-dps', async (event, { empresa, dpsData }) => {
  try {
    if (!empresa) {
      return { sucesso: false, status: 'ERRO', mensagem: 'Empresa emissora não informada.' };
    }
    const { companyDir } = resolveCompanyNfseDir(empresa.cnpj, empresa.razaoSocial);
    const result = await dpsService.transmitirDpsNacional(empresa, dpsData, companyDir);
    invalidateCompanyMetrics(empresa.cnpj);
    return result;
  } catch (err) {
    return { sucesso: false, status: 'ERRO', mensagem: err.message || 'Erro inesperado na transmissão da DPS.' };
  }
});

// 26c. Cancelar NFS-e Padrão Nacional junto à SEFIN (Evento 101101)
ipcMain.handle('nfse:cancelar-nota', async (event, { empresa, cancelData }) => {
  try {
    if (!empresa) {
      return { sucesso: false, status: 'ERRO', mensagem: 'Empresa emissora não informada.' };
    }
    const { companyDir } = resolveCompanyNfseDir(empresa.cnpj, empresa.razaoSocial);
    const result = await dpsService.cancelarNfseNacional(empresa, cancelData, companyDir);
    invalidateCompanyMetrics(empresa.cnpj);
    return result;
  } catch (err) {
    return { sucesso: false, status: 'ERRO', mensagem: err.message || 'Erro inesperado no cancelamento da NFS-e.' };
  }
});

// 27. Salvar Relatório em Planilha (.CSV) com diálogo nativo do sistema
ipcMain.handle('app:save-csv-file', async (event, { defaultFilename, content, title }) => {
  try {
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: title || 'Salvar Relatório em Planilha (.csv)',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename || 'relatorio.csv'),
      filters: [{ name: 'Planilha CSV (*.csv)', extensions: ['csv'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(saveDialog.filePath, content, 'utf8');
    shell.showItemInFolder(saveDialog.filePath);
    return { success: true, filePath: saveDialog.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// 27b. Salvar Dashboard Executivo em HTML e abrir no navegador
ipcMain.handle('app:save-html-dashboard', async (event, { defaultFilename, htmlContent, title, autoOpen = true }) => {
  try {
    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: title || 'Salvar Dashboard Executivo (.html)',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename || 'dashboard_executivo.html'),
      filters: [{ name: 'Página Web / Dashboard (*.html)', extensions: ['html', 'htm'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(saveDialog.filePath, htmlContent, 'utf8');
    if (autoOpen) {
      shell.openPath(saveDialog.filePath);
    } else {
      shell.showItemInFolder(saveDialog.filePath);
    }
    return { success: true, filePath: saveDialog.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

function parseFlexibleDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const str = String(dateVal).trim();
  if (!str) return null;
  // Tentar formato brasileiro DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
  const brMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1;
    const year = parseInt(brMatch[3], 10);
    const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 23;
    const min = brMatch[5] ? parseInt(brMatch[5], 10) : 59;
    const sec = brMatch[6] ? parseInt(brMatch[6], 10) : 59;
    const parsed = new Date(year, month, day, hour, min, sec);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;
  return null;
}

// 27c. Obter métricas rápidas de todas as empresas (contagem de documentos por modelo e validade de certificados)
ipcMain.handle('app:get-companies-metrics', async (event, { companies }) => {
  try {
    if (!companies || !Array.isArray(companies)) {
      return { success: true, metrics: [] };
    }

    const now = Date.now();
    const metrics = companies.map((company) => {
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
      const companyDir = sefazManager.getCompanyDir(cleanCnpj, company.razaoSocial);

      let nfeCount = 0;
      let nfceCount = 0;
      let cteCount = 0;
      let nfseTomadasCount = 0;
      let nfsePrestadasCount = 0;
      let latestMtime = 0;

      const cached = companiesMetricsCache.get(cleanCnpj);
      if (cached && (now - cached.timestamp < 60000)) {
        nfeCount = cached.nfeCount;
        nfceCount = cached.nfceCount;
        cteCount = cached.cteCount;
        nfseTomadasCount = cached.nfseTomadasCount;
        nfsePrestadasCount = cached.nfsePrestadasCount;
        latestMtime = cached.latestMtime;
      } else if (fs.existsSync(companyDir)) {
        const scanDir = (dir) => {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                scanDir(fullPath);
              } else if (entry.name.toLowerCase().endsWith('.xml')) {
                const lName = entry.name.toLowerCase();
                const lDir = fullPath.toLowerCase();

                if (lName.endsWith('-nfce.xml') || lDir.includes('\\nfce\\') || lDir.includes('/nfce/')) {
                  nfceCount++;
                } else if (lName.endsWith('-cte.xml') || lDir.includes('\\cte\\') || lDir.includes('/cte/')) {
                  cteCount++;
                } else if (lDir.includes('prestada') || lDir.includes('prestados')) {
                  nfsePrestadasCount++;
                } else if (lDir.includes('tomada') || lDir.includes('tomados') || lDir.includes('nfse') || lName.endsWith('-nfse.xml')) {
                  nfseTomadasCount++;
                } else {
                  nfeCount++;
                }
              }
            }
          } catch (_) {}
        };
        scanDir(companyDir);
        companiesMetricsCache.set(cleanCnpj, {
          timestamp: now,
          nfeCount,
          nfceCount,
          cteCount,
          nfseTomadasCount,
          nfsePrestadasCount,
          latestMtime
        });
      }

      // Certificado
      let certStatus = 'missing';
      let daysRemaining = null;
      let validTo = null;
      let subject = null;
      let issuer = null;

      if (company.certInfo) {
        subject = company.certInfo.subject || null;
        issuer = company.certInfo.issuer || null;
        const validDate = parseFlexibleDate(company.certInfo.validTo);
        if (validDate) {
          validTo = validDate.toISOString();
          daysRemaining = Math.ceil((validDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        } else if (typeof company.certInfo.daysRemaining === 'number') {
          daysRemaining = company.certInfo.daysRemaining;
          validTo = company.certInfo.validTo || null;
        }

        if (daysRemaining !== null) {
          if (daysRemaining < 0) {
            certStatus = 'expired';
          } else if (daysRemaining <= 30) {
            certStatus = 'expiring_soon';
          } else {
            certStatus = 'valid';
          }
        }
      }

      // Se ainda não temos dias restantes e o arquivo existe em disco, inspeciona diretamente o PFX
      if ((daysRemaining === null || certStatus === 'missing') && company.certPath && fs.existsSync(company.certPath)) {
        try {
          const certInfo = sefazManager.testCertificate({
            certPath: company.certPath,
            password: company.password || ''
          });
          if (certInfo) {
            if (certInfo.validTo) {
              const parsedV = parseFlexibleDate(certInfo.validTo);
              validTo = parsedV ? parsedV.toISOString() : String(certInfo.validTo);
            }
            subject = certInfo.subject || subject;
            issuer = certInfo.issuer || issuer;
            if (typeof certInfo.daysRemaining === 'number') {
              daysRemaining = certInfo.daysRemaining;
            } else if (validTo) {
              const parsedV = parseFlexibleDate(validTo);
              if (parsedV) {
                daysRemaining = Math.ceil((parsedV.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              }
            }

            if (daysRemaining !== null && daysRemaining !== undefined) {
              if (daysRemaining < 0) {
                certStatus = 'expired';
              } else if (daysRemaining <= 30) {
                certStatus = 'expiring_soon';
              } else {
                certStatus = 'valid';
              }
            }
          }
        } catch (_) {
          if (certStatus === 'missing') certStatus = 'invalid';
        }
      }

      return {
        id: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        uf: company.uf,
        regime: company.regime,
        nfeCount,
        nfceCount,
        cteCount,
        nfseTomadasCount,
        nfsePrestadasCount,
        nfseTotalCount: nfseTomadasCount + nfsePrestadasCount,
        totalDocs: nfeCount + nfceCount + cteCount + nfseTomadasCount + nfsePrestadasCount,
        certStatus,
        certDaysRemaining: daysRemaining,
        certValidTo: validTo,
        certSubject: subject,
        certIssuer: issuer,
        modelosHabilitados: company.modelosHabilitados,
        lastSyncDate: latestMtime > 0 ? new Date(latestMtime).toISOString() : null,
        companyDir
      };
    });

    return { success: true, metrics };
  } catch (err) {
    return { success: false, error: err.message, metrics: [] };
  }
});

// 28. Gerar e Exportar Relatório de Diagnóstico & Suporte Técnico Completo
ipcMain.handle('app:export-diagnostics', async (event, { activeEmpresa } = {}) => {
  try {
    const os = require('os');
    const settings = loadSettings();
    const currentStorage = settings.customStorageDir || defaultStorageDir;
    let storageWritable = false;
    try {
      if (!fs.existsSync(currentStorage)) {
        fs.mkdirSync(currentStorage, { recursive: true });
      }
      const testFile = path.join(currentStorage, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      storageWritable = true;
    } catch (_) {
      storageWritable = false;
    }

    // Coleta dados cadastrais sanitizados das empresas (sem senhas de certificados)
    let empresasResumo = [];
    try {
      const empresasJsonPath = path.join(app.getPath('userData'), 'empresas_sefaz.json');
      if (fs.existsSync(empresasJsonPath)) {
        const empData = JSON.parse(fs.readFileSync(empresasJsonPath, 'utf8') || '[]');
        empresasResumo = empData.map(e => ({
          razaoSocial: e.razaoSocial,
          cnpj: e.cnpj,
          uf: e.uf,
          hasCertPath: !!e.certPath,
          certExists: e.certPath ? fs.existsSync(e.certPath) : false,
          certInfo: e.certInfo || null
        }));
      }
    } catch (_) {}

    const now = new Date();
    const lines = [
      '======================================================================',
      '           RELATÓRIO DE DIAGNÓSTICO E SUPORTE TÉCNICO',
      '======================================================================',
      `Data/Hora de Emissão: ${now.toLocaleString('pt-BR')}`,
      `Nome do Aplicativo: ${app.getName()} v${app.getVersion()}`,
      `Sistema Operacional: ${process.platform} (${os.type()} ${os.release()} ${os.arch()})`,
      `Ambiente de Execução: Node ${process.versions.node} | Electron ${process.versions.electron} | Chrome ${process.versions.chrome}`,
      `Memória RAM: ${Math.round(os.freemem() / (1024 * 1024))} MB Livres / ${Math.round(os.totalmem() / (1024 * 1024))} MB Totais`,
      `CPUs: ${os.cpus().length} núcleos (${os.cpus()[0]?.model || 'N/D'})`,
      '',
      '----------------------------------------------------------------------',
      '1. DIRETÓRIOS E PERMISSÕES EM DISCO',
      '----------------------------------------------------------------------',
      `UserData: ${app.getPath('userData')}`,
      `Downloads: ${app.getPath('downloads')}`,
      `Diretório Base de Armazenamento: ${currentStorage}`,
      `Pasta Existe em Disco: ${fs.existsSync(currentStorage) ? 'SIM' : 'NÃO'}`,
      `Teste de Gravação em Disco: ${storageWritable ? 'OK (Sucesso - Gravável)' : 'FALHA (Somente Leitura ou Bloqueado por Antivírus/Permissão)'}`,
      '',
      '----------------------------------------------------------------------',
      '2. AGENDADORES AUTOMÁTICOS (ROBÔS DE CAPTAÇÃO)',
      '----------------------------------------------------------------------',
      JSON.stringify(settings.modelSchedulers || {}, null, 2),
      '',
      '----------------------------------------------------------------------',
      '3. EMPRESAS CADASTRADAS & CERTIFICADOS A1',
      '----------------------------------------------------------------------',
      empresasResumo.length === 0
        ? 'Nenhuma empresa cadastrada no momento.'
        : empresasResumo.map((e, idx) => {
            const certStatus = e.certInfo
              ? `${e.certInfo.isExpired ? '🔴 VENCIDO' : (e.certInfo.daysRemaining <= 30 ? '🟡 VENCENDO EM BREVE' : '🟢 VÁLIDO')} (${e.certInfo.daysRemaining} dias restantes | Expira em: ${e.certInfo.validTo || 'N/D'})`
              : 'Não verificado / sem informações';
            return [
              `[Empresa ${idx + 1}] ${e.razaoSocial} | CNPJ: ${e.cnpj} | UF: ${e.uf}`,
              `  - Certificado PFX Vinculado: ${e.hasCertPath ? 'SIM' : 'NÃO'} (Arquivo presente em disco: ${e.certExists ? 'SIM' : 'NÃO'})`,
              `  - Integridade & Validade: ${certStatus}`
            ].join('\n');
          }).join('\n\n'),
      '',
      '----------------------------------------------------------------------',
      '4. HISTÓRICO RECENTE DE EVENTOS (CONSOLE LOGS)',
      '----------------------------------------------------------------------',
      rollingLogs.length === 0
        ? 'Nenhum log gravado nesta sessão.'
        : rollingLogs.join('\r\n'),
      '',
      '======================================================================',
      '                     FIM DO RELATÓRIO DE SUPORTE',
      '======================================================================',
    ];

    const reportContent = lines.join('\r\n');
    const timeStr = `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}m`;
    const defaultFilename = `diagnostico_suporte_${now.toISOString().slice(0, 10)}_${timeStr}.txt`;

    const saveDialog = await dialog.showSaveDialog(mainWindow, {
      title: 'Salvar Relatório de Diagnóstico do Sistema',
      defaultPath: path.join(app.getPath('downloads'), defaultFilename),
      filters: [{ name: 'Documento de Texto (*.txt)', extensions: ['txt'] }]
    });

    if (saveDialog.canceled || !saveDialog.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(saveDialog.filePath, reportContent, 'utf8');
    shell.showItemInFolder(saveDialog.filePath);
    return { success: true, filePath: saveDialog.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ----------------------------------------------------
// CICLO DE VIDA DO APP ELECTRON & AGENDADOR
// ----------------------------------------------------
app.whenReady().then(() => {
  createWindow();
  createTray();

  // Verificador dos Agendadores Diários por Modelo (executa a cada 30 segundos)
  setInterval(() => {
    const settings = loadSettings();
    const now = new Date();
    const currentHourMinute = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const todayDate = now.toISOString().substring(0, 10); // YYYY-MM-DD
    let dirty = false;

    const models = [
      { key: 'nfe', label: 'NF-e Entradas (Mod. 55)' },
      { key: 'nfce', label: 'NFC-e Saídas (Mod. 65)' },
      { key: 'cte', label: 'CT-e Fretes (Mod. 57)' },
      { key: 'nfse', label: 'NFS-e Serviços' }
    ];

    const modelScheds = settings.modelSchedulers || {};

    for (const m of models) {
      const sched = modelScheds[m.key];
      if (sched && sched.enabled && sched.time) {
        if (currentHourMinute === sched.time && sched.lastRunDate !== todayDate) {
          sched.lastRunDate = todayDate;
          dirty = true;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scheduler:trigger-sync', { type: m.key, time: sched.time });
            if (m.key === 'nfe') {
              mainWindow.webContents.send('scheduler:trigger-sync', { type: 'sefaz', time: sched.time });
            }
          }
          try {
            if (Notification && Notification.isSupported()) {
              new Notification({
                title: `CONT-AI - Agendador ${m.label}`,
                body: `Iniciando busca diária programada (${sched.time}).`
              }).show();
            }
          } catch (eNotif) {}
        }
      }
    }

    // Compatibilidade com schedulers antigos se modelSchedulers não estiver populado
    if (!settings.modelSchedulers) {
      if (settings.scheduler && settings.scheduler.enabled && settings.scheduler.time) {
        if (currentHourMinute === settings.scheduler.time && settings.scheduler.lastRunDate !== todayDate) {
          settings.scheduler.lastRunDate = todayDate;
          dirty = true;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scheduler:trigger-sync', { type: 'sefaz', time: settings.scheduler.time });
          }
        }
      }
      if (settings.nfseScheduler && settings.nfseScheduler.enabled && settings.nfseScheduler.time) {
        if (currentHourMinute === settings.nfseScheduler.time && settings.nfseScheduler.lastRunDate !== todayDate) {
          settings.nfseScheduler.lastRunDate = todayDate;
          dirty = true;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('scheduler:trigger-sync', { type: 'nfse', time: settings.nfseScheduler.time });
          }
        }
      }
    }

    if (dirty) {
      saveSettings(settings);
    }
  }, 30000);
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Mantem a aplicacao rodando em segundo plano na bandeja do sistema
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
