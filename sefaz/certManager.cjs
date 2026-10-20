const fs = require('fs');
const forge = require('node-forge');

class CertManager {
  constructor(certPath, password) {
    this.certPath = certPath;
    this.password = password || '';
    this.pfxBuffer = null;
    this.certPem = null;
    this.keyPem = null;
    this.certRawBase64 = null;
    this.fullCertChainPem = null;
    this.caPems = [];
    this.info = null;
  }

  load() {
    if (!fs.existsSync(this.certPath)) {
      throw new Error(`Arquivo de certificado não encontrado em: ${this.certPath}`);
    }

    this.pfxBuffer = fs.readFileSync(this.certPath);

    try {
      const p12Asn1 = forge.asn1.fromDer(this.pfxBuffer.toString('binary'));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, this.password);

      let key = null;
      const allCerts = [];

      for (const sc of (p12.safeContents || [])) {
        for (const safeBag of (sc.safeBags || [])) {
          if (safeBag.key) {
            key = safeBag.key;
          }
          if (safeBag.cert) {
            allCerts.push(safeBag.cert);
          }
        }
      }

      if (allCerts.length === 0) {
        throw new Error('Certificado X.509 não localizado dentro do arquivo .pfx.');
      }
      if (!key) {
        throw new Error('Chave privada não localizada dentro do arquivo .pfx.');
      }

      let clientCert = null;
      const caCerts = [];

      for (const cert of allCerts) {
        if (cert.publicKey && key.n && cert.publicKey.n && cert.publicKey.n.equals(key.n)) {
          clientCert = cert;
        } else {
          caCerts.push(cert);
        }
      }

      if (!clientCert) {
        clientCert = allCerts[0];
      }

      this.certPem = forge.pki.certificateToPem(clientCert);
      this.caPems = caCerts.map(c => forge.pki.certificateToPem(c));
      this.fullCertChainPem = [this.certPem, ...this.caPems].join('\n');
      this.keyPem = forge.pki.privateKeyToPem(key);

      this.certRawBase64 = forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(clientCert)).getBytes());

      const cert = clientCert;
      const subjectAttrs = cert.subject.attributes.reduce((acc, attr) => {
        acc[attr.shortName || attr.name] = attr.value;
        return acc;
      }, {});

      const issuerAttrs = cert.issuer.attributes.reduce((acc, attr) => {
        acc[attr.shortName || attr.name] = attr.value;
        return acc;
      }, {});

      const validFrom = cert.validity.notBefore;
      const validTo = cert.validity.notAfter;
      const now = new Date();
      const isExpired = now > validTo;
      const daysRemaining = Math.ceil((validTo - now) / (1000 * 60 * 60 * 24));

      // Extrair CNPJ se presente no CommonName (ex: EMPRESA:12345678000199)
      const cn = subjectAttrs.CN || '';
      let cnpjMatch = cn.match(/(\d{14})/);
      const extractedCnpj = cnpjMatch ? cnpjMatch[1] : '';

      this.info = {
        subject: cn || 'Desconhecido',
        issuer: issuerAttrs.CN || 'Desconhecido',
        extractedCnpj,
        validFrom,
        validTo,
        isExpired,
        daysRemaining
      };

      return this.info;
    } catch (err) {
      if (err.message.includes('password') || err.message.includes('MAC') || err.message.includes('PKCS#12')) {
        throw new Error(`Senha incorreta ou arquivo PFX inválido. (Erro: ${err.message})`);
      }
      throw err;
    }
  }

  getPfxBuffer() {
    return this.pfxBuffer;
  }

  getCertPem() {
    return this.certPem;
  }

  getKeyPem() {
    return this.keyPem;
  }

  getCertRawBase64() {
    return this.certRawBase64;
  }

  getFullCertChainPem() {
    return this.fullCertChainPem || this.certPem;
  }

  getCaPems() {
    return this.caPems || [];
  }

  getInfo() {
    return this.info;
  }
}

module.exports = CertManager;
