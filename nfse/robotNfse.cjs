const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const https = require('https');
const tls = require('tls');
const zlib = require('zlib');
const axios = require('axios');
const PDFLib = require('pdf-lib');
const qrcode = require('qrcode-generator');
const DANFSe = require('./danfse.cjs');
const { decryptPassword, normalizarEExportarPfx } = require('./cryptoUtils.cjs');
const { gerarChaveDedupNfse, indexarNotasExistentes } = require('./reportsNfse.cjs');

// =========================================================================
// EMULAÇÃO DE NAVEGADOR PARA O DANFSe.JS EM AMBIENTE NODE
// =========================================================================
global.DOMParser = require('@xmldom/xmldom').DOMParser;

const docTest = new global.DOMParser().parseFromString('<proto><child/></proto>', 'text/xml');
const DocumentProto = Object.getPrototypeOf(docTest);
const ElementProto = Object.getPrototypeOf(docTest.documentElement);

if (!DocumentProto.querySelector) {
  DocumentProto.querySelector = function (selector) {
    if (selector === 'parsererror') {
      const elements = this.getElementsByTagName('parsererror');
      return elements.length > 0 ? elements[0] : null;
    }
    return null;
  };
}

if (!('firstElementChild' in ElementProto)) {
  Object.defineProperty(ElementProto, 'firstElementChild', {
    get() {
      let n = this.firstChild;
      while (n) {
        if (n.nodeType === 1) return n;
        n = n.nextSibling;
      }
      return null;
    }
  });
}

if (!('nextElementSibling' in ElementProto)) {
  Object.defineProperty(ElementProto, 'nextElementSibling', {
    get() {
      let n = this.nextSibling;
      while (n) {
        if (n.nodeType === 1) return n;
        n = n.nextSibling;
      }
      return null;
    }
  });
}

