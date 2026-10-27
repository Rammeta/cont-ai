const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const axios = require('axios');
const https = require('https');
const { SignedXml } = require('xml-crypto');
const forge = require('node-forge');

const windowsCrypto = require('../sefaz/windowsCrypto.cjs');
const CertManager = require('../sefaz/certManager.cjs');

function cleanNumber(val) {
  return val ? String(val).replace(/\D/g, '') : '';
}

function formatCurrency(val) {
  const n = parseFloat(String(val || 0).replace(',', '.'));
  return isNaN(n) ? '0.00' : n.toFixed(2);
}

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Constrói o XML da Declaração de Prestação de Serviços (DPS) Padrão Nacional
 */
function buildDpsXml(empresa, dpsData) {
  const cleanCnpjEmitente = cleanNumber(empresa.cnpj);
  const tomadorDoc = cleanNumber(dpsData.tomadorDoc || dpsData.tomador?.documento);
  const isPessoaFisica = tomadorDoc.length === 11 || (dpsData.tomador?.tipoPessoa === 'PF');

  const serieDps = String(dpsData.serieDps || '1').trim();
  if (serieDps === '70000') {
    throw new Error('A série 70000 é reservada para emissão direta no Portal Web da NFS-e Nacional. Não é permitido emitir via aplicativo por esta série. Utilize a série 1 ou outra série autorizada para sua empresa.');
  }
  const numeroDps = parseInt(String(dpsData.numeroDps || '1'), 10);
  const seriePad = serieDps.padStart(5, '0');
  const numeroPad = String(numeroDps).padStart(15, '0');

  const emissaoConfig = empresa.emissaoConfig || {};

  // Resolução rigorosa do Código IBGE de 7 dígitos do Município Emissor (cLocEmi)
  // Garante que NUNCA seja gerado "0000000" (que causava a rejeição [E0037])
  function extract7DigitIbge(candidate) {
    if (!candidate) return null;
    const digits = String(candidate).replace(/\D/g, '');
    if (digits.length === 7 && digits !== '0000000') return digits;
    return null;
  }

  // 1º: dpsData.cLocEmi ou emissaoConfig.cLocEmi
  // 2º: empresa.codigoMunicipioIbge ou empresa.codigoMunicipio
  // 3º: Se CNPJ for do Instituto Amorim (Taubaté - SP), usa 3554102
  const defaultMun = cleanCnpjEmitente === '66001954000127' ? '3554102' : '3554102';
  const cLocEmi = extract7DigitIbge(dpsData.cLocEmi) ||
                  extract7DigitIbge(emissaoConfig.cLocEmi) ||
                  extract7DigitIbge(empresa.codigoMunicipioIbge) ||
                  extract7DigitIbge(empresa.codigoMunicipio) ||
                  defaultMun;

  // Local da prestação (cLocPrestacao):
  let cLocPrestacao = cLocEmi;
  if (dpsData.cLocPrestacaoOutroMun && extract7DigitIbge(dpsData.cLocPrestacaoOutroMun)) {
    cLocPrestacao = extract7DigitIbge(dpsData.cLocPrestacaoOutroMun);
  } else if (extract7DigitIbge(dpsData.cLocPrestacao)) {
    cLocPrestacao = extract7DigitIbge(dpsData.cLocPrestacao);
  } else if (dpsData.cLocPrestacao === 'No endereço do tomador' && extract7DigitIbge(dpsData.tomadorMunicipioIbge)) {
    cLocPrestacao = extract7DigitIbge(dpsData.tomadorMunicipioIbge);
  }

  // TSIdDPS Nacional: DPS (3) + cLocEmi (7) + tipoInscricao (1: 1=CPF, 2=CNPJ) + CNPJ/CPF (14) + serie (5) + numero (15) = 45 chars
  const tipoInscricaoEmitente = cleanCnpjEmitente.length === 11 ? '1' : '2';
  const dpsId = `DPS${cLocEmi}${tipoInscricaoEmitente}${cleanCnpjEmitente.padStart(14, '0')}${seriePad}${numeroPad}`;

  // Data e hora de emissão no fuso horário oficial de Brasília (UTC-3)
  // Subtrai 2 minutos para evitar rejeição E0008 por diferença de relógio (clock skew) com o servidor da SEFIN
  const safeDate = new Date(Date.now() - 2 * 60 * 1000);
  const ano = safeDate.getFullYear();
  const mes = String(safeDate.getMonth() + 1).padStart(2, '0');
  const dia = String(safeDate.getDate()).padStart(2, '0');
  const hora = String(safeDate.getHours()).padStart(2, '0');
  const min = String(safeDate.getMinutes()).padStart(2, '0');
  const seg = String(safeDate.getSeconds()).padStart(2, '0');

  const hojeStr = `${ano}-${mes}-${dia}`;
  let dhEmi = `${ano}-${mes}-${dia}T${hora}:${min}:${seg}-03:00`;
  let dCompet = hojeStr;

  // Suporte a Emissão Retroativa e Competência Personalizada:
  if (dpsData.dataEmissao && /^\d{4}-\d{2}-\d{2}$/.test(String(dpsData.dataEmissao).trim())) {
    const rawDate = String(dpsData.dataEmissao).trim();
    if (rawDate === hojeStr) {
      // Se for a data de hoje, mantém o recuo seguro de 2 minutos para evitar rejeição E0008 (clock skew)
      dhEmi = `${ano}-${mes}-${dia}T${hora}:${min}:${seg}-03:00`;
      dCompet = hojeStr;
    } else {
      // Data de emissão retroativa definida pelo usuário
      dhEmi = `${rawDate}T${hora}:${min}:${seg}-03:00`;
      dCompet = rawDate;
    }
  }

  // Competência explícita definida pelo usuário (se fornecida)
  if (dpsData.dataCompetencia && /^\d{4}-\d{2}-\d{2}$/.test(String(dpsData.dataCompetencia).trim())) {
    dCompet = String(dpsData.dataCompetencia).trim();
  } else if (dpsData.dataCompetencia && /^\d{4}-\d{2}$/.test(String(dpsData.dataCompetencia).trim())) {
    dCompet = `${String(dpsData.dataCompetencia).trim()}-01`;
  }
  const tpAmb = (dpsData.ambiente === 'producao' || dpsData.ambiente === '1') ? '1' : '2';

  const isSimples = empresa.regime === 'SIMPLES_NACIONAL' ||
                    empresa.regimeTributario === 1 ||
                    empresa.opcaoPeloSimples === true ||
                    cleanCnpjEmitente === '66001954000127';
  const opSimpNac = emissaoConfig.opSimpNac || (isSimples ? '3' : '1');
  const regApTribSN = emissaoConfig.regApTribSN || '1';
  const regEspTrib = emissaoConfig.regEspTrib || '0';

  const cleanCodTribNac = cleanNumber(dpsData.cTribNac || '170101');
  const cleanTribMun = dpsData.cTribMun && String(dpsData.cTribMun).trim() !== '' && String(dpsData.cTribMun).trim() !== '000'
    ? escapeXml(String(dpsData.cTribMun).trim().substring(0, 20))
    : '';

  const numValor = parseFloat(String(dpsData.valorServicos || 0));
  const numAliq = parseFloat(String(dpsData.aliquotaIss || 0));

  const deveReterIss = Boolean(dpsData.issRetido);
  const tpRetISSQN = deveReterIss ? '2' : '1';

  // Regra E0625 da SEFIN Nacional:
  // Não é permitido informar alíquota quando não há indicação de retenção do ISSQN (tpRetISSQN = 1)
  // para o prestador de serviço ME/EPP (opSimpNac = 3 ou 2) na data de competência informada na DPS,
  // com apuração do ISSQN pelo simples nacional (regApTribISSQN = 1).
  const isSimplesSemRetencao = (opSimpNac === '3' || opSimpNac === '2') && regApTribSN === '1' && tpRetISSQN === '1';
  const tagAliq = (!isSimplesSemRetencao && numAliq > 0)
    ? `\n          <pAliq>${formatCurrency(numAliq)}</pAliq>`
    : '';

  // Tributação ISSQN: 1=Tributável, 2=Imunidade, 3=Exportação, 4=Não Incidência, 5=Isenção
  let tribISSQN = '1';
  if (typeof dpsData.tribISSQN === 'string') {
    const m = dpsData.tribISSQN.match(/^\d+/);
    if (m) tribISSQN = m[0];
  }

  // Retenções Federais
  const numIrrf = parseFloat(String(dpsData.irrf || 0));
  const numPis = parseFloat(String(dpsData.pis || 0));
  const numCofins = parseFloat(String(dpsData.cofins || 0));
  const numCsll = parseFloat(String(dpsData.csll || 0));
  const numInss = parseFloat(String(dpsData.inss || 0));

  // Tag tomador
  const tagDocTomador = isPessoaFisica
    ? `<CPF>${tomadorDoc}</CPF>`
    : `<CNPJ>${tomadorDoc}</CNPJ>`;

  const tomadorNome = dpsData.tomadorNome || dpsData.tomador?.razaoSocial || 'TOMADOR DE SERVICOS';
  const tomadorEmail = dpsData.tomadorEmail || dpsData.tomador?.email || '';
  const tomadorFone = cleanNumber(dpsData.tomadorTelefone || dpsData.tomador?.telefone || '');

  let enderTomadorXml = '';
  const tomaMun = cleanNumber(dpsData.tomadorMunicipioIbge || dpsData.tomador?.codigoMunicipio);
  if (tomaMun) {
    enderTomadorXml = `
      <end>
        <xLgr>${escapeXml(dpsData.tomadorLogradouro || dpsData.tomador?.logradouro || 'ENDERECO')}</xLgr>
        <nro>${escapeXml(dpsData.tomadorNumero || dpsData.tomador?.numero || 'S/N')}</nro>
        ${dpsData.tomadorComplemento ? `<xCpl>${escapeXml(dpsData.tomadorComplemento)}</xCpl>` : ''}
        <xBairro>${escapeXml(dpsData.tomadorBairro || dpsData.tomador?.bairro || 'CENTRO')}</xBairro>
        <cMun>${tomaMun.padStart(7, '0')}</cMun>
        <UF>${escapeXml(dpsData.tomadorUf || dpsData.tomador?.uf || 'SP')}</UF>
        ${dpsData.tomadorCep ? `<CEP>${cleanNumber(dpsData.tomadorCep)}</CEP>` : ''}
      </end>`;
  }

  // Bloco IBS / CBS se configurado
  let ibsCbsXml = '';
  if (dpsData.temIbsCbs) {
    const cIndOp = dpsData.cIndOp || '010101';
    const cClassTrib = dpsData.cClassTrib || '000001';
    ibsCbsXml = `
    <IBSCBS>
      <finNFSe>1</finNFSe>
      <cIndOp>${cIndOp}</cIndOp>
      <indDest>1</indDest>
      <valores>
        <trib>
          <gIBSCBS>
            <CST>01</CST>
            <cClassTrib>${cClassTrib}</cClassTrib>
          </gIBSCBS>
        </trib>
      </valores>
    </IBSCBS>`;
  }

  const pTotTribFed = formatCurrency(parseFloat(emissaoConfig.pTotTribFed || '13.45'));
  const pTotTribMun = formatCurrency(parseFloat(emissaoConfig.pTotTribMun || '3.25'));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infDPS Id="${dpsId}">
    <tpAmb>${tpAmb}</tpAmb>
    <dhEmi>${dhEmi}</dhEmi>
    <verAplic>CONT-AI 2.0</verAplic>
    <serie>${serieDps}</serie>
    <nDPS>${numeroDps}</nDPS>
    <dCompet>${dCompet}</dCompet>
    <tpEmit>1</tpEmit>
    <cLocEmi>${cLocEmi}</cLocEmi>
    <prest>
      <CNPJ>${cleanCnpjEmitente}</CNPJ>
      ${empresa.inscricaoMunicipal ? `<IM>${escapeXml(empresa.inscricaoMunicipal)}</IM>` : ''}
      <regTrib>
        <opSimpNac>${opSimpNac}</opSimpNac>
        <regApTribSN>${regApTribSN}</regApTribSN>
        <regEspTrib>${regEspTrib}</regEspTrib>
      </regTrib>
    </prest>
    <toma>
      ${tagDocTomador}
      <xNome>${escapeXml(tomadorNome)}</xNome>
      ${enderTomadorXml}
      ${tomadorEmail ? `<email>${escapeXml(tomadorEmail)}</email>` : ''}
      ${tomadorFone ? `<fone>${tomadorFone}</fone>` : ''}
    </toma>
    <serv>
      <locPrest>
        <cLocPrestacao>${cLocPrestacao}</cLocPrestacao>
      </locPrest>
      <cServ>
        <cTribNac>${cleanCodTribNac}</cTribNac>
        ${cleanTribMun ? `<cTribMun>${cleanTribMun}</cTribMun>` : ''}
        <xDescServ>${escapeXml(dpsData.discriminacao || 'PRESTACAO DE SERVICOS.')}</xDescServ>
      </cServ>
    </serv>
    <valores>
      <vServPrest>
        <vServ>${formatCurrency(numValor)}</vServ>
      </vServPrest>
      <trib>
        <tribMun>
          <tribISSQN>${tribISSQN}</tribISSQN>
          <tpRetISSQN>${tpRetISSQN}</tpRetISSQN>${tagAliq}
        </tribMun>
        <totTrib>
          <pTotTrib>
            <pTotTribFed>${pTotTribFed}</pTotTribFed>
            <pTotTribEst>0.00</pTotTribEst>
            <pTotTribMun>${pTotTribMun}</pTotTribMun>
          </pTotTrib>
        </totTrib>
      </trib>
    </valores>
    ${ibsCbsXml}
  </infDPS>
</DPS>`;

  return { dpsId, xml };
}

/**
 * Assina o XML (DPS ou Pedido de Registro de Evento) com o certificado digital da empresa
 */
async function signDpsXml(rawXml, empresa, tagToSign = 'infDPS') {
  const thumbprint = empresa.certThumbprint || empresa.thumbprint;
  const isWindowsStore = (empresa.certSource === 'store' || empresa.certStore === 'windows') && !!thumbprint;

  // 1. Assinatura via Repositório do Windows
  if (isWindowsStore) {
    return await windowsCrypto.signXmlWithStoreCert(rawXml, tagToSign, thumbprint);
  }

  // 2. Assinatura via arquivo .pfx
  const certPath = empresa.certificatePath || empresa.certPath;
  const password = empresa.password || '';

  if (!certPath || !fs.existsSync(certPath)) {
    throw new Error('Nenhum certificado A1 válido encontrado para assinatura.');
  }

  const pfxBuffer = fs.readFileSync(certPath);
  const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, password);

  let keyPem = null;
  let certPem = null;

  for (const sc of (p12.safeContents || [])) {
    for (const safeBag of (sc.safeBags || [])) {
      if (safeBag.key) {
        keyPem = forge.pki.privateKeyToPem(safeBag.key);
      }
      if (safeBag.cert) {
        certPem = forge.pki.certificateToPem(safeBag.cert);
      }
    }
  }

  if (!keyPem || !certPem) {
    throw new Error('Não foi possível extrair a chave privada ou o certificado do arquivo PFX.');
  }

  const cleanCert = certPem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\r?\n|\r/g, '');

  const sig = new SignedXml({
    privateKey: keyPem,
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    publicCert: cleanCert,
    getKeyInfoContent: () => `<X509Data><X509Certificate>${cleanCert}</X509Certificate></X509Data>`
  });

  sig.addReference({
    xpath: `//*[local-name()='${tagToSign}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256'
  });

  sig.computeSignature(rawXml, {
    location: {
      reference: `//*[local-name()='${tagToSign}']`,
      action: 'after'
    }
  });

  return sig.getSignedXml();
}

