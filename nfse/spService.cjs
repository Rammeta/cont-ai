// =========================================================================
// CONT.AI - Captador de Notas Fiscais - MÓDULO PREFEITURA DE SÃO PAULO (PMSP)
// Web Service Oficial de NFS-e da Prefeitura de São Paulo
// =========================================================================

const https = require('https');
const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const crypto = require('crypto');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const DANFSe = require('./danfse.cjs');
const { gerarDanfseSpPdf } = require('./danfseSP.cjs');
const { converterSpParaXmlNacional } = require('./xmlNacionalConverter.cjs');
const { gerarChaveDedupNfse, indexarNotasExistentes } = require('./reportsNfse.cjs');
const PDFLib = require('pdf-lib');
const qrcode = require('qrcode-generator');
const { obterDiretorioDadosUsuario } = require('./cryptoUtils.cjs');

const BASE_DIR = obterDiretorioDadosUsuario();

let fontkit = null;
const FONTKIT_PATH = fs.existsSync(path.join(__dirname, 'fontkit.umd.min.js')) 
  ? path.join(__dirname, 'fontkit.umd.min.js') 
  : path.join(BASE_DIR, 'fontkit.umd.min.js');
if (fs.existsSync(FONTKIT_PATH)) {
  try { fontkit = require(FONTKIT_PATH); } catch (_) {}
}

let arimo = null;
let arimoBold = null;
const ARIMO_REG_PATH = fs.existsSync(path.join(__dirname, 'fonts', 'Arimo_400Regular.ttf')) 
  ? path.join(__dirname, 'fonts', 'Arimo_400Regular.ttf') 
  : path.join(BASE_DIR, 'fonts', 'Arimo_400Regular.ttf');
const ARIMO_BOLD_PATH = fs.existsSync(path.join(__dirname, 'fonts', 'Arimo_700Bold.ttf')) 
  ? path.join(__dirname, 'fonts', 'Arimo_700Bold.ttf') 
  : path.join(BASE_DIR, 'fonts', 'Arimo_700Bold.ttf');

if (fs.existsSync(ARIMO_REG_PATH)) arimo = new Uint8Array(fs.readFileSync(ARIMO_REG_PATH));
if (fs.existsSync(ARIMO_BOLD_PATH)) arimoBold = new Uint8Array(fs.readFileSync(ARIMO_BOLD_PATH));

let logoSpBytes = null;
const BRASAO_SP_PATH = fs.existsSync(path.join(__dirname, '../assets/brasao_sp.jpg'))
  ? path.join(__dirname, '../assets/brasao_sp.jpg')
  : (fs.existsSync(path.join(__dirname, 'brasao_sp.jpg')) ? path.join(__dirname, 'brasao_sp.jpg') : path.join(BASE_DIR, 'brasao_sp.jpg'));
if (fs.existsSync(BRASAO_SP_PATH)) {
  logoSpBytes = fs.readFileSync(BRASAO_SP_PATH);
}

// Extrai chave privada e certificado folha (leaf) + cadeia de certificados intermediários do PFX
function parsePfxKeys(pfxBuffer, passphrase) {
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, passphrase);
  let keyBag = null;
  const certs = [];

  for (const safeContent of p12.safeContents) {
    for (const safeBag of safeContent.safeBags) {
      if (safeBag.key) keyBag = safeBag;
      if (safeBag.cert) certs.push(safeBag.cert);
    }
  }

  let leafCert = certs[0];
  const allCertsPem = [];
  if (keyBag) {
    const keyN = keyBag.key.n.toString(16);
    for (const c of certs) {
      if (c.publicKey && c.publicKey.n && c.publicKey.n.toString(16) === keyN) {
        leafCert = c;
      } else {
        allCertsPem.push(forge.pki.certificateToPem(c));
      }
    }
  }

  const privateKeyPem = forge.pki.privateKeyToPem(keyBag.key);
  const leafPem = forge.pki.certificateToPem(leafCert);
  // Concatena a cadeia completa de certificados para evitar que o servidor IIS trave resolvendo CA via AIA/LDAP
  const certPem = [leafPem, ...allCertsPem].join('\n');
  const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(leafCert)).getBytes();
  const certB64 = Buffer.from(certDer, 'binary').toString('base64');

  return { privateKeyPem, certPem, certB64 };
}