// Logo oficial do Portal Nacional para o DANFSe
let logoBytes = null;
const LOGO_PATH = path.join(__dirname, '../assets/nfse-logo.png');
if (fs.existsSync(LOGO_PATH)) {
  try {
    logoBytes = new Uint8Array(fs.readFileSync(LOGO_PATH));
  } catch (_) {}
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// =========================================================================
// PARSERS E CLASSIFICADORES DE REGRAS TRIBUTÁRIAS
// =========================================================================

function decodeGzipBase64(b64) {
  const buffer = Buffer.from(b64, 'base64');
  try {
    return zlib.gunzipSync(buffer).toString('utf-8');
  } catch (_) {
    return buffer.toString('utf-8');
  }
}

const obterNomeTagLimpo = (node) => {
  const nomeBruto = node.localName || node.tagName || '';
  return (nomeBruto.includes(':') ? nomeBruto.split(':').pop() : nomeBruto).toLowerCase();
};

function parseMeta(xmlString) {
  const doc = new global.DOMParser().parseFromString(xmlString, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  const root = doc.documentElement;

  const t = (parent, ...sels) => {
    if (!parent) return '';
    for (const s of sels) {
      const allElements = parent.getElementsByTagName('*');
      for (let i = 0; i < allElements.length; i++) {
        if (obterNomeTagLimpo(allElements[i]) === s.toLowerCase() && allElements[i].textContent.trim()) {
          return allElements[i].textContent.trim();
        }
      }
    }
    return '';
  };

  let emit = null;
  let toma = null;
  let interm = null;
  const allNodes = root.getElementsByTagName('*');

  for (let i = 0; i < allNodes.length; i++) {
    const nomeTag = obterNomeTagLimpo(allNodes[i]);
    if (nomeTag === 'emit' || nomeTag === 'prest' || nomeTag === 'prestador' || nomeTag === 'prestadorservico') {
      if (!emit || nomeTag === 'emit' || nomeTag === 'prestador') emit = allNodes[i];
    }
    if (nomeTag === 'toma' || nomeTag === 'tomador' || nomeTag === 'tomadorservico' || nomeTag === 'dest') {
      if (!toma || nomeTag === 'toma' || nomeTag === 'tomador') toma = allNodes[i];
    }
    if (nomeTag === 'interm' || nomeTag === 'intermediario') {
      if (!interm) interm = allNodes[i];
    }
  }

  const numero = t(root, 'nNFSe', 'nDPS');
  const dataEmissao = t(root, 'dhEmi') || t(root, 'dhProc') || t(root, 'dhEvento');
  const dataCompet = t(root, 'dCompet');
  const dataEmissaoISO = dataEmissao ? dataEmissao.slice(0, 10) : '';
  const competenciaMes = dataCompet ? dataCompet.slice(0, 7) : (dataEmissaoISO ? dataEmissaoISO.slice(0, 7) : '');

  const numVal = (...tags) => {
    for (const s of tags) {
      const val = t(root, s);
      if (val) {
        const num = parseFloat(val.replace(',', '.'));
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return 0;
  };

  const vBruto = numVal('vServ', 'vServicos', 'vBC', 'vLiqServ');
  const vLiquido = numVal('vLiq', 'vLiquido', 'vNF');
  let vDescIncond = numVal('vDescIncond');
  let vDescCond = numVal('vDescCond');

  // NUNCA inclui vTotalRet ou vTotalRetFed aqui pois prefeituras preenchem com IBPT ou PIS/COFINS próprio
  const temImpostoRetido = Boolean(
    numVal('vRetIRRF', 'vRetCSLL', 'vRetCP', 'vRetINSS', 'vISSQNRet') > 0 ||
    t(root, 'tpRetISSQN') === '2' ||
    t(root, 'tpRetISSQN') === '3' ||
    t(root, 'indRetencao') === '1'
  );

  const difValores = (vBruto > 0 && vLiquido > 0) ? Math.max(0, vBruto - vLiquido) : 0;
  if (difValores > 0 && vDescIncond === 0 && vDescCond === 0 && !temImpostoRetido) {
    vDescIncond = difValores;
  }

  const totalDescontos = vDescIncond + vDescCond;
  const temDescontoCond = Boolean(vDescCond > 0);
  const temDescontoIncond = Boolean(vDescIncond > 0);
  const temDesconto = Boolean(vDescCond > 0 || vDescIncond > 0);

  const retencaoRestante = Math.max(0, difValores - totalDescontos);
  // Regra de ouro: se ambos vBruto e vLiquido estão presentes, só há retenção se o valor líquido for menor que o bruto (descontados os descontos)
  const temRetencao = (vBruto > 0 && vLiquido > 0)
    ? Boolean(retencaoRestante >= 0.01)
    : Boolean(temImpostoRetido);

  const cStat = t(root, 'cStat');
  const tpEvento = t(root, 'tpEvento');
  const xDesc = t(root, 'xDesc', 'descEvento');
  const xMotivo = t(root, 'xMotivo', 'xJust');
  const chRef = t(root, 'chNFSe', 'chNFSeRef', 'chNFe');

  const isSubstituicao = (
    tpEvento === '105102' ||
    (xDesc && xDesc.toLowerCase().includes('substitui')) ||
    (xMotivo && xMotivo.toLowerCase().includes('substitui'))
  );

  const isCancelada = (
    cStat === '2' ||
    tpEvento === '101101' ||
    tpEvento === '105102' ||
    (xDesc && (xDesc.toLowerCase().includes('cancelamento') || xDesc.toLowerCase().includes('cancelada'))) ||
    (xMotivo && (xMotivo.toLowerCase().includes('cancelamento') || xMotivo.toLowerCase().includes('cancelada'))) ||
    root.getElementsByTagName('infPedCanc').length > 0 ||
    root.getElementsByTagName('cancNFSe').length > 0
  );

  let prestadorCnpj = emit ? t(emit, 'CNPJ', 'CPF', 'NIF') : '';
  let prestadorNome = emit ? t(emit, 'xNome', 'xRazSoc', 'xFant') : '';
  const tomaEfetivo = toma || interm;
  let tomadorCnpj = tomaEfetivo ? t(tomaEfetivo, 'CNPJ', 'CPF', 'NIF') : '';
  let tomadorNome = tomaEfetivo ? t(tomaEfetivo, 'xNome', 'xRazSoc') : '';

  return {
    numero, dataEmissaoISO, competenciaMes,
    prestadorCnpj,
    prestadorNome,
    tomadorCnpj,
    tomadorNome,
    valorServicos: vBruto,
    valorLiquido: vLiquido || vBruto,
    eventoDesc: xDesc, chaveReferenciada: chRef,
    temRetencao,
    temDescontoCond,
    temDescontoIncond,
    temDesconto,
    isCancelada,
    isSubstituicao
  };
}

function classifyTipo(tipoDoc, meta, ownerDigits) {
  if (tipoDoc === 'EVENTO') return 'Eventos';
  const norm = (s) => (s || '').replace(/\D/g, '');
  const cleanOwner = norm(ownerDigits);
  const cleanPrestador = norm(meta.prestadorCnpj);
  const cleanTomador = norm(meta.tomadorCnpj);

  let base = 'SERVIÇOS PRESTADOS';
  if (cleanOwner && cleanTomador && (cleanTomador === cleanOwner || cleanTomador.slice(0, 8) === cleanOwner.slice(0, 8))) {
    base = 'SERVIÇOS TOMADOS';
  } else if (cleanOwner && cleanPrestador && (cleanPrestador === cleanOwner || cleanPrestador.slice(0, 8) === cleanOwner.slice(0, 8))) {
    base = 'SERVIÇOS PRESTADOS';
  } else if (cleanOwner && cleanPrestador && cleanPrestador !== cleanOwner && cleanPrestador.slice(0, 8) !== cleanOwner.slice(0, 8)) {
    base = 'SERVIÇOS TOMADOS';
  } else if (cleanOwner && cleanTomador && cleanTomador !== cleanOwner && cleanTomador.slice(0, 8) !== cleanOwner.slice(0, 8)) {
    base = 'SERVIÇOS PRESTADOS';
  }

  return meta.isCancelada ? `${base} - CANCELADAS` : base;
}

const MONTH_NAMES = {
  '01': '01 - Janeiro', '02': '02 - Fevereiro', '03': '03 - Março',
  '04': '04 - Abril',   '05': '05 - Maio',      '06': '06 - Junho',
  '07': '07 - Julho',   '08': '08 - Agosto',    '09': '09 - Setembro',
  '10': '10 - Outubro', '11': '11 - Novembro',  '12': '12 - Dezembro'
};

function folderFor(tipo, meta, companyOutputDir) {
  const ym = meta.competenciaMes || '';
  let ano = 'Ano_Indefinido', mes = '01';
  if (/^\d{4}-\d{2}$/.test(ym)) {
    const p = ym.split('-');
    ano = p[0];
    mes = p[1];
  } else {
    const now = new Date();
    ano = String(now.getFullYear());
    mes = String(now.getMonth() + 1).padStart(2, '0');
  }

  const defaultMonthFolder = MONTH_NAMES[mes] || mes;
  let resolvedMonthFolder = defaultMonthFolder;

  if (companyOutputDir && fs.existsSync(path.join(companyOutputDir, ano))) {
    try {
      const entries = fs.readdirSync(path.join(companyOutputDir, ano), { withFileTypes: true });
      const found = entries.find(e => e.isDirectory() && (
        e.name === mes ||
        e.name.startsWith(`${mes} -`) ||
        e.name.startsWith(`${mes}-`) ||
        (MONTH_NAMES[mes] && e.name.toLowerCase() === MONTH_NAMES[mes].toLowerCase())
      ));
      if (found) resolvedMonthFolder = found.name;
    } catch (_) {}
  }

  return path.join(ano, resolvedMonthFolder, 'NFSE', tipo);
}

function sanitize(name) {
  return (name || '').replace(/[\/\\:*?"<>|]/g, '_').replace(/[\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim().substring(0, 80).replace(/[. ]+$/, '') || 'sem-nome';
}

function fileNameFor(meta, tipoDoc, nsu, chave, tipo) {
  const ch = (chave || '').replace(/[^0-9]/g, '');
  const sufNSU = (nsu != null && nsu !== '') ? String(nsu) : (ch.length >= 7 ? ch.slice(-7) : 's');

  if (tipoDoc === 'EVENTO') {
    const rawDesc = (meta.eventoDesc || '').trim().replace(/^Manifesta[çc]ão de NFS-?e\s*[-–]\s*/i, '');
    let descEv = rawDesc ? sanitize(rawDesc).replace(/_/g, '-') : 'evento';
    if (descEv.length > 50) descEv = descEv.slice(0, 50).replace(/\s+\S*$/, '');
    descEv = descEv.replace(/[ .]+$/, '');

    const chRef = (meta.chaveReferenciada || '').replace(/\D/g, '');
    const numNota = chRef.length >= 36 ? String(parseInt(chRef.slice(23, 36), 10) || '') : '';
    return [numNota ? `NF ${numNota}` : null, descEv, sufNSU].filter(Boolean).join(' - ') + '.xml';
  }

  const num = meta.numero ? sanitize(String(meta.numero)) : 'SEM-NUMERO';
  const tipoUpper = String(tipo || '').toUpperCase();
  const isPrestada = tipoUpper.includes('PRESTAD') || tipoUpper.includes('EMITID');
  let nomeBruto = isPrestada ? meta.tomadorNome : meta.prestadorNome;
  let nome = sanitize(nomeBruto);
  if (!nome || nome === 'sem-nome') nome = 'SEM NOME';

  let partes = [`NF ${num}`, nome];
  if (meta.temRetencao) {
    partes.push('COM RETENÇÃO');
  }
  if (meta.temDescontoCond) {
    partes.push('COM DESCONTO COND');
  } else if (meta.temDescontoIncond) {
    partes.push('COM DESCONTO');
  }
  if (meta.isCancelada) {
    partes.push('CANCELADA');
  }

  return partes.join(' - ') + '.xml';
}

async function marcarComoCancelada(pastaEmpresaRaiz, chaveAlvo, xmlEventoContent = null, metaEvento = null) {
  if (!chaveAlvo) return false;
  const cleanChave = chaveAlvo.replace(/\D/g, '');
  if (!cleanChave) return false;

  let encontrouPar = false;

  async function verificarEAtualizar(diretorio) {
    if (!fs.existsSync(diretorio)) return;
    const itens = fs.readdirSync(diretorio);
    for (const item of itens) {
      const caminhoItem = path.join(diretorio, item);
      if (fs.statSync(caminhoItem).isDirectory()) {
        await verificarEAtualizar(caminhoItem);
      } else if (item.toLowerCase().endsWith('.xml') && !item.toUpperCase().includes('EVENTO')) {
        try {
          const conteudoXml = fs.readFileSync(caminhoItem, 'utf-8');
          let isTarget = false;
          const matchInfNFSe = conteudoXml.match(/<infNFSe[^>]*Id="NFS?(\d{50})"/i);
          const matchChaveNac = conteudoXml.match(/<ChaveNotaNacional>(\d{50})<\/ChaveNotaNacional>/i);
          const chavePropria = (matchInfNFSe ? matchInfNFSe[1] : (matchChaveNac ? matchChaveNac[1] : ''));

          if (chavePropria) {
            isTarget = (chavePropria === cleanChave);
          } else {
            const xmlSemSubst = conteudoXml.replace(/<subst>[\s\S]*?<\/subst>/gi, '').replace(/<chSubstda>[\s\S]*?<\/chSubstda>/gi, '');
            isTarget = xmlSemSubst.includes(cleanChave);
          }

          if (isTarget) {
            encontrouPar = true;
            let nomeBaseSemExt = item.replace(/\.xml$/i, '');
            if (!nomeBaseSemExt.toUpperCase().includes('CANCELADA')) {
              nomeBaseSemExt = `${nomeBaseSemExt} - CANCELADA`;
            }

            let pastaDestino = diretorio;
            const dirName = path.basename(diretorio);
            const dirParent = path.dirname(diretorio);

            if (dirName === 'SERVIÇOS PRESTADOS' || dirName === 'Prestadas') {
              pastaDestino = path.join(dirParent, 'SERVIÇOS PRESTADOS - CANCELADAS');
            } else if (dirName === 'SERVIÇOS TOMADOS' || dirName === 'Tomadas') {
              pastaDestino = path.join(dirParent, 'SERVIÇOS TOMADOS - CANCELADAS');
            } else if (dirName !== 'NFSE' && !dirName.toUpperCase().includes('CANCELADA')) {
              pastaDestino = path.join(dirParent, `${dirName} - CANCELADAS`);
            }

            if (!fs.existsSync(pastaDestino)) fs.mkdirSync(pastaDestino, { recursive: true });

            const novoCaminhoXml = path.join(pastaDestino, `${nomeBaseSemExt}.xml`);
            fs.writeFileSync(novoCaminhoXml, conteudoXml, 'utf-8');
            if (caminhoItem !== novoCaminhoXml && fs.existsSync(caminhoItem)) {
              try { fs.unlinkSync(caminhoItem); } catch (_) {}
            }

            if (xmlEventoContent) {
              const nomeEventoXml = `${nomeBaseSemExt} - EVENTO_CANCELAMENTO.xml`;
              const caminhoEventoXml = path.join(pastaDestino, nomeEventoXml);
              fs.writeFileSync(caminhoEventoXml, xmlEventoContent, 'utf-8');
            }

            try {
              let marcaDagua = 'CANCELADA';
              if (metaEvento && (metaEvento.isSubstituicao || (metaEvento.eventoDesc && metaEvento.eventoDesc.toLowerCase().includes('substitui')))) {
                marcaDagua = 'SUBSTITUÍDA';
              } else if (xmlEventoContent && (xmlEventoContent.includes('105102') || /substitui/i.test(xmlEventoContent))) {
                marcaDagua = 'SUBSTITUÍDA';
              }

              const pdfBytes = await DANFSe.gerarDanfse(conteudoXml, {
                PDFLib,
                qrcode,
                logoBytes,
                destacarRet: true,
                marcaDagua
              });

              const novoCaminhoPdf = path.join(pastaDestino, `${nomeBaseSemExt}.pdf`);
              fs.writeFileSync(novoCaminhoPdf, Buffer.from(pdfBytes));

              const pdfAntigo = caminhoItem.replace(/\.xml$/i, '.pdf');
              if (pdfAntigo !== novoCaminhoPdf && fs.existsSync(pdfAntigo)) {
                try { fs.unlinkSync(pdfAntigo); } catch (_) {}
              }
            } catch (errPdf) {
              console.warn(`[Cancelamento] Erro ao regerar PDF com marca d'água: ${errPdf.message}`);
            }

            if (diretorio !== pastaDestino && fs.existsSync(diretorio)) {
              try {
                if (fs.readdirSync(diretorio).length === 0) fs.rmdirSync(diretorio);
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }
  }
  await verificarEAtualizar(pastaEmpresaRaiz);
  return encontrouPar;
}

async function verificarEUnificarEventosPendentes(pastaEmpresaRaiz, chaveAlvo, pastaDestinoNota, nomeArquivoNota) {
  if (!chaveAlvo || !fs.existsSync(pastaEmpresaRaiz)) return;

  function procurarEMover(diretorio) {
    if (!fs.existsSync(diretorio)) return;
    const itens = fs.readdirSync(diretorio);
    for (const item of itens) {
      const caminhoItem = path.join(diretorio, item);
      if (fs.statSync(caminhoItem).isDirectory()) {
        procurarEMover(caminhoItem);
      } else if (item.toLowerCase().endsWith('.xml') && item.toUpperCase().includes('EVENTO') && !diretorio.toUpperCase().includes('PRESTAD') && !diretorio.toUpperCase().includes('TOMAD')) {
        try {
          const conteudo = fs.readFileSync(caminhoItem, 'utf-8');
          const chAfetada = (
            conteudo.match(/<chNFSe>(\d{50})<\/chNFSe>/i)?.[1] ||
            conteudo.match(/<chNFSeRef>(\d{50})<\/chNFSeRef>/i)?.[1] || ''
          );
          let match = false;
          if (chAfetada) {
            match = (chAfetada === chaveAlvo);
          } else {
            const conteudoSemSubst = conteudo.replace(/<chSubstituta>[\s\S]*?<\/chSubstituta>/gi, '');
            match = conteudoSemSubst.includes(chaveAlvo);
          }

          if (match) {
            const nomeBaseSemExt = nomeArquivoNota.replace(/\.xml$/i, '');
            const novoNomeEvento = `${nomeBaseSemExt} - EVENTO_CANCELAMENTO.xml`;
            const caminhoFinalEvento = path.join(pastaDestinoNota, novoNomeEvento);
            fs.writeFileSync(caminhoFinalEvento, conteudo, 'utf-8');
            try { fs.unlinkSync(caminhoItem); } catch (_) {}
          }
        } catch (_) {}
      }
    }
  }
  procurarEMover(pastaEmpresaRaiz);
}

// =========================================================================
// MOTOR DE CAPTAÇÃO DO PORTAL NACIONAL DA NFS-E (ADN)
// =========================================================================

/**
 * Executa a sincronização de NFS-e via Portal Nacional (ADN) para uma empresa.
 * @param {Object} options
 * @param {Object} options.company Dados da empresa { cnpj, razaoSocial, certPath, password, ultimoNsuNfse }
 * @param {string} options.companyOutputDir Pasta de saída para as NFS-e (ex: .../RAZAO (CNPJ)/nfse)
 * @param {function} [options.onProgress] Callback de progresso ({ message, currentNsu, docsCount, type })
 * @param {string|number} [options.targetNsu] NSU inicial customizado
 */
async function rodarCaptacaoNfseEmpresa({ company, companyOutputDir, onProgress, targetNsu }) {
  const log = (msg, type = 'info') => {
    if (onProgress) onProgress({ message: msg, type, timestamp: new Date().toLocaleTimeString('pt-BR') });
  };

  if (!company || !company.cnpj) {
    throw new Error('Dados da empresa inválidos.');
  }

  const cleanCnpj = String(company.cnpj).replace(/\D/g, '');
  const cleanThumb = (company.certThumbprint || company.thumbprint || '').replace(/[^a-fA-F0-9]/g, '');
  let isWindowsCert = company.certStore === 'windows' || (!company.certPath && !!cleanThumb);
  let certPath = company.certPath;

  if (!isWindowsCert) {
    if (!certPath || !fs.existsSync(certPath)) {
      const fallbackCert = path.join(process.env.APPDATA || '', 'contai-robo', 'certificados', `${cleanCnpj}.pfx`);
      if (fs.existsSync(fallbackCert)) {
        certPath = fallbackCert;
      } else if (cleanThumb) {
        isWindowsCert = true;
      } else {
        throw new Error(`Certificado digital A1 não encontrado em: ${company.certPath}`);
      }
    }
  }

  let httpsAgent = null;
  let pfxBuffer = null;
  let passphrase = '';
  let tentouConverter = false;

  if (isWindowsCert) {
    log(`Utilizando Certificado Digital do Repositório Windows (Thumbprint: ${cleanThumb || 'Padrão'})`);
  } else {
    pfxBuffer = fs.readFileSync(certPath);
    const rawPassword = company.password || '';
    passphrase = decryptPassword(rawPassword);

    // Auto-cura preventiva do PFX
    try {
      tls.createSecureContext({ pfx: pfxBuffer, passphrase });
    } catch (errPfxInit) {
      log(`PFX incompatível com OpenSSL 3 (${errPfxInit.message}). Convertendo certificado...`, 'warn');
      const pfxConvertido = normalizarEExportarPfx(pfxBuffer, passphrase);
      if (pfxConvertido && pfxConvertido.length > 0) {
        pfxBuffer = pfxConvertido;
        try { fs.writeFileSync(certPath, pfxBuffer); } catch (_) {}
        tentouConverter = true;
      }
    }

    httpsAgent = new https.Agent({
      pfx: pfxBuffer,
      passphrase: passphrase,
      rejectUnauthorized: true,
      secureProtocol: 'TLSv1_2_method'
    });
  }

  let cursorNSU = (targetNsu !== undefined && targetNsu !== null && targetNsu !== '')
    ? parseInt(String(targetNsu), 10)
    : (parseInt(String(company.ultimoNsuNfse || 0), 10) || 0);

  if (isNaN(cursorNSU)) cursorNSU = 0;

  log(`Iniciando busca no Portal Nacional ADN a partir do NSU: ${cursorNSU}`);
  if (!fs.existsSync(companyOutputDir)) {
    fs.mkdirSync(companyOutputDir, { recursive: true });
  }

  // Indexa todas as notas já existentes na pasta da empresa para evitar duplicidade
  // (inclusive notas já captadas pelo Portal SP ou salvas em outra competência)
  const existingIndex = indexarNotasExistentes(companyOutputDir, cleanCnpj);

  let loopSeguranca = 0;
  let totalDocsBaixados = 0;
  let totalDuplicadasIgnoradas = 0;

  while (loopSeguranca < 1000) {
    loopSeguranca++;
    const url = `https://adn.nfse.gov.br/contribuintes/DFe/${cursorNSU}?lote=true`;

    let response = null;
    let tentativas = 0;
    const maxTentativas = 3;

    while (tentativas < maxTentativas) {
      try {
        await delay(tentativas === 0 ? 1000 : 3000 * tentativas);
        if (isWindowsCert) {
          const certFlag = cleanThumb ? `--cert "CurrentUser\\My\\${cleanThumb}"` : '';
          const cmd = `curl.exe -s -H "Accept: application/json" ${certFlag} "${url}"`;
          const stdout = cp.execSync(cmd, { timeout: 45000, maxBuffer: 15 * 1024 * 1024 }).toString('utf8');
          if (stdout && stdout.trim()) {
            try {
              const data = JSON.parse(stdout);
              response = { data, status: 200 };
            } catch (pErr) {
              if (stdout.includes('404 - File or directory not found') || stdout.includes('404 Not Found')) {
                response = { status: 404 };
              } else {
                throw new Error(`Resposta não-JSON do Portal Nacional: ${stdout.slice(0, 100)}`);
              }
            }
          } else {
            response = { status: 404 };
          }
          break;
        } else {
          response = await axios.get(url, {
            httpsAgent,
            headers: { 'Accept': 'application/json' },
            timeout: 45000
          });
          break;
        }
      } catch (error) {
        const errStr = (error.message || '') + ' ' + (error.code || '');
        const isPfxError = /Unsupported PKCS12|PKCS12|EVP_UNSUPPORTED|unsupported|mac verify failure|ERR_OSSL/i.test(errStr);

        if (isPfxError && !tentouConverter) {
          tentouConverter = true;
          log(`Reparando certificado PFX em tempo de execução...`, 'warn');
          const pfxConvertido = normalizarEExportarPfx(fs.readFileSync(certPath), passphrase);
          if (pfxConvertido && pfxConvertido.length > 0) {
            pfxBuffer = pfxConvertido;
            try { fs.writeFileSync(certPath, pfxBuffer); } catch (_) {}
            httpsAgent = new https.Agent({
              pfx: pfxBuffer,
              passphrase: passphrase,
              rejectUnauthorized: true,
              secureProtocol: 'TLSv1_2_method'
            });
            continue;
          }
        }

        if (error.response && error.response.status === 404) {
          response = { status: 404 };
          break;
        }

        tentativas++;
        log(`Instabilidade no NSU ${cursorNSU} (tentativa ${tentativas}/${maxTentativas}): ${error.message}`, 'warn');
        if (tentativas >= maxTentativas) {
          response = { erroGrave: true };
        }
      }
    }

    if (!response || response.erroGrave) {
      log(`Lote interrompido por instabilidade da API do Portal Nacional.`, 'warn');
      break;
    }
    if (response.status === 404) {
      log(`Caixa postal fiscal atualizada no Portal Nacional.`);
      break;
    }

    const batch = response.data || {};
    const lote = batch.LoteDFe || [];
    if (batch.StatusProcessamento === 'NENHUM_DOCUMENTO_LOCALIZADO' || lote.length === 0) {
      log(`Todos os documentos do Portal Nacional já foram baixados. Sistema em dia.`);
      break;
    }

    let highestNSU = cursorNSU;
    let salvosNoLote = 0;

    for (const doc of lote) {
      const nsuNum = typeof doc.NSU === 'number' ? doc.NSU : parseInt(doc.NSU, 10);
      if (!isNaN(nsuNum) && nsuNum > highestNSU) highestNSU = nsuNum;

      if (!doc.ArquivoXml) continue;

      const xmlContent = decodeGzipBase64(doc.ArquivoXml);
      const meta = parseMeta(xmlContent) || { competenciaMes: '', dataEmissaoISO: '', numero: '' };

      if (doc.TipoDocumento === 'EVENTO') {
        const descLower = (meta.eventoDesc || '').toLowerCase();
        const isEventoCancelamento = descLower.includes('cancelamento') || descLower.includes('cancelada') || meta.isCancelada;

        if (isEventoCancelamento) {
          const vinculou = await marcarComoCancelada(companyOutputDir, meta.chaveReferenciada, xmlContent, meta);
          salvosNoLote++;
          if (!vinculou) {
            const subPastas = folderFor('Eventos', meta, companyOutputDir);
            const pastaFinal = path.join(companyOutputDir, subPastas);
            if (!fs.existsSync(pastaFinal)) fs.mkdirSync(pastaFinal, { recursive: true });
            const nomeArquivo = fileNameFor(meta, doc.TipoDocumento, doc.NSU, doc.ChaveAcesso, 'Eventos');
            fs.writeFileSync(path.join(pastaFinal, nomeArquivo), xmlContent, 'utf-8');
          }
        } else {
          const subPastas = folderFor('Eventos', meta, companyOutputDir);
          const pastaFinal = path.join(companyOutputDir, subPastas);
          if (!fs.existsSync(pastaFinal)) fs.mkdirSync(pastaFinal, { recursive: true });
          const nomeArquivo = fileNameFor(meta, doc.TipoDocumento, doc.NSU, doc.ChaveAcesso, 'Eventos');
          fs.writeFileSync(path.join(pastaFinal, nomeArquivo), xmlContent, 'utf-8');
          salvosNoLote++;
        }
      } else {
        // Validação estrita de vínculo de CNPJ (evita salvar notas de outra empresa se o certificado for de matriz/procurador)
        const cleanPrest = (meta.prestadorCnpj || '').replace(/\D/g, '');
        const cleanToma = (meta.tomadorCnpj || '').replace(/\D/g, '');
        const ownerRoot = cleanCnpj.slice(0, 8);
        if (cleanCnpj.length >= 8 && (cleanPrest || cleanToma)) {
          const matchPrest = cleanPrest && (cleanPrest === cleanCnpj || cleanPrest.slice(0, 8) === ownerRoot);
          const matchToma = cleanToma && (cleanToma === cleanCnpj || cleanToma.slice(0, 8) === ownerRoot);
          if (!matchPrest && !matchToma && !xmlContent.includes(cleanCnpj)) {
            continue;
          }
        }

        // Verifica duplicidade: mesmo número + mesmo CNPJ prestador + mesmo CNPJ tomador + mesmo valor
        const dedupKey = gerarChaveDedupNfse(meta.numero, cleanPrest, cleanToma || cleanCnpj, meta.valorServicos);
        const existingNota = dedupKey ? existingIndex.get(dedupKey) : null;

        if (existingNota && fs.existsSync(existingNota.caminhoXml)) {
          // O Portal Nacional TEM PRIORIDADE sobre o Portal SP por ter informações fiscais mais detalhadas
          if (existingNota.origemCaptacao === 'PORTAL_SP') {
            // Substitui a versão do Portal SP pela versão oficial do Portal Nacional
            try { if (fs.existsSync(existingNota.caminhoXml)) fs.unlinkSync(existingNota.caminhoXml); } catch (_) {}
            try { if (fs.existsSync(existingNota.caminhoPdf)) fs.unlinkSync(existingNota.caminhoPdf); } catch (_) {}
          } else if (existingNota.isCancelada || !meta.isCancelada) {
            totalDuplicadasIgnoradas++;
            continue;
          }
        }

        const tipo = classifyTipo(doc.TipoDocumento, meta, cleanCnpj);
        const subPastas = folderFor(tipo, meta, companyOutputDir);
        const nomeArquivo = fileNameFor(meta, doc.TipoDocumento, doc.NSU, doc.ChaveAcesso, tipo);
        const pastaFinal = path.join(companyOutputDir, subPastas);

        if (!fs.existsSync(pastaFinal)) fs.mkdirSync(pastaFinal, { recursive: true });

        const caminhoXmlSalvo = path.join(pastaFinal, nomeArquivo);
        const caminhoPdfSalvo = path.join(pastaFinal, nomeArquivo.replace(/\.xml$/i, '.pdf'));
        fs.writeFileSync(caminhoXmlSalvo, xmlContent, 'utf-8');
        salvosNoLote++;

        if (dedupKey) {
          existingIndex.set(dedupKey, {
            caminhoXml: caminhoXmlSalvo,
            caminhoPdf: caminhoPdfSalvo,
            origemCaptacao: 'PORTAL_NACIONAL',
            isCancelada: meta.isCancelada
          });
        }

        const chaveLimpa = (doc.ChaveAcesso || '').replace(/\D/g, '');
        if (chaveLimpa) {
          await verificarEUnificarEventosPendentes(companyOutputDir, chaveLimpa, pastaFinal, nomeArquivo);
        }

        // Gera o PDF DANFSe oficial em background
        try {
          const pdfBytes = await DANFSe.gerarDanfse(xmlContent, {
            PDFLib,
            qrcode,
            logoBytes,
            destacarRet: true,
            marcaDagua: meta.isCancelada ? 'CANCELADA' : ''
          });
          fs.writeFileSync(caminhoPdfSalvo, Buffer.from(pdfBytes));
        } catch (pdfError) {
          console.warn(`[PDF DANFSe] Erro ao gerar espelho do doc NSU ${doc.NSU}: ${pdfError.message}`);
        }
      }
    }

    totalDocsBaixados += salvosNoLote;
    cursorNSU = highestNSU;
    log(`Lote processado (+${salvosNoLote} docs). Próximo NSU: ${cursorNSU}`);
  }

  log(`Captação no Portal Nacional finalizada! Total de novos documentos: ${totalDocsBaixados}${totalDuplicadasIgnoradas > 0 ? ` (${totalDuplicadasIgnoradas} duplicadas ignoradas)` : ''}`);
  return {
    sucesso: true,
    totalDocsBaixados,
    totalDuplicadasIgnoradas,
    novoNsu: cursorNSU
  };
}

module.exports = {
  rodarCaptacaoNfseEmpresa,
  parseMeta,
  classifyTipo
};
