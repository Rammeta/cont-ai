const { XMLParser } = require('fast-xml-parser');

const SEFAZ_URLS = {
  1: 'https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx',
  2: 'https://hom1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx'
};

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse';

class DistribuicaoService {
  constructor(soapClient, { cnpj, cUFAutor, ambiente = 1 }) {
    this.soapClient = soapClient;
    this.cnpj = cnpj;
    this.cUFAutor = cUFAutor;
    this.ambiente = ambiente;
    this.url = SEFAZ_URLS[ambiente] || SEFAZ_URLS[1];

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

    const nfeDadosMsg = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${this.ambiente}</tpAmb><cUFAutor>${this.cUFAutor}</cUFAutor><CNPJ>${this.cnpj}</CNPJ><distNSU><ultNSU>${nsuFormatted}</ultNSU></distNSU></distDFeInt>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
  }

  async consultarPorNSU(ultNSU) {
    const envelope = this.buildEnvelopeDistNSU(ultNSU);
    const responseXml = await this.soapClient.send(this.url, SOAP_ACTION, envelope);
    return this.parseResponse(responseXml);
  }

  buildEnvelopeConsChNFe(chNFe) {
    const nfeDadosMsg = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${this.ambiente}</tpAmb><cUFAutor>${this.cUFAutor}</cUFAutor><CNPJ>${this.cnpj}</CNPJ><consChNFe><chNFe>${chNFe}</chNFe></consChNFe></distDFeInt>`;

    return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">
      <nfeDadosMsg>${nfeDadosMsg}</nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap12:Body>
</soap12:Envelope>`;
  }

  async consultarPorChave(chNFe) {
    const envelope = this.buildEnvelopeConsChNFe(chNFe);
    const responseXml = await this.soapClient.send(this.url, SOAP_ACTION, envelope);
    return this.parseResponse(responseXml);
  }

  parseResponse(responseXml) {
    const parsed = this.parser.parse(responseXml);

    const envelope = parsed.Envelope || parsed;
    const body = envelope.Body || envelope;

    const result = body.nfeDistDFeInteresseResponse?.nfeDistDFeInteresseResult || body;
    const ret = result.retDistDFeInt || result;

    if (!ret) {
      throw new Error(`Resposta inesperada da SEFAZ: ${responseXml}`);
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

module.exports = DistribuicaoService;
