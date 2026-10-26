const { sanitizeWinAnsi } = require('./danfse.cjs');
// =========================================================================
// CONT.AI - Gerador de DANFSe no Padrão Oficial da Prefeitura de São Paulo (PMSP)
// Reproduz fielmente o layout oficial da NFS-e Paulistana (com Brasão,
// Código de Verificação no canto superior direito, tabelas de retenções e ISS).
// =========================================================================

const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');

// Mapeamento de Códigos IBGE frequentes
const IBGE_CIDADES = {
  '3550308': 'São Paulo',
  '3518404': 'Guaratinguetá',
  '3509502': 'Campinas',
  '3554102': 'Taubaté',
  '3549904': 'São José dos Campos',
  '3548500': 'Santos',
  '3543402': 'Ribeirão Preto',
  '3552205': 'Sorocaba',
  '3534401': 'Osasco',
  '3548708': 'São Bernardo do Campo',
  '3547809': 'Santo André',
  '3518800': 'Guarulhos',
  '3505708': 'Barueri',
  '3513009': 'Cotia',
  '3522505': 'Itapevi',
  '3550704': 'São Sebastião',
  '3555406': 'Ubatuba',
  '3520509': 'Indaiatuba',
  '3525904': 'Jundiaí',
  '3540606': 'Piracicaba',
  '3501608': 'Americana',
  '3503208': 'Araraquara',
  '3506003': 'Bauru',
  '3516200': 'Franca',
  '3526902': 'Limeira',
  '3529005': 'Marília',
  '3541406': 'Presidente Prudente',
  '3548906': 'São Carlos',
  '3549805': 'São José do Rio Preto',
  '3304557': 'Rio de Janeiro',
  '3106200': 'Belo Horizonte',
  '4106902': 'Curitiba',
  '4314902': 'Porto Alegre',
  '5300108': 'Brasília'
};

