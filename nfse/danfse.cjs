// Baixar NFSe - Geração do DANFSe (Documento Auxiliar da NFS-e) em PDF.
// Segue a Nota Técnica nº 008 (SE/CGNFS-e), gerando o DANFSe a partir do XML
// da NFS-e (a API oficial de geração será desligada em 01/07/2026).
//
// Estrutura: parseDanfse(xml) -> objeto de dados; buildDanfsePdf(data, deps) ->
// Uint8Array (PDF). deps = { PDFLib, qrcode, logoBytes }. O parser usa DOMParser
// (navegador); o layout é puro pdf-lib (testável no Node).
//
// Layout espelhado no DANFSe v1.0 oficial (portal nacional): títulos de Emitente/
// Tomador "na 1ª célula", rótulos em negrito caixa-normal, "-" em campos vazios,
// Tributação Municipal completa, Totais Aproximados (Lei 12.741) e NBS nas Infos.
'use strict';

(function (root) {
  try {
    if (typeof require === 'function') {
      require('./ibge-municipios.cjs');
    }
  } catch (_) {}

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

  function parseDanfse(xmlString) {
    let ParserClass;
    try {
      ParserClass = (typeof globalThis !== 'undefined' && globalThis.DOMParser) ? globalThis.DOMParser : require('@xmldom/xmldom').DOMParser;
    } catch (_) {
      ParserClass = require('@xmldom/xmldom').DOMParser;
    }
    const doc = new ParserClass().parseFromString(xmlString, 'text/xml');
    if (doc.querySelector && doc.querySelector('parsererror')) return null;
    const NFSe = doc.documentElement;
    // Busca por localName (à prova de namespace) — compatível com browser DOM e xmldom (Node.js)
    const child = (el, name) => {
      if (!el) return null;
      if (el.firstElementChild !== undefined) {
        for (let c = el.firstElementChild; c; c = c.nextElementSibling) {
          if (c.localName === name || c.nodeName === name) return c;
        }
      } else if (el.childNodes) {
        for (let i = 0; i < el.childNodes.length; i++) {
          const c = el.childNodes[i];
          if (c.nodeType === 1 && (c.localName === name || c.nodeName === name)) return c;
        }
      }
      return null;
    };
    const txt = (el, name) => { const c = child(el, name); return c ? c.textContent.trim() : ''; };
    const deepEl = (el, name) => {
      if (!el) return null;
      const st = [el];
      while (st.length) {
        const e = st.shift();
        if (e.firstElementChild !== undefined) {
          for (let c = e.firstElementChild; c; c = c.nextElementSibling) {
            if (c.localName === name || c.nodeName === name) return c;
            st.push(c);
          }
        } else if (e.childNodes) {
          for (let i = 0; i < e.childNodes.length; i++) {
            const c = e.childNodes[i];
            if (c.nodeType === 1) {
              if (c.localName === name || c.nodeName === name) return c;
              st.push(c);
            }
          }
        }
      }
      return null;
    };
    const deep = (el, name) => { const c = deepEl(el, name); return c ? c.textContent.trim() : ''; };

    const infNFSe = child(NFSe, 'infNFSe');
    if (!infNFSe) {
      const nfeSP = (NFSe.localName === 'NFe') ? NFSe : deepEl(NFSe, 'NFe');
      if (nfeSP) {
        return parseDanfseSP(nfeSP, deep, deepEl, txt);
      }
      return null;
    }
    const emit = child(infNFSe, 'emit');
    const emitEnd = child(emit, 'enderNac') || child(emit, 'enderExt');
    const valNFSe = child(infNFSe, 'valores');
    const DPS = child(infNFSe, 'DPS');
    const infDPS = child(DPS, 'infDPS');
    const prest = child(infDPS, 'prest');
    const regTrib = child(prest, 'regTrib');
    const toma = child(infDPS, 'toma');
    const tomaEnd = child(toma, 'end');
    const tomaEndNac = tomaEnd ? (child(tomaEnd, 'endNac') || child(tomaEnd, 'endExt')) : null;
    const interm = child(infDPS, 'interm') || child(infDPS, 'intermediario');
    const intermEnd = child(interm, 'end');
    const intermEndNac = intermEnd ? (child(intermEnd, 'endNac') || child(intermEnd, 'endExt')) : null;
    const ibsCbsDPS = child(infDPS, 'IBSCBS');        // v2.0: bloco IBS/CBS sob infDPS (alíquotas/indicadores)
    const ibsCbsNFSe = child(infNFSe, 'IBSCBS');      // bloco IBS/CBS sob infNFSe (totais apurados / totCIBS)
    const dest = child(ibsCbsDPS, 'dest');            // DESTINATÁRIO DA OPERAÇÃO (IBSCBS/dest)
    const destEnd = child(dest, 'end');
    const destEndNac = destEnd ? (child(destEnd, 'endNac') || child(destEnd, 'endExt')) : null;
    const serv = child(infDPS, 'serv');
    const cServ = child(serv, 'cServ');
    const locPrest = child(serv, 'locPrest');  // local da prestação (cLocPrestacao/cPaisPrestacao)
    const valDPS = child(infDPS, 'valores');
    const trib = child(valDPS, 'trib');
    const tribMun = child(trib, 'tribMun');
    const tribFed = child(trib, 'tribFed');
    const totTrib = child(trib, 'totTrib');
    const ibscbs = child(trib, 'tribIBSCBS') || child(infDPS, 'IBSCBS');

    // Endereço concatenado (logradouro, nº, compl, bairro)
    const endStr = (lgrEl) => {
      if (!lgrEl) return '';
      const p = [txt(lgrEl, 'xLgr'), txt(lgrEl, 'nro'), txt(lgrEl, 'xCpl'), txt(lgrEl, 'xBairro')]
        .map(s => (s || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return p.join(', ');
    };
    // Para o tomador o logradouro fica no <end> (não no endNac)
    const endTomaStr = () => {
      if (!tomaEnd) return '';
      const p = [txt(tomaEnd, 'xLgr'), txt(tomaEnd, 'nro'), txt(tomaEnd, 'xCpl'), txt(tomaEnd, 'xBairro')]
        .map(s => (s || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return p.join(', ');
    };

    const idAttr = infNFSe.getAttribute('Id') || '';
    const chave = idAttr.replace(/^NFS/, '').replace(/\D/g, '');

    const opSimp = txt(regTrib, 'opSimpNac'); // 1=Não optante, 2=MEI, 3=ME/EPP
    const opSimpLabel = {
      '1': 'Não Optante',
      '2': 'Optante - Microempreendedor Individual (MEI)',
      '3': 'Optante - Microempresa ou Empresa de Pequeno Porte (ME/EPP)'
    }[opSimp] || '';
    const cStat = txt(infNFSe, 'cStat');
    const xMotivo = txt(infNFSe, 'xMotivo') || deep(NFSe, 'xJust') || deep(NFSe, 'xMotivo');
    const isXmlCanc = (
      (xMotivo && (xMotivo.toLowerCase().includes('cancelamento') || xMotivo.toLowerCase().includes('cancelada'))) ||
      deep(NFSe, 'infPedCanc') !== '' || 
      deep(NFSe, 'cancNFSe') !== ''
    );
    let situacaoLabel = 'NFS-e Gerada';
    if (isXmlCanc) {
      situacaoLabel = 'NFS-e Cancelada';
    } else if (cStat === '101') {
      situacaoLabel = 'NFS-e de Substituição Gerada';
    } else if (cStat === '100') {
      situacaoLabel = 'NFS-e Gerada';
    } else if (cStat === '107') {
      situacaoLabel = 'NFS-e do MEI Gerada';
    } else if (cStat === '102') {
      situacaoLabel = 'NFS-e de Decisão Judicial Gerada';
    } else if (cStat) {
      situacaoLabel = cStat;
    }

    // Município "Nome / UF" (spec v2.0: concatenar nome do município com a UF, Ex.: "Município / UF")
    const munUFStr = (code, ufFb, nomeFb) => {
      const nome = munNome(code) || nomeFb || '';
      const uf = munUF(code, ufFb);
      return [nome, uf].filter(Boolean).join(' / ');
    };
    // Pessoa v2.0 (Tomador/Destinatário/Intermediário): identidade + endereço. `el` = toma/dest/interm;
    // `end` = elemento <end>; `endNac` = endNac/endExt (onde ficam cMun/UF/CEP).
    const pessoa = (el, end, endNac) => el ? {
      cnpjCpf: txt(el, 'CNPJ') || txt(el, 'CPF') || txt(el, 'NIF'),
      im: txt(el, 'IM'),
      fone: txt(el, 'fone'),
      nome: txt(el, 'xNome'),
      cMun: txt(endNac, 'cMun'),
      municipioUF: munUFStr(txt(endNac, 'cMun'), txt(endNac, 'UF'), txt(endNac, 'xMun')),
      cep: txt(endNac, 'CEP') || txt(endNac, 'cEndPost'),
      endereco: endStr(end),
      email: txt(el, 'email'),
    } : null;

    // Inventário das tags COM VALOR nesta nota — usado pela auditoria pra resolver o fallback
    // (`a|b`) numa única tag (a que existe no XML). `pairs` = TODOS os pares "ancestral>folha"
    // (não só o pai imediato → casa tanto leitura direta quanto busca profunda, e o "ancestral
    // real" desambigua CNPJ/CPF/NIF que repetem em emit/toma); `leaves` = nomes de folha soltos
    // (pra candidatas sem pai, ex.: vPis|vRetPIS).
    const _tagPairs = new Set(), _tagLeaves = new Set();
    {
      const all = NFSe.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const e = all[i];
        if (e.children && e.children.length === 0 && e.textContent && e.textContent.trim()) {
          _tagLeaves.add(e.localName);
          for (let a = e.parentNode; a && a.localName; a = a.parentNode) _tagPairs.add(a.localName + '>' + e.localName);
        }
      }
    }

    const _vServTot = txt(valNFSe, 'vServ') || deep(valDPS, 'vServ');
    let _vDescCond = txt(valNFSe, 'vDescCond') || deep(valDPS, 'vDescCond') || deep(NFSe, 'vDescCond');
    let _vDescIncond = txt(valNFSe, 'vDescIncond') || deep(valDPS, 'vDescIncond') || deep(NFSe, 'vDescIncond');
    const _vLiqTot = txt(valNFSe, 'vLiq') || deep(valDPS, 'vLiq');
    let _totalRetTot = txt(valNFSe, 'vTotalRet') || deep(valDPS, 'vTotalRet');

    const _tpRetISS = txt(tribMun, 'tpRetISSQN');
    const _issRetBool = (_tpRetISS === '2' || _tpRetISS === '3');
    const _vISSNum = parseFloat(txt(valNFSe, 'vISSQN') || deep(valDPS, 'vISSQN') || '0') || 0;
    const _vISSRetNum = parseFloat(txt(valNFSe, 'vISSQNRet') || '0') || (_issRetBool ? _vISSNum : 0);
    const _vIrNum = parseFloat(deep(valDPS, 'vRetIRRF') || '0') || 0;
    const _vCpNum = parseFloat(deep(valDPS, 'vRetCP') || '0') || 0;
    const _vCsllNum = parseFloat(deep(valDPS, 'vRetCSLL') || '0') || 0;
    const _tpRetPC = deep(tribFed, 'tpRetPisCofins');
    const _pcRetBool = !!_tpRetPC && _tpRetPC !== '0' && _tpRetPC !== '2';
    const _vPisRetNum = _pcRetBool ? (parseFloat(deep(valDPS, 'vPis') || '0') || 0) : 0;
    const _vCofinsRetNum = _pcRetBool ? (parseFloat(deep(valDPS, 'vCofins') || '0') || 0) : 0;
    const _calcRetNum = _vISSRetNum + _vIrNum + _vCpNum + _vCsllNum + _vPisRetNum + _vCofinsRetNum;
    const _retNumXml = parseFloat(_totalRetTot || '0') || 0;
    const _temImpostoRetido = _issRetBool || _calcRetNum > 0 || _retNumXml > 0;

    const _vServNum = parseFloat(_vServTot || '0') || 0;
    const _vLiqNum = parseFloat(_vLiqTot || '0') || 0;
    if (_vServNum > _vLiqNum && (_vServNum - _vLiqNum) >= 0.01) {
      const _explicitDesc = (parseFloat(_vDescCond || '0') || 0) + (parseFloat(_vDescIncond || '0') || 0);
      const _retEff = Math.max(0, _vServNum - _vLiqNum - _explicitDesc);
      if (_temImpostoRetido) {
        if (_retNumXml === 0 && (_retEff >= 0.01 || _calcRetNum >= 0.01)) {
          _totalRetTot = (_retEff >= 0.01 ? _retEff : _calcRetNum).toFixed(2);
        }
      } else if (!_vDescCond && !_vDescIncond) {
        _vDescIncond = (_vServNum - _vLiqNum).toFixed(2);
      }
    }

    const _rawFin = txt(infDPS, 'finNFSe') || deep(ibsCbsDPS, 'finNFSe');
    const _finalidade = { '1': 'NFS-e de Crédito', '2': 'NFS-e de Débito' }[_rawFin] || ((_rawFin && _rawFin !== '0') ? _rawFin : '');
    const _rawXDesc = txt(cServ, 'xDescServ');
    const _xDescServ = sanitizarDiscriminacao(_rawXDesc);
    const _rawXInfComp = deep(serv, 'xInfComp');
    const _cleanRawInf = _rawXInfComp ? _rawXInfComp.trim() : '';
    const _xInfComp = (_cleanRawInf && !_xDescServ.toLowerCase().includes(_cleanRawInf.toLowerCase()) && !_cleanRawInf.toLowerCase().includes(_xDescServ.toLowerCase())) ? _rawXInfComp : '';
    const _cMunEmit = txt(emitEnd, 'cMun') || txt(infDPS, 'cLocEmi');
    const _cLocPrest = txt(locPrest, 'cLocPrestacao') || txt(infNFSe, 'cLocIncid') || _cMunEmit;
    const _cLocIncid = txt(infNFSe, 'cLocIncid') || _cLocPrest;

    return {
      chave,
      _tagInfo: { pairs: _tagPairs, leaves: _tagLeaves },
      // Cabeçalho
      municipioEmit: txt(infNFSe, 'xLocEmi') || munNome(_cMunEmit),
      ufEmit: munUF(_cMunEmit, txt(emitEnd, 'UF')),
      ambGer: txt(infNFSe, 'ambGer'),       // 1=Sistema Próprio do Município, 2=Sefin Nacional NFS-e
      tpAmb: txt(infDPS, 'tpAmb'),           // 1=Produção, 2=Homologação
      // Dados da NFS-e
      nNFSe: txt(infNFSe, 'nNFSe'),
      competencia: txt(infDPS, 'dCompet'),
      dhEmiNFSe: txt(infNFSe, 'dhProc'),
      nDPS: txt(infDPS, 'nDPS'),
      serieDPS: txt(infDPS, 'serie'),
      dhEmiDPS: txt(infDPS, 'dhEmi'),
      emitenteNome: txt(emit, 'xNome'),
      tpEmit: txt(infDPS, 'tpEmit'),   // 1=Prestador, 2=Tomador, 3=Intermediário (campo "EMITENTE DA NFS-e")
      situacao: situacaoLabel,
      cStat,
      // Marca d'água (NT-008): 'CANCELADA' / 'SUBSTITUÍDA' / '' (regular).
      marcaDagua: isXmlCanc ? 'CANCELADA' : '',
      finalidade: _finalidade,
      // Prestador (identidade no emit; regime no DPS/prest)
      prest: {
        cnpjCpf: txt(emit, 'CNPJ') || txt(emit, 'CPF') || txt(emit, 'NIF') || txt(prest, 'CNPJ') || txt(prest, 'CPF'),
        im: txt(emit, 'IM') || txt(prest, 'IM'),
        fone: txt(emit, 'fone') || txt(prest, 'fone'),
        nome: txt(emit, 'xNome'),
        cMun: _cMunEmit,
        municipioUF: munUFStr(_cMunEmit, txt(emitEnd, 'UF'), txt(infNFSe, 'xLocEmi')),
        cep: txt(emitEnd, 'CEP') || txt(emitEnd, 'cEndPost'),
        endereco: endStr(emitEnd),
        email: txt(emit, 'email') || txt(prest, 'email'),
        simples: opSimpLabel,
        regApSN: txt(regTrib, 'regApTribSN'),
      },
      // Tomador
      toma: {
        cnpjCpf: txt(toma, 'CNPJ') || txt(toma, 'CPF') || txt(toma, 'NIF'),
        im: txt(toma, 'IM'),
        fone: txt(toma, 'fone'),
        nome: txt(toma, 'xNome'),
        cMun: txt(tomaEndNac, 'cMun'),
        municipioUF: munUFStr(txt(tomaEndNac, 'cMun'), txt(tomaEndNac, 'UF'), txt(tomaEndNac, 'xMun')),
        cep: txt(tomaEndNac, 'CEP') || txt(tomaEndNac, 'cEndPost'),
        endereco: endTomaStr(),
        email: txt(toma, 'email'),
      },
      // Intermediário e Destinatário (v2.0) — mesma estrutura de pessoa do Tomador
      interm: pessoa(interm, intermEnd, intermEndNac),
      dest: pessoa(dest, destEnd, destEndNac),
      // Serviço
      serv: {
        cTribNac: txt(cServ, 'cTribNac'),
        xTribNac: txt(infNFSe, 'xTribNac'),
        cTribMun: txt(cServ, 'cTribMun'),
        xTribMun: txt(cServ, 'xTribMun') || txt(infNFSe, 'xTribMun'),                    // descrição municipal (v2.0)
        cNBS: txt(cServ, 'cNBS'),
        xNBS: txt(infNFSe, 'xNBS'),
        localPrest: txt(infNFSe, 'xLocPrestacao') || munNome(_cLocPrest),
        ufLocPrest: munUF(_cLocPrest, txt(locPrest, 'UF')),  // UF do local (Tabela IBGE)
        paisPrest: txt(locPrest, 'cPaisPrestacao'),          // país (código ISO 2 dígitos, ex.: BR)
        xInfComp: _xInfComp,                                 // informações complementares (texto livre)
        xDescServ: _xDescServ,
      },
      // Tributação Municipal (ISSQN) — completa
      issqn: {
        tipoTrib: txt(tribMun, 'tribISSQN'),                 // 1=Operação tributável...
        paisResult: deep(tribMun, 'cPaisResult'),
        municipioIncid: txt(infNFSe, 'xLocIncid') || munNome(_cLocIncid),
        ufIncid: munUF(_cLocIncid),                          // UF de incidência (Tabela IBGE, via cLocIncid)
        regimeEsp: txt(tribMun, 'tpRegEsp') || txt(regTrib, 'regEspTrib'),
        tipoImunidade: txt(tribMun, 'tpImunidade'),
        suspensao: deep(tribMun, 'tpSusp'),                  // 0/ausente=Não
        nProcSusp: deep(tribMun, 'nProcesso'),
        beneficioMun: deep(tribMun, 'cBenef') || deep(tribMun, 'tBM'),
        deducoes: deep(tribMun, 'vDeducao') || deep(tribMun, 'vRedBCBM'),
        calcBM: deep(tribMun, 'pRedBCBM') || deep(tribMun, 'pAliqAplicBM'),
        descIncond: _vDescIncond,
        bc: txt(valNFSe, 'vBC'),
        aliq: txt(valNFSe, 'pAliqAplic') || txt(tribMun, 'pAliq'),
        retencao: txt(tribMun, 'tpRetISSQN'),                // 1=Não,2=Tomador,3=Interm.
        apurado: txt(valNFSe, 'vISSQN'),
      },
      // Tributação Federal (busca ampla no valores p/ não perder retenções)
      federal: {
        // Seção "Tributação Federal" = RETENÇÕES (IRRF/CP/CSLL retidos) + PIS/COFINS de débito
        // PRÓPRIO. Cada campo = UMA tag (o rótulo já diz "Retida"/"Própria"); sem fallback.
        irrf: deep(valDPS, 'vRetIRRF'),
        cp: deep(valDPS, 'vRetCP'),
        csll: deep(valDPS, 'vRetCSLL'),
        // "Descrição Contrib. Sociais - Retidas" = Tipo de Retenção PIS/COFINS e CSLL (código → descrição)
        tpRetPisCofins: deep(tribFed, 'tpRetPisCofins'),
        pis: deep(valDPS, 'vPis'),
        cofins: deep(valDPS, 'vCofins'),
      },
      // IBS/CBS (reforma tributária) — alíquotas/indicadores em infDPS/IBSCBS; totais apurados em
      // infNFSe/IBSCBS/totCIBS. Ausente nas notas atuais (v1.01) → tudo vazio. Busca profunda (deep)
      // porque o aninhamento é complexo (valores/uf|mun|fed, totCIBS/gIBS|gCBS).
      ibscbs: {
        cst: deep(ibsCbsDPS, 'CST'),
        cClassTrib: deep(ibsCbsDPS, 'cClassTrib'),
        cIndOp: deep(ibsCbsDPS, 'cIndOp'),
        cLocIncid: deep(ibsCbsDPS, 'cLocalidadeIncid'),
        xLocIncid: deep(ibsCbsDPS, 'xLocalidadeIncid'),
        ufIncid: munUF(deep(ibsCbsDPS, 'cLocalidadeIncid')),
        vBC: deep(ibsCbsDPS, 'vBC'),
        pRedAliqUF: deep(ibsCbsDPS, 'pRedAliqUF'),
        pRedAliqMun: deep(ibsCbsDPS, 'pRedAliqMun'),
        pRedAliqCBS: deep(ibsCbsDPS, 'pRedAliqCBS'),
        pIBSUF: deep(ibsCbsDPS, 'pIBSUF'),
        pIBSMun: deep(ibsCbsDPS, 'pIBSMun'),
        pAliqEfetMun: deep(ibsCbsDPS, 'pAliqEfetMun'),
        pAliqEfetUF: deep(ibsCbsDPS, 'pAliqEfetUF'),
        pCBS: deep(ibsCbsDPS, 'pCBS'),
        pAliqEfetCBS: deep(ibsCbsDPS, 'pAliqEfetCBS'),
        vIBSMun: deep(ibsCbsNFSe, 'vIBSMun'),
        vIBSUF: deep(ibsCbsNFSe, 'vIBSUF'),
        vIBSTot: deep(ibsCbsNFSe, 'vIBSTot'),
        vCBS: deep(ibsCbsNFSe, 'vCBS'),
        vTotNF: deep(ibsCbsNFSe, 'vTotNF'),
      },
      // Totais
      totais: {
        vServ: _vServTot,
        descCond: _vDescCond,
        descIncond: _vDescIncond,
        issqnRetido: txt(valNFSe, 'vISSQNRet'),
        totRetFed: txt(valNFSe, 'vTotalRetFed'),
        pisCofinsProprio: deep(tribFed, 'vPisCofins'),
        totalRet: _totalRetTot,
        vLiq: _vLiqTot,
      },
      // Totais aproximados dos tributos (Lei 12.741) — 3 formas: VALOR (vTotTrib), PERCENTUAL
      // (pTotTrib) ou Simples Nacional (pTotTribSN). A nota usa só UMA delas.
      totaisAprox: {
        fed: deep(totTrib, 'vTotTribFed'),
        est: deep(totTrib, 'vTotTribEst'),
        mun: deep(totTrib, 'vTotTribMun'),
        pFed: deep(totTrib, 'pTotTribFed'),  // forma percentual
        pEst: deep(totTrib, 'pTotTribEst'),
        pMun: deep(totTrib, 'pTotTribMun'),
        pSN: deep(valDPS, 'pTotTribSN'),
      },
      // Campos das Informações Complementares (v2.0) — raros, aparecem só quando existem.
      infoCompl: {
        chSubstda: deep(infDPS, 'chSubstda'),       // NFS-e substituída (subst)
        docRef: deep(serv, 'docRef'),               // documento de referência
        cObra: deep(serv, 'cObra'),                 // código da obra (CNO)
        inscImobFisc: deep(ibsCbsDPS, 'inscImobFisc'), // inscrição imobiliária fiscal (IBSCBS/imovel)
        idAtvEvt: deep(serv, 'idAtvEvt'),           // atividade de evento
        idDocTec: deep(serv, 'idDocTec'),           // documento técnico
        xPed: deep(serv, 'xPed'),                   // número do pedido
        xItemPed: deep(serv, 'xItemPed'),           // item do pedido (1º; gItemPed pode repetir)
        xOutInf: txt(infNFSe, 'xOutInf'),           // outras informações (gerado pelo fisco)
      },
    };
  }

  // ───────────────────────── Parser PMSP (São Paulo) ─────────────────────────
  function parseDanfseSP(nfe, deep, deepEl, txt) {
    const isXmlCanc = (deep(nfe, 'StatusNFe') === 'C' || deep(nfe, 'DataCancelamento') !== '');
    const chave = deep(nfe, 'ChaveNotaNacional') || deep(nfe, 'CodigoVerificacao') || deep(nfe, 'NumeroNFe');
    const endPrest = deepEl(nfe, 'EnderecoPrestador');
    const endToma = deepEl(nfe, 'EnderecoTomador');

    const endStrSP = (end) => {
      if (!end) return '';
      const p = [txt(end, 'TipoLogradouro'), txt(end, 'Logradouro'), txt(end, 'NumeroEndereco'), txt(end, 'ComplementoEndereco'), txt(end, 'Bairro')].filter(Boolean);
      return p.join(' ');
    };

    const munUFStrSP = (end, def) => {
      if (!end) return def || 'São Paulo / SP';
      const cid = txt(end, 'Cidade') || 'São Paulo';
      const uf = txt(end, 'UF') || 'SP';
      return [cid, uf].filter(Boolean).join(' / ');
    };

    const prestCnpj = deep(deepEl(nfe, 'CPFCNPJPrestador'), 'CNPJ') || deep(deepEl(nfe, 'CPFCNPJPrestador'), 'CPF') || deep(nfe, 'CNPJPrestador') || deep(nfe, 'CPFPrestador');
    const tomaCnpj = deep(deepEl(nfe, 'CPFCNPJTomador'), 'CNPJ') || deep(deepEl(nfe, 'CPFCNPJTomador'), 'CPF') || deep(nfe, 'CNPJTomador') || deep(nfe, 'CPFTomador');

    const vServ = deep(nfe, 'ValorServicos') || deep(nfe, 'ValorTotalRecebido') || '0.00';
    const vLiq = deep(nfe, 'ValorLiquidoNFe') || deep(nfe, 'ValorTotalRecebido') || vServ;
    const aliqVal = deep(nfe, 'AliquotaServicos');
    let aliqStr = aliqVal;
    if (aliqVal && !isNaN(parseFloat(aliqVal)) && parseFloat(aliqVal) < 1 && parseFloat(aliqVal) > 0) {
      aliqStr = (parseFloat(aliqVal) * 100).toFixed(2);
    }

    return {
      chave,
      _tagInfo: { pairs: new Set(), leaves: new Set() },
      municipioEmit: 'São Paulo',
      ufEmit: 'SP',
      ambGer: '1',
      tpAmb: '1',
      nNFSe: deep(nfe, 'NumeroNFe'),
      competencia: deep(nfe, 'DataEmissaoNFe') || deep(nfe, 'DataFatoGeradorNFe'),
      dhEmiNFSe: deep(nfe, 'DataEmissaoNFe'),
      nDPS: deep(nfe, 'NumeroRPS') || '-',
      serieDPS: deep(nfe, 'SerieRPS') || '-',
      dhEmiDPS: deep(nfe, 'DataEmissaoRPS') || '-',
      emitenteNome: deep(nfe, 'RazaoSocialPrestador'),
      tpEmit: '1',
      situacao: isXmlCanc ? 'NFS-e Cancelada' : 'NFS-e regular (Autorizada)',
      cStat: isXmlCanc ? '101' : '100',
      marcaDagua: isXmlCanc ? 'CANCELADA' : '',
      finalidade: 'NFS-e',
      prest: {
        cnpjCpf: prestCnpj,
        im: deep(nfe, 'InscricaoPrestador'),
        fone: '',
        nome: deep(nfe, 'RazaoSocialPrestador'),
        cMun: '3550308',
        municipioUF: munUFStrSP(endPrest, 'São Paulo / SP'),
        cep: txt(endPrest, 'CEP'),
        endereco: endStrSP(endPrest),
        email: deep(nfe, 'EmailPrestador'),
        simples: (deep(nfe, 'OpcaoSimples') === 'true' || deep(nfe, 'OpcaoSimples') === '1') ? 'Optante - Simples Nacional' : 'Não Optante',
        regApSN: '',
      },
      toma: {
        cnpjCpf: tomaCnpj,
        im: deep(nfe, 'InscricaoTomador'),
        fone: '',
        nome: deep(nfe, 'RazaoSocialTomador'),
        cMun: '',
        municipioUF: munUFStrSP(endToma, ''),
        cep: txt(endToma, 'CEP'),
        endereco: endStrSP(endToma),
        email: deep(nfe, 'EmailTomador'),
      },
      interm: null,
      dest: null,
      serv: {
        locPrestacao: munUFStrSP(endPrest, 'São Paulo / SP'),
        paisPrestacao: 'Brasil',
        cTribMun: deep(nfe, 'CodigoServico'),
        cTribNac: '-',
        cNBS: deep(nfe, 'NBS') || deep(nfe, 'cNBS') || '-',
        cLC116: '-',
        desc: sanitizarDiscriminacao(deep(nfe, 'Discriminacao')),
      },
      issqn: {
        tipoTrib: deep(nfe, 'TributacaoNFe') || 'T',
        paisResult: '',
        municipioIncid: 'São Paulo',
        ufIncid: 'SP',
        regimeEsp: '',
        tipoImunidade: '',
        suspensao: '',
        nProcSusp: '',
        beneficioMun: '',
        deducoes: deep(nfe, 'ValorDeducoes'),
        calcBM: '',
        descIncond: '',
        bc: deep(nfe, 'BaseCalculo') || vServ,
        aliq: aliqStr,
        retencao: (deep(nfe, 'ISSRetido') === 'true' || deep(nfe, 'ISSRetido') === 'S' || deep(nfe, 'ISSRetido') === '1') ? '2' : '1',
        apurado: deep(nfe, 'ValorISS'),
      },
      federal: {
        irrf: deep(nfe, 'ValorIR') || deep(nfe, 'ValorIRRF') || deep(nfe, 'IRRF'),
        cp: deep(nfe, 'ValorINSS') || deep(nfe, 'ValorPrevidencia') || deep(nfe, 'INSS'),
        csll: deep(nfe, 'ValorCSLL') || deep(nfe, 'CSLL'),
        tpRetPisCofins: '',
        pis: deep(nfe, 'ValorPIS') || deep(nfe, 'PIS'),
        cofins: deep(nfe, 'ValorCOFINS') || deep(nfe, 'COFINS'),
      },
      ibscbs: (deep(nfe, 'CST') || deep(nfe, 'ValorIBS') || deep(nfe, 'ValorCBS')) ? {
        cst: deep(nfe, 'CST'),
        cClassTrib: deep(nfe, 'ClassificacaoTributaria') || '',
        cIndOp: deep(nfe, 'cIndOp') || deep(nfe, 'CodigoIndicadorOperacao'),
        cLocIncid: '',
        xLocIncid: '',
        ufIncid: '',
        vBC: deep(nfe, 'BaseCalculoIBS') || vServ,
        pRedAliqUF: '',
        pRedAliqMun: '',
        pRedAliqCBS: '',
        pIBSUF: deep(nfe, 'ValorAliqEstadualIBS') || deep(nfe, 'AliqEstadualIBS'),
        pIBSMun: deep(nfe, 'ValorAliqMunicipalIBS') || deep(nfe, 'AliqMunicipalIBS'),
        pAliqEfetMun: '',
        pAliqEfetUF: '',
        pCBS: deep(nfe, 'ValorAliqCBS') || deep(nfe, 'AliqCBS'),
        pAliqEfetCBS: '',
        vIBSMun: deep(nfe, 'ValorMunicipalIBS') || deep(nfe, 'ValorIBSMun'),
        vIBSUF: deep(nfe, 'ValorEstadualIBS') || deep(nfe, 'ValorIBSUF'),
        vIBSTot: deep(nfe, 'ValorIBS'),
        vCBS: deep(nfe, 'ValorCBS'),
        vTotNF: deep(nfe, 'ValorTotalCobrado') || vServ,
      } : null,
      totais: {
        vServ: vServ,
        descCond: '',
        descIncond: deep(nfe, 'ValorDeducoes'),
        issqnRetido: (deep(nfe, 'ISSRetido') === 'true' || deep(nfe, 'ISSRetido') === 'S' || deep(nfe, 'ISSRetido') === '1') ? deep(nfe, 'ValorISS') : '',
        totRetFed: '',
        pisCofinsProprio: '',
        totalRet: deep(nfe, 'ValorISSRetido') || '',
        vLiq: vLiq,
      },
      totaisAprox: {
        fed: '',
        est: '',
        mun: '',
        pFed: '',
        pEst: '',
        pMun: '',
        pSN: '',
      },
      infoCompl: {
        chSubstda: '',
        docRef: '',
        cObra: '',
        inscImobFisc: '',
        idAtvEvt: '',
        idDocTec: '',
        xPed: '',
        xItemPed: '',
        xOutInf: (deep(nfe, 'OutrasInformacoes') && !deep(nfe, 'Discriminacao').toLowerCase().includes(deep(nfe, 'OutrasInformacoes').trim().toLowerCase())) ? deep(nfe, 'OutrasInformacoes') : '',
      }
    };
  }

  // ───────────────────────── Parser de Evento ─────────────────────────
  // Lê um XML de evento da NFS-e (cancelamento / substituição / manifestação) e devolve
  // { chave (da nota afetada), tpEvento, xDesc, motivo, autor, dhEvento, marcaDagua }.
  // Estrutura: <evento><infEvento><pedRegEvento><infPedReg><chNFSe/><e101101>…</e101101>
  function parseEvento(xmlString) {
    const doc = new DOMParser().parseFromString(xmlString, 'text/xml');
    if (doc.querySelector('parsererror')) return null;
    const deepEl = (el, name) => {
      if (!el) return null;
      const st = [el];
      while (st.length) { const e = st.shift(); for (let c = e.firstElementChild; c; c = c.nextElementSibling) { if (c.localName === name) return c; st.push(c); } }
      return null;
    };
    const deep = (el, name) => { const c = deepEl(el, name); return c ? c.textContent.trim() : ''; };
    const root = doc.documentElement;
    const infPedReg = deepEl(root, 'infPedReg');
    if (!infPedReg) return null;
    const chave = (deep(infPedReg, 'chNFSe') || '').replace(/\D/g, '');
    if (!chave) return null;
    const autor = deep(infPedReg, 'CNPJAutor') || deep(infPedReg, 'CPFAutor');
    const dhEvento = deep(infPedReg, 'dhEvento') || deep(root, 'dhProc');
    // Elemento do tipo de evento: filho de infPedReg com nome /^e\d{4,}$/ (ex.: e101101).
    let tipoEl = null;
    for (let c = infPedReg.firstElementChild; c; c = c.nextElementSibling) {
      if (/^e\d{4,}$/.test(c.localName)) { tipoEl = c; break; }
    }
    const tpEvento = tipoEl ? tipoEl.localName.slice(1) : '';
    const xDesc = tipoEl ? deep(tipoEl, 'xDesc') : '';
    const motivo = tipoEl ? deep(tipoEl, 'xMotivo') : '';
    // Marca d'água (NT-008): substituída prevalece; senão cancelamento. Outros eventos = ''.
    let marcaDagua = '';
    if (/substitu/i.test(xDesc) || tpEvento === '105102') marcaDagua = 'SUBSTITUÍDA';
    else if (/cancel/i.test(xDesc) || tpEvento === '101101') marcaDagua = 'CANCELADA';
    return { chave, tpEvento, xDesc, motivo, autor, dhEvento, marcaDagua };
  }

  // ───────────────────────── Layout (pdf-lib) ─────────────────────────
  async function buildDanfsePdf(data, deps) {
    const { PDFLib, qrcode, logoBytes } = deps;
    const audit = !!deps.auditoria; // modo conferência: imprime a tag XML (vermelho) em cada campo
    const _vServNum = parseFloat((data.totais || {}).vServ || '0') || 0;
    const _vLiqNum = parseFloat((data.totais || {}).vLiq || '0') || 0;
    const _hasNetDiff = (_vServNum > 0 && _vLiqNum > 0) ? ((_vServNum - _vLiqNum) >= 0.01) : true;
    const hlRet = !!deps.destacarRet && _hasNetDiff; // destaca os campos de RETENÇÃO apenas se houver redução real no valor líquido
    // Só destaca quando HÁ retenção (valor retido > 0 ou indicador "retido") — campo vazio não pinta.
    const temVal = (v) => parseFloat(v) > 0;
    const issRetido = ['2', '3'].includes((data.issqn || {}).retencao);   // 2=Tomador, 3=Intermediário
    const tpPC = (data.federal || {}).tpRetPisCofins;
    const pisCofRetido = !!tpPC && tpPC !== '0' && tpPC !== '2';           // 0/2 = não retido
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const A4W = 595.28, A4H = 841.89;
    // `page` é MUTÁVEL: no modo auditoria (linhas de 3 alturas) ou numa nota muito longa o conteúdo
    // pode estourar a folha; `novaPagina()` cria uma A4 nova e os helpers (que fecham sobre `page`)
    // passam a desenhar nela. `pages` guarda todas p/ desenhar moldura/marca/nº por página no fim.
    let page = pdf.addPage([A4W, A4H]);
    const pages = [page];
    // Fontes (norma 2.4): por padrão Arimo — clone de LICENÇA LIVRE métrica-idêntico à Arial —
    // embutido via fontkit. Conteúdo em Arimo-Regular (fN), títulos/labels em Arimo-Bold (fB).
    // Se fontkit/fontes não vierem em deps (ou falharem), cai pra Helvetica (fonte-padrão do PDF),
    // sem quebrar. NÃO usamos subset (`subset:false`): o subset do pdf-lib renderiza glifos faltando
    // em alguns visualizadores (PyMuPDF, etc.); a fonte inteira (~200KB/peso) garante o render em
    // qualquer leitor — correção > tamanho num documento fiscal.
    let fN, fB;
    if (deps.fontkit && deps.arimo && deps.arimoBold) {
      try {
        pdf.registerFontkit(deps.fontkit);
        fN = await pdf.embedFont(deps.arimo, { subset: false });
        fB = await pdf.embedFont(deps.arimoBold, { subset: false });
      } catch (_) { fN = fB = null; }
    }
    if (!fN || !fB) {
      fN = await pdf.embedFont(StandardFonts.Helvetica);
      fB = await pdf.embedFont(StandardFonts.HelveticaBold);
    }
    let logo = null;
    try { if (logoBytes) logo = await pdf.embedPng(logoBytes); } catch (_) {}

    const CM = 28.3464567;
    const cm = (v) => v * CM;
    const GRAY = rgb(0.95, 0.95, 0.95); // cinza claro 5% de densidade (norma 2.2.3)
    const YELLOW = rgb(1, 0.93, 0.45);  // destaque dos campos de retenção (checkbox "Destacar retenções")
    const K = rgb(0, 0, 0);
    const RED = rgb(0.85, 0, 0);
    const LINE = 0.5;
    // Altura padrão da linha: 2 linhas (rótulo + valor). No modo auditoria sobe pra 3 linhas
    // (rótulo + valor + tag em vermelho embaixo) — 0,88cm ainda cabe na faixa do QR (3 linhas
    // ≈ 74,9pt < 78,5 disponíveis) e sobra folga no rodapé (~288pt livres).
    const RH = audit ? cm(0.88) : cm(0.64);

    const mg = cm(0.20);          // moldura externa (margem corpo→papel: norma 2.2.2 = 0,15–0,20cm)
    const pad = cm(0.15);         // RESPIRO lateral/inferior entre a moldura e a tabela interna
    const padTop = cm(0.32);      // RESPIRO SUPERIOR (maior — estava colado no topo)
    const L = mg + pad, R = A4W - mg - pad;  // área da tabela, afastada da moldura pelo respiro
    const W = R - L;
    const contentTop = A4H - mg - padTop;
    let y = contentTop;

    // Borda externa grossa (igual ao oficial) — desenhada POR ÚLTIMO (ver fim da função), pra
    // ficar por cima das células/fundos cinza e as linhas horizontais encostarem limpas nela.

    const clip = (s, max) => { s = (s == null ? '' : String(s)); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
    // Corte por LARGURA REAL (mede a fonte) — não estoura a célula mesmo com maiúsculas largas.
    const clipW = (s, font, size, maxW) => {
      s = (s == null ? '' : String(s));
      if (font.widthOfTextAtSize(s, size) <= maxW) return s;
      while (s.length > 0 && font.widthOfTextAtSize(s + '…', size) > maxW) s = s.slice(0, -1);
      return s + '…';
    };
    // Tag de auditoria pra exibição. Resolve o fallback (`a|b`) pra UMA tag — a que existe no
    // XML desta nota (via data._tagInfo). Mantém o ` ou ` SÓ quando há divergência de layout:
    // nenhuma candidata presente (fonte sumiu / tag nova) ou mais de uma (layout ambíguo).
    // Sem "|" (tag única, composto " + ", agregação) devolve intacto. Parser antigo (sem
    // _tagInfo) degrada pro "|"→" ou " simples, sem falso-positivo.
    const fmtTag = (s) => {
      s = String(s == null ? '' : s);
      if (s.indexOf('|') < 0) return s;
      const info = data._tagInfo;
      if (!info) return s.replace(/\|/g, ' ou ');
      let lastParent = '';
      const cands = s.split('|').map(t => t.trim()).map(t => {
        if (t.indexOf('>') >= 0) { lastParent = t.slice(0, t.lastIndexOf('>')); return t; }
        return lastParent ? lastParent + '>' + t : t; // herda o pai do shorthand "emit>CNPJ|CPF|NIF"
      });
      // candidata com pai (ancestral>folha) casa por par; sem pai casa por nome de folha solto
      const has = (t) => t.indexOf('>') >= 0 ? info.pairs.has(t) : info.leaves.has(t);
      const hit = cands.filter(has);
      if (hit.length === 1) return hit[0];          // caso normal: 1 campo = 1 tag
      if (hit.length > 1) return hit.join(' ou ');  // várias presentes: anomalia → mostra as presentes
      return cands.join(' ou ');                    // nenhuma: mostra as candidatas esperadas
    };
    const D = (v) => (v == null || v === '') ? '-' : String(v); // "-" em vazios, igual ao oficial
    const pc = (v) => {
      if (v == null || v === '') return '';
      const num = parseFloat(String(v).replace(',', '.'));
      if (isNaN(num)) return String(v);
      return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
    };
    const pcs = (...vs) => {
      const formatted = vs.map(v => {
        if (v == null || v === '') return '-';
        const num = parseFloat(String(v).replace(',', '.'));
        if (isNaN(num)) return String(v);
        return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
      });
      return formatted.join(' / ');
    };
    const slash = (...vs) => vs.filter(v => v != null && v !== '').join(' / '); // concatena com " / "
    const wrap = (s, max, lines) => {
      s = (s == null ? '' : String(s)).replace(/\s+/g, ' ').trim();
      const out = []; let cur = '';
      for (const word of s.split(' ')) {
        if ((cur + ' ' + word).trim().length > max) { if (cur) out.push(cur); cur = word; }
        else cur = (cur + ' ' + word).trim();
        if (out.length >= lines) break;
      }
      if (cur && out.length < lines) out.push(cur);
      return out.slice(0, lines);
    };
    // Preserva quebras de linha (\n) e linhas em branco originais do XML (ex.: Descrição do Serviço e Infos Compl.)
    const wrapMultiline = (s, max, lines) => {
      if (s == null || s === '') return [];
      const rawLines = String(s).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
      const out = [];
      for (const rawLine of rawLines) {
        const trimmed = rawLine.replace(/[ \t]+/g, ' ').trim();
        if (!trimmed) {
          out.push('');
        } else {
          let cur = '';
          for (const word of trimmed.split(' ')) {
            if ((cur + ' ' + word).trim().length > max) {
              if (cur) out.push(cur);
              cur = word;
            } else {
              cur = (cur + ' ' + word).trim();
            }
            if (out.length >= lines) break;
          }
          if (cur && out.length < lines) out.push(cur);
        }
        if (out.length >= lines) break;
      }
      while (out.length > 0 && out[out.length - 1] === '') out.pop();
      return out.slice(0, lines);
    };

    // Célula: fundo cinza opcional + SÓ linhas horizontais (topo e base). O oficial não tem
    // divisórias verticais internas — as colunas se separam por espaço; as bordas esquerda/
    // direita do documento vêm da moldura externa grossa.
    function box(x, yTop, w, h, shaded) {
      if (shaded) page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: GRAY });
      page.drawLine({ start: { x, y: yTop }, end: { x: x + w, y: yTop }, thickness: LINE, color: K });
      page.drawLine({ start: { x, y: yTop - h }, end: { x: x + w, y: yTop - h }, thickness: LINE, color: K });
    }
    // Fundo cinza opcional de uma célula, SEM linhas (usado nos títulos de grupo).
    function fill(x, yTop, w, h, col) { page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: col || GRAY }); }
    // Separador de GRUPO: única linha horizontal (ponta a ponta L→R) no topo do grupo. As linhas
    // só aparecem ENTRE grupos (separador) + na borda da tabela; DENTRO do grupo, sem linha.
    function sep(yTop) { page.drawLine({ start: { x: L, y: yTop }, end: { x: R, y: yTop }, thickness: LINE, color: K }); }
    // Campo: rótulo (6pt negrito) em cima, valor (7pt normal) embaixo. Vazio = "-".
    // Modo auditoria (opt.tag): rótulo em cima, valor no meio e a tag XML em VERMELHO na
    // linha de baixo (linha própria — não escreve em cima do valor nem é cortada no fim).
    // Sem valor, mostra só a tag (não desenha o "-").
    function field(x, yTop, w, h, lab, val, opt) {
      opt = opt || {};
      if (opt.shaded) fill(x, yTop, w, h); // só fundo; sem linhas (dentro do grupo não tem divisória)
      if (opt.hl) fill(x, yTop, w, h, YELLOW); // destaque amarelo (campo de retenção)
      if (lab) page.drawText(clip(lab, Math.floor(w / 2.85)), { x: x + 2, y: yTop - 7, size: opt.labSize || 6, font: fB, color: K }); // labSize: rótulo maior (ex.: nome de grupo)
      const vSize = opt.valSize || 7, vFont = opt.valBold ? fB : fN;
      const rawStr = (val == null ? '' : String(val)), hasVal = rawStr !== '';
      if (audit && opt.tag) {
        if (hasVal) page.drawText(clipW(rawStr, vFont, vSize, w - 4), { x: x + 2, y: yTop - 15, size: vSize, font: vFont, color: opt.color || K });
        page.drawText(clip(fmtTag(opt.tag), Math.floor((w - 4) / 2.4)), { x: x + 2, y: yTop - h + 3, size: 5, font: fN, color: RED });
        return;
      }
      const v = opt.raw ? rawStr : D(val);
      const valY = opt.topVal ? (yTop - 15) : (yTop - h + 3);
      if (v !== '') page.drawText(clipW(v, vFont, vSize, w - 4), { x: x + 2, y: valY, size: vSize, font: vFont, color: opt.color || K });
    }
    // Linha de campos: cells = [{f: fração da largura, l, v, opt}]
    function row(yTop, h, cells, x0, totalW) {
      let x = (x0 == null ? L : x0); const tw = (totalW == null ? W : totalW);
      for (const c of cells) { const w = tw * c.f; field(x, yTop, w, h, c.l, c.v, c.opt); x += w; }
      return yTop - h;
    }
    // Título de bloco (7pt negrito caixa alta, sem fundo cinza como no modelo oficial de INFORMAÇÕES COMPLEMENTARES)
    function title(yTop, text) {
      const h = cm(0.42);
      sep(yTop);            // separador de grupo no topo
      page.drawText(text.toUpperCase(), { x: L + 2, y: yTop - h + (h - 7) / 2 + 1, size: 7, font: fB, color: K });
      return yTop - h;
    }
    // Linha que ABRE uma seção no padrão do oficial: 1ª célula = TÍTULO (cinza, 0,25 da largura,
    // texto centralizado vertical) + os primeiros campos preenchendo o resto da grade de 4 colunas.
    // `cells` são os campos após o título (até 3, p/ fechar as 4 colunas).
    // noSep=true: célula-título cinza SEM separador (2º título cinza dentro do mesmo grupo, ex.:
    // PRESTADOR/FORNECEDOR sob EMITENTE). text vai como veio (sem forçar maiúscula — preserva "NFS-e").
    function tituloRow(yTop, text, cells, noSep) {
      const h = RH, tw = W * 0.25;
      fill(L, yTop, tw, h);  // 1ª célula cinza (título), sem linhas
      if (!noSep) sep(yTop);  // separador de grupo no topo (ponta a ponta)
      page.drawText(text, { x: L + 3, y: yTop - h + (h - 7) / 2 + 1, size: 7, font: fB, color: K });
      let x = L + tw;
      for (const c of cells) { const w = W * c.f; field(x, yTop, w, h, c.l, c.v, c.opt); x += w; }
      return yTop - h;
    }
    // Quadro de texto longo (rótulo + N linhas, preservando quebras de linha do XML)
    function textbox(yTop, lab, val, maxLines, minLines, tag) {
      const showTag = audit && tag;
      const ls = wrapMultiline(val, 118, maxLines);
      const n = Math.max(minLines || 1, ls.length);
      const lineH = 9;
      // Sem rótulo, o valor começa no topo (firstY 10) — mas se há tag de auditoria, reserva
      // a linha do topo pra ela (firstY 15.5) pra não sobrepor o valor.
      const firstY = (lab || showTag) ? 15.5 : 10; // baseline da 1ª linha de valor
      const h = firstY + (n - 1) * lineH + 4;       // folga até a borda de baixo (sem estourar)
      if (lab) page.drawText(lab, { x: L + 2, y: yTop - 7, size: 6, font: fB, color: K });
      if (showTag) page.drawText(fmtTag(tag), { x: L + 2 + (lab ? fB.widthOfTextAtSize(lab, 6) + 6 : 0), y: yTop - 7, size: 5, font: fN, color: RED });
      ls.forEach((ln, i) => {
        if (ln) page.drawText(ln, { x: L + 2, y: yTop - firstY - i * lineH, size: 7, font: fN, color: K });
      });
      return yTop - h;
    }
    // Quadro das Informações Complementares no modo auditoria: UMA info por bloco — o texto
    // (preto, podendo quebrar em linhas) e a sua tag (vermelho) na linha logo abaixo. Texto
    // vazio mostra só a tag (mesma regra dos campos: a tag aparece mesmo sem valor).
    function infoboxAudit(yTop, items) {
      const lineH = 9;
      const rows = []; // { t, red }
      for (const it of items) {
        if (it.txt) wrapMultiline(it.txt, 118, 8).forEach(ln => rows.push({ t: ln, red: false }));
        rows.push({ t: fmtTag(it.tag), red: true });
      }
      if (!rows.length) rows.push({ t: '', red: false });
      const h = 10 + (rows.length - 1) * lineH + 4;
      rows.forEach((r, i) => {
        if (r.t) page.drawText(r.t, { x: L + 2, y: yTop - 10 - i * lineH, size: r.red ? 5 : 7, font: fN, color: r.red ? RED : K });
      });
      return yTop - h;
    }
    // Quadro das Informações Complementares no modo NORMAL: cada CAMPO (info) numa LINHA própria
    // (quebra de linha por campo em vez de juntar tudo com " | " — facilita a leitura). Campo
    // vazio é pulado; preserva quebras de linha de xInfComp.
    function infoboxNormal(yTop, items) {
      const lineH = 9, lines = [];
      for (const it of items) if (it.txt) wrapMultiline(it.txt, 118, 8).forEach(ln => lines.push(ln));
      if (!lines.length) lines.push('');
      const h = 10 + (lines.length - 1) * lineH + 4;
      lines.forEach((ln, i) => {
        if (ln) page.drawText(ln, { x: L + 2, y: yTop - 10 - i * lineH, size: 7, font: fN, color: K });
      });
      return yTop - h;
    }
    // Linha centralizada (ex.: "INTERMEDIÁRIO ... NÃO IDENTIFICADO")
    function linhaCentral(yTop, text, h) {
      h = h || cm(0.32);
      sep(yTop); // separador de grupo no topo
      const tw = fB.widthOfTextAtSize(text, 7);
      page.drawText(text, { x: L + (W - tw) / 2, y: yTop - h + (h - 7) / 2 + 1, size: 7, font: fB, color: K });
      return yTop - h;
    }

    // ── Quebra de página entre GRUPOS (nunca no meio de um) ──────────────────────
    // No modo normal a nota cabe numa folha (sem quebra). Em auditoria (linhas mais altas) ou
    // numa nota muito longa, o conteúdo estoura → abre-se uma nova página A4 ANTES do próximo grupo,
    // se ele não couber no que resta. Reserva-se o rodapé do canhoto no modo normal (em auditoria
    // não há canhoto). `tbH` calcula a altura de um textbox/infobox (mesma fórmula do desenho) p/
    // saber se o grupo cabe.
    const canhotoReserva = audit ? 0 : cm(1.0) + cm(0.3); // altura do canhoto + folga (só no normal)
    const yBottomLimit = mg + pad + cm(0.12) + canhotoReserva;
    function novaPagina() { page = pdf.addPage([A4W, A4H]); pages.push(page); y = contentTop; }
    function brk(need) { if (y - need < yBottomLimit) novaPagina(); } // quebra se o grupo não couber
    const tbH = (val, maxLines, minLines, labOrTag) => {
      const n = Math.max(minLines || 1, wrapMultiline(val, 118, maxLines).length);
      return (labOrTag ? 15.5 : 10) + (n - 1) * 9 + 4; // espelha textbox()
    };

    // ── Cabeçalho ──
    const qrColX = cm(15.62); // dados/cabeçalho param à esquerda do QR
    const rx = qrColX + 2;
    // Palavras pra quebra do município: "Município:" + nome, com " - UF" GRUDADO na última palavra
    const munWords = ('Município: ' + (data.municipioEmit || '')).trim().split(/\s+/);
    if (data.ufEmit) munWords[munWords.length - 1] += ' - ' + data.ufEmit;
    const ambGerTxt = data.ambGer || '';
    const tpAmbTxt = data.tpAmb || '';
    // Município quebra por LARGURA REAL da fonte (não por contagem de char) — usa toda a largura e
    // só quebra quando precisa; máx 2 linhas. O maior nome do BR ("Vila Bela da Santíssima Trindade",
    // 32 chars) PRECISA de 2 linhas — e o modelo oficial mostra exatamente isso.
    const munAvail = R - rx;
    const munWrap = (words) => {
      const out = []; let cur = '';
      for (const wd of words) {
        const test = cur ? cur + ' ' + wd : wd;
        if (!cur || fN.widthOfTextAtSize(test, 8) <= munAvail) cur = test;
        else { out.push(cur); cur = wd; }
      }
      if (cur) out.push(cur);
      return out.slice(0, 2);
    };
    const munLs = munWrap(munWords);
    // A faixa do cabeçalho CRESCE quando o município ocupa 2 linhas — segue o MODELO oficial
    // (município em 2 linhas + QR com folga embaixo). O TEXTO da norma crava Y=1,67cm, mas o
    // próprio modelo dela mostra o QR mais baixo, com folga; seguimos o modelo.
    const headH = munLs.length >= 2 ? cm(1.55) : cm(1.16);
    fill(L, y, W, headH); // cabeçalho com sombreamento cinza 5% (norma 2.2.3) — ANTES do logo
    if (logo) {
      const lw = cm(4.0), lh = lw * (logo.height / logo.width);
      page.drawImage(logo, { x: L + 4, y: y - (headH + lh) / 2, width: lw, height: Math.min(lh, headH - 6) });
    }
    // centro (versão v2.0)
    const tV = 'DANFSe v2.0', tD = 'Documento Auxiliar da NFS-e';
    page.drawText(tV, { x: L + (W - fB.widthOfTextAtSize(tV, 9)) / 2, y: y - 13, size: 9, font: fB, color: K });
    page.drawText(tD, { x: L + (W - fB.widthOfTextAtSize(tD, 9)) / 2, y: y - 25, size: 9, font: fB, color: K });
    if (data.tpAmb === '2') page.drawText('NFS-e SEM VALIDADE JURÍDICA', { x: L + cm(5.9), y: y - 37, size: 8, font: fB, color: RED });
    // direita: Município (8pt, 1-2 linhas) + Ambiente Gerador + Tipo de Ambiente (6pt)
    let hy = y - 9;
    munLs.forEach((ln) => { page.drawText(ln, { x: rx, y: hy, size: 8, font: fN, color: K }); hy -= 10; });
    hy += 1.5;
    page.drawText('Ambiente Gerador: ' + (ambGerTxt || '-'), { x: rx, y: hy, size: 6, font: fN, color: K }); hy -= 7.5;
    page.drawText('Tipo de Ambiente: ' + (tpAmbTxt || '-'), { x: rx, y: hy, size: 6, font: fN, color: K });
    y -= headH;
    const bandTopY = y; // topo da faixa "chave/dados (esq.) + QR (dir.)"
    sep(bandTopY);      // única linha do cabeçalho: separa a faixa cinza da chave/dados

    // ── QR Code (norma 2.4.3): dimensão mín. 1,52×1,52cm, endereço de consulta + chave de acesso.
    //    POSIÇÃO seguindo o MODELO oficial — centralizado na coluna direita do bloco chave/dados,
    //    com folga abaixo da faixa do cabeçalho. (O texto da norma crava Y=1,67cm, mas o próprio
    //    modelo dela mostra o QR mais baixo, com folga, e o município em 2 linhas — seguimos o modelo.) ──
    try {
      const url = 'https://www.nfse.gov.br/ConsultaPublica/?tpc=1&chave=' + data.chave;
      const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
      const n = qr.getModuleCount(); const qsz = cm(1.52);
      const rightColW = R - qrColX;
      const cap = 'A autenticidade desta NFS-e pode ser verificada pela leitura deste código QR ou pela consulta da chave de acesso no portal nacional da NFS-e';
      const capLs = wrap(cap, 48, 3); // 3 linhas (norma 2.4.3)
      const qyTop = bandTopY - cm(0.22);                   // folga abaixo da linha do cabeçalho
      const qx = qrColX + (rightColW - qsz) / 2;           // centralizado na coluna direita (modelo)
      const m = qsz / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
        page.drawRectangle({ x: qx + c * m, y: qyTop - (r + 1) * m, width: m + 0.4, height: m + 0.4, color: K });
      const capCx = qx + qsz / 2;                          // legenda centralizada SOB o QR
      capLs.forEach((ln, i) => {
        const lw = fN.widthOfTextAtSize(ln, 6);
        page.drawText(ln, { x: capCx - lw / 2, y: qyTop - qsz - 7 - i * 7, size: 6, font: fN, color: K }); // legenda 6pt
      });
    } catch (_) {}

    // ── Chave de acesso ──
    y = row(y, RH, [{ f: 1, l: 'CHAVE DE ACESSO DA NFS-e', v: data.chave, opt: { valSize: 7, raw: true, tag: 'infNFSe@Id' } }], L, qrColX - L);

    // ── Dados da NFS-e — na MESMA grade de 4 colunas (0.25 cada) do resto do documento, p/ alinhar
    //    com EMITENTE/SITUAÇÃO/FINALIDADE. 3 campos ocupam col 1-3; a col 4 é a área do QR. ──
    y = row(y, RH, [
      { f: 0.25, l: 'NÚMERO DA NFS-e', v: data.nNFSe, opt: { tag: 'infNFSe>nNFSe' } },
      { f: 0.25, l: 'COMPETÊNCIA DA NFS-e', v: fmtData(data.competencia), opt: { tag: 'infDPS>dCompet' } },
      { f: 0.25, l: 'DATA E HORA DA EMISSÃO DA NFS-e', v: fmtDataHora(data.dhEmiNFSe), opt: { tag: 'infNFSe>dhProc' } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'NÚMERO DA DPS', v: data.nDPS, opt: { tag: 'infDPS>nDPS' } },
      { f: 0.25, l: 'SÉRIE DA DPS', v: data.serieDPS, opt: { tag: 'infDPS>serie' } },
      { f: 0.25, l: 'DATA E HORA DA EMISSÃO DA DPS', v: fmtDataHora(data.dhEmiDPS), opt: { tag: 'infDPS>dhEmi' } },
    ]);

    // v2.0: chave/dados + QR + EMITENTE são UM grupo sem linhas internas. O QR (centralizado no
    // grupo) não empurra mais a linha do EMITENTE — ela vem logo após os dados, sem vão.

    // ── Emitente (v2.0): EMITENTE DA NFS-e (+Situação/Finalidade) → PRESTADOR/FORNECEDOR → … ──
    // Um grupo só: a 1ª linha leva o separador; a 2ª célula-título (PRESTADOR) vai com noSep.
    // "EMITENTE DA NFS-e" é CAMPO (não título): valor = descrição de tpEmit (Prestador/Tomador/
    // Intermediário). 1ª célula cinza, com rótulo + valor. NÃO leva separador: faz parte do grupo
    // DE CIMA (chave/dados) — a linha separadora vem só ANTES do PRESTADOR.
    y = row(y, RH, [
      { f: 0.25, l: 'EMITENTE DA NFS-e', v: tpEmitLabel(data.tpEmit), opt: { shaded: true, raw: true, labSize: 7, tag: 'infDPS>tpEmit' } },
      { f: 0.25, l: 'SITUAÇÃO DA NFS-e', v: data.situacao, opt: { raw: true, tag: 'infNFSe>cStat' } },
      { f: 0.25, l: 'FINALIDADE', v: data.finalidade, opt: { tag: 'infDPS>finNFSe' } },
      { f: 0.25, l: '', v: '', opt: { raw: true } },
    ]);
    // PRESTADOR/FORNECEDOR — grupo próprio (linha acima, separando da linha EMITENTE).
    y = blocoPessoaV2(y, 'PRESTADOR / FORNECEDOR', data.prest, {
      cnpj: 'emit>CNPJ|CPF|NIF', im: 'emit>IM', fone: 'emit>fone', nome: 'emit>xNome',
      mun: 'enderNac>cMun', ibgeCep: 'enderNac>cMun + CEP', end: 'enderNac>xLgr + nro + xCpl + xBairro', email: 'emit>email',
    });
    y = row(y, RH, [
      { f: 0.25, l: 'Simples Nacional na Data de Competência', v: data.prest.simples, opt: { tag: 'regTrib>opSimpNac' } },
      { f: 0.50, l: 'Regime de Apuração Tributária pelo SN', v: regApLabel(data.prest.regApSN), opt: { tag: 'regTrib>regApTribSN' } },
      { f: 0.25, l: '', v: '', opt: { raw: true } },
    ]);

    // ── Tomador / Destinatário / Intermediário (v2.0) ──
    // Norma 2.3.1: bloco VAZIO/não aplicável é SUPRIMIDO pra UMA linha "... NÃO IDENTIFICADO NA
    // NFS-e" (modo NORMAL). No modo AUDITORIA expande SEMPRE (mesmo vazio) pra mostrar as tags de
    // cada campo. `exp*` = expandir (tem dado OU auditoria).
    const temToma = data.toma && (data.toma.cnpjCpf || data.toma.nome);
    const expToma = temToma || audit;
    brk(expToma ? 3 * RH : cm(0.42));
    if (expToma) y = blocoPessoaV2(y, 'TOMADOR / ADQUIRENTE', data.toma || {}, {
      cnpj: 'toma>CNPJ|CPF|NIF', im: 'toma>IM', fone: 'toma>fone', nome: 'toma>xNome',
      mun: 'endNac>cMun', ibgeCep: 'endNac>cMun + CEP', end: 'end>xLgr + nro + xCpl + xBairro', email: 'toma>email',
    });
    else y = linhaCentral(y, 'TOMADOR / ADQUIRENTE NÃO IDENTIFICADO NA NFS-e');

    // ── Destinatário da Operação (v2.0, de IBSCBS/dest) — SEM Indicador Municipal ──
    const temDest = data.dest && (data.dest.cnpjCpf || data.dest.nome);
    const expDest = temDest || audit;
    brk(expDest ? 3 * RH : cm(0.42));
    if (expDest) y = blocoPessoaV2(y, 'DESTINATÁRIO DA OPERAÇÃO', data.dest || {}, {
      cnpj: 'dest>CNPJ|CPF|NIF', fone: 'dest>fone', nome: 'dest>xNome',
      mun: 'endNac>cMun', ibgeCep: 'endNac>cMun + CEP', end: 'end>xLgr + nro + xCpl + xBairro', email: 'dest>email',
    }, true);
    else y = linhaCentral(y, 'DESTINATÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');

    // ── Intermediário da Operação (v2.0, de infDPS/interm) ──
    const temInterm = data.interm && (data.interm.cnpjCpf || data.interm.nome);
    const expInterm = temInterm || audit;
    brk(expInterm ? 3 * RH : cm(0.42));
    if (expInterm) y = blocoPessoaV2(y, 'INTERMEDIÁRIO DA OPERAÇÃO', data.interm || {}, {
      cnpj: 'interm>CNPJ|CPF|NIF', im: 'interm>IM', fone: 'interm>fone', nome: 'interm>xNome',
      mun: 'endNac>cMun', ibgeCep: 'endNac>cMun + CEP', end: 'end>xLgr + nro + xCpl + xBairro', email: 'interm>email',
    });
    else y = linhaCentral(y, 'INTERMEDIÁRIO DA OPERAÇÃO NÃO IDENTIFICADO NA NFS-e');

    // ── Serviço Prestado (v2.0): título embutido + 3 campos; depois Descrição do Código (SEM
    //    título, valor = municipal se houver senão nacional) e Descrição do Serviço. ──
    brk(RH + tbH(data.serv.xTribMun || data.serv.xTribNac, 2, 1, audit) + tbH(data.serv.xDescServ, 14, 1, true));
    const _codNac = fmtCTribNac(data.serv.cTribNac);
    const _codMun = (data.serv.cTribMun && data.serv.cTribMun !== '-') ? data.serv.cTribMun : '';
    const _valCod = (_codNac && _codMun && _codNac !== _codMun) ? `${_codNac} / ${_codMun}` : (_codNac || _codMun || '-');
    y = tituloRow(y, 'SERVIÇO PRESTADO', [
      { f: 0.25, l: 'Código de Tributação Nacional/Municipal', v: _valCod, opt: { raw: true, tag: 'cServ>cTribNac + cTribMun' } },
      { f: 0.25, l: 'Código da NBS', v: fmtNBS(data.serv.cNBS), opt: { tag: 'cServ>cNBS' } },
      { f: 0.25, l: 'Local da Prestação / Sigla UF / País', v: [data.serv.localPrest || '-', data.serv.ufLocPrest || '-', data.serv.paisPrest || '-'].join(' / '), opt: { raw: true, tag: 'infNFSe>xLocPrestacao + locPrest>cPaisPrestacao' } },
    ]);
    // Descrição do Código de Tributação Nacional/Municipal — SEM título (label) no DANFSe; valor =
    // descrição MUNICIPAL (xTribMun) se houver, senão a NACIONAL (xTribNac).
    y = textbox(y, '', data.serv.xTribMun || data.serv.xTribNac, 2, 1, 'cServ>xTribMun ou infNFSe>xTribNac');
    y = textbox(y, 'Descrição do Serviço', data.serv.xDescServ, 14, 1, 'cServ>xDescServ');

    // ── Tributação Municipal (ISSQN) v2.0. Norma 2.3.1: quando a operação é NÃO SUJEITA
    //    ao ISSQN (Imunidade/Exportação/Não Incidência/Imune) suprime pra UMA linha no modo NORMAL;
    //    auditoria expande sempre (pra mostrar as tags). Linhas intermediárias (Regime Especial/Suspensão
    //    e Benefício Municipal/Deduções/Desconto) só são exibidas se houver valor preenchido (ou em auditoria).
    const issqnNaoSujeita = ['2', '3', '4', '5'].includes(data.issqn.tipoTrib);
    const expISSQN = !issqnNaoSujeita || audit;
    const showIssRow2 = audit || Boolean(
      (data.issqn.regimeEsp && data.issqn.regimeEsp !== '0') ||
      data.issqn.tipoImunidade ||
      (data.issqn.suspensao && data.issqn.suspensao !== '0' && data.issqn.suspensao !== '1') ||
      data.issqn.nProcSusp
    );
    const showIssRow3 = audit || Boolean(
      data.issqn.beneficioMun ||
      data.issqn.calcBM ||
      temVal(data.issqn.deducoes) ||
      temVal(data.issqn.descIncond)
    );
    const issRowsCount = 2 + (showIssRow2 ? 1 : 0) + (showIssRow3 ? 1 : 0);
    brk(expISSQN ? issRowsCount * RH : cm(0.42));
    if (expISSQN) {
    y = tituloRow(y, 'TRIBUTAÇÃO MUNICIPAL (ISSQN)', [
      { f: 0.25, l: 'Tipo de Tributação do ISSQN', v: tipoTribLabel(data.issqn.tipoTrib), opt: { raw: true, tag: 'tribMun>tribISSQN' } },
      { f: 0.50, l: 'Município / Sigla UF / País de Incidência do ISSQN', v: [data.issqn.municipioIncid || '-', data.issqn.ufIncid || '-', data.issqn.paisResult || '-'].join(' / '), opt: { raw: true, tag: 'infNFSe>xLocIncid + tribMun>cPaisResult' } },
    ]);
    if (showIssRow2) {
      y = row(y, RH, [
        { f: 0.25, l: 'Regime Especial de Tributação do ISSQN', v: regEspLabel(data.issqn.regimeEsp), opt: { raw: true, tag: 'tribMun>tpRegEsp|regTrib>regEspTrib' } },
        { f: 0.25, l: 'Tipo de Imunidade do ISSQN', v: data.issqn.tipoImunidade, opt: { tag: 'tribMun>tpImunidade' } },
        { f: 0.25, l: 'Suspensão da Exigibilidade do ISSQN', v: suspLabel(data.issqn.suspensao), opt: { tag: 'tribMun>tpSusp' } },
        { f: 0.25, l: 'Número Processo Suspensão', v: data.issqn.nProcSusp, opt: { tag: 'tribMun>nProcesso' } },
      ]);
    }
    if (showIssRow3) {
      y = row(y, RH, [
        { f: 0.25, l: 'Benefício Municipal', v: data.issqn.beneficioMun, opt: { tag: 'tribMun>tpBM|cBenef' } },
        { f: 0.25, l: 'Cálculo do BM', v: data.issqn.calcBM, opt: { tag: 'tribMun>vCalcBM|vRedBCBM' } },
        { f: 0.25, l: 'Total Deduções/Reduções', v: fmtMoeda(data.issqn.deducoes), opt: { tag: 'valores>vDR|vDedRed' } },
        { f: 0.25, l: 'Desconto Incondicionado', v: fmtMoeda(data.issqn.descIncond), opt: { tag: 'valores>vDescIncond' } },
      ]);
    }
    y = row(y, RH, [
      { f: 0.25, l: 'BC ISSQN', v: fmtMoeda(data.issqn.bc), opt: { tag: 'valores>vBC' } },
      { f: 0.25, l: 'Alíquota Aplicada', v: pc(data.issqn.aliq), opt: { tag: 'valores>pAliqAplic' } },
      { f: 0.25, l: 'Retenção do ISSQN', v: retISSLabel(data.issqn.retencao), opt: { tag: 'tribMun>tpRetISSQN', hl: hlRet && issRetido } },
      { f: 0.25, l: 'ISSQN Apurado', v: fmtMoeda(data.issqn.apurado), opt: { tag: 'valores>vISSQN', hl: hlRet && issRetido } },
    ]);
    } else y = linhaCentral(y, 'TRIBUTAÇÃO MUNICIPAL (ISSQN) - OPERAÇÃO NÃO SUJEITA AO ISSQN');

    // ── Tributação Federal (Exceto CBS) — título na 1ª célula + grade 4 colunas, igual ao oficial ──
    brk(2 * RH);
    y = tituloRow(y, 'TRIBUTAÇÃO FEDERAL (EXCETO CBS)', [
      { f: 0.25, l: 'IRRF', v: fmtMoeda(data.federal.irrf), opt: { tag: 'valores>vRetIRRF', hl: hlRet && temVal(data.federal.irrf) } },
      { f: 0.25, l: 'Contribuição Previdenciária - Retida', v: fmtMoeda(data.federal.cp), opt: { tag: 'valores>vRetCP', hl: hlRet && temVal(data.federal.cp) } },
      { f: 0.25, l: 'Contribuições Sociais - Retidas', v: fmtMoeda(data.federal.csll), opt: { tag: 'valores>vRetCSLL', hl: hlRet && temVal(data.federal.csll) } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'PIS - Débito Apuração Própria', v: fmtMoeda(data.federal.pis), opt: { tag: 'vPis', hl: hlRet && pisCofRetido && temVal(data.federal.pis) } },
      { f: 0.25, l: 'COFINS - Débito Apuração Própria', v: fmtMoeda(data.federal.cofins), opt: { tag: 'vCofins', hl: hlRet && pisCofRetido && temVal(data.federal.cofins) } },
      { f: 0.25, l: 'Descrição Contrib. Sociais - Retidas', v: retPisCofinsLabel(data.federal.tpRetPisCofins), opt: { tag: 'piscofins>tpRetPisCofins', hl: hlRet && pisCofRetido } },
      { f: 0.25, l: '', v: '', opt: { raw: true } },
    ]);

    // ── Tributação IBS/CBS (v2.0, reforma tributária) ──
    const ic = data.ibscbs || {};
    const exclIbsCbs = ic.vBC ? 'R$ 0,00' : (fmtMoeda(data.issqn.apurado) || '-');
    brk(4 * RH);
    y = tituloRow(y, 'TRIBUTAÇÃO IBS/CBS', [
      { f: 0.25, l: 'CST / cClassTrib', v: [ic.cst || '-', ic.cClassTrib || '-'].join(' / '), opt: { raw: true, tag: 'gIBSCBS>CST + cClassTrib' } },
      { f: 0.50, l: 'Indicador de Operação / Código IBGE Incidência / Município Incidência / Sigla UF', v: [ic.cIndOp || '-', fmtIbge(ic.cLocIncid) || '-', ic.xLocIncid || '-', ic.ufIncid || '-'].join(' / '), opt: { raw: true, tag: 'IBSCBS>cIndOp + cLocalidadeIncid + xLocalidadeIncid' } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'Exclusões e Reduções da Base de Cálculo', v: exclIbsCbs, opt: { raw: true, tag: '(somatório)' } },
      { f: 0.25, l: 'Base de Cálculo Após Exclusões e Reduções', v: fmtMoeda(ic.vBC), opt: { tag: 'IBSCBS>valores>vBC' } },
      { f: 0.25, l: 'Red. Alíquota IBS / Red. Alíquota CBS', v: pcs(ic.pRedAliqUF, ic.pRedAliqMun, ic.pRedAliqCBS), opt: { raw: true, tag: 'pRedAliqUF + pRedAliqMun + pRedAliqCBS' } },
      { f: 0.25, l: 'Alíquota - IBS UF / IBS Mun', v: pcs(ic.pIBSUF, ic.pIBSMun), opt: { raw: true, tag: 'pIBSUF + pIBSMun' } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'Alíq. Efetiva Municipal - IBS', v: pc(ic.pAliqEfetMun), opt: { tag: 'pAliqEfetMun' } },
      { f: 0.25, l: 'Valor Apurado Municipal - IBS', v: fmtMoeda(ic.vIBSMun), opt: { tag: 'gIBSMunTot>vIBSMun' } },
      { f: 0.25, l: 'Alíq. Efetiva Estadual - IBS', v: pc(ic.pAliqEfetUF), opt: { tag: 'pAliqEfetUF' } },
      { f: 0.25, l: 'Valor Apurado Estadual - IBS', v: fmtMoeda(ic.vIBSUF), opt: { tag: 'gIBSUFTot>vIBSUF' } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'Valor Total Apurado - IBS', v: fmtMoeda(ic.vIBSTot), opt: { tag: 'gIBS>vIBSTot' } },
      { f: 0.25, l: 'Alíquota - CBS', v: pc(ic.pCBS), opt: { tag: 'pCBS' } },
      { f: 0.25, l: 'Alíquota Efetiva - CBS', v: pc(ic.pAliqEfetCBS), opt: { tag: 'pAliqEfetCBS' } },
      { f: 0.25, l: 'Valor Total Apurado - CBS', v: fmtMoeda(ic.vCBS), opt: { tag: 'gCBS>vCBS' } },
    ]);

    // ── Valor Total da NFS-e (v2.0): título embutido + IBS/CBS no total ──
    const totIbsCbs = (parseFloat(ic.vIBSTot) || 0) + (parseFloat(ic.vCBS) || 0);
    brk(2 * RH);
    y = tituloRow(y, 'VALOR TOTAL DA NFS-e', [
      { f: 0.25, l: 'VALOR DA OPERAÇÃO / SERVIÇO', v: fmtMoeda(data.totais.vServ), opt: { tag: 'vServPrest>vServ' } },
      { f: 0.25, l: 'Desconto Incondicionado', v: fmtMoeda(data.totais.descIncond), opt: { tag: 'valores>vDescIncond' } },
      { f: 0.25, l: 'Desconto Condicionado', v: fmtMoeda(data.totais.descCond), opt: { tag: 'valores>vDescCond' } },
    ]);
    y = row(y, RH, [
      { f: 0.25, l: 'Total das Retenções (ISSQN / Federais)', v: fmtMoeda(data.totais.totalRet), opt: { tag: 'valores>vTotalRet', hl: hlRet && temVal(data.totais.totalRet) } },
      { f: 0.25, l: 'VALOR LÍQUIDO DA NFS-e', v: fmtMoeda(data.totais.vLiq), opt: { tag: 'valores>vLiq' } },
      { f: 0.25, l: 'Total do IBS/CBS', v: fmtMoeda(totIbsCbs), opt: { tag: 'vIBSTot + vCBS' } },
      { f: 0.25, l: 'VALOR LÍQUIDO DA NFS-e + IBS/CBS', v: fmtMoeda(ic.vTotNF || 0), opt: { tag: 'totCIBS>vTotNF' } },
    ]);

    // ── Informações Complementares (v2.0) ──
    // Fidedigno ao DANFSe oficial do Portal Nacional: exibe apenas os campos complementares reais do XML
    // (sem duplicar descrição do serviço ou injetar descrição NBS) + Totais aproximados dos Tributos (Lei 12.741).
    const ta = data.totaisAprox || {};
    const taTxt = (ta.fed || ta.est || ta.mun)
      ? `Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: ${fmtMoeda(ta.fed) || '-'}; Estaduais: ${fmtMoeda(ta.est) || '-'}; Municipais: ${fmtMoeda(ta.mun) || '-'};`
      : (ta.pFed || ta.pEst || ta.pMun)
      ? `Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: ${pc(ta.pFed) || '-'}; Estaduais: ${pc(ta.pEst) || '-'}; Municipais: ${pc(ta.pMun) || '-'};`
      : 'Totais aproximados dos Tributos cfe. Lei n° 12.741/2012: Federais: -; Estaduais: -; Municipais: -;';

    const icp = data.infoCompl || {};
    const lbl = (rot, v) => v ? rot + ': ' + v : '';
    const infoItems = [
      { txt: data.serv.xInfComp || '', tag: 'serv>infoCompl>xInfComp' },
      { txt: lbl('NFS-e Subst.', icp.chSubstda), tag: 'subst>chSubstda' },
      { txt: lbl('Documento de Referência', icp.docRef), tag: 'infoCompl>docRef' },
      { txt: lbl('Código da Obra (CNO)', icp.cObra), tag: 'obra>cObra' },
      { txt: lbl('Inscrição Imobiliária Fiscal', icp.inscImobFisc), tag: 'imovel>inscImobFisc' },
      { txt: lbl('Atividade do Evento', icp.idAtvEvt), tag: 'atvEvento>idAtvEvt' },
      { txt: lbl('Documento Técnico', icp.idDocTec), tag: 'infoCompl>idDocTec' },
      { txt: lbl('Pedido', icp.xPed), tag: 'infoCompl>xPed' },
      { txt: lbl('Item do Pedido', icp.xItemPed), tag: 'gItemPed>xItemPed' },
      { txt: icp.xOutInf || '', tag: 'infNFSe>xOutInf' },
      { txt: taTxt, tag: 'totTrib>vTotTribFed/Est/Mun ou pTotTribFed/Est/Mun' },
    ];
    let infoLines = 0, infoRows = 0;
    for (const it of infoItems) { const w = it.txt ? wrapMultiline(it.txt, 118, 8).length : 0; infoLines += w; infoRows += w + 1; }
    const infoH = 10 + ((audit ? Math.max(1, infoRows) : Math.max(1, infoLines)) - 1) * 9 + 4;
    brk(cm(0.42) + infoH);
    y = title(y, 'INFORMAÇÕES COMPLEMENTARES');
    y = audit ? infoboxAudit(y, infoItems) : infoboxNormal(y, infoItems);

    // ── CANHOTO (stub destacável no rodapé): DATA CIENTIFICAÇÃO | IDENTIFICAÇÃO E ASSINATURA |
    //    Nº NFS-e / CHAVE NFS-e. Fixo no fundo da página (espaço pra ciência/assinatura). ──
    if (!audit) {
      const canhotoH = cm(1.0), canhotoTop = mg + pad + canhotoH;
      // Caixa FECHADA com divisórias verticais (o canhoto é a ÚNICA parte do documento com verticais).
      page.drawRectangle({ x: L, y: canhotoTop - canhotoH, width: W, height: canhotoH, borderWidth: LINE, borderColor: K });
      [0.25, 0.50].forEach(f => page.drawLine({ start: { x: L + f * W, y: canhotoTop }, end: { x: L + f * W, y: canhotoTop - canhotoH }, thickness: LINE, color: K }));
      row(canhotoTop, canhotoH, [
        { f: 0.25, l: 'DATA CIENTIFICAÇÃO:', v: '', opt: { raw: true } },
        { f: 0.25, l: 'IDENTIFICAÇÃO E ASSINATURA', v: '', opt: { raw: true } },
        { f: 0.50, l: 'N° NFS-e / CHAVE NFS-e', v: slash(data.nNFSe, data.chave), opt: { raw: true, topVal: true } },
      ]);
    }
    // ── Moldura + marca d'água + nº da folha: desenhadas em CADA página ───────────
    const { degrees } = PDFLib;
    const K35 = rgb(0.65, 0.65, 0.65); // 35% preto
    const wmTxt = data.marcaDagua ? String(data.marcaDagua).toUpperCase() : '';
    const wmFont = fB || fN;
    const wmSize = 70, wmTw = wmTxt ? wmFont.widthOfTextAtSize(wmTxt, wmSize) : 0;
    const a = Math.PI / 4, cs = Math.cos(a), sn = Math.sin(a);
    pages.forEach((pg, i) => {
      pg.drawRectangle({ x: mg, y: mg, width: A4W - 2 * mg, height: A4H - 2 * mg, borderWidth: 1.0, borderColor: K });
      if (wmTxt) pg.drawText(wmTxt, {
        x: A4W / 2 - (wmTw / 2) * cs + (wmSize * 0.35) * sn,
        y: A4H / 2 - (wmTw / 2) * sn - (wmSize * 0.35) * cs,
        size: wmSize, font: wmFont, color: rgb(0.72, 0.72, 0.72), opacity: 0.45, rotate: degrees(45),
      });
      if (pages.length > 1) {
        const ft = 'Folha ' + (i + 1) + '/' + pages.length;
        pg.drawText(ft, { x: R - fN.widthOfTextAtSize(ft, 6), y: mg + 3, size: 6, font: fN, color: K35 });
      }
    });

    return await pdf.save();

    // — Bloco de pessoa v2.0 (PRESTADOR/FORNECEDOR, TOMADOR/ADQUIRENTE…): título cinza na 1ª célula
    //   + CNPJ/Indicador Municipal/Telefone; depois Nome | Município/Sigla UF | Código IBGE/CEP;
    //   depois Endereço | E-mail. tags = origem de cada campo p/ a auditoria. —
    function blocoPessoaV2(yTop, titulo, p, tags, semIM) {
      tags = tags || {};
      const ibge = [fmtIbge(p.cMun), fmtCep(p.cep)].filter(Boolean).join(' / ');
      yTop = tituloRow(yTop, titulo, [
        { f: 0.25, l: 'CNPJ / CPF / NIF', v: fmtDoc(p.cnpjCpf), opt: { tag: tags.cnpj } },
        semIM ? { f: 0.25, l: '', v: '', opt: { raw: true } }
              : { f: 0.25, l: 'Indicador Municipal (Inscrição)', v: p.im, opt: { tag: tags.im } },
        { f: 0.25, l: 'Telefone', v: fmtFone(p.fone), opt: { tag: tags.fone } },
      ]);
      yTop = row(yTop, RH, [
        { f: 0.50, l: 'Nome / Nome Empresarial', v: p.nome, opt: { tag: tags.nome } },
        { f: 0.25, l: 'Município / Sigla UF', v: p.municipioUF, opt: { raw: true, tag: tags.mun } },
        { f: 0.25, l: 'Código IBGE / CEP', v: ibge, opt: { raw: true, tag: tags.ibgeCep } },
      ]);
      yTop = row(yTop, RH, [
        { f: 0.75, l: 'Endereço', v: p.endereco, opt: { tag: tags.end } },
        { f: 0.25, l: 'E-mail', v: p.email, opt: { tag: tags.email } },
      ]);
      return yTop;
    }
  }

  // ───────────────────────── helpers de formatação ─────────────────────────
  function fmtData(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || ''); }
  function fmtDataHora(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):?(\d{2})?/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}:${m[6] || '00'}` : (iso || ''); }
  function fmtMoeda(v) { const n = parseFloat(v); if (isNaN(n)) return ''; return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtIbge(c) { c = (c || '').replace(/\D/g, ''); return c.length === 7 ? `${c.slice(0, 2)}.${c.slice(2)}` : c; }
  function fmtCep(c) { c = (c || '').replace(/\D/g, ''); return c.length === 8 ? c.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1.$2-$3') : c; }
  function fmtFone(f) { f = (f || '').replace(/\D/g, ''); if (f.length === 11) return f.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3'); if (f.length === 10) return f.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3'); return f; }
  function fmtDoc(d) { d = (d || '').replace(/\D/g, ''); if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4'); return d; }
  // Código de Tributação Nacional: formata "060102" → "06.01.02" (item da lista LC 116/national)
  function fmtCTribNac(c) { c = (c || '').replace(/\D/g, ''); return c.length === 6 ? `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4, 6)}` : (c || ''); }
  // Código NBS: 9 dígitos → "n.nnnn.nn.nn" (ex.: "114013900" → "1.1401.39.00")
  function fmtNBS(c) { c = (c || '').replace(/\D/g, ''); return c.length === 9 ? `${c.slice(0, 1)}.${c.slice(1, 5)}.${c.slice(5, 7)}.${c.slice(7, 9)}` : (c || ''); }
  // Resolução de município pela tabela IBGE (global IBGE_MUNICIPIOS / IBGE_UF, carregada por ibge-municipios.cjs)
  function ibgeT() { const r = (typeof self !== 'undefined') ? self : (typeof globalThis !== 'undefined' ? globalThis : {}); return { mun: r.IBGE_MUNICIPIOS || {}, uf: r.IBGE_UF || {} }; }
  function munNome(code) { code = (code || '').replace(/\D/g, ''); return ibgeT().mun[code] || code; }
  function munUF(code, fb) { if (fb) return fb; code = (code || '').replace(/\D/g, ''); return ibgeT().uf[code.slice(0, 2)] || ''; }
  function nbsDesc(code) { code = (code || '').replace(/\D/g, ''); if (!code) return ''; const r = (typeof self !== 'undefined') ? self : (typeof globalThis !== 'undefined' ? globalThis : {}); return (r.NBS_DESC || {})[code] || ''; }
  function regApLabel(v) {
    return {
      '1': 'Regime de apuração dos tributos federais e municipal pelo Simples Nacional',
      '2': 'Regime de apuração dos tributos federais pelo Simples Nacional e o ISSQN pela NFS-e (conforme respectiva legislação municipal do tributo)',
      '3': 'Regime de apuração dos tributos federais e municipal por fora do Simples Nacional'
    }[v] || (v || '');
  }
  function tipoTribLabel(v) { return { '1': 'Operação Tributável', '2': 'Imunidade', '3': 'Exportação', '4': 'Não Incidência', '5': 'Imune', '6': 'Suspensa' }[v] || (v || ''); }
  function retISSLabel(v) { return { '1': 'Não Retido', '2': 'Retido pelo Tomador', '3': 'Retido pelo Intermediário' }[v] || (v || ''); }
  // EMITENTE DA NFS-e (tpEmit, "Emitente da DPS") — 1=Prestador, 2=Tomador, 3=Intermediário.
  function tpEmitLabel(v) { return { '1': 'Prestador', '2': 'Tomador', '3': 'Intermediário' }[v] || (v || ''); }
  // Regime Especial de Tributação Municipal (regEspTrib / tpRegEsp), conforme layout oficial.
  // Vazio/ausente e código 0 = "Nenhum"; código desconhecido cai pro próprio valor.
  function regEspLabel(v) {
    if (v === '' || v == null) return 'Nenhum';
    return { '0': 'Nenhum', '1': 'Ato Cooperado (Cooperativa)', '2': 'Estimativa', '3': 'Microempresa Municipal', '4': 'Notário ou Registrador', '5': 'Profissional Autônomo', '6': 'Sociedade de Profissionais', '9': 'Outros' }[v] || v;
  }
  // Tipo de Retenção PIS/COFINS e CSLL (tpRetPisCofins), conforme layout oficial — 0 a 9.
  // Vazio/ausente = '' (vira "-"); código desconhecido cai pro próprio valor.
  function retPisCofinsLabel(v) {
    if (v === '' || v == null) return '';
    return {
      '0': 'PIS/COFINS/CSLL Não Retidos', '1': 'PIS/COFINS Retido', '2': 'PIS/COFINS Não Retido',
      '3': 'PIS/COFINS/CSLL Retidos', '4': 'PIS/COFINS Retidos, CSLL Não Retido',
      '5': 'PIS Retido, COFINS/CSLL Não Retido', '6': 'COFINS Retido, PIS/CSLL Não Retido',
      '7': 'PIS Não Retido, COFINS/CSLL Retidos', '8': 'PIS/COFINS Não Retidos, CSLL Retido',
      '9': 'COFINS Não Retido, PIS/CSLL Retidos',
    }[v] || v;
  }
  function suspLabel(v) { if (v === '' || v == null) return 'Não'; return (v === '0' || v === '1') ? 'Não' : 'Sim'; }

  // ───────────────────────── export ─────────────────────────
  async function gerarDanfse(xmlString, deps) {
    const data = parseDanfse(xmlString);
    if (!data) throw new Error('XML inválido para DANFSe');
    if (deps && deps.marcaDagua) {
      data.marcaDagua = deps.marcaDagua;
    }
    return await buildDanfsePdf(data, deps);
  }

  const api = { parseDanfse, parseEvento, buildDanfsePdf, gerarDanfse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DANFSe = api;

})(typeof self !== 'undefined' ? self : this);
