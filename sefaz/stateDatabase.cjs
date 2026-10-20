const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const SECRET_SEED = 'CONT_AI_FISCAL_SECURE_STORAGE_V1_2026';
const SALT = 'cont_ai_salt_appdata_sqlite_v1';

class StateDatabase {
  constructor(userDataDir) {
    this.userDataDir = userDataDir || process.env.APPDATA || path.join(process.env.USERPROFILE || '.', '.cont_ai');
    if (!fs.existsSync(this.userDataDir)) {
      try {
        fs.mkdirSync(this.userDataDir, { recursive: true });
      } catch (_) {}
    }

    this.dbPath = path.join(this.userDataDir, 'contai_state.sqlite');
    this.key = crypto.scryptSync(SECRET_SEED, SALT, 32);
    this.migratedCnpjs = new Set();

    this.initDatabase();
  }

  initDatabase() {
    try {
      this.db = new DatabaseSync(this.dbPath);
      this.db.exec('PRAGMA journal_mode = WAL;');
      this.db.exec('PRAGMA synchronous = NORMAL;');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS company_state (
          cnpj TEXT NOT NULL,
          model TEXT NOT NULL,
          data_encrypted TEXT NOT NULL,
          iv TEXT NOT NULL,
          tag TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (cnpj, model)
        );

        CREATE TABLE IF NOT EXISTS xml_metadata (
          cnpj TEXT NOT NULL,
          ch_nfe TEXT NOT NULL,
          mtime_ms REAL,
          data_encrypted TEXT NOT NULL,
          iv TEXT NOT NULL,
          tag TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (cnpj, ch_nfe)
        );

        CREATE INDEX IF NOT EXISTS idx_xml_metadata_cnpj ON xml_metadata(cnpj);
      `);
    } catch (err) {
      console.error('[StateDatabase] Erro ao inicializar SQLite nativo:', err.message);
      this.db = null;
    }
  }

  encrypt(plainObj) {
    const text = JSON.stringify(plainObj);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return {
      payload: encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decrypt(payload, ivHex, tagHex) {
    try {
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.key, Buffer.from(ivHex, 'hex'));
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(payload, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (err) {
      console.warn('[StateDatabase] Erro ao descriptografar registro:', err.message);
      return null;
    }
  }

  cleanCnpj(cnpj) {
    return String(cnpj || '').replace(/\D/g, '');
  }

  getState(cnpj, model, defaultVal = {}) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean) return defaultVal;

    if (!this.db) return defaultVal;

    try {
      const stmt = this.db.prepare('SELECT data_encrypted, iv, tag FROM company_state WHERE cnpj = ? AND model = ?');
      const row = stmt.get(clean, String(model).toLowerCase());
      if (row && row.data_encrypted) {
        const decrypted = this.decrypt(row.data_encrypted, row.iv, row.tag);
        if (decrypted) {
          return { ...defaultVal, ...decrypted };
        }
      }
    } catch (err) {
      console.warn(`[StateDatabase] Erro ao ler estado (${model}/${clean}):`, err.message);
    }

    return defaultVal;
  }

  saveState(cnpj, model, stateObj) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean || !this.db) return;

    try {
      const { payload, iv, tag } = this.encrypt(stateObj || {});
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO company_state (cnpj, model, data_encrypted, iv, tag, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(clean, String(model).toLowerCase(), payload, iv, tag, new Date().toISOString());
    } catch (err) {
      console.warn(`[StateDatabase] Erro ao salvar estado (${model}/${clean}):`, err.message);
    }
  }

  resetState(cnpj, model, newState = {}) {
    this.saveState(cnpj, model, newState);
  }

  loadMetadataCache(cnpj) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean || !this.db) return {};

    try {
      const stmt = this.db.prepare('SELECT ch_nfe, mtime_ms, data_encrypted, iv, tag FROM xml_metadata WHERE cnpj = ?');
      const rows = stmt.all(clean);
      const cache = {};
      for (const row of rows) {
        const dec = this.decrypt(row.data_encrypted, row.iv, row.tag);
        if (dec) {
          cache[row.ch_nfe] = dec;
        }
      }
      return cache;
    } catch (err) {
      console.warn(`[StateDatabase] Erro ao carregar metadata cache (${clean}):`, err.message);
      return {};
    }
  }

  saveMetadataCache(cnpj, cacheRecord) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean || !this.db || !cacheRecord) return;

    const entries = Object.entries(cacheRecord);
    if (entries.length === 0) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO xml_metadata (cnpj, ch_nfe, mtime_ms, data_encrypted, iv, tag, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      this.db.exec('BEGIN TRANSACTION;');
      const now = new Date().toISOString();
      for (const [chNFe, meta] of entries) {
        if (!meta) continue;
        const { payload, iv, tag } = this.encrypt(meta);
        const mtime = typeof meta.mtimeMs === 'number' ? meta.mtimeMs : 0;
        stmt.run(clean, chNFe, mtime, payload, iv, tag, now);
      }
      this.db.exec('COMMIT;');
    } catch (err) {
      try { this.db.exec('ROLLBACK;'); } catch (_) {}
      console.warn(`[StateDatabase] Erro ao salvar metadata cache (${clean}):`, err.message);
    }
  }

  clearMetadataCache(cnpj) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean || !this.db) return;

    try {
      const stmt = this.db.prepare('DELETE FROM xml_metadata WHERE cnpj = ?');
      stmt.run(clean);
    } catch (err) {
      console.warn(`[StateDatabase] Erro ao limpar metadata cache (${clean}):`, err.message);
    }
  }

  /**
   * Migração Automática: importa arquivos .json legados expostos na pasta da empresa
   * para o SQLite criptografado e apaga os arquivos .json da pasta para mantê-la 100% limpa.
   */
  migrateLegacyFiles(companyDir, cnpj) {
    const clean = this.cleanCnpj(cnpj);
    if (!clean || !companyDir || !fs.existsSync(companyDir)) return;
    if (this.migratedCnpjs.has(clean)) return;
    this.migratedCnpjs.add(clean);

    // 1. state.json (NF-e Modelo 55)
    const nfeStateFile = path.join(companyDir, 'state.json');
    if (fs.existsSync(nfeStateFile)) {
      try {
        const raw = fs.readFileSync(nfeStateFile, 'utf8');
        const legacy = JSON.parse(raw);
        const current = this.getState(clean, 'nfe', {});
        // Mescla garantindo que os dados legados sejam salvos se não existiam no SQLite
        const merged = { ...legacy, ...current };
        this.saveState(clean, 'nfe', merged);
        try { fs.rmSync(nfeStateFile, { force: true }); } catch (_) {}
      } catch (e) {
        console.warn(`[StateDatabase] Falha ao migrar state.json para ${clean}:`, e.message);
      }
    }

    // 2. metadata_cache.json (NF-e XMLs Cache)
    const metaCacheFile = path.join(companyDir, 'metadata_cache.json');
    if (fs.existsSync(metaCacheFile)) {
      try {
        const raw = fs.readFileSync(metaCacheFile, 'utf8');
        const legacyCache = JSON.parse(raw);
        this.saveMetadataCache(clean, legacyCache);
        try { fs.rmSync(metaCacheFile, { force: true }); } catch (_) {}
      } catch (e) {
        console.warn(`[StateDatabase] Falha ao migrar metadata_cache.json para ${clean}:`, e.message);
      }
    }

    // 3. state_nfce.json (NFC-e Modelo 65)
    const nfceStateFile = path.join(companyDir, 'state_nfce.json');
    if (fs.existsSync(nfceStateFile)) {
      try {
        const raw = fs.readFileSync(nfceStateFile, 'utf8');
        const legacy = JSON.parse(raw);
        const current = this.getState(clean, 'nfce', {});
        const merged = { ...legacy, ...current };
        this.saveState(clean, 'nfce', merged);
        try { fs.rmSync(nfceStateFile, { force: true }); } catch (_) {}
      } catch (e) {
        console.warn(`[StateDatabase] Falha ao migrar state_nfce.json para ${clean}:`, e.message);
      }
    }

    // 4. state_cte.json (CT-e Modelo 57)
    const cteStateFile = path.join(companyDir, 'state_cte.json');
    if (fs.existsSync(cteStateFile)) {
      try {
        const raw = fs.readFileSync(cteStateFile, 'utf8');
        const legacy = JSON.parse(raw);
        const current = this.getState(clean, 'cte', {});
        const merged = { ...legacy, ...current };
        this.saveState(clean, 'cte', merged);
        try { fs.rmSync(cteStateFile, { force: true }); } catch (_) {}
      } catch (e) {
        console.warn(`[StateDatabase] Falha ao migrar state_cte.json para ${clean}:`, e.message);
      }
    }

    // 5. nfse_state.json (NFS-e Portal Nacional)
    const nfseStateRoot = path.join(companyDir, 'nfse_state.json');
    const nfseStateSub = path.join(companyDir, 'nfse', 'nfse_state.json');
    const nfseTarget = fs.existsSync(nfseStateRoot) ? nfseStateRoot : (fs.existsSync(nfseStateSub) ? nfseStateSub : null);
    if (nfseTarget) {
      try {
        const raw = fs.readFileSync(nfseTarget, 'utf8');
        const legacy = JSON.parse(raw);
        const current = this.getState(clean, 'nfse', {});
        const merged = { ...legacy, ...current };
        this.saveState(clean, 'nfse', merged);
        try { fs.rmSync(nfseStateRoot, { force: true }); } catch (_) {}
        try { fs.rmSync(nfseStateSub, { force: true }); } catch (_) {}
      } catch (e) {
        console.warn(`[StateDatabase] Falha ao migrar nfse_state.json para ${clean}:`, e.message);
      }
    }
  }
}

let instance = null;

function getStateDatabase(userDataDir) {
  if (!instance) {
    instance = new StateDatabase(userDataDir);
  }
  return instance;
}

module.exports = {
  StateDatabase,
  getStateDatabase
};