// Códigos de serviços mais frequentes da Prefeitura de SP
// Códigos de serviços da Prefeitura de SP com mapeamento nacional (LC 116)
const SERVICOS_SP_DETALHES = {
  // 01 - Serviços de informática e congêneres
  '01015': { mun: 'Análise e desenvolvimento de sistemas.', cTribNac: '010101', nac: 'Análise e desenvolvimento de sistemas.' },
  '01023': { mun: 'Programação.', cTribNac: '010201', nac: 'Programação.' },
  '01031': { mun: 'Processamento de dados e congêneres.', cTribNac: '010301', nac: 'Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres.' },
  '01040': { mun: 'Elaboração de programas de computadores, inclusive de jogos eletrônicos.', cTribNac: '010401', nac: 'Elaboração de programas de computadores, inclusive de jogos eletrônicos.' },
  '01058': { mun: 'Licenciamento ou cessão de direito de uso de programas de computação.', cTribNac: '010501', nac: 'Licenciamento ou cessão de direito de uso de programas de computação.' },
  '01066': { mun: 'Assessoria e consultoria em informática.', cTribNac: '010601', nac: 'Assessoria e consultoria em informática.' },
  '01074': { mun: 'Suporte técnico em informática.', cTribNac: '010701', nac: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.' },
  '01082': { mun: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas.', cTribNac: '010801', nac: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas.' },
  '02496': { mun: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.', cTribNac: '010701', nac: 'Suporte técnico em informática, inclusive instalação, configuração e manutenção de programas de computação e bancos de dados.' },
  '02500': { mun: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas.', cTribNac: '010801', nac: 'Planejamento, confecção, manutenção e atualização de páginas eletrônicas.' },
  '02684': { mun: 'Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres.', cTribNac: '010301', nac: 'Processamento, armazenamento ou hospedagem de dados, textos, imagens, vídeos, páginas eletrônicas, aplicativos e sistemas de informação, entre outros formatos, e congêneres.' },
  '02800': { mun: 'Licenciamento ou cessão de direito de uso de programas de computação, inclusive distribuição.', cTribNac: '010501', nac: 'Licenciamento ou cessão de direito de uso de programas de computação.' },
  '02881': { mun: 'Assessoria e consultoria em informática.', cTribNac: '010601', nac: 'Assessoria e consultoria em informática.' },
  '02964': { mun: 'Disponibilização, sem cessão definitiva, de conteúdos de áudio, vídeo, imagem e texto por meio da internet.', cTribNac: '010901', nac: 'Disponibilização, sem cessão definitiva, de conteúdos de áudio, vídeo, imagem e texto por meio da internet, respeitada a imunidade de livros, jornais e periódicos.' },

  // 04 - Serviços de saúde, assistência médica e congêneres
  '06017': { mun: 'Medicina e biomedicina.', cTribNac: '040101', nac: 'Medicina e biomedicina.' },
  '06025': { mun: 'Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia e congêneres.', cTribNac: '040201', nac: 'Análises clínicas, patologia, eletricidade médica, radioterapia, quimioterapia e congêneres.' },
  '06041': { mun: 'Enfermagem, inclusive serviços de remoção de doentes.', cTribNac: '040601', nac: 'Enfermagem, inclusive serviços de remoção de doentes.' },

  // 07 - Serviços de engenharia, arquitetura, geologia, urbanismo, construção civil e congêneres
  '07013': { mun: 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo e congêneres.', cTribNac: '070101', nac: 'Engenharia, agronomia, agrimensura, arquitetura, geologia, urbanismo, paisagismo e congêneres.' },
  '07021': { mun: 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica.', cTribNac: '070201', nac: 'Execução, por administração, empreitada ou subempreitada, de obras de construção civil, hidráulica ou elétrica e de outras obras semelhantes.' },
  '07030': { mun: 'Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros.', cTribNac: '070301', nac: 'Elaboração de planos diretores, estudos de viabilidade, estudos organizacionais e outros, relacionados com obras e serviços de engenharia.' },
  '07048': { mun: 'Perícias, laudos, exames técnicos e análises técnicas.', cTribNac: '070401', nac: 'Perícias, laudos, exames técnicos e análises técnicas.' },
  '07102': { mun: 'Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres.', cTribNac: '071001', nac: 'Limpeza e dragagem de rios, portos, canais, baías, lagos, lagoas, represas, açudes e congêneres.' },

  // 08 - Serviços de educação, ensino, orientação pedagógica e educacional, instrução, treinamento
  '05762': { mun: 'Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza.', cTribNac: '080201', nac: 'Instrução, treinamento, orientação pedagógica e educacional, avaliação de conhecimentos de qualquer natureza.' },

  // 10 - Serviços de intermediação e congêneres
  '06009': { mun: 'Representação de qualquer natureza, inclusive comercial.', cTribNac: '100901', nac: 'Representação de qualquer natureza, inclusive comercial.' },
  '06298': { mun: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens, por quaisquer meios.', cTribNac: '100501', nac: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis, não abrangidos em outros itens ou subitens, por quaisquer meios.' },

  // 11 - Serviços de guarda, estacionamento, armazenamento, vigilância e congêneres
  '02097': { mun: 'Monitoramento e rastreamento a distância, em qualquer via ou local, de veículos, cargas, pessoas e semoventes, em vias públicas ou privadas.', cTribNac: '110201', nac: 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes.' },
  '07870': { mun: 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes.', cTribNac: '110201', nac: 'Vigilância, segurança ou monitoramento de bens, pessoas e semoventes.' },

  // 13 - Serviços relativos a fonografia, fotografia, cinematografia e reprografia
  '06940': { mun: 'Composição gráfica, inclusive confecção de impressos gráficos, fotocomposição, clicheria, zincografia, litografia e fotolitografia.', cTribNac: '130501', nac: 'Composição gráfica, inclusive confecção de impressos gráficos, fotocomposição, clicheria, zincografia, litografia e fotolitografia.' },

  // 15 - Serviços relacionados ao setor bancário ou financeiro, inclusive aqueles prestados por instituições financeiras
  '03205': { mun: 'Administração de cartões de crédito, débito, tíquetes e convênios congêneres.', cTribNac: '150101', nac: 'Administração de fundos quaisquer, de consórcio, de cartão de crédito ou débito e congêneres, de carteira de clientes, de cheques pré-datados e congêneres.' },

  // 17 - Serviços de apoio técnico, administrativo, jurídico, contábil, comercial e congêneres
  '02498': { mun: 'Inserção de textos, desenhos e outros materiais de propaganda e publicidade, em qualquer meio.', cTribNac: '170601', nac: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários.' },
  '03220': { mun: 'Advocacia.', cTribNac: '171401', nac: 'Advocacia.' },
  '03751': { mun: 'Apresentação de palestras, conferências, seminários e congêneres.', cTribNac: '171101', nac: 'Apresentação de palestras, conferências, seminários e congêneres.' },
  '17019': { mun: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista.', cTribNac: '170101', nac: 'Assessoria ou consultoria de qualquer natureza, não contida em outros itens desta lista.' },
  '17027': { mun: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e suporte administrativo, textos, cópias e congêneres.', cTribNac: '170201', nac: 'Datilografia, digitação, estenografia, expediente, secretaria em geral, resposta audível, redação, edição, interpretação, revisão, tradução, apoio e suporte administrativo, textos, cópias e congêneres.' },
  '17060': { mun: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários.', cTribNac: '170601', nac: 'Propaganda e publicidade, inclusive promoção de vendas, planejamento de campanhas ou sistemas de publicidade, elaboração de desenhos, textos e demais materiais publicitários.' }
};

// Mapeamento direto de código para descrição municipal (compatibilidade retroativa com código 4 e 5 dígitos)
const SERVICOS_SP = {};
for (const [cod5, val] of Object.entries(SERVICOS_SP_DETALHES)) {
  SERVICOS_SP[cod5] = val.mun;
  const cod4 = cod5.replace(/^0+/, '');
  if (cod4 && cod4 !== cod5) {
    SERVICOS_SP[cod4] = val.mun;
  }
}

function obterDetalhesServicoSP(cod) {
  if (!cod) {
    return {
      codigoMun: '00000',
      descricaoMun: 'Outros serviços municipais',
      cTribNac: '990101',
      descricaoNac: 'Outros Serviços'
    };
  }
  const clean = String(cod).trim();
  const digits = clean.replace(/\D/g, '');
  const pad5 = digits.length >= 4 ? digits.padStart(5, '0') : clean;
  
  if (SERVICOS_SP_DETALHES[pad5]) {
    const item = SERVICOS_SP_DETALHES[pad5];
    return {
      codigoMun: pad5,
      descricaoMun: item.mun,
      cTribNac: item.cTribNac,
      descricaoNac: item.nac
    };
  }

  const match4 = Object.keys(SERVICOS_SP_DETALHES).find(k => k.replace(/^0+/, '') === digits);
  if (match4) {
    const item = SERVICOS_SP_DETALHES[match4];
    return {
      codigoMun: match4,
      descricaoMun: item.mun,
      cTribNac: item.cTribNac,
      descricaoNac: item.nac
    };
  }

  return {
    codigoMun: pad5 || clean,
    descricaoMun: SERVICOS_SP[clean] || 'Serviços municipais tributados em São Paulo',
    cTribNac: digits.length === 6 ? digits : '990101',
    descricaoNac: 'Serviços tributados no Município'
  };
}

function obterPorCodigoNacional(cTribNac) {
  const clean = String(cTribNac || '').replace(/\D/g, '');
  if (!clean) return null;
  const entry = Object.entries(SERVICOS_SP_DETALHES).find(([_, v]) => v.cTribNac === clean);
  if (!entry) return null;
  return {
    codigoMun: entry[0],
    descricaoMun: entry[1].mun,
    cTribNac: entry[1].cTribNac,
    descricaoNac: entry[1].nac
  };
}

// Helpers de formatação
function fmtMoeda(val) {
  if (val == null || val === '') return '0,00';
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return '0,00';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDoc(val) {
  const d = (val || '').replace(/\D/g, '');
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  return val || '----';
}

function fmtInscricaoMunicipal(im) {
  if (!im) return '----';
  const d = im.replace(/\D/g, '');
  if (d.length === 8) return `${d.slice(0, 1)}.${d.slice(1, 4)}.${d.slice(4, 7)}-${d.slice(7)}`;
  if (d.length === 7) return `${d.slice(0, 3)}.${d.slice(3, 6)}-${d.slice(6)}`;
  return im;
}

function fmtCodigoVerificacao(cod) {
  if (!cod) return '----';
  const clean = cod.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (clean.length === 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4)}`;
  }
  return cod;
}

function fmtCep(val) {
  const d = (val || '').replace(/\D/g, '');
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, '$1-$2');
  return val || '----';
}

function fmtDataHora(val) {
  if (!val) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):?(\d{2})?/.exec(val);
  if (m) {
    const s = m[6] || '00';
    return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${s}`;
  }
  const m2 = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
  if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
  return val;
}

function fmtData(val) {
  if (!val) return '-';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(val);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return val;
}

function sanitizarDiscriminacao(texto) {
  if (!texto || typeof texto !== 'string') return '';
  const trimmed = texto.trim();
  if (!trimmed) return '';

  const parts = trimmed.split(/\r?\n\s*\r?\n/).map(p => p.trim()).filter(Boolean);
  if (parts.length >= 2 && parts.length % 2 === 0) {
    const half = parts.length / 2;
    const h1 = parts.slice(0, half).join('\n\n');
    const h2 = parts.slice(half).join('\n\n');
    if (h1.toLowerCase() === h2.toLowerCase()) {
      return h1;
    }
  }

  const len = trimmed.length;
  for (let split = Math.floor(len / 2) - 10; split <= Math.floor(len / 2) + 10; split++) {
    if (split > 15) {
      const s1 = trimmed.slice(0, split).trim();
      const s2 = trimmed.slice(split).trim();
      if (s1.toLowerCase() === s2.toLowerCase()) {
        return s1;
      }
    }
  }

  return trimmed;
}

function fmtAliq(val) {
  if (!val) return '0,00%';
  let n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return '0,00%';
  if (n < 1 && n > 0) n = n * 100;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

try { require('./ibge-municipios.cjs'); } catch (_) {}

function resolverCidade(codigoOuNome, def = '') {
  if (!codigoOuNome) return def;
  const clean = String(codigoOuNome).trim();
  const digits = clean.replace(/\D/g, '');
  const r = (typeof globalThis !== 'undefined' ? globalThis : {});
  const munMap = r.IBGE_MUNICIPIOS || {};
  if (digits && munMap[digits]) return munMap[digits];
  if (IBGE_CIDADES[digits || clean]) return IBGE_CIDADES[digits || clean];
  return clean;
}

function resolverUF(codigoOuNome, def = 'SP') {
  if (!codigoOuNome) return def;
  const clean = String(codigoOuNome).replace(/\D/g, '');
  if (clean.length >= 2) {
    const r = (typeof globalThis !== 'undefined' ? globalThis : {});
    const ufMap = r.IBGE_UF || {};
    const uf = ufMap[clean.slice(0, 2)];
    if (uf) return uf;
  }
  return def;
}

// Parser de XML da PMSP (suporta tanto XML original da PMSP quanto XML convertido para Padrão Nacional)
function parseXmlSP(xmlString) {
  const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
  const nfseRoot = doc.getElementsByTagName('NFSe')[0];

  // Caso seja o XML no Padrão Nacional (Portal Nacional NFS-e v1.01)
  if (nfseRoot) {
    const infNFSe = doc.getElementsByTagName('infNFSe')[0] || nfseRoot;
    const dps = doc.getElementsByTagName('DPS')[0] || infNFSe;
    const infDPS = doc.getElementsByTagName('infDPS')[0] || dps;

    const t = (name) => {
      const el = doc.getElementsByTagName(name)[0];
      return el ? (el.textContent || '').trim() : '';
    };

    const idAttr = infNFSe.getAttribute('Id') || '';
    const chaveNotaNacional = idAttr.replace(/^NFS/, '').replace(/\D/g, '') || t('ChaveNotaNacional');
    const numeroNFe = t('nNFSe') || t('nDFSe') || t('NumeroNFe');
    const numeroRPS = t('nDPS') || t('NumeroRPS') || numeroNFe;
    const serieRPS = t('serie') || t('SerieRPS') || 'SP000';
    const isCancelada = (t('StatusNFe') === 'C' || t('DataCancelamento') !== '' || (t('cStat') === '101' && !t('chSubstda')));

    let codVer = chaveNotaNacional ? chaveNotaNacional.slice(-8) : '';
    const infComp = t('xInfComp');
    const mVer = /C[oó]digo\s+de\s+Verifica[cç][aã]o:\s*([A-Za-z0-9]+)/i.exec(infComp);
    if (mVer) codVer = mVer[1];

    const emit = doc.getElementsByTagName('emit')[0] || doc;
    const prestCnpj = (emit.getElementsByTagName('CNPJ')[0]?.textContent.trim() || t('CNPJ') || '');
    const prestIm = (emit.getElementsByTagName('IM')[0]?.textContent.trim() || t('InscricaoPrestador') || '');
    const prestNome = (emit.getElementsByTagName('xNome')[0]?.textContent.trim() || t('RazaoSocialPrestador') || '');
    const enderNac = emit.getElementsByTagName('enderNac')[0];
    const prestLgr = enderNac ? [enderNac.getElementsByTagName('xLgr')[0]?.textContent.trim(), enderNac.getElementsByTagName('nro')[0]?.textContent.trim(), enderNac.getElementsByTagName('xCpl')[0]?.textContent.trim(), enderNac.getElementsByTagName('xBairro')[0]?.textContent.trim()].filter(Boolean).join(', ') : 'São Paulo';
    const prestCep = enderNac ? enderNac.getElementsByTagName('CEP')[0]?.textContent.trim() : '';
    const prestEndCompleto = prestCep ? `${prestLgr} - CEP: ${fmtCep(prestCep)}` : prestLgr;

    const toma = doc.getElementsByTagName('toma')[0] || doc;
    const tomaCnpj = (toma.getElementsByTagName('CNPJ')[0]?.textContent.trim() || toma.getElementsByTagName('CPF')[0]?.textContent.trim() || '');
    const tomaIm = (toma.getElementsByTagName('IM')[0]?.textContent.trim() || '');
    const tomaNome = (toma.getElementsByTagName('xNome')[0]?.textContent.trim() || '');
    const tomaEnd = toma.getElementsByTagName('end')[0];
    const tomaEndNac = tomaEnd ? tomaEnd.getElementsByTagName('endNac')[0] : null;
    const tomaLgr = tomaEnd ? [tomaEnd.getElementsByTagName('xLgr')[0]?.textContent.trim(), tomaEnd.getElementsByTagName('nro')[0]?.textContent.trim(), tomaEnd.getElementsByTagName('xCpl')[0]?.textContent.trim(), tomaEnd.getElementsByTagName('xBairro')[0]?.textContent.trim()].filter(Boolean).join(', ') : '';
    const tomaCep = tomaEndNac ? tomaEndNac.getElementsByTagName('CEP')[0]?.textContent.trim() : '';
    const tomaEndCompleto = tomaCep ? `${tomaLgr} - CEP: ${fmtCep(tomaCep)}` : tomaLgr;
    const tomaCidadeCod = tomaEndNac ? tomaEndNac.getElementsByTagName('cMun')[0]?.textContent.trim() : '';
    const tomaEmail = toma.getElementsByTagName('email')[0]?.textContent.trim() || '';
    const rawPMSP = t('CodigoServico');
    const rawMun = t('cTribMun');
    const rawNac = t('cTribNac');
    const descXmlNac = t('xTribNac');
    const descXmlMun = t('xTribMun');

    let codServicoFinal = '';
    let descServicoFinal = '';

    const digitsPMSP = rawPMSP.replace(/\D/g, '');
    const digitsMun = rawMun.replace(/\D/g, '');
    const digitsNac = rawNac.replace(/\D/g, '');

    // Verifica se temos código municipal de SP (4 ou 5 dígitos)
    const candMun = (digitsPMSP.length >= 4 && digitsPMSP.length <= 5) ? digitsPMSP :
                    (digitsMun.length >= 4 && digitsMun.length <= 5) ? digitsMun :
                    (digitsNac.length >= 4 && digitsNac.length <= 5) ? digitsNac : '';

    if (candMun) {
      const pad5 = candMun.padStart(5, '0');
      codServicoFinal = pad5;
      const detalhe = obterDetalhesServicoSP(pad5);
      descServicoFinal = detalhe?.descricaoMun || SERVICOS_SP[pad5] || SERVICOS_SP[candMun] || descXmlMun || (descXmlNac && !descXmlNac.includes('tributados no Município') ? descXmlNac : '') || 'Outros serviços municipais';
    } else if (digitsNac.length === 6) {
      // Código Nacional LC 116 (ex.: 100901, 010501)
      const detalheRev = obterPorCodigoNacional(digitsNac);
      if (detalheRev) {
        codServicoFinal = detalheRev.codigoMun;
        descServicoFinal = detalheRev.descricaoMun;
      } else {
        codServicoFinal = `${digitsNac.slice(0, 2)}.${digitsNac.slice(2, 4)}.${digitsNac.slice(4, 6)}`;
        descServicoFinal = descXmlNac || descXmlMun || 'Serviços sujeitos ao ISSQN';
      }
    } else if (rawMun && rawMun.trim()) {
      codServicoFinal = rawMun.trim();
      descServicoFinal = descXmlMun || (descXmlNac && !descXmlNac.includes('tributados no Município') ? descXmlNac : '') || 'Serviços municipais';
    } else if (rawNac && rawNac.trim()) {
      codServicoFinal = rawNac.trim();
      descServicoFinal = descXmlNac || 'Serviços tributados pelo ISSQN';
    } else {
      codServicoFinal = '00000';
      descServicoFinal = descXmlMun || (descXmlNac && !descXmlNac.includes('tributados no Município') ? descXmlNac : '') || 'Outros serviços municipais';
    }
    const codServicoPadded = codServicoFinal;
    const descServico = descServicoFinal;
    const discriminacao = sanitizarDiscriminacao(t('xDescServ') || t('xInfComp') || t('Discriminacao') || '');

    const opSimpNac = t('opSimpNac') || (doc.getElementsByTagName('opSimpNac')[0]?.textContent?.trim() || '');
    const opcaoSimples = t('OpcaoSimples');
    const regApTribSN = t('regApTribSN') || (doc.getElementsByTagName('regApTribSN')[0]?.textContent?.trim() || '');
    const isSimplesNacional = Boolean(
      opcaoSimples === '1' || opcaoSimples === 'true' ||
      regApTribSN ||
      opSimpNac === '2' ||
      (opSimpNac === '3' && (regApTribSN || opcaoSimples === '1' || opcaoSimples === 'true' || xmlString.includes('regApTribSN') || xmlString.includes('Simples Nacional')))
    );

    const vPIS = t('vRetPIS') || t('vPis') || '0.00';
    const vCOFINS = t('vRetCOFINS') || t('vCofins') || '0.00';
    const vINSS = t('vRetCP') || '0.00';
    const vIR = t('vRetIRRF') || '0.00';
    const vCSLL = t('vRetCSLL') || '0.00';
    const rawDescRet = t('xDescRetSociais') || t('DescricaoContribSociais') || '';
    const temCsllRet = parseFloat(vCSLL) > 0;
    let descRetSociais = rawDescRet;
    if (!descRetSociais || descRetSociais === '-' || (!temCsllRet && !descRetSociais.startsWith('0 -'))) {
      descRetSociais = temCsllRet ? (rawDescRet || '3 - PIS/COFINS/CSLL Retidos') : '0 - PIS/COFINS/CSLL Não Retidos.';
    }

    const valorServicos = t('vServ') || t('vLiq') || '0.00';
    const issRetido = (t('tpRetISSQN') === '2');
    const baseCalculo = isSimplesNacional ? '*' : (t('vBC') || valorServicos);
    const aliquota = isSimplesNacional ? '*' : (t('pAliqAplic') || t('pAliq') || '0.00');
    const valorISS = isSimplesNacional ? (issRetido ? (t('vISSQN') || '0.00') : '*') : (t('vISSQN') || '0.00');
    const dataEmissaoRaw = t('dhEmi') || t('dhProc') || t('dCompet') || '';

    return {
      numeroNFe: String(numeroNFe || '').padStart(8, '0'),
      codigoVerificacao: fmtCodigoVerificacao(codVer),
      dataEmissao: dataEmissaoRaw,
      chaveNotaNacional,
      numeroRPS,
      serieRPS,
      dataEmissaoRPS: dataEmissaoRaw,
      isCancelada,
      isSimplesNacional,
      outrasInformacoes: t('xOutInf'),
      prestador: {
        cnpj: prestCnpj,
        im: fmtInscricaoMunicipal(prestIm),
        razaoSocial: prestNome,
        endereco: prestEndCompleto,
        municipio: 'São Paulo',
        uf: 'SP'
      },
      tomador: {
        cnpj: tomaCnpj,
        im: fmtInscricaoMunicipal(tomaIm),
        razaoSocial: tomaNome,
        endereco: tomaEndCompleto,
        municipio: resolverCidade(tomaCidadeCod, ''),
        uf: t('UF') || resolverUF(tomaCidadeCod, 'SP'),
        email: tomaEmail || '----'
      },
      intermediario: {
        cnpj: '----',
        razaoSocial: '----'
      },
      discriminacao,
      valores: {
        valorServicos,
        valorDeducoes: '0.00',
        baseCalculo,
        aliquota,
        valorISS,
        valorCredito: '0.00',
        issRetido,
        inss: vINSS,
        irrf: vIR,
        cofins: vCOFINS,
        pis: vPIS,
        csll: vCSLL,
        descRetSociais
      },
      servico: {
        codigo: codServicoPadded,
        descricao: descServico,
        municipioPrestacao: '-'
      },
      ibscbs: (t('CST') || t('ValorIBS') || t('ValorCBS') || t('vIBS') || t('vCBS')) ? {
        cst: t('CST'),
        cIndOp: t('cIndOp') || '1',
        vBC: t('vBC') || valorServicos,
        pIBSUF: t('pAliqEstadualIBS') || t('ValorAliqEstadualIBS'),
        pIBSMun: t('pAliqMunicipalIBS') || t('ValorAliqMunicipalIBS'),
        pCBS: t('pAliqCBS') || t('ValorAliqCBS'),
        vIBSMun: t('vIBS') || t('ValorMunicipalIBS'),
        vIBSUF: '0.00',
        vIBSTot: t('vIBS') || t('ValorIBS'),
        vCBS: t('vCBS') || t('ValorCBS'),
        vTotNF: t('vTotNF') || valorServicos
      } : null
    };
  }

  // Caso seja o XML bruto da PMSP (<NFe>)
  const nfe = doc.getElementsByTagName('NFe')[0] || doc.documentElement;

  const t = (name) => {
    const el = nfe.getElementsByTagName(name)[0];
    return el ? (el.textContent || '').trim() : '';
  };

  const endStr = (prefix) => {
    const endEl = nfe.getElementsByTagName(`Endereco${prefix}`)[0];
    if (!endEl) return '';
    const te = (sub) => {
      const el = endEl.getElementsByTagName(sub)[0];
      return el ? el.textContent.trim() : '';
    };
    const parts = [te('TipoLogradouro'), te('Logradouro'), te('NumeroEndereco')].filter(Boolean).join(' ');
    const compl = te('ComplementoEndereco');
    const bairro = te('Bairro');
    const cep = te('CEP');
    const res = [parts, compl ? `, ${compl}` : '', bairro ? ` - ${bairro}` : '', cep ? ` - CEP: ${fmtCep(cep)}` : ''].join('');
    return res.replace(/\s+/g, ' ').trim();
  };

  const munStr = (prefix, def) => {
    const endEl = nfe.getElementsByTagName(`Endereco${prefix}`)[0];
    if (!endEl) return def || 'São Paulo';
    const cidEl = endEl.getElementsByTagName('Cidade')[0];
    const cid = cidEl ? cidEl.textContent.trim() : '';
    return resolverCidade(cid, def || 'São Paulo');
  };

  const ufStr = (prefix, def) => {
    const endEl = nfe.getElementsByTagName(`Endereco${prefix}`)[0];
    if (!endEl) return def || 'SP';
    const ufEl = endEl.getElementsByTagName('UF')[0];
    return ufEl ? ufEl.textContent.trim() : (def || 'SP');
  };

  const prestCnpj = t('CNPJ') || t('CPF') || (nfe.getElementsByTagName('CPFCNPJPrestador')[0]?.textContent.trim() || '');
  const tomaCnpj = (nfe.getElementsByTagName('CPFCNPJTomador')[0]?.textContent.trim() || '');

  const dataEmissaoRaw = t('DataEmissaoNFe') || t('DataFatoGeradorNFe');
  const isCancelada = (t('StatusNFe') === 'C' || t('DataCancelamento') !== '');

  const rawPMSP = t('CodigoServico') || '';
  const digitsPMSP = rawPMSP.replace(/\D/g, '');
  const codServicoPadded = digitsPMSP.length >= 4 ? digitsPMSP.padStart(5, '0') : (rawPMSP || '00000');
  const detalhe = obterDetalhesServicoSP(codServicoPadded);
  const descServico = detalhe?.descricaoMun || SERVICOS_SP[codServicoPadded] || SERVICOS_SP[rawPMSP] || 'Outros serviços municipais';

  const opcaoSimples = t('OpcaoSimples');
  const tributacaoNFe = t('TributacaoNFe');
  const isSimplesNacional = (opcaoSimples === 'true' || opcaoSimples === '1' || opcaoSimples === '3' || tributacaoNFe === 'T' || tributacaoNFe === 'J');

  // Tributos Federais e Sociais
  const vPIS = t('ValorPIS') || '0.00';
  const vCOFINS = t('ValorCOFINS') || '0.00';
  const vINSS = t('ValorINSS') || '0.00';
  const vIR = t('ValorIR') || '0.00';
  const vCSLL = t('ValorCSLL') || '0.00';
  const rawDescRet = t('DescricaoContribSociais') || '';
  const temCsllRet = parseFloat(vCSLL) > 0;
  let descRetSociais = rawDescRet;
  if (!descRetSociais || descRetSociais === '-' || (!temCsllRet && !descRetSociais.startsWith('0 -'))) {
    descRetSociais = temCsllRet ? (rawDescRet || '3 - PIS/COFINS/CSLL Retidos') : '0 - PIS/COFINS/CSLL Não Retidos.';
  }

  const valorServicos = t('ValorServicos') || '0.00';
  const issRetido = (t('ISSRetido') === 'true' || t('ISSRetido') === '1' || t('ISSRetido') === 'S');
  const baseCalculo = isSimplesNacional ? '*' : (t('BaseCalculo') || valorServicos);
  const aliquota = isSimplesNacional ? '*' : (t('AliquotaServicos') || '0.00');
  const valorISS = isSimplesNacional ? (issRetido ? (t('ValorISS') || '0.00') : '*') : (t('ValorISS') || '0.00');

  return {
    numeroNFe: String(t('NumeroNFe') || '').padStart(8, '0'),
    codigoVerificacao: fmtCodigoVerificacao(t('CodigoVerificacao')),
    dataEmissao: dataEmissaoRaw,
    chaveNotaNacional: t('ChaveNotaNacional'),
    numeroRPS: t('NumeroRPS'),
    serieRPS: t('SerieRPS'),
    dataEmissaoRPS: t('DataEmissaoRPS'),
    isCancelada,
    isSimplesNacional,
    outrasInformacoes: t('OutrasInformacoes'),

    prestador: {
      cnpj: prestCnpj,
      im: fmtInscricaoMunicipal(t('InscricaoPrestador')),
      razaoSocial: t('RazaoSocialPrestador'),
      endereco: endStr('Prestador'),
      municipio: munStr('Prestador', 'São Paulo'),
      uf: ufStr('Prestador', 'SP')
    },

    tomador: {
      cnpj: tomaCnpj,
      im: fmtInscricaoMunicipal(t('InscricaoTomador')),
      razaoSocial: t('RazaoSocialTomador'),
      endereco: endStr('Tomador'),
      municipio: munStr('Tomador', ''),
      uf: ufStr('Tomador', ''),
      email: t('EmailTomador') || '----'
    },

    intermediario: {
      cnpj: t('CPFCNPJIntermediario') || '----',
      razaoSocial: t('RazaoSocialIntermediario') || '----'
    },

    discriminacao: sanitizarDiscriminacao(t('Discriminacao') || ''),

    valores: {
      valorServicos,
      valorDeducoes: t('ValorDeducoes') || '0.00',
      baseCalculo,
      aliquota,
      valorISS,
      valorCredito: t('ValorCredito') || '0.00',
      issRetido,
      inss: vINSS,
      irrf: vIR,
      cofins: vCOFINS,
      pis: vPIS,
      csll: vCSLL,
      descRetSociais
    },

    servico: {
      codigo: codServicoPadded,
      descricao: descServico,
      municipioPrestacao: '-'
    },

    ibscbs: (t('CST') || t('ValorIBS') || t('ValorCBS')) ? {
      cst: t('CST'),
      cIndOp: t('cIndOp'),
      vBC: t('BaseCalculoIBS') || t('ValorServicos'),
      pIBSUF: t('ValorAliqEstadualIBS'),
      pIBSMun: t('ValorAliqMunicipalIBS'),
      pCBS: t('ValorAliqCBS'),
      vIBSMun: t('ValorMunicipalIBS'),
      vIBSUF: t('ValorEstadualIBS'),
      vIBSTot: t('ValorIBS'),
      vCBS: t('ValorCBS'),
      vTotNF: t('ValorTotalCobrado') || t('ValorServicos')
    } : null
  };
}

// Gerador Gráfico PDF (pdf-lib) no Padrão Oficial da PMSP
async function gerarDanfseSpPdf(xmlString, deps = {}) {
  const { PDFLib, fontkit, arimo, arimoBold, logoSpBytes } = deps;
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

  const data = parseXmlSP(xmlString);
  const pdf = await PDFDocument.create();

  let fN, fB, fCourier;
  if (fontkit && arimo && arimoBold) {
    try {
      pdf.registerFontkit(fontkit);
      fN = await pdf.embedFont(arimo, { subset: false });
      fB = await pdf.embedFont(arimoBold, { subset: false });
    } catch (_) { fN = fB = null; }
  }
  if (!fN || !fB) {
    fN = await pdf.embedFont(StandardFonts.Helvetica);
    fB = await pdf.embedFont(StandardFonts.HelveticaBold);
  }
  fCourier = await pdf.embedFont(StandardFonts.Courier);

  const wrapFont = (f) => {
    if (!f || f._wrappedWinAnsi) return f;
    const origWidth = f.widthOfTextAtSize.bind(f);
    f.widthOfTextAtSize = function(text, size) {
      return origWidth(sanitizeWinAnsi(text), size);
    };
    f._wrappedWinAnsi = true;
    return f;
  };
  if (fN) wrapFont(fN);
  if (fB) wrapFont(fB);
  if (fCourier) wrapFont(fCourier);

  const wrapPage = (p) => {
    if (!p || p._wrappedWinAnsi) return p;
    const origDraw = p.drawText.bind(p);
    p.drawText = function(text, options) {
      return origDraw(sanitizeWinAnsi(text), options);
    };
    p._wrappedWinAnsi = true;
    return p;
  };


  // Carrega Brasão de São Paulo
  let logoSp = null;
  if (logoSpBytes) {
    try { logoSp = await pdf.embedJpg(logoSpBytes); } catch (_) {
      try { logoSp = await pdf.embedPng(logoSpBytes); } catch (_) {}
    }
  }

  const A4W = 595.28;
  const A4H = 841.89;
  const L = 20;
  const R = A4W - 20;
  const W = R - L; // 555.28 pt

  const K = rgb(0, 0, 0);
  const GRAY_BG = rgb(0.93, 0.93, 0.93);
  const YELLOW = rgb(1, 0.93, 0.45); // Destaque de retenção (amarelo igual ao padrão nacional)
  const BORDER_COLOR = rgb(0, 0, 0);
  const LINE = 0.5;

  // Helper de Quebra de Texto
  function wrapText(text, font, size, maxW) {
    const lines = [];
    const paragraphs = (text || '').split('\n');
    for (const para of paragraphs) {
      const words = para.split(/\s+/);
      let cur = '';
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (font.widthOfTextAtSize(test, size) <= maxW) {
          cur = test;
        } else {
          if (cur) lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
    }
    return lines;
  }

  // =========================================================================
  // PÁGINA 1: NFS-e PADRÃO DA PREFEITURA DE SÃO PAULO
  // =========================================================================
  const page1 = pdf.addPage([A4W, A4H]); wrapPage(page1);
  let y = A4H - 20;

  // 1. Moldura do Cabeçalho Superior
  const headH = 88;
  page1.drawRectangle({ x: L, y: y - headH, width: W, height: headH, borderWidth: LINE, borderColor: BORDER_COLOR });

  // Brasão de SP
  if (logoSp) {
    const bW = 42, bH = 55;
    page1.drawImage(logoSp, { x: L + 6, y: y - headH + 26, width: bW, height: bH });
  }

  // Código identificador sob o brasão
  const dtEmissaoCompacta = (data.dataEmissao || '').replace(/\D/g, '').slice(0, 8);
  const strIdCompacta = `${dtEmissaoCompacta}u${(data.prestador.cnpj || '').replace(/\D/g, '')}i${(data.tomador.cnpj || '').replace(/\D/g, '')}`;
  page1.drawText(strIdCompacta.slice(0, 42), { x: L + 2, y: y - headH + 8, size: 5.5, font: fCourier, color: K });

  // Textos Centrais
  const midX = L + 54;
  const midW = W - 54 - 132;
  const t1 = 'PREFEITURA DO MUNICÍPIO DE SÃO PAULO';
  const t2 = 'SECRETARIA MUNICIPAL DA FAZENDA';
  const t3 = 'NOTA FISCAL ELETRÔNICA DE SERVIÇOS - NFS-e';
  let rpsStr = '';
  if (data.numeroRPS) {
    rpsStr = `RPS Nº ${data.numeroRPS} Série ${data.serieRPS || 'SP000'}, emitido em ${fmtData(data.dataEmissaoRPS || data.dataEmissao)}`;
  }

  page1.drawText(t1, { x: midX + (midW - fB.widthOfTextAtSize(t1, 10.5)) / 2, y: y - 18, size: 10.5, font: fB, color: K });
  page1.drawText(t2, { x: midX + (midW - fB.widthOfTextAtSize(t2, 8)) / 2, y: y - 32, size: 8, font: fB, color: K });
  page1.drawText(t3, { x: midX + (midW - fB.widthOfTextAtSize(t3, 9.5)) / 2, y: y - 48, size: 9.5, font: fB, color: K });
  if (rpsStr) {
    page1.drawText(rpsStr, { x: midX + (midW - fN.widthOfTextAtSize(rpsStr, 6.5)) / 2, y: y - 62, size: 6.5, font: fN, color: K });
  }

  // Quadro de Controle no Canto Superior Direito (3 linhas)
  const boxW = 132;
  const boxX = R - boxW;
  page1.drawLine({ start: { x: boxX, y: y }, end: { x: boxX, y: y - headH }, thickness: LINE, color: BORDER_COLOR });
  page1.drawLine({ start: { x: boxX, y: y - 30 }, end: { x: R, y: y - 30 }, thickness: LINE, color: BORDER_COLOR });
  page1.drawLine({ start: { x: boxX, y: y - 59 }, end: { x: R, y: y - 59 }, thickness: LINE, color: BORDER_COLOR });

  // Linha 1: Número da Nota
  page1.drawText('Número da Nota', { x: boxX + (boxW - fN.widthOfTextAtSize('Número da Nota', 7)) / 2, y: y - 10, size: 7, font: fN, color: K });
  const nfeNumTxt = data.numeroNFe || '00000000';
  page1.drawText(nfeNumTxt, { x: boxX + (boxW - fB.widthOfTextAtSize(nfeNumTxt, 12)) / 2, y: y - 24, size: 12, font: fB, color: K });

  // Linha 2: Data e Hora de Emissão
  page1.drawText('Data e Hora de Emissão', { x: boxX + (boxW - fN.widthOfTextAtSize('Data e Hora de Emissão', 6.5)) / 2, y: y - 39, size: 6.5, font: fN, color: K });
  const dtEmiTxt = fmtDataHora(data.dataEmissao);
  page1.drawText(dtEmiTxt, { x: boxX + (boxW - fB.widthOfTextAtSize(dtEmiTxt, 8.5)) / 2, y: y - 52, size: 8.5, font: fB, color: K });

  // Linha 3: Código de Verificação
  page1.drawText('Código de Verificação', { x: boxX + (boxW - fN.widthOfTextAtSize('Código de Verificação', 6.5)) / 2, y: y - 68, size: 6.5, font: fN, color: K });
  const codVerTxt = data.codigoVerificacao || '----';
  page1.drawText(codVerTxt, { x: boxX + (boxW - fB.widthOfTextAtSize(codVerTxt, 10)) / 2, y: y - 81, size: 10, font: fB, color: K });

  y -= headH;

  // 2. Faixa Identificador Nacional (se disponível)
  if (data.chaveNotaNacional) {
    const idH = 14;
    page1.drawRectangle({ x: L, y: y - idH, width: W, height: idH, borderWidth: LINE, borderColor: BORDER_COLOR });
    const idTxt = `Identificador Nacional: ${data.chaveNotaNacional}`;
    page1.drawText(idTxt, { x: L + (W - fN.widthOfTextAtSize(idTxt, 7.5)) / 2, y: y - 10, size: 7.5, font: fN, color: K });
    y -= idH;
  }

  // Helper para Seção com Título em Barra
  function drawSecaoBarra(titulo, alturaConteudo) {
    const barH = 13;
    const totalH = barH + alturaConteudo;
    page1.drawRectangle({ x: L, y: y - totalH, width: W, height: totalH, borderWidth: LINE, borderColor: BORDER_COLOR });
    page1.drawRectangle({ x: L, y: y - barH, width: W, height: barH, color: GRAY_BG, borderWidth: LINE, borderColor: BORDER_COLOR });
    page1.drawText(titulo, { x: L + (W - fB.widthOfTextAtSize(titulo, 8)) / 2, y: y - 9.5, size: 8, font: fB, color: K });
    const contentY = y - barH;
    y -= totalH;
    return contentY;
  }

  // 3. Bloco PRESTADOR DE SERVIÇOS
  const pY = drawSecaoBarra('PRESTADOR DE SERVIÇOS', 54);
  page1.drawText('CPF/CNPJ: ', { x: L + 8, y: pY - 12, size: 7.5, font: fB, color: K });
  page1.drawText(fmtDoc(data.prestador.cnpj), { x: L + 54, y: pY - 12, size: 7.5, font: fN, color: K });

  page1.drawText('Inscrição Municipal: ', { x: L + 320, y: pY - 12, size: 7.5, font: fB, color: K });
  page1.drawText(data.prestador.im || '----', { x: L + 415, y: pY - 12, size: 7.5, font: fN, color: K });

  page1.drawText('Nome/Razão Social: ', { x: L + 8, y: pY - 24, size: 7.5, font: fB, color: K });
  page1.drawText((data.prestador.razaoSocial || '').slice(0, 85), { x: L + 94, y: pY - 24, size: 7.5, font: fB, color: K });

  page1.drawText('Endereço: ', { x: L + 8, y: pY - 36, size: 7.5, font: fB, color: K });
  page1.drawText((data.prestador.endereco || '').slice(0, 105), { x: L + 54, y: pY - 36, size: 7, font: fN, color: K });

  page1.drawText('Município: ', { x: L + 8, y: pY - 48, size: 7.5, font: fB, color: K });
  page1.drawText(data.prestador.municipio || 'São Paulo', { x: L + 54, y: pY - 48, size: 7.5, font: fN, color: K });
  page1.drawText('UF: ', { x: L + 320, y: pY - 48, size: 7.5, font: fB, color: K });
  page1.drawText(data.prestador.uf || 'SP', { x: L + 340, y: pY - 48, size: 7.5, font: fN, color: K });

  // 4. Bloco TOMADOR DE SERVIÇOS
  const tY = drawSecaoBarra('TOMADOR DE SERVIÇOS', 54);
  page1.drawText('Nome/Razão Social: ', { x: L + 8, y: tY - 12, size: 7.5, font: fB, color: K });
  page1.drawText((data.tomador.razaoSocial || '').slice(0, 85), { x: L + 94, y: tY - 12, size: 7.5, font: fB, color: K });

  page1.drawText('CPF/CNPJ: ', { x: L + 8, y: tY - 24, size: 7.5, font: fB, color: K });
  page1.drawText(fmtDoc(data.tomador.cnpj), { x: L + 54, y: tY - 24, size: 7.5, font: fN, color: K });

  page1.drawText('Inscrição Municipal: ', { x: L + 320, y: tY - 24, size: 7.5, font: fB, color: K });
  page1.drawText(data.tomador.im || '----', { x: L + 415, y: tY - 24, size: 7.5, font: fN, color: K });

  page1.drawText('Endereço: ', { x: L + 8, y: tY - 36, size: 7.5, font: fB, color: K });
  page1.drawText((data.tomador.endereco || '').slice(0, 105), { x: L + 54, y: tY - 36, size: 7, font: fN, color: K });

  page1.drawText('Município: ', { x: L + 8, y: tY - 48, size: 7.5, font: fB, color: K });
  page1.drawText(data.tomador.municipio || '', { x: L + 54, y: tY - 48, size: 7.5, font: fN, color: K });
  page1.drawText('UF: ', { x: L + 200, y: tY - 48, size: 7.5, font: fB, color: K });
  page1.drawText(data.tomador.uf || '', { x: L + 220, y: tY - 48, size: 7.5, font: fN, color: K });
  page1.drawText('E-mail: ', { x: L + 260, y: tY - 48, size: 7.5, font: fB, color: K });
  page1.drawText((data.tomador.email || '----').slice(0, 50), { x: L + 295, y: tY - 48, size: 7, font: fN, color: K });

  // 5. Bloco INTERMEDIÁRIO DE SERVIÇOS
  const iH = 22;
  page1.drawRectangle({ x: L, y: y - iH, width: W, height: iH, borderWidth: LINE, borderColor: BORDER_COLOR });
  page1.drawRectangle({ x: L, y: y - 11, width: W, height: 11, color: GRAY_BG, borderWidth: LINE, borderColor: BORDER_COLOR });
  page1.drawText('INTERMEDIÁRIO DE SERVIÇOS', { x: L + (W - fB.widthOfTextAtSize('INTERMEDIÁRIO DE SERVIÇOS', 7.5)) / 2, y: y - 8.5, size: 7.5, font: fB, color: K });
  page1.drawText('CPF/CNPJ: ', { x: L + 8, y: y - 19, size: 7, font: fB, color: K });
  page1.drawText(fmtDoc(data.intermediario.cnpj), { x: L + 54, y: y - 19, size: 7, font: fN, color: K });
  page1.drawText('Nome/Razão Social: ', { x: L + 140, y: y - 19, size: 7, font: fB, color: K });
  page1.drawText(data.intermediario.razaoSocial, { x: L + 220, y: y - 19, size: 7, font: fN, color: K });
  y -= iH;

  // 6. Bloco DISCRIMINAÇÃO DE SERVIÇOS
  // Altura proporcional: mínimo 135pt, máximo 200pt
  const descLines = wrapText(data.discriminacao, fCourier, 7, W - 16);
  const discContentH = Math.min(185, Math.max(120, descLines.length * 9 + 15));
  const dY = drawSecaoBarra('DISCRIMINAÇÃO DE SERVIÇOS', discContentH);

  let curDy = dY - 11;
  const maxLinesDisplay = Math.floor((discContentH - 8) / 9);
  for (let idx = 0; idx < Math.min(descLines.length, maxLinesDisplay); idx++) {
    page1.drawText(descLines[idx], { x: L + 8, y: curDy, size: 7, font: fCourier, color: K });
    curDy -= 9;
  }

  // 7. VALOR TOTAL DO SERVIÇO E RETENÇÕES FEDERAIS
  // Barra do Valor Total
  const vTotH = 16;
  page1.drawRectangle({ x: L, y: y - vTotH, width: W, height: vTotH, color: GRAY_BG, borderWidth: LINE, borderColor: BORDER_COLOR });
  const valServTxt = `VALOR TOTAL DO SERVIÇO = R$ ${fmtMoeda(data.valores.valorServicos)}`;
  page1.drawText(valServTxt, { x: L + (W - fB.widthOfTextAtSize(valServTxt, 9.5)) / 2, y: y - 11.5, size: 9.5, font: fB, color: K });
  y -= vTotH;

  // Tabela de Retenções (5 Colunas: INSS, IRRF, COFINS, PIS, IPI)
  const ret1H = 24;
  page1.drawRectangle({ x: L, y: y - ret1H, width: W, height: ret1H, borderWidth: LINE, borderColor: BORDER_COLOR });
  const c5W = W / 5;
  for (let i = 1; i < 5; i++) {
    page1.drawLine({ start: { x: L + i * c5W, y: y }, end: { x: L + i * c5W, y: y - ret1H }, thickness: LINE, color: BORDER_COLOR });
  }

  const retCols = [
    { label: 'Contribuição Previdenciária - Retida (R$)', val: fmtMoeda(data.valores.inss) },
    { label: 'IRRF (R$)', val: fmtMoeda(data.valores.irrf) },
    { label: 'COFINS (R$)', val: fmtMoeda(data.valores.cofins) },
    { label: 'PIS/PASEP (R$)', val: fmtMoeda(data.valores.pis) },
    { label: 'IPI (R$)', val: '0,00' }
  ];

  retCols.forEach((rc, i) => {
    const colX = L + i * c5W;
    page1.drawText(rc.label, { x: colX + (c5W - fN.widthOfTextAtSize(rc.label, 5.5)) / 2, y: y - 8, size: 5.5, font: fN, color: K });
    page1.drawText(rc.val, { x: colX + (c5W - fN.widthOfTextAtSize(rc.val, 7.5)) / 2, y: y - 19, size: 7.5, font: fN, color: K });
  });
  y -= ret1H;

  // Linha 2 de Retenções (Contribuições Sociais e Descrição)
  const ret2H = 22;
  page1.drawRectangle({ x: L, y: y - ret2H, width: W, height: ret2H, borderWidth: LINE, borderColor: BORDER_COLOR });
  const cRet2W = W * 0.28;
  page1.drawLine({ start: { x: L + cRet2W, y: y }, end: { x: L + cRet2W, y: y - ret2H }, thickness: LINE, color: BORDER_COLOR });

  page1.drawText('Contribuições Sociais - Retidas (R$)', { x: L + 6, y: y - 8, size: 6, font: fN, color: K });
  page1.drawText(fmtMoeda(data.valores.csll), { x: L + (cRet2W - fN.widthOfTextAtSize(fmtMoeda(data.valores.csll), 7.5)) / 2, y: y - 18, size: 7.5, font: fN, color: K });

  page1.drawText('Descrição Contribuições Sociais - Retidas', { x: L + cRet2W + 6, y: y - 8, size: 6, font: fN, color: K });
  page1.drawText(data.valores.descRetSociais || '0 - PIS/COFINS/CSLL Não Retidos.', { x: L + cRet2W + 6, y: y - 18, size: 7, font: fN, color: K });
  y -= ret2H;

  // 8. CÓDIGO DO SERVIÇO E APURAÇÃO DO ISS
  // Caixa do Código do Serviço
  const codServH = 22;
  page1.drawRectangle({ x: L, y: y - codServH, width: W, height: codServH, borderWidth: LINE, borderColor: BORDER_COLOR });
  page1.drawText('Código do Serviço', { x: L + 6, y: y - 8, size: 6, font: fB, color: K });
  const servCompleto = `${data.servico.codigo || '00000'} - ${data.servico.descricao || 'Outros serviços municipais'}`;
  page1.drawText(servCompleto.slice(0, 110), { x: L + 6, y: y - 18, size: 7, font: fB, color: K });
  y -= codServH;

  // Tabela ISS (5 Colunas: Deduções, Base de Cálculo, Alíquota, Valor ISS, Crédito NFP)
  const iss1H = 24;
  page1.drawRectangle({ x: L, y: y - iss1H, width: W, height: iss1H, borderWidth: LINE, borderColor: BORDER_COLOR });
  for (let i = 1; i < 5; i++) {
    page1.drawLine({ start: { x: L + i * c5W, y: y }, end: { x: L + i * c5W, y: y - iss1H }, thickness: LINE, color: BORDER_COLOR });
  }

  const fmtBase = data.valores.baseCalculo === '*' ? '*' : fmtMoeda(data.valores.baseCalculo);
  const fmtAli = data.valores.aliquota === '*' ? '*' : fmtAliq(data.valores.aliquota);
  const fmtIss = data.valores.valorISS === '*' ? '*' : fmtMoeda(data.valores.valorISS);

  const issCols = [
    { label: 'Valor Total das Deduções (R$)', val: fmtMoeda(data.valores.valorDeducoes) },
    { label: 'Base de Cálculo (R$)', val: fmtBase },
    { label: 'Alíquota (%)', val: fmtAli },
    { label: 'Valor do ISS (R$)', val: fmtIss },
    { label: 'Crédito Programa da NFP (R$)', val: fmtMoeda(data.valores.valorCredito) }
  ];

  issCols.forEach((ic, i) => {
    const colX = L + i * c5W;
    page1.drawText(ic.label, { x: colX + (c5W - fN.widthOfTextAtSize(ic.label, 5.5)) / 2, y: y - 8, size: 5.5, font: fN, color: K });
    page1.drawText(ic.val, { x: colX + (c5W - fN.widthOfTextAtSize(ic.val, 7.5)) / 2, y: y - 19, size: 7.5, font: fN, color: K });
  });
  y -= iss1H;

  // Tabela ISS Linha 2 (3 Colunas: Município de Prestação, Inscrição Obra, Valor Aprox Tributos)
  const iss2H = 22;
  page1.drawRectangle({ x: L, y: y - iss2H, width: W, height: iss2H, borderWidth: LINE, borderColor: BORDER_COLOR });
  const c3W = W / 3;
  page1.drawLine({ start: { x: L + c3W, y: y }, end: { x: L + c3W, y: y - iss2H }, thickness: LINE, color: BORDER_COLOR });
  page1.drawLine({ start: { x: L + 2 * c3W, y: y }, end: { x: L + 2 * c3W, y: y - iss2H }, thickness: LINE, color: BORDER_COLOR });

  page1.drawText('Município de Prestação do Serviço', { x: L + (c3W - fN.widthOfTextAtSize('Município de Prestação do Serviço', 6)) / 2, y: y - 8, size: 6, font: fN, color: K });
  const munPrest = data.servico.municipioPrestacao || '-';
  page1.drawText(munPrest, { x: L + (c3W - fN.widthOfTextAtSize(munPrest, 7)) / 2, y: y - 18, size: 7, font: fN, color: K });

  page1.drawText('Número Inscrição da Obra', { x: L + c3W + (c3W - fN.widthOfTextAtSize('Número Inscrição da Obra', 6)) / 2, y: y - 8, size: 6, font: fN, color: K });
  page1.drawText('-', { x: L + c3W + (c3W - fN.widthOfTextAtSize('-', 7)) / 2, y: y - 18, size: 7, font: fN, color: K });

  page1.drawText('Valor Aproximado dos Tributos / Fonte', { x: L + 2 * c3W + (c3W - fN.widthOfTextAtSize('Valor Aproximado dos Tributos / Fonte', 6)) / 2, y: y - 8, size: 6, font: fN, color: K });
  page1.drawText('-', { x: L + 2 * c3W + (c3W - fN.widthOfTextAtSize('-', 7)) / 2, y: y - 18, size: 7, font: fN, color: K });
  y -= iss2H;

  // 9. OUTRAS INFORMAÇÕES
  const outH = Math.max(42, y - 28);
  const oY = drawSecaoBarra('OUTRAS INFORMAÇÕES', outH - 13);
  const infoParts = ['(1) Esta NFS-e foi emitida com respaldo na Lei nº 14.097/2005;'];
  let itemNum = 2;
  if (data.isSimplesNacional) {
    infoParts.push(`(${itemNum}) Documento emitido por ME ou EPP optante pelo Simples Nacional;`);
    itemNum++;
  }
  if (data.numeroRPS) {
    infoParts.push(`(${itemNum}) Esta NFS-e substitui o RPS Nº ${data.numeroRPS} Série ${data.serieRPS || 'SP000'}, emitido em ${fmtData(data.dataEmissaoRPS || data.dataEmissao)};`);
    itemNum++;
  }
  if (data.outrasInformacoes && (!data.discriminacao || !data.discriminacao.toLowerCase().includes(data.outrasInformacoes.trim().toLowerCase()))) {
    infoParts.push(data.outrasInformacoes);
  }
  const infoText = infoParts.join(' ');

  const infoLines = wrapText(infoText, fN, 6.5, W - 16);
  let oCurY = oY - 10;
  for (const ln of infoLines.slice(0, 4)) {
    page1.drawText(ln, { x: L + 8, y: oCurY, size: 6.5, font: fN, color: K });
    oCurY -= 9;
  }

  // Rodapé da Página 1
  const totalPaginas = data.ibscbs ? 2 : 1;
  const rodapeTxt = `Página 1 de ${totalPaginas}`;
  page1.drawText(rodapeTxt, { x: R - fN.widthOfTextAtSize(rodapeTxt, 6.5), y: 12, size: 6.5, font: fN, color: rgb(0.3, 0.3, 0.3) });

  // Marca d'água CANCELADA
  if (data.isCancelada) {
    page1.drawText('CANCELADA', {
      x: 80,
      y: 260,
      size: 78,
      font: fB,
      color: rgb(0.85, 0.2, 0.2),
      opacity: 0.28,
      rotate: degrees(45)
    });
  }

  // =========================================================================
  // PÁGINA 2: REFORMA TRIBUTÁRIA IBS / CBS (se presente)
  // =========================================================================
  if (data.ibscbs) {
    const page2 = pdf.addPage([A4W, A4H]); wrapPage(page2);
    let y2 = A4H - 20;

    // Cabeçalho IBS/CBS
    const h2H = 34;
    page2.drawRectangle({ x: L, y: y2 - h2H, width: W, height: h2H, borderWidth: LINE, borderColor: BORDER_COLOR });
    const tIbsCbs = 'IMPOSTO E CONTRIBUIÇÃO SOBRE BENS E SERVIÇOS (IBS E CBS)';
    page2.drawText(tIbsCbs, { x: L + (W - fB.widthOfTextAtSize(tIbsCbs, 10)) / 2, y: y2 - 14, size: 10, font: fB, color: K });
    if (data.chaveNotaNacional) {
      const id2 = `Identificador: ${data.chaveNotaNacional}`;
      page2.drawText(id2, { x: L + (W - fN.widthOfTextAtSize(id2, 7)) / 2, y: y2 - 27, size: 7, font: fN, color: K });
    }
    y2 -= h2H;

    // Fornecedor / Número / Código
    const top2H = 26;
    page2.drawRectangle({ x: L, y: y2 - top2H, width: W, height: top2H, borderWidth: LINE, borderColor: BORDER_COLOR });
    page2.drawLine({ start: { x: L + c3W, y: y2 }, end: { x: L + c3W, y: y2 - top2H }, thickness: LINE, color: BORDER_COLOR });
    page2.drawLine({ start: { x: L + 2 * c3W, y: y2 }, end: { x: L + 2 * c3W, y: y2 - top2H }, thickness: LINE, color: BORDER_COLOR });

    page2.drawText('CPF/CNPJ/NIF do Fornecedor', { x: L + (c3W - fN.widthOfTextAtSize('CPF/CNPJ/NIF do Fornecedor', 6.5)) / 2, y: y2 - 9, size: 6.5, font: fN, color: K });
    page2.drawText(fmtDoc(data.prestador.cnpj), { x: L + (c3W - fB.widthOfTextAtSize(fmtDoc(data.prestador.cnpj), 8)) / 2, y: y2 - 20, size: 8, font: fB, color: K });

    page2.drawText('Número da Nota', { x: L + c3W + (c3W - fN.widthOfTextAtSize('Número da Nota', 6.5)) / 2, y: y2 - 9, size: 6.5, font: fN, color: K });
    page2.drawText(data.numeroNFe, { x: L + c3W + (c3W - fB.widthOfTextAtSize(data.numeroNFe, 9)) / 2, y: y2 - 20, size: 9, font: fB, color: K });

    page2.drawText('Código de Verificação', { x: L + 2 * c3W + (c3W - fN.widthOfTextAtSize('Código de Verificação', 6.5)) / 2, y: y2 - 9, size: 6.5, font: fN, color: K });
    page2.drawText(data.codigoVerificacao, { x: L + 2 * c3W + (c3W - fB.widthOfTextAtSize(data.codigoVerificacao, 9)) / 2, y: y2 - 20, size: 9, font: fB, color: K });
    y2 -= top2H;

    // Adquirente
    const adqH = 50;
    page2.drawRectangle({ x: L, y: y2 - adqH, width: W, height: adqH, borderWidth: LINE, borderColor: BORDER_COLOR });
    page2.drawRectangle({ x: L, y: y2 - 12, width: W, height: 12, color: GRAY_BG, borderWidth: LINE, borderColor: BORDER_COLOR });
    page2.drawText('ADQUIRENTE', { x: L + (W - fB.widthOfTextAtSize('ADQUIRENTE', 7.5)) / 2, y: y2 - 9, size: 7.5, font: fB, color: K });

    page2.drawText('CPF/CNPJ: ', { x: L + 8, y: y2 - 22, size: 7, font: fB, color: K });
    page2.drawText(fmtDoc(data.tomador.cnpj), { x: L + 54, y: y2 - 22, size: 7, font: fN, color: K });
    page2.drawText('Nome/Razão Social: ', { x: L + 150, y: y2 - 22, size: 7, font: fB, color: K });
    page2.drawText(data.tomador.razaoSocial.slice(0, 70), { x: L + 230, y: y2 - 22, size: 7, font: fB, color: K });

    page2.drawText('Endereço: ', { x: L + 8, y: y2 - 34, size: 7, font: fB, color: K });
    page2.drawText(data.tomador.endereco.slice(0, 100), { x: L + 54, y: y2 - 34, size: 7, font: fN, color: K });

    page2.drawText('Município: ', { x: L + 8, y: y2 - 45, size: 7, font: fB, color: K });
    page2.drawText(`${data.tomador.municipio} - ${data.tomador.uf}`, { x: L + 54, y: y2 - 45, size: 7, font: fN, color: K });
    y2 -= adqH;

    // Tabela Alíquotas e Valores IBS/CBS
    const icTabH = 75;
    page2.drawRectangle({ x: L, y: y2 - icTabH, width: W, height: icTabH, borderWidth: LINE, borderColor: BORDER_COLOR });
    page2.drawRectangle({ x: L, y: y2 - 12, width: W, height: 12, color: GRAY_BG, borderWidth: LINE, borderColor: BORDER_COLOR });
    page2.drawText('VALORES DE IBS E CBS', { x: L + (W - fB.widthOfTextAtSize('VALORES DE IBS E CBS', 7.5)) / 2, y: y2 - 9, size: 7.5, font: fB, color: K });

    const ic = data.ibscbs;
    page2.drawText('Base de Cálculo IBS/CBS: ', { x: L + 8, y: y2 - 26, size: 7, font: fB, color: K });
    page2.drawText(`R$ ${fmtMoeda(ic.vBC)}`, { x: L + 115, y: y2 - 26, size: 7, font: fN, color: K });

    page2.drawText('Alíquota IBS UF: ', { x: L + 8, y: y2 - 39, size: 7, font: fB, color: K });
    page2.drawText(fmtAliq(ic.pIBSUF), { x: L + 85, y: y2 - 39, size: 7, font: fN, color: K });
    page2.drawText('Valor IBS UF: ', { x: L + 150, y: y2 - 39, size: 7, font: fB, color: K });
    page2.drawText(`R$ ${fmtMoeda(ic.vIBSUF)}`, { x: L + 215, y: y2 - 39, size: 7, font: fN, color: K });

    page2.drawText('Alíquota IBS Mun: ', { x: L + 290, y: y2 - 39, size: 7, font: fB, color: K });
    page2.drawText(fmtAliq(ic.pIBSMun), { x: L + 370, y: y2 - 39, size: 7, font: fN, color: K });
    page2.drawText('Valor IBS Mun: ', { x: L + 430, y: y2 - 39, size: 7, font: fB, color: K });
    page2.drawText(`R$ ${fmtMoeda(ic.vIBSMun)}`, { x: L + 495, y: y2 - 39, size: 7, font: fN, color: K });

    page2.drawText('Alíquota CBS: ', { x: L + 8, y: y2 - 52, size: 7, font: fB, color: K });
    page2.drawText(fmtAliq(ic.pCBS), { x: L + 75, y: y2 - 52, size: 7, font: fN, color: K });
    page2.drawText('Valor CBS: ', { x: L + 150, y: y2 - 52, size: 7, font: fB, color: K });
    page2.drawText(`R$ ${fmtMoeda(ic.vCBS)}`, { x: L + 205, y: y2 - 52, size: 7, font: fN, color: K });

    page2.drawText('Total IBS Apurado: ', { x: L + 290, y: y2 - 52, size: 7, font: fB, color: K });
    page2.drawText(`R$ ${fmtMoeda(ic.vIBSTot)}`, { x: L + 375, y: y2 - 52, size: 7, font: fN, color: K });

    const cobTxt = `VALOR TOTAL COBRADO = R$ ${fmtMoeda(ic.vTotNF)}`;
    page2.drawText(cobTxt, { x: L + (W - fB.widthOfTextAtSize(cobTxt, 9)) / 2, y: y2 - 68, size: 9, font: fB, color: K });
    y2 -= icTabH;

    // Rodapé da Página 2
    const r2Txt = `Página 2 de 2`;
    page2.drawText(r2Txt, { x: R - fN.widthOfTextAtSize(r2Txt, 6.5), y: 12, size: 6.5, font: fN, color: rgb(0.3, 0.3, 0.3) });

    if (data.isCancelada) {
      page2.drawText('CANCELADA', {
        x: 80,
        y: 260,
        size: 78,
        font: fB,
        color: rgb(0.85, 0.2, 0.2),
        opacity: 0.28,
        rotate: degrees(45)
      });
    }
  }

  return await pdf.save();
}

module.exports = {
  parseXmlSP,
  gerarDanfseSpPdf,
  SERVICOS_SP,
  obterDetalhesServicoSP,
  obterPorCodigoNacional
};
