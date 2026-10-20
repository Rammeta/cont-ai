const https = require('https');
const crypto = require('crypto');
const axios = require('axios');

class SoapClient {
  constructor(certPem, keyPem, caPems = []) {
    this.certPem = certPem;
    this.keyPem = keyPem;
    this.caPems = caPems;

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
  }

  async send(url, soapAction, bodyXml, timeoutMs = 30000) {
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
