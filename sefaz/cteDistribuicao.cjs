const { XMLParser } = require('fast-xml-parser');

const CTE_SEFAZ_URLS = {
  1: 'https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx',
  2: 'https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx'
};

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse';

class CteDistribuicaoService {
  constructor(soapClient, { cnpj, cUFAutor = '35', ambiente = 1 }) {
    this.soapClient = soapClient;
    this.cnpj = String(cnpj || '').replace(/\D/g, '');
    this.cUFAutor = String(cUFAutor || '35');
    this.ambiente = Number(ambiente) || 1;
    this.url = CTE_SEFAZ_URLS[this.ambiente] || CTE_SEFAZ_URLS[1];

    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      removeNSPrefix: true,
      isArray: (name) => name === 'docZip'
    });
  }

  formatNSU(nsu) {
    const clean = String(nsu || 0).replace(/\D/g, '');
    return clean.padStart(15, '0');
  }

  buildEnvelopeDistNSU(ultNSU) {
    const nsuFormatted = this.formatNSU(ultNSU);

    const cteDadosMsg = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>${this.ambiente}</tpAmb><cUFAutor>${this.cUFAutor}</cUFAutor><CNPJ>${this.cnpj}</CNPJ><distNSU><ultNSU>${nsuFormatted}</ultNSU></distNSU></distDFeInt>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">
      <cteDadosMsg>${cteDadosMsg}</cteDadosMsg>
    </cteDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
  }

  async consultarPorNSU(ultNSU) {
    const envelope = this.buildEnvelopeDistNSU(ultNSU);
    const responseXml = await this.soapClient.send(this.url, SOAP_ACTION, envelope);
    return this.parseResponse(responseXml);
  }

  buildEnvelopeConsChCTe(chCTe) {
    const cleanKey = String(chCTe || '').replace(/\D/g, '');
    const cteDadosMsg = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/cte" versao="1.00"><tpAmb>${this.ambiente}</tpAmb><cUFAutor>${this.cUFAutor}</cUFAutor><CNPJ>${this.cnpj}</CNPJ><consChCTe><chCTe>${cleanKey}</chCTe></consChCTe></distDFeInt>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <cteDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe">
      <cteDadosMsg>${cteDadosMsg}</cteDadosMsg>
    </cteDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
  }

  async consultarPorChave(chCTe) {
    const envelope = this.buildEnvelopeConsChCTe(chCTe);
    const responseXml = await this.soapClient.send(this.url, SOAP_ACTION, envelope);
    return this.parseResponse(responseXml);
  }

  parseResponse(responseXml) {
    const parsed = this.parser.parse(responseXml);

    const envelope = parsed.Envelope || parsed;
    const body = envelope.Body || envelope;

    const result = body.cteDistDFeInteresseResponse?.cteDistDFeInteresseResult || body;
    const ret = result.retDistDFeInt || result;

    if (!ret) {
      throw new Error(`Resposta inesperada da SEFAZ CT-e: ${responseXml}`);
    }

    const cStat = String(ret.cStat || '');
    const xMotivo = String(ret.xMotivo || '');
    const ultNSU = String(ret.ultNSU || '0');
    const maxNSU = String(ret.maxNSU || '0');

    const docs = [];
    const docZipList = ret.loteDistDFeInt?.docZip || [];

    for (const item of docZipList) {
      if (item) {
        docs.push({
          nsu: item['@_NSU'] || '',
          schema: item['@_schema'] || '',
          contentBase64: typeof item === 'string' ? item : (item['#text'] || '')
        });
      }
    }

    return {
      cStat,
      xMotivo,
      ultNSU,
      maxNSU,
      docs,
      rawXml: responseXml
    };
  }
}

module.exports = CteDistribuicaoService;
