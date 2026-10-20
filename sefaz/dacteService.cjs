const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

class DacteService {
  constructor(options = {}) {
    this.options = {
      textoRodape: 'Documento Auxiliar do Conhecimento de Transporte Eletrônico',
      ...options
    };
  }

  formatCnpjCpf(val) {
    if (!val) return '';
    const clean = String(val).replace(/\D/g, '');
    if (clean.length === 14) {
      return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }
    if (clean.length === 11) {
      return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    return val;
  }

  formatBrl(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  extractTag(xml, tagName) {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]+)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }

  extractBlock(xml, blockName) {
    const regex = new RegExp(`<${blockName}[^>]*>([\\s\\S]*?)<\/${blockName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1] : '';
  }

  parseCteXml(xmlContent) {
    const get = (t) => this.extractTag(xmlContent, t);
    const getFrom = (block, t) => {
      const b = this.extractBlock(xmlContent, block);
      return b ? this.extractTag(b, t) : '';
    };

    const chCTeMatch = xmlContent.match(/Id=["']CTe(\d{44})["']/i) || xmlContent.match(/<chCTe>(\d{44})<\/chCTe>/i);
    const chCTe = chCTeMatch ? chCTeMatch[1] : '';

    const nCT = get('nCT') || 'S/N';
    const serie = get('serie') || '1';
    const dhEmi = get('dhEmi') || '';
    const formattedDate = dhEmi ? dhEmi.substring(0, 10).split('-').reverse().join('/') : '';
    const natOp = get('natOp') || 'PRESTACAO DE SERVICO DE TRANSPORTE';
    const cfop = get('CFOP') || '';
    const modalCode = get('modal') || '01';
    const modalLabel = modalCode === '01' ? 'RODOVIARIO' : (modalCode === '02' ? 'AEREO' : (modalCode === '03' ? 'AQUAVIARIO' : 'OUTROS'));

    // Emitente (Transportadora)
    const emitBlock = this.extractBlock(xmlContent, 'emit') || '';
    const emitente = this.extractTag(emitBlock, 'xNome') || 'TRANSPORTADORA';
    const cnpjEmit = this.extractTag(emitBlock, 'CNPJ') || '';
    const ieEmit = this.extractTag(emitBlock, 'IE') || '';
    const enderEmit = `${this.extractTag(emitBlock, 'xLgr')}, ${this.extractTag(emitBlock, 'nro')} - ${this.extractTag(emitBlock, 'xBairro')} - ${this.extractTag(emitBlock, 'xMun')}/${this.extractTag(emitBlock, 'UF')}`;

    // Remetente
    const remBlock = this.extractBlock(xmlContent, 'rem') || '';
    const remetente = this.extractTag(remBlock, 'xNome') || 'REMETENTE';
    const cnpjRem = this.extractTag(remBlock, 'CNPJ') || this.extractTag(remBlock, 'CPF') || '';
    const ieRem = this.extractTag(remBlock, 'IE') || '';
    const enderRem = `${this.extractTag(remBlock, 'xLgr')}, ${this.extractTag(remBlock, 'nro')} - ${this.extractTag(remBlock, 'xBairro')} - ${this.extractTag(remBlock, 'xMun')}/${this.extractTag(remBlock, 'UF')}`;

    // Destinatário
    const destBlock = this.extractBlock(xmlContent, 'dest') || '';
    const destinatario = this.extractTag(destBlock, 'xNome') || 'DESTINATARIO';
    const cnpjDest = this.extractTag(destBlock, 'CNPJ') || this.extractTag(destBlock, 'CPF') || '';
    const ieDest = this.extractTag(destBlock, 'IE') || '';
    const enderDest = `${this.extractTag(destBlock, 'xLgr')}, ${this.extractTag(destBlock, 'nro')} - ${this.extractTag(destBlock, 'xBairro')} - ${this.extractTag(destBlock, 'xMun')}/${this.extractTag(destBlock, 'UF')}`;

    // Tomador
    let tomaPapel = 'Tomador';
    const tomaCode = get('toma') || '0';
    if (tomaCode === '0') tomaPapel = 'Remetente';
    else if (tomaCode === '1') tomaPapel = 'Expedidor';
    else if (tomaCode === '2') tomaPapel = 'Recebedor';
    else if (tomaCode === '3') tomaPapel = 'Destinatário';
    else tomaPapel = 'Outros';

    let tomadorNome = tomaCode === '0' ? remetente : (tomaCode === '3' ? destinatario : remetente);
    let cnpjTomador = tomaCode === '0' ? cnpjRem : (tomaCode === '3' ? cnpjDest : cnpjRem);

    const toma4Block = this.extractBlock(xmlContent, 'toma4');
    if (toma4Block) {
      tomadorNome = this.extractTag(toma4Block, 'xNome') || tomadorNome;
      cnpjTomador = this.extractTag(toma4Block, 'CNPJ') || this.extractTag(toma4Block, 'CPF') || cnpjTomador;
    }

    // Início e Fim da Prestação
    const munIni = `${get('xMunIni') || ''} - ${get('UFIni') || ''}`;
    const munFim = `${get('xMunFim') || ''} - ${get('UFFim') || ''}`;

    // Valores da Prestação
    const vTPrest = parseFloat(get('vTPrest') || '0') || 0;
    const vRec = parseFloat(get('vRec') || '0') || vTPrest;

    // Tributos ICMS
    const icmsBlock = this.extractBlock(xmlContent, 'ICMS') || '';
    const vBC = parseFloat(this.extractTag(icmsBlock, 'vBC') || '0') || 0;
    const pICMS = parseFloat(this.extractTag(icmsBlock, 'pICMS') || '0') || 0;
    const vICMS = parseFloat(this.extractTag(icmsBlock, 'vICMS') || '0') || 0;
    const cstIcms = this.extractTag(icmsBlock, 'CST') || this.extractTag(icmsBlock, 'CSOSN') || '00';

    // Protocolo
    const nProt = get('nProt') || 'Autorizado';
    const dhRecbto = get('dhRecbto') || '';

    // NF-es vinculadas
    const chNFeDocs = [];
    const nfeRegex = /<chNFe>(\d{44})<\/chNFe>/g;
    let nfeMatch;
    while ((nfeMatch = nfeRegex.exec(xmlContent)) !== null) {
      chNFeDocs.push(nfeMatch[1]);
    }

    return {
      chCTe,
      nCT,
      serie,
      formattedDate,
      dhEmi,
      natOp,
      cfop,
      modalLabel,
      emitente,
      cnpjEmit,
      ieEmit,
      enderEmit,
      remetente,
      cnpjRem,
      ieRem,
      enderRem,
      destinatario,
      cnpjDest,
      ieDest,
      enderDest,
      tomaPapel,
      tomadorNome,
      cnpjTomador,
      munIni,
      munFim,
      vTPrest,
      vRec,
      vBC,
      pICMS,
      vICMS,
      cstIcms,
      nProt,
      dhRecbto,
      chNFeDocs
    };
  }

  async gerarDactePdf(xmlContent, outputPdfPath) {
    const targetDir = path.dirname(outputPdfPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const data = this.parseCteXml(xmlContent);

    // Cria documento A4 com pdf-lib
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 em pontos
    const { width, height } = page.getSize();

    const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

    const slate900 = rgb(0.06, 0.09, 0.16);
    const slate700 = rgb(0.2, 0.25, 0.35);
    const slate500 = rgb(0.4, 0.45, 0.55);
    const slate200 = rgb(0.88, 0.91, 0.94);
    const slate100 = rgb(0.95, 0.96, 0.98);
    const blue700 = rgb(0.11, 0.35, 0.72);
    const emerald700 = rgb(0.02, 0.48, 0.3);

    let y = height - 30;
    const margin = 30;
    const contentWidth = width - margin * 2;

    const drawBox = (x, boxY, w, h, bg = null, stroke = slate200) => {
      if (bg) {
        page.drawRectangle({ x, y: boxY, width: w, height: h, color: bg });
      }
      if (stroke) {
        page.drawRectangle({ x, y: boxY, width: w, height: h, borderColor: stroke, borderWidth: 1 });
      }
    };

    // 1. CABEÇALHO DACTE
    drawBox(margin, y - 90, contentWidth, 90, slate100, slate200);

    // Lado Esquerdo: Transportadora
    page.drawText('DACTE - DOCUMENTO AUXILIAR DO CONHECIMENTO DE TRANSPORTE ELETRÔNICO', {
      x: margin + 12,
      y: y - 18,
      size: 9,
      font: fontBold,
      color: blue700
    });

    page.drawText(data.emitente.substring(0, 48), {
      x: margin + 12,
      y: y - 36,
      size: 13,
      font: fontBold,
      color: slate900
    });

    page.drawText(`CNPJ: ${this.formatCnpjCpf(data.cnpjEmit)}   IE: ${data.ieEmit || 'ISENTO'}`, {
      x: margin + 12,
      y: y - 52,
      size: 8,
      font: fontNormal,
      color: slate700
    });

    page.drawText(data.enderEmit.substring(0, 75), {
      x: margin + 12,
      y: y - 66,
      size: 7.5,
      font: fontNormal,
      color: slate500
    });

    page.drawText(`MODAL: ${data.modalLabel}   |   NATUREZA: ${data.natOp.substring(0, 35)}`, {
      x: margin + 12,
      y: y - 80,
      size: 8,
      font: fontBold,
      color: slate700
    });

    // Lado Direito do Cabeçalho: Número, Série e Chave
    const rightBoxWidth = 200;
    const rightBoxX = width - margin - rightBoxWidth;
    drawBox(rightBoxX, y - 90, rightBoxWidth, 90, rgb(1, 1, 1), slate200);

    page.drawText(`MODELO: 57   SÉRIE: ${data.serie}`, {
      x: rightBoxX + 12,
      y: y - 18,
      size: 8.5,
      font: fontBold,
      color: slate700
    });

    page.drawText(`Nº ${data.nCT}`, {
      x: rightBoxX + 12,
      y: y - 38,
      size: 16,
      font: fontBold,
      color: blue700
    });

    page.drawText(`EMISSÃO: ${data.formattedDate || '-'}`, {
      x: rightBoxX + 12,
      y: y - 54,
      size: 8,
      font: fontBold,
      color: slate700
    });

    page.drawText(`CHAVE DE ACESSO:`, {
      x: rightBoxX + 12,
      y: y - 68,
      size: 7,
      font: fontBold,
      color: slate500
    });

    const formattedKey = data.chCTe ? data.chCTe.replace(/(\d{4})/g, '$1 ').trim() : 'N/A';
    page.drawText(formattedKey.substring(0, 27), {
      x: rightBoxX + 12,
      y: y - 80,
      size: 7.5,
      font: fontMono,
      color: slate900
    });

    y -= 100;

    // 2. PROTOCOLO E ROTAS
    drawBox(margin, y - 40, contentWidth, 40, rgb(1, 1, 1), slate200);

    page.drawText(`INÍCIO DA PRESTAÇÃO: ${data.munIni || '-'}`, {
      x: margin + 12,
      y: y - 16,
      size: 8.5,
      font: fontBold,
      color: slate700
    });

    page.drawText(`TÉRMINO DA PRESTAÇÃO: ${data.munFim || '-'}`, {
      x: margin + 12,
      y: y - 30,
      size: 8.5,
      font: fontBold,
      color: slate700
    });

    page.drawText(`PROTOCOLO DE AUTORIZAÇÃO: ${data.nProt} (${data.dhRecbto ? data.dhRecbto.substring(0, 19) : 'AUTORIZADO'})`, {
      x: margin + 280,
      y: y - 22,
      size: 8,
      font: fontBold,
      color: emerald700
    });

    y -= 50;

    // 3. REMETENTE E DESTINATÁRIO
    const halfW = (contentWidth - 10) / 2;

    // Remetente Box
    drawBox(margin, y - 75, halfW, 75, rgb(1, 1, 1), slate200);
    page.drawText('REMETENTE DA CARGA', { x: margin + 10, y: y - 16, size: 8, font: fontBold, color: blue700 });
    page.drawText(data.remetente.substring(0, 40), { x: margin + 10, y: y - 30, size: 9, font: fontBold, color: slate900 });
    page.drawText(`CNPJ/CPF: ${this.formatCnpjCpf(data.cnpjRem)}   IE: ${data.ieRem || 'ISENTO'}`, { x: margin + 10, y: y - 44, size: 7.5, font: fontNormal, color: slate700 });
    page.drawText(data.enderRem.substring(0, 48), { x: margin + 10, y: y - 58, size: 7, font: fontNormal, color: slate500 });

    // Destinatário Box
    drawBox(margin + halfW + 10, y - 75, halfW, 75, rgb(1, 1, 1), slate200);
    page.drawText('DESTINATÁRIO DA CARGA', { x: margin + halfW + 20, y: y - 16, size: 8, font: fontBold, color: blue700 });
    page.drawText(data.destinatario.substring(0, 40), { x: margin + halfW + 20, y: y - 30, size: 9, font: fontBold, color: slate900 });
    page.drawText(`CNPJ/CPF: ${this.formatCnpjCpf(data.cnpjDest)}   IE: ${data.ieDest || 'ISENTO'}`, { x: margin + halfW + 20, y: y - 44, size: 7.5, font: fontNormal, color: slate700 });
    page.drawText(data.enderDest.substring(0, 48), { x: margin + halfW + 20, y: y - 58, size: 7, font: fontNormal, color: slate500 });

    y -= 85;

    // 4. TOMADOR DO SERVIÇO (QUEM PAGA O FRETE)
    drawBox(margin, y - 50, contentWidth, 50, slate100, slate200);
    page.drawText(`TOMADOR DO SERVIÇO (QUEM PAGA O FRETE): ${data.tomaPapel.toUpperCase()}`, {
      x: margin + 12,
      y: y - 16,
      size: 8.5,
      font: fontBold,
      color: blue700
    });

    page.drawText(`${data.tomadorNome}  -  CNPJ/CPF: ${this.formatCnpjCpf(data.cnpjTomador)}`, {
      x: margin + 12,
      y: y - 34,
      size: 9.5,
      font: fontBold,
      color: slate900
    });

    y -= 60;

    // 5. VALORES DA PRESTAÇÃO E TRIBUTAÇÃO
    drawBox(margin, y - 75, contentWidth, 75, rgb(1, 1, 1), slate200);

    page.drawText('COMPONENTES DO VALOR DA PRESTAÇÃO E IMPOSTOS', {
      x: margin + 12,
      y: y - 16,
      size: 8,
      font: fontBold,
      color: blue700
    });

    const colW = contentWidth / 4;

    // Col 1: Valor Total do Frete
    page.drawText('VALOR TOTAL DO SERVIÇO', { x: margin + 12, y: y - 32, size: 7, font: fontBold, color: slate500 });
    page.drawText(this.formatBrl(data.vTPrest), { x: margin + 12, y: y - 52, size: 14, font: fontBold, color: emerald700 });

    // Col 2: Valor a Receber
    page.drawText('VALOR A RECEBER', { x: margin + colW + 12, y: y - 32, size: 7, font: fontBold, color: slate500 });
    page.drawText(this.formatBrl(data.vRec), { x: margin + colW + 12, y: y - 52, size: 12, font: fontBold, color: slate900 });

    // Col 3: Base de Cálculo ICMS
    page.drawText('BASE DE CÁLCULO ICMS', { x: margin + colW * 2 + 12, y: y - 32, size: 7, font: fontBold, color: slate500 });
    page.drawText(this.formatBrl(data.vBC), { x: margin + colW * 2 + 12, y: y - 52, size: 11, font: fontBold, color: slate900 });

    // Col 4: Alíquota e ICMS
    page.drawText('ALÍQUOTA / ICMS DEVIDO', { x: margin + colW * 3 + 12, y: y - 32, size: 7, font: fontBold, color: slate500 });
    page.drawText(`${data.pICMS.toFixed(2)}% | ${this.formatBrl(data.vICMS)}`, { x: margin + colW * 3 + 12, y: y - 52, size: 11, font: fontBold, color: slate900 });

    y -= 85;

    // 6. DOCUMENTOS TRANSPORTADOS (NF-e)
    if (data.chNFeDocs && data.chNFeDocs.length > 0) {
      const docBoxH = Math.min(140, 35 + Math.ceil(data.chNFeDocs.length / 2) * 16);
      drawBox(margin, y - docBoxH, contentWidth, docBoxH, rgb(1, 1, 1), slate200);

      page.drawText(`DOCUMENTOS FISCAIS VINCULADOS (${data.chNFeDocs.length} NF-e TRANSPORTADAS)`, {
        x: margin + 12,
        y: y - 16,
        size: 8,
        font: fontBold,
        color: blue700
      });

      data.chNFeDocs.slice(0, 10).forEach((nfeChave, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const itemX = margin + 12 + col * (contentWidth / 2);
        const itemY = y - 34 - row * 16;
        page.drawText(`NF-e: ${nfeChave}`, {
          x: itemX,
          y: itemY,
          size: 7.5,
          font: fontMono,
          color: slate700
        });
      });

      y -= docBoxH + 10;
    }

    // 7. RODAPÉ INFORMATIVO
    page.drawText(this.options.textoRodape, {
      x: margin + 12,
      y: 20,
      size: 7,
      font: fontNormal,
      color: slate500
    });

    page.drawText(`Emissão em ${new Date().toLocaleString('pt-BR')}`, {
      x: width - margin - 150,
      y: 20,
      size: 7,
      font: fontNormal,
      color: slate500
    });

    const pdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPdfPath, Buffer.from(pdfBytes));
    return outputPdfPath;
  }

  async gerarDacteFromFile(xmlFilePath, outputPdfPath) {
    const xmlContent = fs.readFileSync(xmlFilePath, 'utf8');
    return this.gerarDactePdf(xmlContent, outputPdfPath);
  }
}

module.exports = DacteService;
