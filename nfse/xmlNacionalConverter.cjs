const { DOMParser } = require('@xmldom/xmldom');
const { obterDetalhesServicoSP } = require('./danfseSP.cjs');

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtNum(val, def = '0.00') {
  if (!val) return def;
  const n = parseFloat(String(val).replace(',', '.'));
  if (isNaN(n)) return def;
  return n.toFixed(2);
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

function converterSpParaXmlNacional(xmlSpString) {
  if (!xmlSpString || typeof xmlSpString !== 'string') return '';
  // Se já for um XML Padrão Nacional, retorna o próprio
  if (xmlSpString.includes('<NFSe') && xmlSpString.includes('xmlns="http://www.sped.fazenda.gov.br/nfse"')) {
    return xmlSpString;
  }

  const doc = new DOMParser().parseFromString(xmlSpString, 'text/xml');
  const nfe = doc.getElementsByTagName('NFe')[0] || doc.documentElement;

  const t = (name) => {
    const el = nfe.getElementsByTagName(name)[0];
    return el ? (el.textContent || '').trim() : '';
  };

  const te = (parentName, childName) => {
    const p = nfe.getElementsByTagName(parentName)[0];
    if (!p) return '';
    const el = p.getElementsByTagName(childName)[0];
    return el ? (el.textContent || '').trim() : '';
  };

  const numeroNFe = t('NumeroNFe') || '0';
  const codigoVerificacao = t('CodigoVerificacao') || '';
  let chaveNotaNacional = t('ChaveNotaNacional') || '';

  const prestCnpj = (t('CNPJ') || te('CPFCNPJPrestador', 'CNPJ') || te('CPFCNPJPrestador', 'CPF') || '').replace(/\D/g, '');
  const prestIm = (t('InscricaoPrestador') || '').replace(/\D/g, '');
  const prestNome = t('RazaoSocialPrestador') || 'PRESTADOR DE SERVIÇOS';

  const tomaCnpjCpf = (te('CPFCNPJTomador', 'CNPJ') || te('CPFCNPJTomador', 'CPF') || '').replace(/\D/g, '');
  const tomaTipoDoc = tomaCnpjCpf.length > 11 ? 'CNPJ' : 'CPF';
  const tomaIm = (t('InscricaoTomador') || '').replace(/\D/g, '');
  const tomaNome = t('RazaoSocialTomador') || 'TOMADOR DE SERVIÇOS';
  const tomaEmail = t('EmailTomador') || '';

  // Endereço Prestador
  const prestTipoLgr = te('EnderecoPrestador', 'TipoLogradouro') || '';
  const prestLgrBase = te('EnderecoPrestador', 'Logradouro') || '';
  const prestLgr = [prestTipoLgr, prestLgrBase].filter(Boolean).join(' ') || 'São Paulo';
  const prestNro = te('EnderecoPrestador', 'NumeroEndereco') || 'S/N';
  const prestCpl = te('EnderecoPrestador', 'ComplementoEndereco') || '';
  const prestBairro = te('EnderecoPrestador', 'Bairro') || 'Centro';
  const prestCep = (te('EnderecoPrestador', 'CEP') || '01000000').replace(/\D/g, '');
  const prestEmail = t('EmailPrestador') || '';

  // Endereço Tomador
  const tomaTipoLgr = te('EnderecoTomador', 'TipoLogradouro') || '';
  const tomaLgrBase = te('EnderecoTomador', 'Logradouro') || '';
  const tomaLgr = [tomaTipoLgr, tomaLgrBase].filter(Boolean).join(' ') || 'Endereço';
  const tomaNro = te('EnderecoTomador', 'NumeroEndereco') || 'S/N';
  const tomaCpl = te('EnderecoTomador', 'ComplementoEndereco') || '';
  const tomaBairro = te('EnderecoTomador', 'Bairro') || 'Bairro';
  const tomaCep = (te('EnderecoTomador', 'CEP') || '00000000').replace(/\D/g, '');
  let tomaCidade = te('EnderecoTomador', 'Cidade') || '3550308';
  if (!/^\d+$/.test(tomaCidade)) {
    tomaCidade = '3550308'; // Default SP caso não seja numérico
  }

  // Datas
  const dataEmissaoRaw = t('DataEmissaoNFe') || t('DataFatoGeradorNFe') || new Date().toISOString();
  let dhProc = dataEmissaoRaw;
  if (!dhProc.includes('T')) {
    dhProc = `${dhProc}T00:00:00-03:00`;
  } else if (!dhProc.includes('-03:00') && !dhProc.endsWith('Z')) {
    dhProc = `${dhProc}-03:00`;
  }

  const dCompet = (t('DataFatoGeradorNFe') || dataEmissaoRaw).slice(0, 10);
  const anoMes = dCompet.replace(/\D/g, '').slice(2, 6) || '2601';

  // Chave Nacional: 50 dígitos
  if (!chaveNotaNacional || chaveNotaNacional.length !== 50) {
    const cMunEmi = '3550308';
    const cnpj14 = prestCnpj.padStart(14, '0').slice(-14);
    const nNfePadded = String(numeroNFe).replace(/\D/g, '').padStart(9, '0').slice(-9);
    const hashVerif = (codigoVerificacao.replace(/\W/g, '') + '00000000').slice(0, 8);
    // 7 + 4 + 14 + 6 + 9 + 10 = 50 dígitos
    chaveNotaNacional = `${cMunEmi}${anoMes}${cnpj14}000000${nNfePadded}1${hashVerif}`.slice(0, 50);
  }

  // RPS
  const numeroRPS = t('NumeroRPS') || numeroNFe;
  const serieRPS = t('SerieRPS') || 'SP000';
  const dpsId = `DPS3550308${anoMes}${prestCnpj.padStart(14, '0')}${serieRPS.padEnd(5, '0')}${String(numeroRPS).padStart(15, '0')}`.slice(0, 50);

  // Status
  const isCancelada = (t('StatusNFe') === 'C' || t('DataCancelamento') !== '');
  const cStat = isCancelada ? '101' : '100';

  // Valores e Alíquotas
  const vServ = fmtNum(t('ValorServicos') || t('ValorTotalRecebido') || '0.00');
  const vDed = fmtNum(t('ValorDeducoes') || '0.00');
  const vBC = fmtNum(t('BaseCalculo') || vServ);
  let aliqVal = parseFloat(String(t('AliquotaServicos') || '0').replace(',', '.'));
  if (aliqVal < 1 && aliqVal > 0) aliqVal = aliqVal * 100;
  const pAliq = aliqVal.toFixed(2);
  const vISS = fmtNum(t('ValorISS') || '0.00');

  const issRetido = (t('ISSRetido') === 'true' || t('ISSRetido') === '1' || t('ISSRetido') === 'S');
  const tpRetISSQN = issRetido ? '2' : '1';
  const tributacao = t('TributacaoNFe');
  const tribISSQN = (tributacao === 'I' || tributacao === 'J') ? '2' : '1';

  // Serviços e Discriminação
  const codServicoRaw = t('CodigoServico') || t('cTribMun') || t('cTribNac') || '00000';
  const infoServico = obterDetalhesServicoSP(codServicoRaw);
  const codServicoMun = infoServico.codigoMun;
  const descServicoMun = infoServico.descricaoMun;
  const codServicoNac = infoServico.cTribNac;
  const descServicoNac = infoServico.descricaoNac;
  const discriminacao = sanitizarDiscriminacao(t('Discriminacao') || t('xDescServ') || '');
  const discText = discriminacao.toLowerCase();

  // Regime Tributário
  const opcaoSimples = t('OpcaoSimples');
  const isSimples = (opcaoSimples === '1' || opcaoSimples === 'true');
  const opSimpNac = isSimples ? '2' : '1';

  // Retenções Federais e Valores
  const numPIS = parseFloat(t('ValorPIS') || '0') || 0;
  const numCOFINS = parseFloat(t('ValorCOFINS') || '0') || 0;
  const numCSLL = parseFloat(t('ValorCSLL') || '0') || 0;
  const numIRRF = parseFloat(t('ValorIR') || '0') || 0;
  const numINSS = parseFloat(t('ValorINSS') || '0') || 0;
  const vServNum = parseFloat(vServ) || 0;
  const vIssNum = parseFloat(vISS) || 0;
  const vDedNum = parseFloat(vDed) || 0;

  // Valor Líquido explícito fornecido pelo ambiente SP (se houver tag própria no XML)
  const vLiqExplicitNum = parseFloat(t('ValorLiquidoNFe') || t('ValorLiquido') || t('ValorTotalRecebido') || '0');

  // Declaração expressa de NÃO retenção no corpo da nota
  const declaraSemRetencao = /n[ãa]o\s+(est[ãa]o\s+)?sujeit[oa]s?\s+[àa]\s+reten[çc][ãa]o|sem\s+reten[çc][ãa]o|dispensad[oa]\s+de\s+reten[çc][ãa]o|n[ãa]o\s+h[áa]\s+reten[çc][ãa]o/i.test(discText);

  let isPisCofinsRetido = false;
  let isIrRetido = false;
  let isInssRetido = false;

  if (!declaraSemRetencao) {
    // 1. Se veio tag explícita de Valor Líquido do ambiente SP que comprove abatimento de retenções
    if (vLiqExplicitNum > 0 && (vServNum - vLiqExplicitNum) >= 0.01) {
      const dif = Math.round((vServNum - vDedNum - (issRetido ? vIssNum : 0) - vLiqExplicitNum) * 100) / 100;
      if (dif > 0) {
        if (numIRRF > 0 && Math.abs(dif - numIRRF) < 0.02) {
          isIrRetido = true;
        } else if ((numPIS + numCOFINS + numCSLL) > 0 && Math.abs(dif - (numPIS + numCOFINS + numCSLL)) < 0.02) {
          isPisCofinsRetido = true;
        } else if ((numPIS + numCOFINS + numCSLL + numIRRF + numINSS) > 0 && Math.abs(dif - (numPIS + numCOFINS + numCSLL + numIRRF + numINSS)) < 0.05) {
          isPisCofinsRetido = (numPIS + numCOFINS + numCSLL) > 0;
          isIrRetido = numIRRF > 0;
          isInssRetido = numINSS > 0;
        }
      }
    }

    // 2. Se a discriminação textual indica expressamente retenção de tributos federais ou valor líquido
    const mLiqDisc = discText.match(/valor\s+l[íi]quido\s*(?:r\$|:)?\s*([\d\.,]+)/i);
    const vLiqDiscNum = mLiqDisc ? parseFloat(mLiqDisc[1].replace(/\./g, '').replace(',', '.')) : 0;

    if (vLiqDiscNum > 0 && (vServNum - vLiqDiscNum) >= 0.01) {
      const difDisc = Math.round((vServNum - vDedNum - (issRetido ? vIssNum : 0) - vLiqDiscNum) * 100) / 100;
      if (difDisc > 0 && Math.abs(difDisc - (numPIS + numCOFINS + numCSLL + numIRRF + numINSS)) < 0.05) {
        isPisCofinsRetido = (numPIS + numCOFINS + numCSLL) > 0;
        isIrRetido = numIRRF > 0;
        isInssRetido = numINSS > 0;
      }
    } else if (!isSimples) {
      // Se não for Simples Nacional e houver menção textual direta a tributo retido
      if (/irrf\s+ret|ir\s+ret/i.test(discText) && numIRRF > 0) isIrRetido = true;
      if (/pis\s+ret|cofins\s+ret|csrf|csl\s+ret/i.test(discText) && (numPIS + numCOFINS + numCSLL) > 0) isPisCofinsRetido = true;
      if (/inss\s+ret/i.test(discText) && numINSS > 0) isInssRetido = true;
    }
  }

  // Valores retidos: só preenchidos se houver retenção discriminada e confirmada
  const vRetPIS = fmtNum(isPisCofinsRetido ? numPIS : 0);
  const vRetCOFINS = fmtNum(isPisCofinsRetido ? numCOFINS : 0);
  const vRetCSLL = fmtNum(isPisCofinsRetido ? numCSLL : 0);
  const vRetIRRF = fmtNum(isIrRetido ? numIRRF : 0);
  const vRetCP = fmtNum(isInssRetido ? numINSS : 0);

  const tpRetPisCofins = isPisCofinsRetido ? '3' : '0';

  const totalRetSp = (issRetido ? vIssNum : 0) + (isIrRetido ? numIRRF : 0) + (isInssRetido ? numINSS : 0) + (isPisCofinsRetido ? (numPIS + numCOFINS + numCSLL) : 0);

  // Valor Líquido fidedigno: se houver retenção discriminada, desconta; se não houver, é o valor integral do serviço
  const vLiq = fmtNum(vLiqExplicitNum > 0 ? vLiqExplicitNum : Math.max(0, vServNum - vDedNum - totalRetSp));

  // Bloco IBS / CBS se presente
  const cstIbs = t('CST');
  const vIbs = t('ValorIBS');
  const vCbs = t('ValorCBS');
  const hasIbsCbs = !!(cstIbs || vIbs || vCbs);

  // Montagem do XML Padrão Nacional (Portal Nacional NFS-e v1.01)
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse">
  <infNFSe Id="NFS${escapeXml(chaveNotaNacional)}">
    <OrigemCaptacao>PORTAL_SP</OrigemCaptacao>
    <xLocEmi>São Paulo</xLocEmi>
    <xLocPrestacao>São Paulo</xLocPrestacao>
    <nNFSe>${escapeXml(numeroNFe)}</nNFSe>
    <cLocIncid>3550308</cLocIncid>
    <xLocIncid>São Paulo</xLocIncid>
    <xTribNac>${escapeXml(descServicoNac)}</xTribNac>
    <xTribMun>${escapeXml(descServicoMun)}</xTribMun>
    <verAplic>PMSP_WebServices_1.0</verAplic>
    <ambGer>1</ambGer>
    <tpEmis>1</tpEmis>
    <procEmi>1</procEmi>
    <cStat>${escapeXml(cStat)}</cStat>
    <dhProc>${escapeXml(dhProc)}</dhProc>
    <nDFSe>${escapeXml(numeroNFe)}</nDFSe>
    <emit>
      <CNPJ>${escapeXml(prestCnpj)}</CNPJ>
      ${prestIm ? `<IM>${escapeXml(prestIm)}</IM>` : ''}
      <xNome>${escapeXml(prestNome)}</xNome>
      <enderNac>
        <xLgr>${escapeXml(prestLgr)}</xLgr>
        <nro>${escapeXml(prestNro)}</nro>
        ${prestCpl ? `<xCpl>${escapeXml(prestCpl)}</xCpl>` : ''}
        <xBairro>${escapeXml(prestBairro)}</xBairro>
        <cMun>3550308</cMun>
        <UF>SP</UF>
        <CEP>${escapeXml(prestCep)}</CEP>
      </enderNac>
      ${prestEmail ? `<email>${escapeXml(prestEmail)}</email>` : ''}
    </emit>
    <valores>
      <vBC>${vBC}</vBC>
      <pAliqAplic>${pAliq}</pAliqAplic>
      <vISSQN>${vISS}</vISSQN>
      <vLiq>${vLiq}</vLiq>
    </valores>
    <DPS versao="1.00" xmlns="http://www.sped.fazenda.gov.br/nfse">
      <infDPS Id="${escapeXml(dpsId)}">
        <tpAmb>1</tpAmb>
        <dhEmi>${escapeXml(dhProc)}</dhEmi>
        <verAplic>PMSP_WebServices_1.0</verAplic>
        <serie>${escapeXml(serieRPS)}</serie>
        <nDPS>${escapeXml(numeroRPS)}</nDPS>
        <dCompet>${escapeXml(dCompet)}</dCompet>
        <tpEmit>1</tpEmit>
        <cLocEmi>3550308</cLocEmi>
        <prest>
          <CNPJ>${escapeXml(prestCnpj)}</CNPJ>
          ${prestIm ? `<IM>${escapeXml(prestIm)}</IM>` : ''}
          <regTrib>
            <opSimpNac>${escapeXml(opSimpNac)}</opSimpNac>
            ${isSimples ? '<regApTribSN>1</regApTribSN>' : ''}
            <regEspTrib>0</regEspTrib>
          </regTrib>
        </prest>
        <toma>
          <${tomaTipoDoc}>${escapeXml(tomaCnpjCpf)}</${tomaTipoDoc}>
          ${tomaIm ? `<IM>${escapeXml(tomaIm)}</IM>` : ''}
          <xNome>${escapeXml(tomaNome)}</xNome>
          <end>
            <endNac>
              <cMun>${escapeXml(tomaCidade)}</cMun>
              <CEP>${escapeXml(tomaCep)}</CEP>
            </endNac>
            <xLgr>${escapeXml(tomaLgr)}</xLgr>
            <nro>${escapeXml(tomaNro)}</nro>
            ${tomaCpl ? `<xCpl>${escapeXml(tomaCpl)}</xCpl>` : ''}
            <xBairro>${escapeXml(tomaBairro)}</xBairro>
          </end>
          ${tomaEmail ? `<email>${escapeXml(tomaEmail)}</email>` : ''}
        </toma>
        <serv>
          <locPrest>
            <cLocPrestacao>3550308</cLocPrestacao>
          </locPrest>
          <cServ>
            <cTribNac>${escapeXml(codServicoNac)}</cTribNac>
            <cTribMun>${escapeXml(codServicoMun)}</cTribMun>
            <xDescServ>${escapeXml(discriminacao)}</xDescServ>
          </cServ>${(t('OutrasInformacoes') && t('OutrasInformacoes').trim().toLowerCase() !== discriminacao.toLowerCase()) ? `
          <infoCompl>
            <xInfComp>${escapeXml(t('OutrasInformacoes').trim())}</xInfComp>
          </infoCompl>` : ''}
        </serv>
        <valores>
          <vServPrest>
            <vServ>${vServ}</vServ>
          </vServPrest>
          <trib>
            <tribMun>
              <tribISSQN>${escapeXml(tribISSQN)}</tribISSQN>
              <tpRetISSQN>${escapeXml(tpRetISSQN)}</tpRetISSQN>
              <vISSQN>${vISS}</vISSQN>
              <pAliqAplic>${pAliq}</pAliqAplic>
            </tribMun>
            <tribFed>
              <piscofins>
                <CST>01</CST>
                <vBCPisCofins>${vBC}</vBCPisCofins>
                <tpRetPisCofins>${tpRetPisCofins}</tpRetPisCofins>
                <vPis>${fmtNum(numPIS)}</vPis>
                <vRetPIS>${vRetPIS}</vRetPIS>
                <vCofins>${fmtNum(numCOFINS)}</vCofins>
                <vRetCOFINS>${vRetCOFINS}</vRetCOFINS>
              </piscofins>
              <vRetCSLL>${vRetCSLL}</vRetCSLL>
              <vRetIRRF>${vRetIRRF}</vRetIRRF>
              <vRetCP>${vRetCP}</vRetCP>
              <xDescRetSociais>${escapeXml(isPisCofinsRetido ? '3 - PIS/COFINS/CSLL Retidos' : '0 - PIS/COFINS/CSLL Não Retidos.')}</xDescRetSociais>
              <DescricaoContribSociais>${escapeXml(isPisCofinsRetido ? '3 - PIS/COFINS/CSLL Retidos' : '0 - PIS/COFINS/CSLL Não Retidos.')}</DescricaoContribSociais>
            </tribFed>
            <totTrib>
              <indTotTrib>0</indTotTrib>
            </totTrib>
          </trib>
        </valores>
        ${hasIbsCbs ? `
        <IBSCBS>
          <CST>${escapeXml(cstIbs || '01')}</CST>
          <cIndOp>${escapeXml(t('cIndOp') || '1')}</cIndOp>
          <vBC>${escapeXml(fmtNum(t('BaseCalculoIBS') || vServ))}</vBC>
          <pAliqEstadualIBS>${escapeXml(t('ValorAliqEstadualIBS') || '0.00')}</pAliqEstadualIBS>
          <pAliqMunicipalIBS>${escapeXml(t('ValorAliqMunicipalIBS') || '0.00')}</pAliqMunicipalIBS>
          <pAliqCBS>${escapeXml(t('ValorAliqCBS') || '0.00')}</pAliqCBS>
          <vIBS>${escapeXml(fmtNum(vIbs || '0.00'))}</vIBS>
          <vCBS>${escapeXml(fmtNum(vCbs || '0.00'))}</vCBS>
          <vTotNF>${escapeXml(fmtNum(t('ValorTotalCobrado') || vServ))}</vTotNF>
        </IBSCBS>` : ''}
      </infDPS>
    </DPS>
  </infNFSe>
</NFSe>`;

  return xml;
}

module.exports = {
  converterSpParaXmlNacional
};
