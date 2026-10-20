const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const AdmZip = require('adm-zip');
const { obterDetalhesServicoSP } = require('./danfseSP.cjs');

const UF_IBGE = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
    '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL',
    '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR',
    '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF'
};

function formatarMoeda(valor) {
    if (valor == null || valor === '' || isNaN(Number(valor))) return '0,00';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatarPercent(valor) {
    if (valor == null || valor === '' || isNaN(Number(valor))) return '0,00%';
    return Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
}

function formatarCpfCnpj(doc) {
    if (!doc) return '';
    const d = String(doc).replace(/\D/g, '');
    if (d.length === 11) {
        return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (d.length === 14) {
        return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
}

function formatarData(dataIso) {
    if (!dataIso) return '';
    const dStr = String(dataIso).trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dStr);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return dStr;
}

function formatarCompetencia(dCompet, dataEmi) {
    const d = dCompet || dataEmi || '';
    const str = String(d).trim();
    // 1. Padrão ISO YYYY-MM ou YYYY-MM-DD
    const mIso = /^(\d{4})[-/.](\d{2})/.exec(str);
    if (mIso) return `${mIso[2]}/${mIso[1]}`;
    // 2. Padrão BR completo DD/MM/YYYY
    const mBrFull = /^\d{2}\/(\d{2})\/(\d{4})/.exec(str);
    if (mBrFull) return `${mBrFull[1]}/${mBrFull[2]}`;
    // 3. Padrão BR mês/ano MM/YYYY
    const mBr = /^(\d{2})\/(\d{4})/.exec(str);
    if (mBr) return `${mBr[1]}/${mBr[2]}`;
    return '';
}

const MESES_ABREV_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function formatarCompetenciaCsv(competencia, dataGeracao) {
    const comp = String(competencia || '').trim();
    const mComp = /^(\d{2})\/(\d{4})$/.exec(comp);
    if (mComp) {
        const mesIdx = parseInt(mComp[1], 10) - 1;
        const anoCurto = mComp[2].slice(-2);
        if (mesIdx >= 0 && mesIdx < 12) return `${MESES_ABREV_PT[mesIdx]}/${anoCurto}`;
    }
    const dg = String(dataGeracao || '').trim();
    const mData = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dg);
    if (mData) {
        const mesIdx = parseInt(mData[2], 10) - 1;
        const anoCurto = mData[3].slice(-2);
        if (mesIdx >= 0 && mesIdx < 12) return `${MESES_ABREV_PT[mesIdx]}/${anoCurto}`;
    }
    return comp;
}

function converterDataBrParaIso(dataBr) {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr || '').trim());
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return '';
}

