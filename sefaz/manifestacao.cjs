const { XMLParser } = require('fast-xml-parser');

const EVENTO_URLS = {
  1: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  2: 'https://hom.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx'
};

const SOAP_ACTION = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4/nfeRecepcaoEvento';

class ManifestacaoService {
  constructor(soapClient, xmlSigner, { cnpj, ambiente = 1 }) {
    this.soapClient = soapClient;
    this.xmlSigner = xmlSigner;
    this.cnpj = cnpj;
    this.ambiente = ambiente;
    this.url = EVENTO_URLS[ambiente] || EVENTO_URLS[1];

    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseTagValue: false,
      removeNSPrefix: true
    });
  }

  formatDateTime(date = new Date()) {
    const tzOffset = -3;
    const localTime = new Date(date.getTime() + (tzOffset * 60 + date.getTimezoneOffset()) * 60000);
    const yyyy = localTime.getFullYear();
    const MM = String(localTime.getMonth() + 1).padStart(2, '0');
    const dd = String(localTime.getDate()).padStart(2, '0');
    const hh = String(localTime.getHours()).padStart(2, '0');
    const mm = String(localTime.getMinutes()).padStart(2, '0');
    const ss = String(localTime.getSeconds()).padStart(2, '0');
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}-03:00`;
  }

  buildSignedEventoXml(chNFe, tpEvento = '210210', descEvento = 'Ciencia da Operacao') {
    const nSeqEvento = '1';
    const seqPadded = String(nSeqEvento).padStart(2, '0');
    const idEvento = `ID${tpEvento}${chNFe}${seqPadded}`;
    const dhEvento = this.formatDateTime();

    const eventoXml = `<evento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><infEvento Id="${idEvento}"><cOrgao>91</cOrgao><tpAmb>${this.ambiente}</tpAmb><CNPJ>${this.cnpj}</CNPJ><chNFe>${chNFe}</chNFe><dhEvento>${dhEvento}</dhEvento><tpEvento>${tpEvento}</tpEvento><nSeqEvento>${nSeqEvento}</nSeqEvento><verEvento>1.00</verEvento><detEvento versao="1.00"><descEvento>${descEvento}</descEvento></detEvento></infEvento></evento>`;

    const signedEvento = this.xmlSigner.sign(eventoXml, 'infEvento', idEvento);

    const idLote = String(Date.now()).slice(-15);
    const envEventoXml = `<envEvento xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00"><idLote>${idLote}</idLote>${signedEvento}</envEvento>`;

    return envEventoXml;
  }

  async manifestar(chNFe, tpEvento = '210210', descEvento = 'Ciencia da Operacao') {
    const envEventoXml = this.buildSignedEventoXml(chNFe, tpEvento, descEvento);

    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">
  <soap12:Body>
    <nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4">
      ${envEventoXml}
    </nfeDadosMsg>
  </soap12:Body>
</soap12:Envelope>`;

    const responseXml = await this.soapClient.send(this.url, SOAP_ACTION, envelope);
    return this.parseResponse(responseXml, chNFe);
  }

  async darCiencia(chNFe) {
    return this.manifestar(chNFe, '210210', 'Ciencia da Operacao');
  }

  async confirmarOperacao(chNFe) {
    return this.manifestar(chNFe, '210200', 'Confirmacao da Operacao');
  }

  parseResponse(responseXml, chNFe) {
    const parsed = this.parser.parse(responseXml);

    const envelope = parsed.Envelope || parsed;
    const body = envelope.Body || envelope;

    let retEnv = null;
    for (const key of Object.keys(body)) {
      if (body[key] && body[key].retEnvEvento) {
        retEnv = body[key].retEnvEvento;
        break;
      }
      if (key === 'retEnvEvento') {
        retEnv = body[key];
        break;
      }
    }
    if (!retEnv) {
      retEnv = body.nfeRecepcaoEventoResult || body.nfeResultMsg || body;
    }

    const cStatLote = String(retEnv.cStat || '');
    const retEvento = retEnv.retEvento || {};
    const infEvento = retEvento.infEvento || retEvento;

    const cStatEvento = String(infEvento.cStat || cStatLote);
    const xMotivoEvento = String(infEvento.xMotivo || retEnv.xMotivo || '');
    const nProt = String(infEvento.nProt || '');

    const success = ['135', '136', '573'].includes(cStatEvento);

    return {
      chNFe,
      cStatLote,
      cStatEvento,
      xMotivo: xMotivoEvento,
      nProt,
      success,
      alreadyManifested: cStatEvento === '573',
      rawXml: responseXml
    };
  }
}

module.exports = ManifestacaoService;