// Canonicalização C14N
function canonicalizeXml(xml) {
  return xml
    .replace(/>\s+</g, '><')
    .replace(/<([a-zA-Z0-9_:]+)([^>]*?)\/>/g, '<$1$2></$1>')
    .trim();
}

// Assinatura digital XMLDSIG RSA-SHA1 exigida pela PMSP
function assinarXml(xmlDoc, privateKeyPem, certB64) {
  const docC14n = canonicalizeXml(xmlDoc);
  const hashDoc = crypto.createHash('sha1').update(docC14n, 'utf8').digest('base64');

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI=""><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform><Transform Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${hashDoc}</DigestValue></Reference></SignedInfo>`;
  const signedInfoC14n = canonicalizeXml(signedInfo);

  const signer = crypto.createSign('RSA-SHA1');
  signer.update(signedInfoC14n, 'utf8');
  const signatureValue = signer.sign(privateKeyPem, 'base64');

  const signature = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfoC14n}<SignatureValue>${signatureValue}</SignatureValue><KeyInfo><X509Data><X509Certificate>${certB64}</X509Certificate></X509Data></KeyInfo></Signature>`;

  return docC14n.replace('</PedidoConsultaNFePeriodo>', signature + '</PedidoConsultaNFePeriodo>');
}

// POST SOAP HTTPS para o Web Service da Prefeitura de SP
function postSoapPMSP(soapEnvelope, certPem, privateKeyPem) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(soapEnvelope, 'utf8');

    const req = https.request({
      hostname: 'nfews.prefeitura.sp.gov.br',
      port: 443,
      path: '/lotenfe.asmx',
      method: 'POST',
      cert: certPem,
      key: privateKeyPem,
      agent: false,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://www.prefeitura.sp.gov.br/nfe/ws/consultaNFeRecebidas"',
        'Content-Length': bodyBuf.length
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout de comunicação com o Web Service da Prefeitura de SP (30s)'));
    });

    req.write(bodyBuf);
    req.end();
  });
}