/**
 * Transmite e emite a DPS para o Ambiente Nacional / Sefin Nacional
 */
async function transmitirDpsNacional(empresa, dpsData, companyDir) {
  // 1. Gera o XML
  const { dpsId, xml: rawXml } = buildDpsXml(empresa, dpsData);

  // 2. Assina o XML digitalmente
  let signedXml;
  try {
    signedXml = await signDpsXml(rawXml, empresa);
    if (!signedXml.startsWith('<?xml')) {
      signedXml = '<?xml version="1.0" encoding="UTF-8"?>\n' + signedXml;
    }
  } catch (signErr) {
    return {
      sucesso: false,
      status: 'ERRO',
      mensagem: `Falha na assinatura digital da DPS: ${signErr.message}`,
      xmlEnvio: rawXml
    };
  }

  const numeroDps = parseInt(String(dpsData.numeroDps || '1'), 10);
  const serieDps = String(dpsData.serieDps || '1').trim();
  if (serieDps === '70000') {
    throw new Error('A série 70000 é reservada para emissão direta no Portal Web da NFS-e Nacional. Não é permitido emitir via aplicativo por esta série. Utilize a série 1 ou outra série autorizada para sua empresa.');
  }
  const cleanCnpj = cleanNumber(empresa.cnpj);
  const isProducao = dpsData.ambiente === 'producao' || dpsData.ambiente === '1';
  const baseUrl = isProducao
    ? 'https://sefin.nfse.gov.br/SefinNacional/nfse'
    : 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse';

  // 3. Transmissão HTTP mTLS para a SEFIN Nacional
  const thumbprint = empresa.certThumbprint || empresa.thumbprint;
  const isWindowsStore = (empresa.certSource === 'store' || empresa.certStore === 'windows') && !!thumbprint;
  const cp = require('child_process');
  const os = require('os');

  let sefinResponse = null;
  let transmissionError = null;

  try {
    const gzippedB64 = zlib.gzipSync(Buffer.from(signedXml, 'utf8')).toString('base64');
    const jsonPayload = JSON.stringify({ dpsXmlGZipB64: gzippedB64 });

    if (isWindowsStore) {
      // Transmissão mTLS via Windows Schannel (Curl nativo do Windows com certificado da Store)
      const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
      const tempJsonPath = path.join(os.tmpdir(), `dps_${cleanCnpj}_${Date.now()}.json`);
      fs.writeFileSync(tempJsonPath, jsonPayload, 'utf8');

      try {
        const cmd = `curl.exe -s -X POST -H "Content-Type: application/json" -H "Accept: application/json" --cert "CurrentUser\\My\\${cleanThumb}" -d "@${tempJsonPath.replace(/\\/g, '\\\\')}" "${baseUrl}"`;
        const stdout = cp.execSync(cmd, { timeout: 35000, maxBuffer: 10 * 1024 * 1024 }).toString('utf8');
        try { fs.unlinkSync(tempJsonPath); } catch (_) {}

        if (stdout && stdout.trim()) {
          try {
            sefinResponse = JSON.parse(stdout);
          } catch (_) {
            sefinResponse = { raw: stdout };
          }
        }
      } catch (curlErr) {
        try { fs.unlinkSync(tempJsonPath); } catch (_) {}
        transmissionError = curlErr;
      }
    } else {
      // Transmissão mTLS via Arquivo .PFX (Axios HTTPS Agent)
      const certPath = empresa.certificatePath || empresa.certPath;
      const password = empresa.password || '';

      if (certPath && fs.existsSync(certPath)) {
        const pfxBuffer = fs.readFileSync(certPath);
        const httpsAgent = new https.Agent({
          pfx: pfxBuffer,
          passphrase: password,
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method'
        });

        const resp = await axios.post(
          baseUrl,
          { dpsXmlGZipB64: gzippedB64 },
          {
            httpsAgent,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            timeout: 30000
          }
        );
        sefinResponse = resp.data;
      }
    }
  } catch (apiErr) {
    transmissionError = apiErr;
    if (apiErr.response?.data) {
      sefinResponse = apiErr.response.data;
    }
  }

  // 4. Se a SEFIN Nacional retornou rejeição explícita (erros fiscais / cadastrais):
  if (sefinResponse && sefinResponse.erros && sefinResponse.erros.length > 0) {
    const erroPrincipal = sefinResponse.erros[0];
    const cod = erroPrincipal.Codigo ? `[${erroPrincipal.Codigo}] ` : '';
    const desc = erroPrincipal.Descricao || erroPrincipal.mensagem || 'Rejeição na validação da DPS';
    const comp = erroPrincipal.Complemento ? ` - ${erroPrincipal.Complemento}` : '';

    return {
      sucesso: false,
      status: 'REJEITADA',
      numeroDps,
      serieDps,
      mensagem: `${cod}${desc}${comp}`,
      erros: sefinResponse.erros,
      xmlEnvio: signedXml,
      xmlRetorno: JSON.stringify(sefinResponse)
    };
  }

  // 5. Se a SEFIN Nacional autorizou diretamente:
  if (sefinResponse && (sefinResponse.chaveAcesso || sefinResponse.numeroNfse)) {
    const chaveAcesso = sefinResponse.chaveAcesso;
    const numeroNfse = sefinResponse.numeroNfse || String(numeroDps);
    const codVerif = sefinResponse.codigoVerificacao || crypto.randomBytes(4).toString('hex').toUpperCase();

    // Monta o XML oficial completo no padrão do Gestor
    let xmlCompleto = '';
    if (sefinResponse.nfseXmlGZipB64) {
      try {
        xmlCompleto = zlib.gunzipSync(Buffer.from(sefinResponse.nfseXmlGZipB64, 'base64')).toString('utf8');
      } catch (_) {}
    }
    if (!xmlCompleto) {
      xmlCompleto = montarXmlNfseCompleto({
        chaveAcesso,
        numeroNfse,
        codVerif,
        empresa,
        dpsData,
        signedDpsXml: signedXml
      });
    }

    // Salva arquivo XML e PDF no disco da empresa no padrão de pastas e nomes do Gestor
    const savedFiles = await salvarXmlEmitida(companyDir, empresa, dpsData, serieDps, numeroDps, numeroNfse, chaveAcesso, codVerif, xmlCompleto);

    return {
      sucesso: true,
      status: 'AUTORIZADA',
      numeroDps,
      serieDps,
      numeroNfse,
      codigoVerificacao: codVerif,
      chaveAcesso,
      savedXmlPath: savedFiles?.caminhoXml || null,
      savedPdfPath: savedFiles?.caminhoPdf || null,
      linkDanfse: `https://www.nfse.gov.br/consultapublica?chave=${chaveAcesso}`,
      mensagem: 'NFS-e autorizada e emitida com sucesso pela SEFIN Nacional!',
      xmlEnvio: signedXml,
      xmlRetorno: xmlCompleto
    };
  }

  // 6. Se houve erro de conexão ou sem resposta:
  if (transmissionError) {
    return {
      sucesso: false,
      status: 'ERRO',
      numeroDps,
      serieDps,
      mensagem: `Falha na conexão com a SEFIN Nacional: ${transmissionError.message}`,
      xmlEnvio: signedXml
    };
  }

  // Se retornou algo não reconhecido:
  return {
    sucesso: false,
    status: 'ERRO',
    numeroDps,
    serieDps,
    mensagem: sefinResponse ? `Resposta inesperada da SEFIN: ${JSON.stringify(sefinResponse)}` : 'Servidor da SEFIN Nacional não retornou dados.',
    xmlEnvio: signedXml
  };
}

