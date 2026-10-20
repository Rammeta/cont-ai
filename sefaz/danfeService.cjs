const fs = require('fs');
const path = require('path');
const { gerarPDF } = require('nfe-danfe-pdf');

class DanfeService {
  constructor(options = {}) {
    this.options = {
      textoRodape: 'Documento Auxiliar da Nota Fiscal Eletrônica',
      ...options
    };
  }

  /**
   * Normaliza a estrutura do XML para bibliotecas de DANFE caso falte a tag <protNFe>
   * (comum em retornos do SAE-NFC-e da SEFAZ-SP onde <nProt> e <dhInc> vêm direto na raiz do <nfeProc>)
   */
  normalizeXmlForDanfe(xmlContent) {
    if (!xmlContent || typeof xmlContent !== 'string') return xmlContent;
    if (!xmlContent.includes('<protNFe') && xmlContent.includes('<nfeProc')) {
      const nProtMatch = xmlContent.match(/<nProt>(\d+)<\/nProt>/);
      const dhIncMatch = xmlContent.match(/<dhInc>([^<]+)<\/dhInc>/) || xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/);
      const chMatch = xmlContent.match(/Id=["']NFe(\d+)["']/);

      const nProt = nProtMatch ? nProtMatch[1] : '135000000000000';
      const dhInc = dhIncMatch ? dhIncMatch[1] : new Date().toISOString();
      const chNFe = chMatch ? chMatch[1] : '';

      const protXml = `<protNFe versao="4.00"><infProt><tpAmb>1</tpAmb><verAplic>1.0</verAplic><chNFe>${chNFe}</chNFe><dhRecbto>${dhInc}</dhRecbto><nProt>${nProt}</nProt><digVal></digVal><cStat>100</cStat><xMotivo>Autorizado o uso</xMotivo></infProt></protNFe>`;

      return xmlContent.replace('</nfeProc>', `${protXml}</nfeProc>`);
    }
    return xmlContent;
  }

  async gerarDanfeFromXml(xmlContent, outputPdfPath) {
    const targetDir = path.dirname(outputPdfPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const normalizedXml = this.normalizeXmlForDanfe(xmlContent);

    const pdfDoc = await gerarPDF(normalizedXml, {
      textoRodape: this.options.textoRodape,
      pathLogo: this.options.pathLogo || undefined
    });

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(outputPdfPath);
      pdfDoc.pipe(writeStream);
      writeStream.on('finish', () => resolve(outputPdfPath));
      writeStream.on('error', reject);
    });
  }

  async gerarDanfeFromFile(xmlFilePath, outputPdfPath) {
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf8');
    return this.gerarDanfeFromXml(xmlContent, outputPdfPath);
  }
}

module.exports = DanfeService;
