const crypto = require('crypto');
const forge = require('node-forge');
const path = require('path');
const fs = require('fs');

const SECRET_KEY = process.env.APP_SECRET || 'contai-robo-secret-key-32bytes!!';
const ALGORITHM = 'aes-256-cbc';
const KEY_BUFFER = crypto.createHash('sha256').update(SECRET_KEY).digest();

/**
 * Retorna o diretório seguro de dados do usuário.
 */
function obterDiretorioDadosUsuario(customDir) {
    if (customDir && typeof customDir === 'string' && customDir.trim().length > 0) {
        return customDir;
    }
    if (process.env.CONTAI_DATA_DIR) return process.env.CONTAI_DATA_DIR;
    
    try {
        const electron = require('electron');
        const appObj = electron.app || (electron.remote && electron.remote.app);
        if (appObj && appObj.getPath) {
            const userDataPath = appObj.getPath('userData');
            if (userDataPath) return userDataPath;
        }
    } catch (_) {}

    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library', 'Application Support') : path.join(process.env.HOME || '', '.config'));
    const dataDir = path.join(appData, 'CONT-AI - Entradas e Difal SN');
    if (!fs.existsSync(dataDir)) {
        try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
    }
    return dataDir;
}

/**
 * Criptografa a senha usando AES-256-CBC se ela ainda não estiver criptografada.
 * Retorna no formato "enc:<iv_hex>:<cipher_hex>".
 */
function encryptPassword(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    if (text.startsWith('enc:')) return text;

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY_BUFFER, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `enc:${iv.toString('hex')}:${encrypted}`;
}

/**
 * Descriptografa a senha se ela estiver no formato "enc:<iv_hex>:<cipher_hex>".
 */
function decryptPassword(text) {
    if (!text) return '';
    if (typeof text !== 'string') text = String(text);
    if (!text.startsWith('enc:')) return text;

    try {
        const parts = text.split(':');
        if (parts.length !== 3) return text;
        const iv = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY_BUFFER, iv);
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        console.error('[Crypto] Erro ao descriptografar senha:', err.message);
        return text;
    }
}

/**
 * Extrai a data de validade (notAfter) do certificado PFX/P12.
 */
function obterValidadeCertificado(pfxBuffer, passphrase) {
    if (!pfxBuffer || !Buffer.isBuffer(pfxBuffer) || pfxBuffer.length === 0) return null;
    try {
        const pfxDer = pfxBuffer.toString('binary');
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);
        const pfxParsed = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, passphrase);

        const certBags = (pfxParsed.getBags({ bagType: forge.pki.oids.certBag }) || {})[forge.pki.oids.certBag] || [];
        const leafCert = certBags.find(b => b.cert && b.cert.validity && b.cert.validity.notAfter);

        if (leafCert) {
            return leafCert.cert.validity.notAfter.toISOString();
        }
    } catch (err) {
        console.warn('[Crypto] Não foi possível extrair validade do PFX:', err.message);
    }
    return null;
}

/**
 * Normaliza um buffer de certificado PFX/P12 para garantir que ele seja re-exportado
 * como um arquivo PKCS#12 padrão, totalmente exportável e compatível com OpenSSL e Node.js.
 */
function normalizarEExportarPfx(pfxBuffer, passphrase) {
    if (!pfxBuffer || !Buffer.isBuffer(pfxBuffer) || pfxBuffer.length === 0) return pfxBuffer;
    try {
        const pfxDer = pfxBuffer.toString('binary');
        const pfxAsn1 = forge.asn1.fromDer(pfxDer);
        const pfxParsed = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, passphrase);

        const keyBags = (pfxParsed.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag }) || {})[forge.pki.oids.pkcs8ShroudedKeyBag] ||
                        (pfxParsed.getBags({ bagType: forge.pki.oids.keyBag }) || {})[forge.pki.oids.keyBag] || [];
        const certBags = (pfxParsed.getBags({ bagType: forge.pki.oids.certBag }) || {})[forge.pki.oids.certBag] || [];

        const key = keyBags[0] ? keyBags[0].key : null;
        const certs = certBags.map(b => b.cert).filter(Boolean);

        if (key) {
            const newP12Asn1 = forge.pkcs12.toPkcs12Asn1(
                key,
                certs,
                passphrase,
                { algorithm: '3des', generateLocalKeyId: true, friendlyName: 'CONT.AI Exportavel' }
            );
            const newDer = forge.asn1.toDer(newP12Asn1).getBytes();
            console.log('[PfxConverter] Certificado PFX re-exportado e reconstruído com sucesso como exportável.');
            return Buffer.from(newDer, 'binary');
        }
    } catch (err) {
        console.warn('[PfxConverter] Não foi possível reprocessar PFX (mantendo original):', err.message);
    }
    return pfxBuffer;
}

module.exports = {
    encryptPassword,
    decryptPassword,
    obterValidadeCertificado,
    normalizarEExportarPfx,
    obterDiretorioDadosUsuario
};
