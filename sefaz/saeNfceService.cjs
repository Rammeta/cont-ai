const { XMLParser } = require('fast-xml-parser');
const SaeRateLimiter = require('./saeRateLimiter.cjs');

const SAE_URLS = {
  listagem: {
    1: 'https://nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx',
    2: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeListagemChaves.asmx'
  },
  download: {
    1: 'https://nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx',
    2: 'https://homologacao.nfce.fazenda.sp.gov.br/ws/NFCeDownloadXML.asmx'
  }
};

const SOAP_ACTIONS = {
  listagem: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFCeListagemChaves/nfceListagemChaves',
  download: 'http://www.portalfiscal.inf.br/nfe/wsdl/NFCeDownloadXML/nfceDownloadXML'
};

class SaeNfceService {
  /**
   * @param {Object} soapClient Instância de SoapClient configurada com mTLS
   * @param {Object} options
   * @param {string} options.cnpj CNPJ da empresa emitente (apenas dígitos)
   * @param {number} [options.ambiente=1] 1 = Produção, 2 = Homologação
   * @param {number} [options.delayMs=400] Delay entre requisições em ms
   */
  constructor(soapClient, { cnpj, ambiente = 1, delayMs = 400 }) {
    this.soapClient = soapClient;
    this.cnpj = String(cnpj || '').replace(/\D/g, '');
    this.ambiente = Number(ambiente) || 1;
    this.rateLimiter = new SaeRateLimiter({ delayMs });

    this.urlListagem = SAE_URLS.listagem[this.ambiente] || SAE_URLS.listagem[1];
    this.urlDownload = SAE_URLS.download[this.ambiente] || SAE_URLS.download[1];

    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      isArray: (name) => name === 'chNFCe' || name === 'chNFe' || name === 'resNFCe'
    });
  }

  /**
   * Formata Date para padrão do XSD da SEFAZ-SP (nfceListagemChaves_100.xsd): YYYY-MM-DDTHH:mm
   * @param {Date} date
   */
  formatSefazDate(date) {
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = date.getFullYear();
    const mm = pad(date.getMonth() + 1);
    const dd = pad(date.getDate());
    const hh = pad(date.getHours());
    const min = pad(date.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  /**
   * Monta o envelope SOAP 1.2 para o WebService NFCeListagemChaves
   * Conforme schema oficial nfceListagemChaves_100.xsd
   */
  buildEnvelopeListagem(dhIniStr, dhFinStr) {
    const dadosMsg = `<nfceListagemChaves versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${this.ambiente}</tpAmb><dataHoraInicial>${dhIniStr}</dataHoraInicial><dataHoraFinal>${dhFinStr}</dataHoraFinal></nfceListagemChaves>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFCeListagemChaves">
      ${dadosMsg}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
  }

  /**
   * Monta o envelope SOAP 1.2 para o WebService NFCeDownloadXML
   * Conforme schema oficial nfceDownloadXML_100.xsd
   */
  buildEnvelopeDownload(chNFe) {
    const dadosMsg = `<nfceDownloadXML versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>${this.ambiente}</tpAmb><chNFCe>${chNFe}</chNFCe></nfceDownloadXML>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFCeDownloadXML">
      ${dadosMsg}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;
  }

  /**
   * Executa uma consulta pontual de listagem no período
   * @param {Date} dateIni
   * @param {Date} dateFin
   * @returns {Promise<{ cStat: string, xMotivo: string, chaves: Array<{ chNFe: string, dhEmi?: string, vNF?: string }> }>}
   */
  async consultarListagem(dateIni, dateFin) {
    const dhIniStr = this.formatSefazDate(dateIni);
    const dhFinStr = this.formatSefazDate(dateFin);
    const envelope = this.buildEnvelopeListagem(dhIniStr, dhFinStr);

    const responseXml = await this.rateLimiter.execute(
      () => this.soapClient.send(this.urlListagem, SOAP_ACTIONS.listagem, envelope),
      `NFCeListagemChaves [${dhIniStr} -> ${dhFinStr}]`
    );

    const parsed = this.parser.parse(responseXml);
    const body = parsed['soap:Envelope']?.['soap:Body'] ||
                 parsed['soap12:Envelope']?.['soap12:Body'] ||
                 parsed['Envelope']?.['Body'] || parsed;

    const result = body.nfeDadosMsgResponse || body.nfeDadosMsgResult || body.nfceListagemChavesResult || body.nfeResultMsg || body;
    const ret = result.retNfceListagemChaves || result.retNFCeListagemChaves || result;

    if (!ret) {
      throw new Error(`Resposta inválida da SEFAZ-SP para NFCeListagemChaves: ${responseXml}`);
    }

    const cStat = String(ret.cStat || '');
    const xMotivo = String(ret.xMotivo || '');
    const chaves = [];

    // Chaves no padrão oficial: <chNFCe>
    const chList = ret.chNFCe || ret.chNFe || [];
    const chArray = Array.isArray(chList) ? chList : [chList];
    for (const ch of chArray) {
      if (ch && typeof ch === 'string') {
        const clean = ch.trim();
        if (clean.length === 44 && !chaves.some(c => c.chNFe === clean)) {
          chaves.push({ chNFe: clean });
        }
      } else if (ch && typeof ch === 'object' && ch['#text']) {
        const clean = String(ch['#text']).trim();
        if (clean.length === 44 && !chaves.some(c => c.chNFe === clean)) {
          chaves.push({ chNFe: clean });
        }
      }
    }

    // Suporte caso retorne resNFCe
    const resList = ret.resNFCe || [];
    for (const item of resList) {
      if (item && item.chNFe) {
        const clean = String(item.chNFe).trim();
        if (!chaves.some(c => c.chNFe === clean)) {
          chaves.push({
            chNFe: clean,
            dhEmi: item.dhEmi || '',
            vNF: item.vNF || '0.00',
            cStat: item.cStat || ''
          });
        }
      }
    }

    return {
      cStat,
      xMotivo,
      chaves,
      rawXml: responseXml
    };
  }

  /**
   * Lista todas as chaves do período com particionamento/bisseção temporal automático
   * Se o volume exceder 2.000 chaves (cStat 101), divide o intervalo na metade recursivamente.
   * @param {Date} dateIni
   * @param {Date} dateFin
   * @param {number} [depth=0]
   * @returns {Promise<Array<{ chNFe: string, dhEmi?: string, vNF?: string }>>}
   */
  async listarChavesRecursivo(dateIni, dateFin, depth = 0) {
    if (depth > 12) {
      console.warn(`⚠️ [SAE-NFC-e] Profundidade máxima de subdivisão atingida (${depth}).`);
      return [];
    }

    const res = await this.consultarListagem(dateIni, dateFin);

    // cStat 100: Lista completa autorizada
    if (res.cStat === '100') {
      return res.chaves;
    }

    // cStat 102 / 107 / 137: Nenhuma NFC-e localizada no período
    if (res.cStat === '102' || res.cStat === '107' || res.cStat === '137') {
      return [];
    }

    // cStat 101: Lista incompleta (> 2.000 chaves) -> Aplicar bisseção temporal
    if (res.cStat === '101') {
      const diffMs = dateFin.getTime() - dateIni.getTime();
      if (diffMs <= 60000) {
        // Intervalo menor ou igual a 1 minuto, retorna o que conseguiu
        return res.chaves;
      }

      const midMs = dateIni.getTime() + Math.floor(diffMs / 2);
      const dateMid = new Date(midMs);

      console.log(`🔀 [SAE-NFC-e] Lote com > 2000 notas (cStat 101). Subdividindo intervalo (nível ${depth + 1})...`);

      const [parte1, parte2] = await Promise.all([
        this.listarChavesRecursivo(dateIni, dateMid, depth + 1),
        this.listarChavesRecursivo(new Date(midMs + 1000), dateFin, depth + 1)
      ]);

      // Deduplica por chNFe
      const map = new Map();
      for (const item of [...parte1, ...parte2]) {
        map.set(item.chNFe, item);
      }
      return Array.from(map.values());
    }

    // Outros status ou advertências
    console.warn(`⚠️ [SAE-NFC-e] Retorno [cStat ${res.cStat}]: ${res.xMotivo}`);
    return res.chaves;
  }

  /**
   * Baixa o documento fiscal completo (nfeProc) via NFCeDownloadXML
   * @param {string} chNFe Chave de acesso de 44 dígitos
   * @returns {Promise<{ cStat: string, xMotivo: string, chNFe: string, xmlContent: string }>}
   */
  async baixarXml(chNFe) {
    const envelope = this.buildEnvelopeDownload(chNFe);

    const responseXml = await this.rateLimiter.execute(
      () => this.soapClient.send(this.urlDownload, SOAP_ACTIONS.download, envelope),
      `NFCeDownloadXML [${chNFe}]`
    );

    const parsed = this.parser.parse(responseXml);
    const body = parsed['soap:Envelope']?.['soap:Body'] ||
                 parsed['soap12:Envelope']?.['soap12:Body'] ||
                 parsed['Envelope']?.['Body'] || parsed;

    const result = body.nfeDadosMsgResponse || body.nfeDadosMsgResult || body.nfceDownloadXMLResult || body.nfeResultMsg || body;
    const ret = result.retNfceDownloadXML || result.retNFCeDownloadXML || result;

    if (!ret) {
      throw new Error(`Resposta inválida para NFCeDownloadXML: ${responseXml}`);
    }

    const cStat = String(ret.cStat || '');
    const xMotivo = String(ret.xMotivo || '');

    // Isolar o XML completo do documento (<nfeProc>...</nfeProc> ou <NFe>...</NFe>)
    let xmlContent = '';
    const matchProc = responseXml.match(/<nfeProc[\s\S]*?<\/nfeProc>/);
    if (matchProc) {
      xmlContent = matchProc[0];
    } else {
      const matchNfe = responseXml.match(/<NFe[\s\S]*?<\/NFe>/);
      if (matchNfe) {
        xmlContent = matchNfe[0];
      } else {
        xmlContent = responseXml;
      }
    }

    return {
      cStat,
      xMotivo,
      chNFe,
      xmlContent
    };
  }
}

module.exports = SaeNfceService;