function sanitize(nome) {
  return (nome || '').replace(/[\/\\:*?"<>|]/g, '_').replace(/[\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim().substring(0, 80).replace(/[. ]+$/, '') || 'sem-nome';
}

function sufixoEstab(empresa) {
  const cnpj = ((empresa && (empresa.cnpjConsulta || empresa.cnpj)) || '').replace(/\D/g, '');
  if (cnpj.length !== 14) return '';
  const estab = cnpj.slice(8, 12);
  return estab === '0001' ? '' : ' (' + estab + ')';
}

// Gera janelas de até 10 dias (decêndios) para acelerar a busca no banco particionado da PMSP
function gerarDecendios(ano, mes, limiteDataISO = null) {
  const anoNum = parseInt(ano, 10);
  const mesNum = parseInt(mes, 10);
  const mesStr = String(mesNum).padStart(2, '0');
  const ultimoDia = new Date(anoNum, mesNum, 0).getDate();
  const raw = [
    { dtInicio: `${anoNum}-${mesStr}-01`, dtFim: `${anoNum}-${mesStr}-10` },
    { dtInicio: `${anoNum}-${mesStr}-11`, dtFim: `${anoNum}-${mesStr}-20` },
    { dtInicio: `${anoNum}-${mesStr}-21`, dtFim: `${anoNum}-${mesStr}-${String(ultimoDia).padStart(2, '0')}` }
  ];

  if (!limiteDataISO) return raw;

  const filtrados = [];
  for (const p of raw) {
    if (p.dtInicio > limiteDataISO) continue;
    filtrados.push({
      dtInicio: p.dtInicio,
      dtFim: p.dtFim > limiteDataISO ? limiteDataISO : p.dtFim
    });
  }
  return filtrados;
}

// Consulta Notas Tomadas (Recebidas) de São Paulo para a empresa
async function consultarTomadasSP(empresa, pastaOutputRaiz, opcoes = {}) {
  const notify = (msg, type = 'info', docsCount = 0) => {
    if (typeof opcoes.onProgress === 'function') {
      opcoes.onProgress({
        message: msg,
        type,
        docsCount,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    }
  };

  const cleanCnpj = (empresa.cnpj || '').replace(/\D/g, '');
  if (!cleanCnpj) throw new Error('CNPJ inválido ou não informado.');

  let certPathSp = empresa.caminhoPfx || empresa.certPath;
  if (!certPathSp || !fs.existsSync(certPathSp)) {
    const fallbackCert = path.join(process.env.APPDATA || '', 'contai-robo', 'certificados', `${cleanCnpj}.pfx`);
    if (fs.existsSync(fallbackCert)) {
      certPathSp = fallbackCert;
    } else {
      throw new Error(`Certificado digital PFX não encontrado no caminho: ${empresa.caminhoPfx}`);
    }
  }

  const pfxBuf = fs.readFileSync(certPathSp);
  const passphrase = empresa.senhaPfx || '';
  const { privateKeyPem, certPem, certB64 } = parsePfxKeys(pfxBuf, passphrase);

  const pastaEmpresaCompleta = pastaOutputRaiz;
  if (!fs.existsSync(pastaEmpresaCompleta)) {
    fs.mkdirSync(pastaEmpresaCompleta, { recursive: true });
  }

  const hoje = new Date();
  const hojeISO = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;

  // Define os períodos a serem consultados em janelas fracionadas (decêndios)
  let periodos = [];
  if (opcoes.dtInicio && opcoes.dtFim) {
    periodos.push({ dtInicio: opcoes.dtInicio, dtFim: opcoes.dtFim });
  } else if (opcoes.ano && opcoes.mes && opcoes.mes !== 'todos') {
    periodos.push(...gerarDecendios(opcoes.ano, opcoes.mes, hojeISO));
  } else if (opcoes.ultimaDataSp) {
    // Busca incremental inteligente: consulta o mês anterior e o mês atual até hoje
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    if (mesAtual === 1) {
      periodos.push(...gerarDecendios(anoAtual - 1, 12, hojeISO));
    } else {
      periodos.push(...gerarDecendios(anoAtual, mesAtual - 1, hojeISO));
    }
    periodos.push(...gerarDecendios(anoAtual, mesAtual, hojeISO));
  } else {
    const anoAtual = (opcoes.ano && !isNaN(parseInt(opcoes.ano, 10))) ? parseInt(opcoes.ano, 10) : hoje.getFullYear();
    const mesMax = (anoAtual === hoje.getFullYear()) ? hoje.getMonth() + 1 : 12;

    for (let m = 1; m <= mesMax; m++) {
      periodos.push(...gerarDecendios(anoAtual, m, hojeISO));
    }
  }

  const existingIndex = indexarNotasExistentes(pastaEmpresaCompleta, cleanCnpj);

  let totalBaixadas = 0;
  let totalCanceladas = 0;
  let jaExistentes = 0;
  const logs = [];

  notify(`[Prefeitura SP] Iniciando consulta de Serviços Tomados na PMSP (${periodos.length} janela(s))...`);

  for (const periodo of periodos) {
    let pagina = 1;
    let temMaisPaginas = true;

    try {
      while (temMaisPaginas && pagina <= 50) {
        const xmlPedido = `<PedidoConsultaNFePeriodo xmlns="http://www.prefeitura.sp.gov.br/nfe"><Cabecalho xmlns="" Versao="1"><CPFCNPJRemetente><CNPJ>${cleanCnpj}</CNPJ></CPFCNPJRemetente><CPFCNPJ><CNPJ>${cleanCnpj}</CNPJ></CPFCNPJ><dtInicio>${periodo.dtInicio}</dtInicio><dtFim>${periodo.dtFim}</dtFim><NumeroPagina>${pagina}</NumeroPagina></Cabecalho></PedidoConsultaNFePeriodo>`;
        const xmlAssinado = assinarXml(xmlPedido, privateKeyPem, certB64);

        const soapBody = `<ConsultaNFeRecebidasRequest xmlns="http://www.prefeitura.sp.gov.br/nfe"><VersaoSchema>1</VersaoSchema><MensagemXML>${xmlAssinado.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</MensagemXML></ConsultaNFeRecebidasRequest>`;
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body>${soapBody}</soap:Body></soap:Envelope>`;

        notify(`[Prefeitura SP] Consultando período ${periodo.dtInicio} a ${periodo.dtFim} (Pág. ${pagina})...`);

        const res = await postSoapPMSP(soapEnvelope, certPem, privateKeyPem);
        if (res.status !== 200) {
          console.warn(`   [SP WS Aviso] HTTP ${res.status} no período ${periodo.dtInicio} a ${periodo.dtFim}`);
          logs.push(`Período ${periodo.dtInicio}: HTTP ${res.status}`);
          break;
        }

        // Extrai RetornoXML
        const docSoap = new DOMParser().parseFromString(res.data, 'text/xml');
        const retornoXmlNodes = docSoap.getElementsByTagName('RetornoXML');
        if (retornoXmlNodes.length === 0) {
          break;
        }

        const retornoXmlRaw = retornoXmlNodes[0].textContent;
        const docRetorno = new DOMParser().parseFromString(retornoXmlRaw, 'text/xml');

        const sucessoNode = docRetorno.getElementsByTagName('Sucesso')[0];
        const sucesso = sucessoNode ? (sucessoNode.textContent.trim().toLowerCase() === 'true') : false;

        if (!sucesso) {
          const erroNode = docRetorno.getElementsByTagName('Erro')[0];
          if (erroNode) {
            const cod = erroNode.getElementsByTagName('Codigo')[0]?.textContent || '';
            const desc = erroNode.getElementsByTagName('Descricao')[0]?.textContent || '';
            console.warn(`   [SP WS Aviso] ${cod}: ${desc}`);
            logs.push(`Período ${periodo.dtInicio}: ${cod} - ${desc}`);
          }
          break;
        }

        // Extrai todas as tags <NFe>
        const nfeNodes = docRetorno.getElementsByTagName('NFe');
        if (nfeNodes.length === 0) {
          temMaisPaginas = false;
          break;
        }

        const serializer = new XMLSerializer();
        let novasNoLote = 0;

        for (let i = 0; i < nfeNodes.length; i++) {
          const nfeNode = nfeNodes[i];
          const nfeXmlString = serializer.serializeToString(nfeNode);

          const t = (name) => {
            const els = nfeNode.getElementsByTagName(name);
            return els.length > 0 ? els[0].textContent.trim() : '';
          };
          const tChild = (parentTag, childTag) => {
            const pEls = nfeNode.getElementsByTagName(parentTag);
            if (pEls.length === 0) return '';
            const cEls = pEls[0].getElementsByTagName(childTag);
            return cEls.length > 0 ? cEls[0].textContent.trim() : '';
          };

          const numeroNFe = t('NumeroNFe') || 'S_N';
          const prestadorNome = t('RazaoSocialPrestador') || 'FORNECEDOR';
          const prestCnpj = (tChild('CPFCNPJPrestador', 'CNPJ') || tChild('CPFCNPJPrestador', 'CPF') || '').replace(/\D/g, '');
          const tomaCnpj = (tChild('CPFCNPJTomador', 'CNPJ') || tChild('CPFCNPJTomador', 'CPF') || cleanCnpj).replace(/\D/g, '');

          // Validação de vínculo com a empresa consultada
          if (cleanCnpj.length >= 8 && tomaCnpj && prestCnpj) {
            const ownerRoot = cleanCnpj.slice(0, 8);
            const matchToma = tomaCnpj === cleanCnpj || tomaCnpj.slice(0, 8) === ownerRoot;
            const matchPrest = prestCnpj === cleanCnpj || prestCnpj.slice(0, 8) === ownerRoot;
            if (!matchToma && !matchPrest) {
              continue;
            }
          }

          const dataEmissaoRaw = t('DataEmissaoNFe') || t('DataFatoGeradorNFe') || periodo.dtInicio;
          const statusNFe = t('StatusNFe');
          const isCancelada = (statusNFe === 'C' || t('DataCancelamento') !== '');

          let ano = periodo.dtInicio.slice(0, 4);
          let mes = periodo.dtInicio.slice(5, 7);
          if (dataEmissaoRaw && dataEmissaoRaw.length >= 7) {
            ano = dataEmissaoRaw.slice(0, 4);
            mes = dataEmissaoRaw.slice(5, 7);
          }

          const MONTH_NAMES = {
            '01': '01 - Janeiro', '02': '02 - Fevereiro', '03': '03 - Março',
            '04': '04 - Abril',   '05': '05 - Maio',      '06': '06 - Junho',
            '07': '07 - Julho',   '08': '08 - Agosto',    '09': '09 - Setembro',
            '10': '10 - Outubro', '11': '11 - Novembro',  '12': '12 - Dezembro'
          };
          const defaultMonthFolder = MONTH_NAMES[mes] || mes;
          let resolvedMonthFolder = defaultMonthFolder;
          if (fs.existsSync(path.join(pastaEmpresaCompleta, ano))) {
            try {
              const entries = fs.readdirSync(path.join(pastaEmpresaCompleta, ano), { withFileTypes: true });
              const found = entries.find(e => e.isDirectory() && (
                e.name === mes || e.name.startsWith(`${mes} -`) || e.name.startsWith(`${mes}-`) ||
                (MONTH_NAMES[mes] && e.name.toLowerCase() === MONTH_NAMES[mes].toLowerCase())
              ));
              if (found) resolvedMonthFolder = found.name;
            } catch (_) {}
          }

          const subFolder = isCancelada ? 'SERVIÇOS TOMADOS - SÃO PAULO - CANCELADAS' : 'SERVIÇOS TOMADOS - SÃO PAULO';
          const pastaFinal = path.join(pastaEmpresaCompleta, ano, resolvedMonthFolder, 'NFSE', subFolder);
          if (!fs.existsSync(pastaFinal)) fs.mkdirSync(pastaFinal, { recursive: true });

          const parseNumSp = (val) => parseFloat((val || '0').replace(',', '.')) || 0;
          const vBrutoSp = parseNumSp(t('ValorServicos'));
          const vPisSp = parseNumSp(t('ValorPIS'));
          const vCofinsSp = parseNumSp(t('ValorCOFINS'));
          const vInssSp = parseNumSp(t('ValorINSS'));
          const vIrSp = parseNumSp(t('ValorIR'));
          const vCsllSp = parseNumSp(t('ValorCSLL'));
          const issRetidoBool = (t('ISSRetido') || '').toLowerCase() === 'true' || t('ISSRetido') === '1' || (t('ISSRetido') || '').toLowerCase() === 's';
          const vIssRetSp = issRetidoBool ? parseNumSp(t('ValorISS')) : 0;

          const discText = (t('Discriminacao') || '').toLowerCase();
          const declaraSemRetencao = /n[ãa]o\s+(est[ãa]o\s+)?sujeit[oa]s?\s+[àa]\s+reten[çc][ãa]o|sem\s+reten[çc][ãa]o|dispensad[oa]\s+de\s+reten[çc][ãa]o|n[ãa]o\s+h[áa]\s+reten[çc][ãa]o/i.test(discText);
          const vLiqExplicit = parseNumSp(t('ValorLiquido') || t('ValorLiquidoNfe') || t('ValorTotalRecebido'));

          let isPisCofRetido = false;
          let isIrRetido = false;
          let isInssRetido = false;

          if (!declaraSemRetencao) {
            if (vLiqExplicit > 0 && (vBrutoSp - vLiqExplicit) >= 0.01) {
              const dif = Math.round((vBrutoSp - parseNumSp(t('ValorDeducoes')) - (issRetidoBool ? vIssRetSp : 0) - vLiqExplicit) * 100) / 100;
              if (dif > 0) {
                if (vIrSp > 0 && Math.abs(dif - vIrSp) < 0.02) {
                  isIrRetido = true;
                } else if ((vPisSp + vCofinsSp + vCsllSp) > 0 && Math.abs(dif - (vPisSp + vCofinsSp + vCsllSp)) < 0.02) {
                  isPisCofRetido = true;
                } else if ((vPisSp + vCofinsSp + vCsllSp + vIrSp + vInssSp) > 0 && Math.abs(dif - (vPisSp + vCofinsSp + vCsllSp + vIrSp + vInssSp)) < 0.05) {
                  isPisCofRetido = (vPisSp + vCofinsSp + vCsllSp) > 0;
                  isIrRetido = vIrSp > 0;
                  isInssRetido = vInssSp > 0;
                }
              }
            }

            const mLiqDisc = discText.match(/valor\s+l[íi]quido\s*(?:r\$|:)?\s*([\d\.,]+)/i);
            const vLiqDiscNum = mLiqDisc ? parseFloat(mLiqDisc[1].replace(/\./g, '').replace(',', '.')) : 0;
            if (vLiqDiscNum > 0 && (vBrutoSp - vLiqDiscNum) >= 0.01) {
              const difDisc = Math.round((vBrutoSp - parseNumSp(t('ValorDeducoes')) - (issRetidoBool ? vIssRetSp : 0) - vLiqDiscNum) * 100) / 100;
              if (difDisc > 0 && Math.abs(difDisc - (vPisSp + vCofinsSp + vCsllSp + vIrSp + vInssSp)) < 0.05) {
                isPisCofRetido = (vPisSp + vCofinsSp + vCsllSp) > 0;
                isIrRetido = vIrSp > 0;
                isInssRetido = vInssSp > 0;
              }
            } else if (t('OpcaoSimples') !== '1' && t('OpcaoSimples') !== 'true') {
              if (/irrf\s+ret|ir\s+ret/i.test(discText) && vIrSp > 0) isIrRetido = true;
              if (/pis\s+ret|cofins\s+ret|csrf|csl\s+ret/i.test(discText) && (vPisSp + vCofinsSp + vCsllSp) > 0) isPisCofRetido = true;
              if (/inss\s+ret/i.test(discText) && vInssSp > 0) isInssRetido = true;
            }
          }

          const retFedReais = (isIrRetido ? vIrSp : 0) + (isInssRetido ? vInssSp : 0) + (isPisCofRetido ? (vPisSp + vCofinsSp + vCsllSp) : 0);
          const retTotalReais = vIssRetSp + retFedReais;

          const vLiqSp = vLiqExplicit > 0
            ? vLiqExplicit
            : Math.max(0, vBrutoSp - parseNumSp(t('ValorDeducoes')) - retTotalReais);

          // Só há retenção se houver imposto comprovadamente retido
          const temRetencao = Boolean(vBrutoSp > 0 && (retTotalReais >= 0.01 || (vLiqExplicit > 0 && (vBrutoSp - vLiqExplicit) >= 0.01)));

          // Verifica duplicidade global na pasta da empresa (mesmo número + mesmo prestador + mesmo tomador + mesmo valor)
          const existingNota = dedupKey ? existingIndex.get(dedupKey) : null;

          if (existingNota && fs.existsSync(existingNota.caminhoXml)) {
            // Se a nota já foi captada pelo Portal Nacional (onde as informações vêm melhor discriminadas), mantém a versão do Portal Nacional
            if (existingNota.origemCaptacao === 'PORTAL_NACIONAL' && (existingNota.isCancelada === isCancelada || existingNota.isCancelada)) {
              jaExistentes++;
              continue;
            }
            const jaNaPastaSp = existingNota.caminhoXml.toUpperCase().includes('SÃO PAULO') || existingNota.caminhoXml.toUpperCase().includes('SAO PAULO');
            if (
              existingNota.origemCaptacao === 'PORTAL_SP' &&
              jaNaPastaSp &&
              (existingNota.isCancelada === isCancelada || existingNota.isCancelada) &&
              fs.existsSync(existingNota.caminhoPdf)
            ) {
              jaExistentes++;
              continue;
            }
            // Se mudou para cancelada ou estava na pasta legada, substitui
            if (isCancelada && !existingNota.isCancelada) {
              try { if (fs.existsSync(existingNota.caminhoXml)) fs.unlinkSync(existingNota.caminhoXml); } catch (_) {}
              try { if (fs.existsSync(existingNota.caminhoPdf)) fs.unlinkSync(existingNota.caminhoPdf); } catch (_) {}
            }
          }

          const nomeSanitizado = sanitize(prestadorNome);
          let baseAtiva = `NF ${numeroNFe} - ${nomeSanitizado}`;
          if (temRetencao) baseAtiva += ' - COM RETENÇÃO';

          let baseFileName = baseAtiva;
          if (isCancelada) baseFileName += ' - CANCELADA';

          // Limpa versão com status oposto de retenção se existir na pasta
          const opostoAtivo = temRetencao
            ? `NF ${numeroNFe} - ${nomeSanitizado}`
            : `NF ${numeroNFe} - ${nomeSanitizado} - COM RETENÇÃO`;
          const opostoFileName = isCancelada ? `${opostoAtivo} - CANCELADA` : opostoAtivo;
          const xmlOposto = path.join(pastaFinal, `${opostoFileName}.xml`);
          const pdfOposto = path.join(pastaFinal, `${opostoFileName}.pdf`);
          if (fs.existsSync(xmlOposto)) try { fs.unlinkSync(xmlOposto); } catch (_) {}
          if (fs.existsSync(pdfOposto)) try { fs.unlinkSync(pdfOposto); } catch (_) {}

          // Se a nota foi cancelada posteriormente, remove eventual versão ativa da pasta SERVIÇOS TOMADOS - SÃO PAULO (e legada SERVIÇOS TOMADOS)
          if (isCancelada) {
            for (const folderAtiva of ['SERVIÇOS TOMADOS - SÃO PAULO', 'SERVIÇOS TOMADOS']) {
              const pastaAtiva = path.join(pastaEmpresaCompleta, ano, resolvedMonthFolder, 'NFSE', folderAtiva);
              const xmlAtivo = path.join(pastaAtiva, `${baseAtiva}.xml`);
              const pdfAtivo = path.join(pastaAtiva, `${baseAtiva}.pdf`);
              if (fs.existsSync(xmlAtivo)) {
                try { fs.unlinkSync(xmlAtivo); } catch (_) {}
              }
              if (fs.existsSync(pdfAtivo)) {
                try { fs.unlinkSync(pdfAtivo); } catch (_) {}
              }
            }
          }

          const xmlPath = path.join(pastaFinal, `${baseFileName}.xml`);
          const pdfPath = path.join(pastaFinal, `${baseFileName}.pdf`);

          if (fs.existsSync(xmlPath) && fs.existsSync(pdfPath)) {
            jaExistentes++;
            if (dedupKey) {
              existingIndex.set(dedupKey, {
                caminhoXml: xmlPath,
                caminhoPdf: pdfPath,
                origemCaptacao: 'PORTAL_SP',
                isCancelada
              });
            }
            continue;
          }

          // Converte o XML de SP para o Padrão Nacional (Portal Nacional NFS-e v1.01) com marcador PORTAL_SP
          const xmlNacionalString = converterSpParaXmlNacional(nfeXmlString);

          // Grava o XML da nota no Padrão Nacional
          fs.writeFileSync(xmlPath, xmlNacionalString, 'utf-8');
          totalBaixadas++;
          novasNoLote++;
          if (isCancelada) totalCanceladas++;

          // Gera o PDF DANFSe no Padrão Oficial da Prefeitura de São Paulo
          try {
            const pdfBytes = await gerarDanfseSpPdf(nfeXmlString, {
              PDFLib,
              fontkit,
              arimo,
              arimoBold,
              logoSpBytes
            });
            fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
          } catch (errPdf) {
            console.warn(`   [DANFSe SP] Aviso ao gerar PDF da NF ${numeroNFe}: ${errPdf.message}`);
          }

          if (dedupKey) {
            existingIndex.set(dedupKey, {
              caminhoXml: xmlPath,
              caminhoPdf: pdfPath,
              origemCaptacao: 'PORTAL_SP',
              isCancelada
            });
          }
        }

        if (novasNoLote > 0) {
          notify(`[Prefeitura SP] +${novasNoLote} nova(s) nota(s) tomada(s) salva(s) no período ${periodo.dtInicio}.`, 'info', novasNoLote);
        }

        if (nfeNodes.length < 50) {
          temMaisPaginas = false;
        } else {
          pagina++;
        }
      }
    } catch (errPeriodo) {
      console.warn(`   [SP WS Aviso] Período ${periodo.dtInicio} a ${periodo.dtFim}: ${errPeriodo.message}`);
      logs.push(`Período ${periodo.dtInicio}: ${errPeriodo.message}`);
    }
  }

  notify(`[Prefeitura SP] Consulta finalizada! Novas baixadas: ${totalBaixadas} | Já existentes: ${jaExistentes}.`);

  return {
    sucesso: true,
    totalBaixadas,
    totalCanceladas,
    jaExistentes,
    ultimaDataSp: hojeISO,
    logs
  };
}

async function gerarPdfPadraoSp(xmlContent) {
  return gerarDanfseSpPdf(xmlContent, {
    PDFLib,
    fontkit,
    arimo,
    arimoBold,
    logoSpBytes
  });
}

module.exports = {
  consultarTomadasSP,
  gerarPdfPadraoSp
};