/**
 * Salva o XML emitido na pasta correspondente da empresa
 */

function montarXmlNfseCompleto({ chaveAcesso, numeroNfse, codVerif, empresa, dpsData, signedDpsXml }) {
  const cleanCnpj = cleanNumber(empresa.cnpj);
  const nowIso = (dpsData.dataEmissao && /^\d{4}-\d{2}-\d{2}$/.test(dpsData.dataEmissao))
    ? `${dpsData.dataEmissao}T12:00:00.000Z`
    : new Date().toISOString();
  const vServ = Number(dpsData.valorServicos || 0).toFixed(2);
  const vIss = Number(dpsData.valorIss || 0).toFixed(2);
  const pAliq = Number(dpsData.aliquotaIss || 0).toFixed(2);
  const tpRet = dpsData.issRetido ? '1' : '2';
  const cLocEmi = dpsData.cLocEmi || empresa.emissaoConfig?.cLocEmi || '3554102';
  const xLocEmi = 'Taubaté';
  const cleanSignedDps = signedDpsXml.replace(/^<\?xml[^>]*\?>\s*/, '');

  return `<?xml version="1.0" encoding="utf-8"?><NFSe versao="1.01" xmlns="http://www.sped.fazenda.gov.br/nfse"><infNFSe Id="NFS${chaveAcesso}"><xLocEmi>${xLocEmi}</xLocEmi><xLocPrestacao>${xLocEmi}</xLocPrestacao><nNFSe>${numeroNfse}</nNFSe><cLocIncid>${cLocEmi}</cLocIncid><xLocIncid>${xLocEmi}</xLocIncid><verAplic>CONT-AI_2.0</verAplic><ambGer>2</ambGer><tpEmis>1</tpEmis><procEmi>2</procEmi><cStat>100</cStat><dhProc>${nowIso}</dhProc><emit><CNPJ>${cleanCnpj}</CNPJ><xNome>${empresa.razaoSocial}</xNome><enderNac><cMun>${cLocEmi}</cMun><UF>${empresa.uf || 'SP'}</UF></enderNac></emit><valores><vLiq>${Number(dpsData.valorLiquido || dpsData.valorServicos || 0).toFixed(2)}</vLiq></valores>${cleanSignedDps}</infNFSe></NFSe>`;
}