function formatarTextoCsv(txt) {
    if (!txt) return '';
    if (txt.includes(';') || txt.includes('\n') || txt.includes('\r') || txt.includes('"')) {
        return `"${txt.replace(/"/g, '""')}"`;
    }
    return txt;
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

function parseXmlNota(xmlContent, nomeArquivo = '') {
    try {
        const upperName = String(nomeArquivo || '').toUpperCase();
        // Se for arquivo de evento isolado ou de outro modelo fiscal (NF-e 55, NFC-e 65, CT-e 57), não contabiliza como NFS-e
        if (
            upperName.includes('EVENTO') ||
            upperName.endsWith('-NFE.XML') ||
            upperName.endsWith('-NFCE.XML') ||
            upperName.endsWith('-CTE.XML') ||
            xmlContent.includes('<evento') ||
            xmlContent.includes('<procEventoNFSe') ||
            xmlContent.includes('<infNFe') ||
            xmlContent.includes('<nfeProc') ||
            xmlContent.includes('portalfiscal.inf.br/nfe') ||
            xmlContent.includes('<infCte') ||
            xmlContent.includes('<cteProc') ||
            xmlContent.includes('portalfiscal.inf.br/cte')
        ) {
            return null;
        }

        const doc = new DOMParser().parseFromString(xmlContent, 'text/xml');
        if (doc.getElementsByTagName('parsererror').length > 0) return null;

        const t = (name) => {
            const el = doc.getElementsByTagName(name)[0] ||
                       doc.getElementsByTagName(name.toLowerCase())[0] ||
                       doc.getElementsByTagName(name.toUpperCase())[0];
            return el ? (el.textContent || '').trim() : '';
        };
        const num = (name) => {
            const v = t(name);
            if (!v) return 0;
            const n = parseFloat(v.replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };

        const infNFSe = doc.getElementsByTagName('infNFSe')[0] || doc.documentElement;
        const idAttr = infNFSe.getAttribute('Id') || '';
        const chaveNotaNacional = idAttr.replace(/^NFS/, '').replace(/\D/g, '') || t('ChaveNotaNacional');

        const emit = doc.getElementsByTagName('emit')[0] || doc.getElementsByTagName('prest')[0] || doc.getElementsByTagName('CPFCNPJPrestador')[0] || null;
        const toma = doc.getElementsByTagName('toma')[0] || doc.getElementsByTagName('interm')[0] || doc.getElementsByTagName('dest')[0] || doc.getElementsByTagName('CPFCNPJTomador')[0] || null;
        const dps = doc.getElementsByTagName('DPS')[0] || doc;
        const infDPS = doc.getElementsByTagName('infDPS')[0] || dps;
        const valNFSe = infNFSe.getElementsByTagName('valores')[0];
        const valDPS = infDPS.getElementsByTagName('valores')[0];
        const ibscbs = doc.getElementsByTagName('IBSCBS')[0];

        const isPortalSp = Boolean(
            xmlContent.includes('PMSP_WebServices') ||
            xmlContent.includes('<OrigemCaptacao>PORTAL_SP</OrigemCaptacao>') ||
            xmlContent.includes('xmlns="http://www.prefeitura.sp.gov.br/nfe"') ||
            doc.getElementsByTagName('ChaveNFe').length > 0
        );
        const origemCaptacao = isPortalSp ? 'PORTAL_SP' : 'PORTAL_NACIONAL';

        const te = (el, name) => {
            if (!el) return '';
            const child = el.getElementsByTagName(name)[0];
            return child ? (child.textContent || '').trim() : '';
        };
        const ne = (el, name) => {
            const v = te(el, name);
            if (!v) return 0;
            const n = parseFloat(v.replace(',', '.'));
            return isNaN(n) ? 0 : n;
        };

        const numeroNFe = t('nNFSe') || t('nDFSe') || t('NumeroNFe') || '0';
        const dhProc = t('dhProc') || t('dhEmi') || t('DataEmissaoNFe');
        const dataGeracao = formatarData(dhProc);
        const dCompet = t('dCompet') || t('Competencia') || t('DataCompetencia') || t('DataFatoGeradorNFe') || t('DataEmissaoRPS') || dhProc;
        const competencia = formatarCompetencia(dCompet, dhProc);

        // Prestador
        const prestadorCnpj = formatarCpfCnpj(te(emit, 'CNPJ') || te(emit, 'CPF') || t('CNPJPrestador') || '');
        const prestadorNome = te(emit, 'xNome') || te(emit, 'xRazSoc') || t('RazaoSocialPrestador');
        const prestadorIM = te(emit, 'IM') || t('InscricaoPrestador') || '-';

        // Tomador
        const tomadorCnpj = formatarCpfCnpj(te(toma, 'CNPJ') || te(toma, 'CPF') || t('CPFCNPJTomador') || '');
        const tomadorNome = te(toma, 'xNome') || te(toma, 'xRazSoc') || t('RazaoSocialTomador');
        const tomadorIM = te(toma, 'IM') || t('InscricaoTomador') || '-';

        // Valores básicos
        const valorServicos = ne(valDPS, 'vServ') || ne(valNFSe, 'vLiq') || num('ValorServicos') || num('vServ');
        const descIncond = ne(valNFSe, 'vDescIncond') || ne(valDPS, 'vDescIncond') || num('vDescIncond');
        const descCond = ne(valNFSe, 'vDescCond') || ne(valDPS, 'vDescCond') || num('vDescCond');
        const baseCalculo = ne(valNFSe, 'vBC') || ne(valDPS, 'vBC') || 0;
        const aliqISSQN = ne(valNFSe, 'pAliqAplic') || ne(valDPS, 'pAliq') || ne(valDPS, 'pAliqAplic') || num('AliquotaServicos');
        const valorISSQN = ne(valNFSe, 'vISSQN') || ne(valDPS, 'vISSQN') || num('ValorISS');

        // Simples Nacional
        const opSimp = t('opSimpNac');
        const simplesNacional = {
            '1': 'Não Optante',
            '2': 'Microempreendedor Individual (MEI)',
            '3': 'Microempresa ou Empresa de Pequeno Porte (ME/EPP)'
        }[opSimp] || 'Não Optante';

        // DPS
        const dpsNumero = t('nDPS') || t('NumeroRPS') || numeroNFe;
        const dpsSerie = t('serie') || t('SerieRPS') || '1';

        // Situação
        const isCancelada = (
            t('StatusNFe') === 'C' ||
            t('DataCancelamento') !== '' ||
            nomeArquivo.toUpperCase().includes('CANCELADA') ||
            doc.getElementsByTagName('infPedCanc').length > 0 ||
            doc.getElementsByTagName('cancNFSe').length > 0
        );
        const cStat = t('cStat');
        let situacaoNFSe = '100 - NFS-e Gerada';
        if (isCancelada) situacaoNFSe = 'Cancelada';
        else if (cStat === '101') situacaoNFSe = '101 - NFS-e de Substituição Gerada';
        else if (cStat === '107') situacaoNFSe = '107 - NFS-e do MEI Gerada';
        else if (cStat === '102') situacaoNFSe = '102 - NFS-e de Decisao Judicial Gerada';
        else if (cStat === '100') situacaoNFSe = '100 - NFS-e Gerada';
        else if (cStat) situacaoNFSe = cStat;

        // Tributação ISSQN
        const tribISSQNVal = t('tribISSQN');
        const tributacaoISSQN = {
            '1': '1 - Operação Tributável',
            '2': '2 - Imunidade',
            '3': '3 - Exportação',
            '4': '4 - Não Incidência'
        }[tribISSQNVal] || '1 - Operação Tributável';

        // Município de Incidência
        const xLocIncid = t('xLocIncid');
        const cLocIncid = t('cLocIncid') || '';
        let ufIncid = UF_IBGE[cLocIncid.slice(0, 2)] || '';
        let munIncid = '/';
        if (xLocIncid) {
            munIncid = ufIncid ? `${xLocIncid}/${ufIncid}` : xLocIncid;
        }

        // Retenção ISSQN
        const tpRetISSQN = t('tpRetISSQN');
        const retencaoISSQN = {
            '1': '1 - Não Retido',
            '2': '2 - Retido pelo Tomador',
            '3': '3 - Retido pelo Intermediário'
        }[tpRetISSQN] || '1 - Não Retido';

        // Tributação Nacional e NBS
        const cTribNac = t('cTribNac') || '';
        const cTribMun = t('cTribMun') || t('CodigoServico') || '';
        const xTribNac = t('xTribNac') || '';
        const xTribMun = t('xTribMun') || '';

        let codTribNac = '-';
        const cleanNac = cTribNac.replace(/\D/g, '');
        const cleanMun = cTribMun.replace(/\D/g, '');

        if (cleanNac.length === 6) {
            const fmtNac = `${cleanNac.slice(0, 2)}.${cleanNac.slice(2, 4)}.${cleanNac.slice(4, 6)}`;
            const desc = (xTribNac && !xTribNac.includes('tributados no Município')) ? xTribNac : (xTribMun || '');
            codTribNac = desc ? `${fmtNac} - ${desc}` : fmtNac;
        } else if (cleanMun.length >= 4 && cleanMun.length <= 5) {
            const infoServ = obterDetalhesServicoSP(cleanMun);
            const padMun = cleanMun.padStart(5, '0');
            const desc = infoServ?.descricaoMun || (xTribMun && !xTribMun.includes('tributados no Município') ? xTribMun : '') || (xTribNac && !xTribNac.includes('tributados no Município') ? xTribNac : '');
            codTribNac = desc ? `${padMun} - ${desc}` : padMun;
        } else if (cTribNac) {
            const desc = (xTribNac && !xTribNac.includes('tributados no Município')) ? xTribNac : '';
            codTribNac = desc ? `${cTribNac} - ${desc}` : cTribNac;
        } else if (cTribMun) {
            codTribNac = cTribMun;
        }

        const cNBS = t('cNBS') || '';
        const xNBS = t('xNBS') || '';
        let itemNBS = '-';
        if (cNBS && xNBS) itemNBS = `${cNBS} - ${xNBS}`;
        else if (cNBS) itemNBS = `${cNBS} -`;

        // Descrição do Serviço
        const descricaoServico = sanitizarDiscriminacao(t('xDescServ') || t('xInfComp') || t('Discriminacao') || '');

        // IBS / CBS
        const temIbsCbs = !!ibscbs;
        const cstIbsCbs = temIbsCbs ? (t('CST') === '000' ? '000 - Tributação integral' : (t('CST') || '000 - Tributação integral')) : '';
        const rawClassTrib = t('cClassTrib');
        const classTribIbsCbs = temIbsCbs ? (rawClassTrib === '000001' ? '000001 - Situações tributadas integralmente pelo IBS e CBS.' : (rawClassTrib || '')) : '';
        
        let indicadorOperacao = '';
        const cIndOp = t('cIndOp');
        if (cIndOp === '050101') {
            indicadorOperacao = '050101 - Serviço prestado fisicamente sobre bem móvel material - Estabelecimento do fornecedor como local da prestação';
        } else if (cIndOp === '100501') {
            indicadorOperacao = '100501 - Demais bens móveis imateriais, inclusive direitos, em operações onerosas - Local do domicílio principal do adquirente residente ou domiciliado no País. Nas aquisições indicadas no art. 11, §4º, II, considera-se domicílio principal do adquirente o estabelecimentro matriz';
        } else if (cIndOp === '100301') {
            indicadorOperacao = '100301 - Demais serviços, em operações onerosas - Local do domicílio principal do adquirente residente ou domiciliado no País. Nas aquisições indicadas no art. 11, §4º, II, considera-se domicílio principal do adquirente o estabelecimentro matriz';
        } else if (cIndOp) {
            indicadorOperacao = cIndOp;
        }

        const bcIbsCbs = temIbsCbs ? (ne(ibscbs, 'vBC') || valorServicos) : '';
        const reembIbsCbs = temIbsCbs ? 0 : '';
        const aliqCBS = temIbsCbs ? ne(ibscbs, 'pCBS') : '';
        const redAliqCBS = temIbsCbs ? 0 : '';
        const aliqEfetCBS = temIbsCbs ? (ne(ibscbs, 'pAliqEfetCBS') || aliqCBS) : '';
        const valorCBSTotal = temIbsCbs ? ne(ibscbs, 'vCBS') : '';

        const aliqIBSEstadual = temIbsCbs ? ne(ibscbs, 'pIBSUF') : '';
        const redAliqIBSEstadual = temIbsCbs ? 0 : '';
        const aliqEfetIBSEstadual = temIbsCbs ? (ne(ibscbs, 'pAliqEfetUF') || aliqIBSEstadual) : '';
        const valorIBSEstadual = temIbsCbs ? ne(ibscbs, 'vIBSUF') : '';

        const aliqIBSMunicipal = temIbsCbs ? ne(ibscbs, 'pIBSMun') : '';
        const redAliqIBSMunicipal = temIbsCbs ? 0 : '';
        const aliqEfetIBSMunicipal = temIbsCbs ? (ne(ibscbs, 'pAliqEfetMun') || aliqIBSMunicipal) : '';
        const valorIBSMunicipal = temIbsCbs ? ne(ibscbs, 'vIBSMun') : '';
        const valorIBSTotal = temIbsCbs ? (ne(ibscbs, 'vIBSTot') || valorIBSEstadual) : '';

        // PIS / COFINS
        const piscofins = doc.getElementsByTagName('piscofins')[0];
        const cstPis = te(piscofins, 'CST');
        let sitTribPisCofins = 'Não informado';
        if (cstPis === '01') sitTribPisCofins = '1 - Operação Tributável com Alíquota Básica';

        const bcPisCofins = ne(piscofins, 'vBCPisCofins') || 0;
        const aliqPIS = ne(piscofins, 'pAliqPis') || 0;
        const debitoPIS = ne(piscofins, 'vPis') || 0;
        const aliqCOFINS = ne(piscofins, 'pAliqCofins') || 0;
        const debitoCOFINS = ne(piscofins, 'vCofins') || 0;

        const tpRetPisCofins = te(piscofins, 'tpRetPisCofins');
        const descrContribSociaisRet = {
            '0': '0 - PIS/COFINS/CSLL Não Retidos',
            '1': '1 - PIS/COFINS Retido',
            '3': '3 - PIS/COFINS/CSLL Retidos',
            '4': '4 - PIS/COFINS Retidos, CSLL Não Retido',
            '8': '8 - PIS/COFINS Não Retidos, CSLL Retido'
        }[tpRetPisCofins] || 'Não informado';

        const irrf = num('vRetIRRF') || num('ValorIR') || 0;
        const csll = num('vRetCSLL') || num('ValorCSLL') || 0;
        const inss = num('vRetCP') || num('vRetINSS') || num('ValorINSS') || 0;
        const percTotalTribSN = (opSimp === '2' || opSimp === '3') ? (num('pTotTribSN') || num('pTotTrib')) : 0;

        const rawInfComp = t('xInfComp');
        const chSubstda = t('chSubstda');
        let xInfComp = (rawInfComp && !descricaoServico.toLowerCase().includes(rawInfComp.trim().toLowerCase()) && !rawInfComp.trim().toLowerCase().includes(descricaoServico.toLowerCase())) ? rawInfComp : '';
        if (chSubstda) {
            const substText = `NFS-e Subst.: ${chSubstda}`;
            xInfComp = xInfComp ? `${substText} | ${xInfComp}` : substText;
        }
        if (!xInfComp) xInfComp = '-';

        // Cálculo de Retenções e Valor Líquido com Discriminação de Descontos
        const vLiqXml = num('vLiq') || num('ValorLiquidoNfe') || num('ValorLiquido') || num('vLiquido');
        const valorLiquido = (vLiqXml > 0) ? vLiqXml : valorServicos;

        // Impostos retidos expressos no XML (sem vTotalRet que frequentemente traz IBPT/Lei da Transparência)
        const vISSQNRet = ne(valNFSe, 'vISSQNRet') || num('vISSQNRet');
        const temImpostoRetido = Boolean(
            irrf > 0 ||
            csll > 0 ||
            inss > 0 ||
            vISSQNRet > 0 ||
            tpRetISSQN === '2' ||
            tpRetISSQN === '3'
        );

        // Diferença entre bruto e líquido deduzindo os descontos
        const diffBrutoLiquido = Math.max(0, valorServicos - valorLiquido);
        let finalDescIncond = descIncond;
        let finalDescCond = descCond;
        if (valorServicos > valorLiquido && !descCond && !descIncond && !temImpostoRetido) {
            finalDescIncond = diffBrutoLiquido;
        }

        // Descontos identificados
        const temDescontoCond = Boolean(finalDescCond > 0);
        const temDescontoIncond = Boolean(finalDescIncond > 0);
        const temDesconto = Boolean(finalDescCond > 0 || finalDescIncond > 0);
        const totalDescontos = (finalDescIncond || 0) + (finalDescCond || 0);

        const retencaoRestante = Math.max(0, diffBrutoLiquido - totalDescontos);
        // REGRA ESTRITA: se o Valor Líquido é igual ao Valor Bruto (sem redução efetiva no pagamento), NUNCA é Com Retenção!
        const temRetencao = (vLiqXml > 0 && valorServicos > 0)
            ? Boolean(retencaoRestante >= 0.01)
            : Boolean(temImpostoRetido);

        return {
            numeroNFe,
            dataGeracao,
            competencia,
            prestadorCnpj,
            prestadorNome,
            tomadorCnpj,
            tomadorNome,
            valorServicos,
            valorLiquido,
            temRetencao,
            origemCaptacao,
            descIncond: finalDescIncond,
            descCond: finalDescCond,
            temDescontoCond,
            temDescontoIncond,
            temDesconto,
            prestadorIM,
            simplesNacional,
            dpsNumero,
            dpsSerie,
            situacaoNFSe,
            tributacaoISSQN,
            munIncid,
            baseCalculo,
            aliqISSQN,
            valorISSQN,
            retencaoISSQN,
            codTribNac,
            itemNBS,
            descricaoServico,
            cstIbsCbs,
            classTribIbsCbs,
            indicadorOperacao,
            bcIbsCbs,
            reembIbsCbs,
            aliqCBS,
            redAliqCBS,
            aliqEfetCBS,
            valorCBSTotal,
            aliqIBSEstadual,
            redAliqIBSEstadual,
            aliqEfetIBSEstadual,
            valorIBSEstadual,
            aliqIBSMunicipal,
            redAliqIBSMunicipal,
            aliqEfetIBSMunicipal,
            valorIBSMunicipal,
            valorIBSTotal,
            sitTribPisCofins,
            bcPisCofins,
            aliqPIS,
            debitoPIS,
            aliqCOFINS,
            debitoCOFINS,
            descrContribSociaisRet,
            irrf,
            csll,
            inss,
            percTotalTribSN,
            tomadorIM,
            xInfComp,
            evento: '',
            autorEvento: '',
            dataEvento: '',
            dataRegEvento: '',
            situacao: isCancelada ? 'Cancelada' : 'Normal',
            isCancelada,
            chaveNotaNacional
        };
    } catch (_) {
        return null;
    }
}

function scanNotasEmpresa(pastaOutput, razaoSocial, cnpj, ano, mes, tipoFiltro = 'todos', dataInicio = '', dataFim = '') {
    const sanitizeFolder = (name) => (name || '').replace(/[\/\\:*?"<>|]/g, '_').replace(/[\x00-\x1F]/g, '').replace(/\s+/g, ' ').trim().substring(0, 80).replace(/[. ]+$/, '') || 'sem-nome';
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    
    let pastaEmpresa = '';
    if (pastaOutput && fs.existsSync(pastaOutput)) {
        const subdirs = fs.readdirSync(pastaOutput);
        // Verifica se pastaOutput já é o diretório de NFS-e da empresa (contém pastas de anos ex: 2024, 2025, 2026, nfse_state.json, Tomadas, Prestadas ou XMLs)
        const isAlreadyCompanyDir = subdirs.some(s => 
            /^\d{4}$/.test(s) || 
            ['tomadas', 'prestadas', 'eventos', 'nfse'].includes(s.toLowerCase()) || 
            s.toLowerCase().endsWith('.xml') || 
            s === 'nfse_state.json' ||
            s === 'state.json'
        );

        if (isAlreadyCompanyDir) {
            pastaEmpresa = pastaOutput;
        } else {
            for (const sub of subdirs) {
                const cleanSub = sub.toUpperCase();
                if ((razaoSocial && cleanSub.includes(razaoSocial.toUpperCase().substring(0, 15))) || (cleanCnpj && cleanSub.includes(cleanCnpj))) {
                    pastaEmpresa = path.join(pastaOutput, sub);
                    break;
                }
            }
        }
    } else if (pastaOutput) {
        // Fallback: se pastaOutput não existe diretamente, inspeciona o diretório pai (sefaz_empresas)
        const parentDir = path.dirname(pastaOutput);
        if (fs.existsSync(parentDir)) {
            try {
                const entries = fs.readdirSync(parentDir);
                const match = entries.find(e => cleanCnpj && e.includes(cleanCnpj));
                if (match) {
                    if (fs.existsSync(path.join(parentDir, match))) {
                        pastaEmpresa = path.join(parentDir, match);
                    }
                }
            } catch (_) {}
        }
    }

    if (!pastaEmpresa && razaoSocial && pastaOutput) {
        pastaEmpresa = path.join(pastaOutput, sanitizeFolder(razaoSocial).toUpperCase());
    }

    const resultado = [];
    if (!pastaEmpresa || !fs.existsSync(pastaEmpresa)) return resultado;

    function varrer(diretorio, tipoDocFolder = 'Geral') {
        if (!fs.existsSync(diretorio)) return;
        const itens = fs.readdirSync(diretorio);

        for (const item of itens) {
            const caminhoCompleto = path.join(diretorio, item);
            let stat;
            try {
                stat = fs.statSync(caminhoCompleto);
            } catch (_) {
                continue;
            }

            if (stat.isDirectory()) {
                const lowerItem = item.toLowerCase();
                // Ignora pastas exclusivas de outros modelos fiscais
                if (['cte', 'nfce', 'nfe entradas', 'danfes', 'xmls'].includes(lowerItem)) {
                    continue;
                }
                let proximoTipo = tipoDocFolder;
                if (lowerItem.includes('são paulo') || lowerItem.includes('sao paulo')) proximoTipo = 'Tomadas - São Paulo';
                else if (lowerItem.includes('serviços prestados') || lowerItem.includes('servicos prestados') || lowerItem.includes('prestadas') || lowerItem.includes('emitidas')) proximoTipo = 'Prestadas';
                else if (lowerItem.includes('serviços tomados') || lowerItem.includes('servicos tomados') || lowerItem.includes('tomadas') || lowerItem.includes('recebidas')) proximoTipo = 'Tomadas';
                else if (lowerItem.includes('eventos')) proximoTipo = 'Eventos';
                else if (lowerItem === 'nfse') proximoTipo = 'NFSE';
                varrer(caminhoCompleto, proximoTipo);
            } else if (item.toLowerCase().endsWith('.xml')) {
                // Filtro preliminar por pasta se já estiver em pasta específica (legado)
                if (tipoFiltro && tipoFiltro !== 'todos' && tipoDocFolder !== 'Geral' && tipoDocFolder !== 'NFSE') {
                    const normFiltro = tipoFiltro.toLowerCase();
                    const normTipo = tipoDocFolder.toLowerCase();
                    if (normFiltro.includes('prest') && !normTipo.includes('prest') && !normTipo.includes('emit')) continue;
                    if (normFiltro.includes('tom') && !normTipo.includes('tom') && !normTipo.includes('receb')) continue;
                }

                const relPath = path.relative(pastaEmpresa, caminhoCompleto).replace(/\\/g, '/');

                try {
                    const xmlContent = fs.readFileSync(caminhoCompleto, 'utf-8');
                    const parsed = parseXmlNota(xmlContent, item);
                    if (parsed) {
                        // Extração rigorosa da competência contábil (MM/AAAA)
                        let compAno = '';
                        let compMes = '';
                        if (parsed.competencia) {
                            const pComp = String(parsed.competencia).trim();
                            const mBr = /^(\d{1,2})\/(\d{4})$/.exec(pComp);
                            if (mBr) {
                                compMes = mBr[1].padStart(2, '0');
                                compAno = mBr[2];
                            } else {
                                const mIso = /^(\d{4})[-/.](\d{2})/.exec(pComp);
                                if (mIso) {
                                    compAno = mIso[1];
                                    compMes = mIso[2];
                                }
                            }
                        }
                        if (!compAno || !compMes) {
                            // Fallback apenas se a tag de competência for inexistente no XML
                            if (parsed.dataGeracao) {
                                const pDg = String(parsed.dataGeracao).trim();
                                const mBr = /^\d{1,2}\/(\d{1,2})\/(\d{4})/.exec(pDg);
                                if (mBr) {
                                    compMes = mBr[1].padStart(2, '0');
                                    compAno = mBr[2];
                                } else {
                                    const mIso = /^(\d{4})[-/.](\d{2})/.exec(pDg);
                                    if (mIso) {
                                        compAno = mIso[1];
                                        compMes = mIso[2];
                                    }
                                }
                            }
                        }
                        if (!compAno || !compMes) {
                            const mPath = relPath.match(/(\d{4})[\\/](\d{2})/);
                            if (mPath) {
                                compAno = mPath[1];
                                compMes = mPath[2];
                            }
                        }

                        // Filtro rigoroso por Competência (Ano e Mês)
                        if (ano && ano !== 'todos') {
                            if (!compAno || compAno !== String(ano)) continue;
                        }
                        if (mes && mes !== 'todos') {
                            const mesPad = String(mes).padStart(2, '0');
                            if (!compMes || compMes !== mesPad) continue;
                        }

                        // Filtro opcional por intervalo de datas (respeitando competência)
                        if (dataInicio || dataFim) {
                            const compIso = (compAno && compMes) ? `${compAno}-${compMes}-01` : '';
                            if (compIso) {
                                if (dataInicio && compIso < dataInicio.slice(0, 7) + '-01') continue;
                                if (dataFim && compIso > dataFim.slice(0, 7) + '-31') continue;
                            }
                        }

                        // Validação de pertencimento à empresa: garante que notas de outra empresa não contaminem a listagem
                        const cleanEmit = (parsed.prestadorCnpj || '').replace(/\D/g, '');
                        const cleanToma = (parsed.tomadorCnpj || '').replace(/\D/g, '');
                        if (cleanCnpj && cleanCnpj.length >= 8) {
                            const rootOwner = cleanCnpj.slice(0, 8);
                            const matchesEmit = cleanEmit && cleanEmit.slice(0, 8) === rootOwner;
                            const matchesToma = cleanToma && cleanToma.slice(0, 8) === rootOwner;
                            // Se ambos prestador e tomador estão preenchidos e nenhum pertence à empresa (nem consta no XML), ignora
                            if (cleanEmit && cleanToma && !matchesEmit && !matchesToma && !xmlContent.includes(rootOwner)) {
                                continue;
                            }
                        }

                        // Classifica dinamicamente Prestadas vs Tomadas pelo CNPJ do Prestador vs Tomador (com fallback para pasta)
                        let docTipo = tipoDocFolder;
                        const isOwnerEmit = Boolean(cleanCnpj && cleanEmit && (cleanEmit === cleanCnpj || cleanEmit.slice(0, 8) === cleanCnpj.slice(0, 8)));
                        const isOwnerToma = Boolean(cleanCnpj && cleanToma && (cleanToma === cleanCnpj || cleanToma.slice(0, 8) === cleanCnpj.slice(0, 8)));
                        const isSpNota = parsed.origemCaptacao === 'PORTAL_SP' || docTipo === 'Tomadas - São Paulo';
                        if (isOwnerEmit && !isOwnerToma) {
                            docTipo = 'Prestadas';
                        } else if (isOwnerToma && !isOwnerEmit) {
                            docTipo = isSpNota ? 'Tomadas - São Paulo' : 'Tomadas';
                        } else if (docTipo === 'NFSE' || docTipo === 'Geral') {
                            docTipo = isOwnerEmit ? 'Prestadas' : (isSpNota ? 'Tomadas - São Paulo' : 'Tomadas');
                        } else if (docTipo === 'Tomadas' && isSpNota) {
                            docTipo = 'Tomadas - São Paulo';
                        }

                        if (tipoFiltro && tipoFiltro !== 'todos') {
                            const normFiltro = tipoFiltro.toLowerCase();
                            const normTipo = docTipo.toLowerCase();
                            if (normFiltro.includes('prest') && !normTipo.includes('prest') && !normTipo.includes('emit')) continue;
                            if (normFiltro.includes('tom') && !normTipo.includes('tom') && !normTipo.includes('receb')) continue;
                        }

                        const pdfPath = caminhoCompleto.replace(/\.xml$/i, '.pdf');
                        const eventoPath = caminhoCompleto.replace(/\.xml$/i, ' - EVENTO_CANCELAMENTO.xml');

                        // Se houver arquivo de evento de cancelamento associado, extrai os dados do evento
                        if (fs.existsSync(eventoPath)) {
                            try {
                                const evXml = fs.readFileSync(eventoPath, 'utf-8');
                                const evDoc = new DOMParser().parseFromString(evXml, 'text/xml');
                                parsed.evento = evDoc.getElementsByTagName('xDesc')[0]?.textContent?.trim() || 'Cancelamento de NFS-e';
                                parsed.autorEvento = evDoc.getElementsByTagName('CNPJAutor')[0]?.textContent?.trim() || '';
                                parsed.dataEvento = formatarData(evDoc.getElementsByTagName('dhEvento')[0]?.textContent?.trim() || '');
                                parsed.dataRegEvento = formatarData(evDoc.getElementsByTagName('dhProc')[0]?.textContent?.trim() || '');
                            } catch (_) {}
                        }

                        resultado.push({
                            ...parsed,
                            tipo: docTipo,
                            caminhoXml: caminhoCompleto,
                            caminhoPdf: fs.existsSync(pdfPath) ? pdfPath : null,
                            caminhoEventoXml: fs.existsSync(eventoPath) ? eventoPath : null,
                            nomeArquivoXml: item
                        });
                    }
                } catch (_) {}
            }
        }
    }

    varrer(pastaEmpresa);

    // Deduplicação por (Número da Nota, CNPJ Prestador, CNPJ Tomador, Valor dos Serviços)
    // Prioriza sempre a versão do Portal Nacional (melhor discriminação de itens e tributos) e/ou versão cancelada atualizada
    const dedupMap = new Map();
    for (const nota of resultado) {
        const key = gerarChaveDedupNfse({
            numeroNFe: nota.numeroNFe,
            prestadorCnpj: nota.prestadorCnpj,
            tomadorCnpj: nota.tomadorCnpj || cleanCnpj,
            valorServicos: nota.valorServicos
        });
        if (!dedupMap.has(key)) {
            dedupMap.set(key, nota);
        } else {
            const existing = dedupMap.get(key);
            const preferNew = (
                (nota.isCancelada && !existing.isCancelada) ||
                (nota.origemCaptacao === 'PORTAL_NACIONAL' && existing.origemCaptacao !== 'PORTAL_NACIONAL' && !existing.isCancelada)
            );
            if (preferNew) {
                dedupMap.set(key, nota);
            }
        }
    }

    let listaDedup = Array.from(dedupMap.values());

    if (dataInicio || dataFim) {
        listaDedup = listaDedup.filter(n => {
            const iso = converterDataBrParaIso(n.dataGeracao);
            if (!iso) return true;
            if (dataInicio && iso < dataInicio) return false;
            if (dataFim && iso > dataFim) return false;
            return true;
        });
    }

    return listaDedup;
}

function gerarChaveDedupNfse(arg1, arg2, arg3, arg4) {
    let numeroNFe, prestadorCnpj, tomadorCnpj, valorServicos;
    if (arg1 && typeof arg1 === 'object') {
        numeroNFe = arg1.numeroNFe || arg1.numero;
        prestadorCnpj = arg1.prestadorCnpj;
        tomadorCnpj = arg1.tomadorCnpj;
        valorServicos = arg1.valorServicos;
    } else {
        numeroNFe = arg1;
        prestadorCnpj = arg2;
        tomadorCnpj = arg3;
        valorServicos = arg4;
    }
    const numNorm = String(numeroNFe || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
    const prestNorm = String(prestadorCnpj || '').replace(/\D/g, '');
    const tomaNorm = String(tomadorCnpj || '').replace(/\D/g, '');
    const valNorm = Number(valorServicos || 0).toFixed(2);
    if (numNorm === '0' && !prestNorm) return '';
    return `${numNorm}|${prestNorm}|${tomaNorm}|${valNorm}`;
}

function indexarNotasExistentes(pastaEmpresa, cleanOwnerCnpj = '') {
    const map = new Map();
    if (!pastaEmpresa || !fs.existsSync(pastaEmpresa)) return map;

    function walk(dir) {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const lower = entry.name.toLowerCase();
                if (['cte', 'nfce', 'nfe entradas', 'danfes', 'xmls', 'eventos'].includes(lower)) continue;
                walk(full);
            } else if (entry.name.toLowerCase().endsWith('.xml')) {
                if (entry.name.toUpperCase().includes('EVENTO')) continue;
                try {
                    const xmlContent = fs.readFileSync(full, 'utf-8');
                    const parsed = parseXmlNota(xmlContent, entry.name);
                    if (!parsed) continue;
                    const key = gerarChaveDedupNfse({
                        numeroNFe: parsed.numeroNFe,
                        prestadorCnpj: parsed.prestadorCnpj,
                        tomadorCnpj: parsed.tomadorCnpj || cleanOwnerCnpj,
                        valorServicos: parsed.valorServicos
                    });
                    const pdfPath = full.replace(/\.xml$/i, '.pdf');
                    const info = {
                        key,
                        caminhoXml: full,
                        caminhoPdf: pdfPath,
                        hasPdf: fs.existsSync(pdfPath),
                        isCancelada: parsed.isCancelada,
                        origemCaptacao: parsed.origemCaptacao
                    };
                    if (!map.has(key) || (info.origemCaptacao === 'PORTAL_NACIONAL' && map.get(key).origemCaptacao !== 'PORTAL_NACIONAL')) {
                        map.set(key, info);
                    }
                } catch (_) {}
            }
        }
    }

    walk(pastaEmpresa);
    return map;
}

const CABECALHO_CSV = [
    'COMPETENCIA',
    'DATA GERAÇÃO',
    'SITUAÇÃO',
    'NUMERO NFS-E',
    'NOME PRESTADOR',
    'CNPJ PRESTADOR',
    'VALOR TOTAL',
    'CSRF RETIDOS?',
    'PIS',
    'COFINS',
    'CSRF',
    'IRRF',
    'ISS RETIDO?',
    'ISS',
    'INSS',
    'VALOR LIQUIDO'
];

function gerarCsvRelatorio(listaNotas, tipoRelatorio = 'Tomadas') {
    const isPrestados = String(tipoRelatorio || '').toLowerCase().includes('prest');
    const cabecalho = CABECALHO_CSV.join(';');

    const linhas = listaNotas.map(n => {
        const parceiroNome = isPrestados ? (n.tomadorNome || n.prestadorNome) : (n.prestadorNome || n.tomadorNome);
        const parceiroCnpj = isPrestados ? (n.tomadorCnpj || n.prestadorCnpj) : (n.prestadorCnpj || n.tomadorCnpj);
        const vLiq = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
            ? Number(n.valorLiquido)
            : (Number(n.valorServicos) || 0);

        return [
            formatarCompetenciaCsv(n.competencia, n.dataGeracao),
            n.dataGeracao,
            n.situacao,
            n.numeroNFe,
            formatarTextoCsv(parceiroNome),
            formatarCpfCnpj(parceiroCnpj),
            formatarMoeda(n.valorServicos),
            n.descrContribSociaisRet,
            formatarMoeda(n.debitoPIS),
            formatarMoeda(n.debitoCOFINS),
            formatarMoeda(n.csll),
            formatarMoeda(n.irrf),
            n.retencaoISSQN,
            formatarMoeda(n.valorISSQN),
            formatarMoeda(n.inss),
            formatarMoeda(vLiq)
        ].join(';');
    });

    const totais = {
        valorServicos: 0,
        debitoPIS: 0,
        debitoCOFINS: 0,
        csll: 0,
        irrf: 0,
        valorISS: 0,
        inss: 0,
        valorLiquido: 0
    };

    for (const n of listaNotas) {
        const vServ = Number(n.valorServicos) || 0;
        const vLiq = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
            ? Number(n.valorLiquido)
            : vServ;
        totais.valorServicos += vServ;
        totais.debitoPIS += Number(n.debitoPIS) || 0;
        totais.debitoCOFINS += Number(n.debitoCOFINS) || 0;
        totais.csll += Number(n.csll) || 0;
        totais.irrf += Number(n.irrf) || 0;
        totais.valorISS += Number(n.valorISSQN) || 0;
        totais.inss += Number(n.inss) || 0;
        totais.valorLiquido += vLiq;
    }

    const linhaTotais = [
        '',
        '',
        '',
        '',
        '',
        '',
        formatarMoeda(totais.valorServicos),
        '',
        formatarMoeda(totais.debitoPIS),
        formatarMoeda(totais.debitoCOFINS),
        formatarMoeda(totais.csll),
        formatarMoeda(totais.irrf),
        '',
        formatarMoeda(totais.valorISS),
        formatarMoeda(totais.inss),
        formatarMoeda(totais.valorLiquido)
    ].join(';');

    // Adiciona BOM UTF-8 (\uFEFF) para abertura perfeita no Microsoft Excel em Português
    return '\uFEFF' + [cabecalho, ...linhas, linhaTotais].join('\r\n');
}

function gerarPacoteZip(listaNotas) {
    const zip = new AdmZip();

    for (const nota of listaNotas) {
        const isCanc = nota.situacao === 'Cancelada' || nota.isCancelada;
        const tipoUpper = String(nota.tipo || '').toUpperCase();
        const isSp = nota.origemCaptacao === 'PORTAL_SP' || tipoUpper.includes('SÃO PAULO') || tipoUpper.includes('SAO PAULO') || String(nota.caminhoXml || '').toUpperCase().includes('SÃO PAULO');
        let subFolder = '';
        if (tipoUpper.includes('PRESTAD') || tipoUpper.includes('EMITID')) {
            subFolder = isCanc ? 'SERVIÇOS PRESTADOS - CANCELADAS' : 'SERVIÇOS PRESTADOS';
        } else if (isSp) {
            subFolder = isCanc ? 'SERVIÇOS TOMADOS - SÃO PAULO - CANCELADAS' : 'SERVIÇOS TOMADOS - SÃO PAULO';
        } else {
            subFolder = isCanc ? 'SERVIÇOS TOMADOS - CANCELADAS' : 'SERVIÇOS TOMADOS';
        }

        if (nota.caminhoXml && fs.existsSync(nota.caminhoXml)) {
            zip.addLocalFile(nota.caminhoXml, subFolder);
        }
        if (nota.caminhoPdf && fs.existsSync(nota.caminhoPdf)) {
            zip.addLocalFile(nota.caminhoPdf, subFolder);
        }
        if (nota.caminhoEventoXml && fs.existsSync(nota.caminhoEventoXml)) {
            zip.addLocalFile(nota.caminhoEventoXml, subFolder);
        }
    }

    return zip.toBuffer();
}

function calcularMetricas(listaNotas) {
    let totalNotas = 0;
    let valorTotalEmitidas = 0;
    let valorTotalRecebidas = 0;
    let totalImpostosRetidos = 0;
    let totalCanceladas = 0;
    let totalIbsCbsApurado = 0;

    for (const n of listaNotas) {
        totalNotas++;
        if (n.situacao === 'Cancelada' || n.isCancelada) {
            totalCanceladas++;
            continue;
        }

        const vServ = Number(n.valorServicos) || 0;
        if (n.tipo === 'Prestadas' || n.tipo === 'Emitidas') valorTotalEmitidas += vServ;
        else if (n.tipo === 'Tomadas' || n.tipo === 'Recebidas' || (n.tipo && n.tipo.includes('Tomadas'))) valorTotalRecebidas += vServ;
        else valorTotalEmitidas += vServ;

        const retFed = (Number(n.debitoPIS) || 0) + (Number(n.debitoCOFINS) || 0) + (Number(n.irrf) || 0) + (Number(n.csll) || 0) + (Number(n.inss) || 0);
        totalImpostosRetidos += retFed;
        totalIbsCbsApurado += (Number(n.valorIBSTot) || 0) + (Number(n.valorCBSTotal) || 0);
    }

    return {
        totalNotas,
        valorTotalEmitidas,
        valorTotalRecebidas,
        totalMovimentado: valorTotalEmitidas - valorTotalRecebidas,
        totalImpostosRetidos,
        totalCanceladas,
        totalIbsCbsApurado
    };
}

module.exports = {
    scanNotasEmpresa,
    gerarCsvRelatorio,
    gerarPacoteZip,
    calcularMetricas,
    parseXmlNota,
    gerarChaveDedupNfse,
    indexarNotasExistentes
};
