const { SignedXml } = require('xml-crypto');

class XmlSigner {
  constructor(privateKeyPem, certPem) {
    this.privateKeyPem = privateKeyPem;
    this.certPem = certPem;
  }

  sign(xmlString, tagToSign = 'infEvento', idAttributeValue = '') {
    const sig = new SignedXml({
      canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
      signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
      privateKey: this.privateKeyPem,
      publicCert: this.certPem
    });

    const uri = idAttributeValue ? `#${idAttributeValue}` : '';

    sig.addReference({
      xpath: `//*[local-name()='${tagToSign}']`,
      transforms: [
        'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
        'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
      ],
      digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
      uri
    });

    sig.computeSignature(xmlString, {
      location: {
        reference: `//*[local-name()='${tagToSign}']`,
        action: 'after'
      }
    });

    return sig.getSignedXml();
  }
}

module.exports = XmlSigner;