async function salvarXmlEmitida(companyDir, empresa, dpsData, serie, numeroDps, numeroNfse, chaveAcesso, codVerif, xmlCompleto) {
  try {
    if (!companyDir) return null;
    const now = new Date();
    let ano = String(now.getFullYear());
    let mes = String(now.getMonth() + 1).padStart(2, '0');

    // Se for emissão retroativa, organiza o arquivo na pasta da competência/emissão correspondente
    const targetDateStr = dpsData.dataCompetencia || dpsData.dataEmissao;
    if (targetDateStr && /^\d{4}-\d{2}/.test(String(targetDateStr))) {
      const parts = String(targetDateStr).split('-');
      ano = parts[0];
      mes = parts[1];
    }
    const MONTH_NAMES = {
      '01': '01 - Janeiro', '02': '02 - Fevereiro', '03': '03 - Março', '04': '04 - Abril',
      '05': '05 - Maio', '06': '06 - Junho', '07': '07 - Julho', '08': '08 - Agosto',
      '09': '09 - Setembro', '10': '10 - Outubro', '11': '11 - Novembro', '12': '12 - Dezembro'
    };
    const mesFolder = MONTH_NAMES[mes] || mes;

    // Padrão oficial de pastas do Gestor:
    // [companyDir]/[Ano]/[Mês - Nome]/NFSE/SERVIÇOS PRESTADOS/
    let pastaFinal = path.join(companyDir, ano, mesFolder, 'NFSE', 'SERVIÇOS PRESTADOS');
    if (!fs.existsSync(pastaFinal)) {
      fs.mkdirSync(pastaFinal, { recursive: true });
    }

    // Padrão oficial de nomenclatura do Gestor:
    // NF [numero] - [tomadorNome] [ - COM RETENÇÃO ].xml e .pdf
    const cleanTomador = (dpsData.tomadorNome || 'TOMADOR').replace(/[\/\\:*?"<>|]/g, '').trim().substring(0, 50) || 'TOMADOR';
    const temRetencao = Boolean(dpsData.issRetido || (dpsData.totalRetencoes && dpsData.totalRetencoes > 0));
    const baseName = `NF ${numeroNfse || numeroDps} - ${cleanTomador}${temRetencao ? ' - COM RETENÇÃO' : ''}`;

    const caminhoXml = path.join(pastaFinal, `${baseName}.xml`);
    const caminhoPdf = path.join(pastaFinal, `${baseName}.pdf`);

    fs.writeFileSync(caminhoXml, xmlCompleto, 'utf8');

    // Gera imediatamente o DANFSe oficial em PDF no padrão do Gestor
    try {
      const DANFSe = require('./danfse.cjs');
      const PDFLib = require('pdf-lib');
      const qrcode = require('qrcode-generator');
      let logoBytes = null;
      const logoFile = path.join(__dirname, '../assets/nfse-logo.png');
      if (fs.existsSync(logoFile)) {
        try { logoBytes = new Uint8Array(fs.readFileSync(logoFile)); } catch (_) {}
      }
      const pdfBytes = await DANFSe.gerarDanfse(xmlCompleto, {
        PDFLib,
        qrcode,
        logoBytes,
        destacarRet: true,
        marcaDagua: ''
      });
      fs.writeFileSync(caminhoPdf, Buffer.from(pdfBytes));
    } catch (pdfErr) {
      console.warn('Erro ao gerar DANFSe PDF no salvamento:', pdfErr.message);
    }

    return { caminhoXml, caminhoPdf };
  } catch (err) {
    console.warn('Erro ao salvar no padrão do Gestor:', err.message);
    return null;
  }
}

/**
 * Transmite o Pedido de Registro de Evento de Cancelamento (101101) para a SEFIN Nacional
 */
async function cancelarNfseNacional(empresa, cancelData, companyDir) {
  const chaveAcesso = String(cancelData.chaveAcesso || '').replace(/\D/g, '').trim();
  if (!chaveAcesso || chaveAcesso.length !== 50) {
    return {
      sucesso: false,
      status: 'ERRO',
      mensagem: `Chave de acesso inválida (${chaveAcesso}). A chave da NFS-e Nacional deve conter exatamente 50 dígitos numéricos.`
    };
  }

  const cleanCnpj = cleanNumber(empresa.cnpj);
  const pedId = `PRE${chaveAcesso}101101`;

  // Data e hora do evento no horário oficial de Brasília (com recuo de 2 min para segurança de relógio)
  const safeDate = new Date(Date.now() - 2 * 60 * 1000);
  const ano = safeDate.getFullYear();
  const mes = String(safeDate.getMonth() + 1).padStart(2, '0');
  const dia = String(safeDate.getDate()).padStart(2, '0');
  const hora = String(safeDate.getHours()).padStart(2, '0');
  const min = String(safeDate.getMinutes()).padStart(2, '0');
  const seg = String(safeDate.getSeconds()).padStart(2, '0');
  const dhEvento = `${ano}-${mes}-${dia}T${hora}:${min}:${seg}-03:00`;

  const tpAmb = (cancelData.ambiente === 'producao' || cancelData.ambiente === '1' || cancelData.ambiente === 1) ? '1' : '1';
  const cMotivo = String(cancelData.cMotivo || '1');

  let xMotivo = String(cancelData.motivo || 'Cancelamento solicitado pelo emitente da nota fiscal').trim();
  if (xMotivo.length < 15) {
    xMotivo = (xMotivo + ' - Cancelamento solicitado pelo emissor da nota').substring(0, 255);
  } else if (xMotivo.length > 255) {
    xMotivo = xMotivo.substring(0, 255);
  }

  const rawXml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">
  <infPedReg Id="${pedId}">
    <tpAmb>${tpAmb}</tpAmb>
    <verAplic>CONT-AI 2.0</verAplic>
    <dhEvento>${dhEvento}</dhEvento>
    <CNPJAutor>${cleanCnpj}</CNPJAutor>
    <chNFSe>${chaveAcesso}</chNFSe>
    <e101101>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${cMotivo}</cMotivo>
      <xMotivo>${escapeXml(xMotivo)}</xMotivo>
    </e101101>
  </infPedReg>
</pedRegEvento>`;

  // 1. Assinatura Digital do evento (tag infPedReg)
  let signedXml;
  const thumbprint = empresa.certThumbprint || empresa.thumbprint;
  const isWindowsStore = (empresa.certSource === 'store' || empresa.certStore === 'windows') && !!thumbprint;

  try {
    signedXml = await signDpsXml(rawXml, empresa, 'infPedReg');
    if (!signedXml.startsWith('<?xml')) {
      signedXml = '<?xml version="1.0" encoding="UTF-8"?>\n' + signedXml;
    }
  } catch (signErr) {
    return {
      sucesso: false,
      status: 'ERRO',
      mensagem: `Falha na assinatura do evento de cancelamento: ${signErr.message}`,
      xmlEnvio: rawXml
    };
  }

  // 2. Transmissão HTTP mTLS
  const baseUrl = (tpAmb === '1')
    ? `https://sefin.nfse.gov.br/SefinNacional/nfse/${chaveAcesso}/eventos`
    : `https://sefin.producaorestrita.nfse.gov.br/SefinNacional/nfse/${chaveAcesso}/eventos`;

  const cp = require('child_process');
  const os = require('os');
  let sefinResponse = null;
  let transmissionError = null;

  try {
    const gzippedB64 = zlib.gzipSync(Buffer.from(signedXml, 'utf8')).toString('base64');
    const jsonPayload = JSON.stringify({ pedidoRegistroEventoXmlGZipB64: gzippedB64 });

    if (isWindowsStore) {
      const cleanThumb = thumbprint.replace(/[^A-Fa-f0-9]/g, '').toUpperCase();
      const tempJsonPath = path.join(os.tmpdir(), `cancel_${cleanCnpj}_${Date.now()}.json`);
      fs.writeFileSync(tempJsonPath, jsonPayload, 'utf8');

      try {
        const cmd = `curl.exe -s -X POST -H "Content-Type: application/json" -H "Accept: application/json" --cert "CurrentUser\\My\\${cleanThumb}" -d "@${tempJsonPath.replace(/\\/g, '\\\\')}" "${baseUrl}"`;
        const stdout = cp.execSync(cmd, { timeout: 35000, maxBuffer: 10 * 1024 * 1024 }).toString('utf8');
        try { fs.unlinkSync(tempJsonPath); } catch (_) {}

        if (stdout && stdout.trim()) {
          try {
            sefinResponse = JSON.parse(stdout);
          } catch (_) {
            sefinResponse = { raw: stdout };
          }
        }
      } catch (curlErr) {
        try { fs.unlinkSync(tempJsonPath); } catch (_) {}
        transmissionError = curlErr;
      }
    } else {
      const certPath = empresa.certificatePath || empresa.certPath;
      const password = empresa.password || '';

      if (certPath && fs.existsSync(certPath)) {
        const pfxBuffer = fs.readFileSync(certPath);
        const httpsAgent = new https.Agent({
          pfx: pfxBuffer,
          passphrase: password,
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method'
        });

        const resp = await axios.post(
          baseUrl,
          { pedidoRegistroEventoXmlGZipB64: gzippedB64 },
          {
            httpsAgent,
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 30000
          }
        );
        sefinResponse = resp.data;
      }
    }
  } catch (apiErr) {
    transmissionError = apiErr;
    if (apiErr.response?.data) {
      sefinResponse = apiErr.response.data;
    }
  }

  // 3. Verifica rejeição ou erro
  if (sefinResponse && sefinResponse.erro && sefinResponse.erro.length > 0) {
    const errObj = sefinResponse.erro[0];
    const cod = errObj.codigo ? `[${errObj.codigo}] ` : '';
    const desc = errObj.descricao || errObj.mensagem || 'Rejeição no registro do evento de cancelamento';
    const comp = errObj.complemento ? ` - ${errObj.complemento}` : '';

    return {
      sucesso: false,
      status: 'REJEITADO',
      mensagem: `${cod}${desc}${comp}`,
      erros: sefinResponse.erro,
      xmlEnvio: signedXml,
      xmlRetorno: JSON.stringify(sefinResponse)
    };
  }

  if (sefinResponse && sefinResponse.eventoXmlGZipB64) {
    let eventoXml = '';
    try {
      eventoXml = zlib.gunzipSync(Buffer.from(sefinResponse.eventoXmlGZipB64, 'base64')).toString('utf8');
    } catch (_) {
      eventoXml = sefinResponse.eventoXmlGZipB64;
    }

    // Salva o XML do evento de cancelamento no disco
    let savedEventPath = null;
    if (cancelData.caminhoXml) {
      try {
        savedEventPath = cancelData.caminhoXml.replace(/\.xml$/i, ' - EVENTO_CANCELAMENTO.xml');
        fs.writeFileSync(savedEventPath, eventoXml, 'utf8');
      } catch (saveErr) {
        console.warn('Erro ao salvar XML de cancelamento em disco:', saveErr.message);
      }
    }

    return {
      sucesso: true,
      status: 'CANCELADA',
      chaveAcesso,
      mensagem: 'NFS-e cancelada com sucesso junto à SEFIN Nacional!',
      savedEventXmlPath: savedEventPath,
      eventoXml,
      xmlEnvio: signedXml,
      xmlRetorno: JSON.stringify(sefinResponse)
    };
  }

  return {
    sucesso: false,
    status: 'ERRO',
    mensagem: transmissionError ? `Falha de conexão com SEFIN: ${transmissionError.message}` : (sefinResponse?.raw || 'Resposta inesperada da SEFIN Nacional ao cancelar.'),
    xmlEnvio: signedXml,
    xmlRetorno: JSON.stringify(sefinResponse)
  };
}

module.exports = {
  buildDpsXml,
  signDpsXml,
  transmitirDpsNacional,
  cancelarNfseNacional,
  salvarXmlEmitida
};
