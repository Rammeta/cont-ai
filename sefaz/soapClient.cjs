const https = require('https');
const crypto = require('crypto');
const axios = require('axios');

class SoapClient {
  constructor(certPem, keyPem, caPems = [], options = {}) {
    this.certPem = certPem;
    this.keyPem = keyPem;
    this.caPems = caPems;
    this.thumbprint = options.thumbprint || null;
    this.useWindowsStore = Boolean(options.thumbprint && (!keyPem || options.useWindowsStore));

    if (!this.useWindowsStore && this.certPem && this.keyPem) {
      const agentOptions = {
        cert: this.certPem,
        key: this.keyPem,
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      };

      if (this.caPems && this.caPems.length > 0) {
        agentOptions.ca = this.caPems;
      }

      if (crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT) {
        agentOptions.secureOptions = crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT;
      }

      this.httpsAgent = new https.Agent(agentOptions);
    } else {
      this.httpsAgent = null;
    }
  }

  async send(url, soapAction, bodyXml, timeoutMs = 30000) {
    if (this.useWindowsStore && this.thumbprint) {
      const windowsCrypto = require('./windowsCrypto.cjs');
      return await windowsCrypto.sendSoapWithStoreCert(url, soapAction, bodyXml, this.thumbprint, timeoutMs);
    }

    if (!this.httpsAgent) {
      throw new Error('Agente mTLS não configurado: Certificado e chave privada ausentes.');
    }

    const headers = {
      'Content-Type': `application/soap+xml; charset=utf-8; action="${soapAction}"`,
      'Accept': 'application/soap+xml, text/xml, */*'
    };

    try {
      const response = await axios.post(url, bodyXml, {
        headers,
        httpsAgent: this.httpsAgent,
        timeout: timeoutMs,
        responseType: 'text'
      });

      return response.data;
    } catch (err) {
      if (err.response) {
        throw new Error(`Erro na resposta da SEFAZ (HTTP ${err.response.status}): ${err.response.data || err.message}`);
      } else if (err.code === 'ECONNABORTED') {
        throw new Error(`Tempo limite de conexão esgotado ao contatar a SEFAZ (${url})`);
      } else {
        throw new Error(`Falha de comunicação mTLS com a SEFAZ: ${err.message}`);
      }
    }
  }
}

module.exports = SoapClient;
