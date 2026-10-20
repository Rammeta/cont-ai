const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');
const { getStateDatabase } = require('./stateDatabase.cjs');

const MONTH_NAMES = {
  '01': '01 - Janeiro',
  '02': '02 - Fevereiro',
  '03': '03 - Março',
  '04': '04 - Abril',
  '05': '05 - Maio',
  '06': '06 - Junho',
  '07': '07 - Julho',
  '08': '08 - Agosto',
  '09': '09 - Setembro',
  '10': '10 - Outubro',
  '11': '11 - Novembro',
  '12': '12 - Dezembro'
};

class XmlStorage {
  constructor(companyDir, cnpj) {
    this.companyDir = companyDir;
    const matchCnpj = String(companyDir || '').match(/(\d{14})/);
    this.cnpj = String(cnpj || (matchCnpj ? matchCnpj[1] : path.basename(companyDir))).replace(/\D/g, '');
    this.stateDb = getStateDatabase();

    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false
    });
    this.ensureDirs();
  }

  ensureDirs() {
    if (!fs.existsSync(this.companyDir)) {
      fs.mkdirSync(this.companyDir, { recursive: true });
    }
  }

  loadState() {
    this.stateDb.migrateLegacyFiles(this.companyDir, this.cnpj);
    return this.stateDb.getState(this.cnpj, 'nfe', {
      ultNSU: '0',
      maxNSU: '0',
      lastExecution: null,
      manifestedKeys: {},
      downloadedKeys: {}
    });
  }

  saveState(state) {
    state.lastExecution = new Date().toISOString();
    this.stateDb.saveState(this.cnpj, 'nfe', state);
  }

  decompressDocZip(base64Content) {
    try {
      const buffer = Buffer.from(base64Content, 'base64');
      const unzipped = zlib.gunzipSync(buffer);
      return unzipped.toString('utf8');
    } catch (err) {
      throw new Error(`Falha ao descompactar documento GZIP da SEFAZ: ${err.message}`);
    }
  }

  parseDoc(xmlContent) {
    const parsed = this.xmlParser.parse(xmlContent);

    if (parsed.resNFe) {
      const r = parsed.resNFe;
      return {
        type: 'resNFe',
        chNFe: r.chNFe,
        cnpjEmitente: r.CNPJ || r.CPF || '',
        xNomeEmitente: r.xNome || '',
        dhEmi: r.dhEmi || '',
        vNF: r.vNF || '0.00',
        cSitNFe: r.cSitNFe,
        xml: xmlContent
      };
    }

    if (parsed.nfeProc || parsed.NFe) {
      const nfeProc = parsed.nfeProc || parsed;
      const nfe = nfeProc.NFe || nfeProc;
      const infNFe = nfe.infNFe || {};
      const prot = nfeProc.protNFe?.infProt || {};

      const chNFe = prot.chNFe || (infNFe['@_Id'] ? infNFe['@_Id'].replace('NFe', '') : '');
      const emit = infNFe.emit || {};
      const dest = infNFe.dest || {};
      const total = infNFe.total?.ICMSTot || {};
      const ide = infNFe.ide || {};

      const ufEmit = emit.enderEmit?.UF || '';
      const ufDest = dest.enderDest?.UF || '';

      return {
        type: 'procNFe',
        chNFe,
        cnpjEmitente: emit.CNPJ || emit.CPF || '',
        xNomeEmitente: emit.xNome || '',
        ufEmit,
        destinatario: dest.xNome || '',
        cnpjDest: dest.CNPJ || dest.CPF || '',
        ufDest,
        dhEmi: ide.dhEmi || ide.dEmi || '',
        vNF: total.vNF || '0.00',
        xml: xmlContent
      };
    }

    if (parsed.resEvento || parsed.procEventoNFe) {
      return {
        type: 'evento',
        xml: xmlContent
      };
    }

    return {
      type: 'outro',
      xml: xmlContent
    };
  }

  getHierarchicalFolder({ dhEmi, ufEmit, ufDest, model = 'NFE ENTRADAS' }) {
    let year = 'Ano_Indefinido';
    let month = '01';

    if (dhEmi && typeof dhEmi === 'string' && dhEmi.length >= 7) {
      const match = dhEmi.match(/(\d{4})[-/](\d{2})/);
      if (match) {
        year = match[1];
        month = match[2];
      }
    } else {
      const now = new Date();
      year = String(now.getFullYear());
      month = String(now.getMonth() + 1).padStart(2, '0');
    }

    const defaultMonthFolder = MONTH_NAMES[month] || month;
    let resolvedMonthFolder = defaultMonthFolder;

    const yearDir = path.join(this.companyDir, year);
    if (fs.existsSync(yearDir)) {
      try {
        const entries = fs.readdirSync(yearDir, { withFileTypes: true });
        const found = entries.find(e => e.isDirectory() && (
          e.name === month ||
          e.name.startsWith(`${month} -`) ||
          e.name.startsWith(`${month}-`) ||
          (MONTH_NAMES[month] && e.name.toLowerCase() === MONTH_NAMES[month].toLowerCase())
        ));
        if (found) {
          resolvedMonthFolder = found.name;
        }
      } catch (_) {}
    }

    let routeFolder = '';
    if (model === 'NFE ENTRADAS') {
      const cleanEmit = String(ufEmit || '').trim().toUpperCase();
      const cleanDest = String(ufDest || '').trim().toUpperCase();
      routeFolder = (cleanEmit && cleanDest && cleanEmit !== cleanDest)
        ? 'FORA DO ESTADO'
        : 'DENTRO DO ESTADO';
    }

    const targetDir = routeFolder
      ? path.join(this.companyDir, year, resolvedMonthFolder, model, routeFolder)
      : path.join(this.companyDir, year, resolvedMonthFolder, model);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  }

  saveFullXml(chNFe, xmlContent, options = {}) {
    let dhEmi = typeof options === 'string' ? options : options.dhEmi;
    let ufEmit = typeof options === 'object' ? options.ufEmit : '';
    let ufDest = typeof options === 'object' ? options.ufDest : '';

    if (!ufEmit && xmlContent) {
      const mEmit = xmlContent.match(/<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
      if (mEmit) ufEmit = mEmit[1].trim();
    }
    if (!ufDest && xmlContent) {
      const mDest = xmlContent.match(/<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
      if (mDest) ufDest = mDest[1].trim();
    }

    const targetDir = this.getHierarchicalFolder({ dhEmi, ufEmit, ufDest, model: 'NFE ENTRADAS' });
    const filePath = path.join(targetDir, `${chNFe}-nfe.xml`);
    fs.writeFileSync(filePath, xmlContent, 'utf8');

    return { filePath, targetDir };
  }
}

module.exports = XmlStorage;
