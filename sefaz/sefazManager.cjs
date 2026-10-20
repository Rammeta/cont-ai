const fs = require('fs');
const path = require('path');
const CertManager = require('./certManager.cjs');
const SoapClient = require('./soapClient.cjs');
const XmlSigner = require('./xmlSigner.cjs');
const DistribuicaoService = require('./distribuicao.cjs');
const ManifestacaoService = require('./manifestacao.cjs');
const XmlStorage = require('./xmlStorage.cjs');
const DanfeService = require('./danfeService.cjs');
const SaeNfceService = require('./saeNfceService.cjs');
const CteDistribuicaoService = require('./cteDistribuicao.cjs');
const DacteService = require('./dacteService.cjs');
const { getStateDatabase } = require('./stateDatabase.cjs');

const UF_TO_IBGE = {
  RO: '11', AC: '12', AM: '13', RR: '14', PA: '15', AP: '16', TO: '17',
  MA: '21', PI: '22', CE: '23', RN: '24', PB: '25', PE: '26', AL: '27',
  SE: '28', BA: '29', MG: '31', ES: '32', RJ: '33', SP: '35', PR: '41',
  SC: '42', RS: '43', MS: '50', MT: '51', GO: '52', DF: '53'
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SefazManager {
  constructor(baseDataDir) {
    this.baseDataDir = baseDataDir;
    this.stateDb = getStateDatabase();
    if (!fs.existsSync(this.baseDataDir)) {
      fs.mkdirSync(this.baseDataDir, { recursive: true });
    }
  }

  setBaseDataDir(newDir) {
    if (newDir && typeof newDir === 'string') {
      this.baseDataDir = newDir;
      if (!fs.existsSync(this.baseDataDir)) {
        fs.mkdirSync(this.baseDataDir, { recursive: true });
      }
    }
  }

  getBaseDataDir() {
    return this.baseDataDir;
  }

  resolveModelFolder(companyDir, dateStr, modelName) {
    let year = 'Ano_Indefinido';
    let month = '01';

    if (dateStr && typeof dateStr === 'string') {
      const m = dateStr.match(/(\d{4})[-/](\d{2})/);
      if (m) {
        year = m[1];
        month = m[2];
      }
    }

    if (year === 'Ano_Indefinido') {
      const now = new Date();
      year = String(now.getFullYear());
      month = String(now.getMonth() + 1).padStart(2, '0');
    }

    const MONTH_NAMES = {
      '01': '01 - Janeiro', '02': '02 - Fevereiro', '03': '03 - Março',
      '04': '04 - Abril',   '05': '05 - Maio',      '06': '06 - Junho',
      '07': '07 - Julho',   '08': '08 - Agosto',    '09': '09 - Setembro',
      '10': '10 - Outubro', '11': '11 - Novembro',  '12': '12 - Dezembro'
    };

    const defaultMonthFolder = MONTH_NAMES[month] || month;
    let resolvedMonthFolder = defaultMonthFolder;

    const yearDir = path.join(companyDir, year);
    if (fs.existsSync(yearDir)) {
      try {
        const entries = fs.readdirSync(yearDir, { withFileTypes: true });
        const found = entries.find(e => e.isDirectory() && (
          e.name === month ||
          e.name.startsWith(`${month} -`) ||
          e.name.startsWith(`${month}-`) ||
          (MONTH_NAMES[month] && e.name.toLowerCase() === MONTH_NAMES[month].toLowerCase())
        ));
        if (found) {
          resolvedMonthFolder = found.name;
        }
      } catch (_) {}
    }

    const targetDir = path.join(companyDir, year, resolvedMonthFolder, modelName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    return targetDir;
  }

  getCompanyDir(cnpj, razaoSocial) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');

    // 1. Procura se já existe qualquer pasta terminada com (cleanCnpj) ou igual a cleanCnpj
    let matchedDir = null;
    let matchedName = null;
    try {
      if (fs.existsSync(this.baseDataDir)) {
        const entries = fs.readdirSync(this.baseDataDir, { withFileTypes: true });
        const candidates = entries.filter(e => e.isDirectory() && (e.name.endsWith(`(${cleanCnpj})`) || e.name === cleanCnpj || e.name.includes(cleanCnpj)));
        // Se houver uma pasta com nome corporativo real (que não seja apenas o CNPJ repetido), prioriza ela
        const realNamed = candidates.find(e => {
          const raw = e.name.replace(`(${cleanCnpj})`, '').trim().replace(/\D/g, '');
          return raw.length > 0 && raw !== cleanCnpj;
        });
        const matched = realNamed || candidates[0];
        if (matched) {
          matchedName = matched.name;
          matchedDir = path.join(this.baseDataDir, matched.name);
        }
      }
    } catch (e) {}

    // 2. Verifica se razaoSocial informada é um nome empresarial legítimo (não apenas dígitos do CNPJ)
    const isRealName = Boolean(
      razaoSocial &&
      typeof razaoSocial === 'string' &&
      razaoSocial.trim().length > 0 &&
      razaoSocial.trim().replace(/\D/g, '') !== cleanCnpj
    );

    if (isRealName) {
      const safeName = razaoSocial.trim().replace(/[\\/:*?"<>|]/g, '_');
      const desiredFolderName = `${safeName} (${cleanCnpj})`;
      const desiredDir = path.join(this.baseDataDir, desiredFolderName);

      // Se já existe com o nome exato desejado, retorna ele
      if (fs.existsSync(desiredDir)) {
        // Se ainda sobrou pasta legada só com CNPJ bruto, migra conteúdo
        if (matchedDir && matchedDir !== desiredDir && (matchedName === cleanCnpj || matchedName === `${cleanCnpj} (${cleanCnpj})`)) {
          try {
            fs.cpSync(matchedDir, desiredDir, { recursive: true });
            fs.rmSync(matchedDir, { recursive: true, force: true });
          } catch (eCopy) {}
        }
        return desiredDir;
      }

      // Se existia uma pasta legada (ex: apenas o CNPJ ou CNPJ (CNPJ)), renomeia para o nome real
      if (matchedDir && matchedDir !== desiredDir) {
        if (matchedName === cleanCnpj || matchedName === `${cleanCnpj} (${cleanCnpj})` || matchedName.startsWith(cleanCnpj)) {
          try {
            fs.renameSync(matchedDir, desiredDir);
            return desiredDir;
          } catch (eRename) {
            try {
              fs.cpSync(matchedDir, desiredDir, { recursive: true });
              return desiredDir;
            } catch (eCp) {
              return matchedDir;
            }
          }
        }
        // Se a pasta existente já tem um nome corporativo real válido, preserva-a
        return matchedDir;
      }

      // Se não existia pasta nenhuma, cria a desejada
      try {
        fs.mkdirSync(desiredDir, { recursive: true });
      } catch (e) {}
      return desiredDir;
    }

    // 3. Se razaoSocial NÃO foi informada ou é apenas dígitos, mas já encontramos uma pasta existente, retorna ela
    if (matchedDir) {
      return matchedDir;
    }

    // 4. Caso extremo onde não há razão social nem pasta existente: cria a pasta com o CNPJ
    const fallbackDir = path.join(this.baseDataDir, cleanCnpj);
    if (!fs.existsSync(fallbackDir)) {
      try {
        fs.mkdirSync(fallbackDir, { recursive: true });
      } catch (e) {}
    }
    return fallbackDir;
  }

  testCertificate({ certPath, password }) {
    const manager = new CertManager(certPath, password);
    const info = manager.load();
    return {
      valid: true,
      subject: info.subject,
      issuer: info.issuer,
      validFrom: info.validFrom,
      validTo: info.validTo,
      daysRemaining: info.daysRemaining,
      isExpired: info.isExpired,
      extractedCnpj: info.extractedCnpj
    };
  }

  getCompanyState({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const storage = new XmlStorage(companyDir, cleanCnpj);
    const state = storage.loadState();

    const now = Date.now();
    const blockedUntilMs = state.blockedUntil ? new Date(state.blockedUntil).getTime() : 0;
    const isBlocked = blockedUntilMs > now;
    const remainingSeconds = isBlocked ? Math.ceil((blockedUntilMs - now) / 1000) : 0;
    const remainingMinutes = Math.ceil(remainingSeconds / 60);

    return {
      ultNSU: state.ultNSU || '0',
      maxNSU: state.maxNSU || '0',
      lastExecution: state.lastExecution || null,
      lastSyncTime: state.lastSyncTime || null,
      lastCStat: state.lastCStat || null,
      blockedUntil: state.blockedUntil || null,
      isBlocked,
      remainingMinutes,
      remainingSeconds,
      totalDownloaded: Object.keys(state.downloadedKeys || {}).length,
      totalManifested: Object.keys(state.manifestedKeys || {}).length
    };
  }

  resetCompanyNsu({ cnpj, targetNsu = '0', clearManifestations = false, razaoSocial, clearFiles = false }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const storage = new XmlStorage(companyDir, cleanCnpj);
    const state = storage.loadState();

    const cleanTarget = String(targetNsu || '0').replace(/\D/g, '') || '0';
    state.ultNSU = cleanTarget;
    if (clearManifestations) {
      state.manifestedKeys = {};
    }
    if (clearFiles) {
      state.downloadedKeys = {};
      this.stateDb.clearMetadataCache(cleanCnpj);
    }
    // Ao redefinir o NSU manualmente, remove o bloqueio local para permitir a nova varredura
    delete state.blockedUntil;
    delete state.lastCStat;
    storage.saveState(state);

    if (clearFiles && fs.existsSync(companyDir)) {
      // 1. Limpa o cache de metadados legado se existir
      const cachePath = path.join(companyDir, 'metadata_cache.json');
      if (fs.existsSync(cachePath)) {
        try { fs.rmSync(cachePath, { force: true }); } catch (_) {}
      }

      // 2. Limpa pastas legadas de xmls e danfes
      const legacyXmls = path.join(companyDir, 'xmls');
      if (fs.existsSync(legacyXmls)) {
        try { fs.rmSync(legacyXmls, { recursive: true, force: true }); } catch (_) {}
      }
      const legacyDanfes = path.join(companyDir, 'danfes');
      if (fs.existsSync(legacyDanfes)) {
        try { fs.rmSync(legacyDanfes, { recursive: true, force: true }); } catch (_) {}
      }

      // 3. Limpa NFE ENTRADAS na hierarquia nova ANO/MÊS/NFE ENTRADAS
      try {
        const entries = fs.readdirSync(companyDir, { withFileTypes: true });
        for (const y of entries) {
          if (y.isDirectory() && /^\d{4}$/.test(y.name)) {
            const yDir = path.join(companyDir, y.name);
            const months = fs.readdirSync(yDir, { withFileTypes: true });
            for (const m of months) {
              if (m.isDirectory()) {
                const mDir = path.join(yDir, m.name);
                const nfeSub = path.join(mDir, 'NFE ENTRADAS');
                if (fs.existsSync(nfeSub)) {
                  try { fs.rmSync(nfeSub, { recursive: true, force: true }); } catch (_) {}
                }
                try {
                  if (fs.readdirSync(mDir).length === 0) fs.rmdirSync(mDir);
                } catch (_) {}
              }
            }
            try {
              if (fs.readdirSync(yDir).length === 0) fs.rmdirSync(yDir);
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    return {
      success: true,
      ultNSU: state.ultNSU,
      maxNSU: state.maxNSU,
      clearManifestations,
      clearFiles
    };
  }

  async syncCompany({ company, onProgress, resetNsu = false, clearManifestations = false, targetNsu = '0', forceSync = false, skipDanfeGeneration = false }) {
    const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
    const ufUpper = (company.uf || 'SP').toUpperCase();
    const cUFAutor = UF_TO_IBGE[ufUpper] || '35';
    const ambiente = Number(company.ambiente) || 1;

    const companyDir = this.getCompanyDir(cleanCnpj, company.razaoSocial);
    const storage = new XmlStorage(companyDir, cleanCnpj);
    const state = storage.loadState();
    if (resetNsu) {
      const cleanTarget = String(targetNsu || '0').replace(/\D/g, '') || '0';
      state.ultNSU = cleanTarget;
      if (clearManifestations) {
        state.manifestedKeys = {};
      }
      delete state.blockedUntil;
      delete state.lastCStat;
      storage.saveState(state);
    }

    // Cooldown preventivo de 1 hora (Anti-656 NT 2014.002)
    const now = Date.now();
    const blockedUntilMs = state.blockedUntil ? new Date(state.blockedUntil).getTime() : 0;
    const isBlocked = blockedUntilMs > now;
    const remainingMinutes = Math.ceil((blockedUntilMs - now) / 60000);

    if (isBlocked && !forceSync) {
      const reason = state.lastCStat === '656'
        ? 'Aviso da SEFAZ: Consumo Indevido (Rejeição 656)'
        : 'SEFAZ já confirmou que não há novos documentos (cStat 137)';
      return {
        success: false,
        isCooldown: true,
        blockedUntil: state.blockedUntil,
        remainingMinutes,
        error: `${reason}. Próxima consulta recomendada após ${new Date(state.blockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${remainingMinutes} min restantes).`
      };
    }
    const danfe = new DanfeService();

    if (onProgress) onProgress({ status: 'info', message: 'Carregando certificado digital...' });
    const certManager = new CertManager(company.certPath, company.password);
    const certInfo = certManager.load();

    if (certInfo.isExpired) {
      throw new Error('O certificado digital da empresa está expirado!');
    }

    const soapClient = new SoapClient(
      certManager.getFullCertChainPem(),
      certManager.getKeyPem(),
      certManager.getCaPems()
    );
    const xmlSigner = new XmlSigner(certManager.getKeyPem(), certManager.getCertPem());

    const distribuicao = new DistribuicaoService(soapClient, {
      cnpj: cleanCnpj,
      cUFAutor,
      ambiente
    });

    const manifestacao = new ManifestacaoService(soapClient, xmlSigner, {
      cnpj: cleanCnpj,
      ambiente
    });

    let continuar = true;
    let totalBaixadas = 0;
    let totalManifestadas = 0;

    while (continuar) {
      if (onProgress) {
        onProgress({
          status: 'info',
          message: `Consultando SEFAZ a partir do NSU ${state.ultNSU}...`
        });
      }

      const response = await distribuicao.consultarPorNSU(state.ultNSU);

      if (response.cStat === '137') {
        state.maxNSU = response.maxNSU || state.maxNSU;
        state.lastSyncTime = new Date().toISOString();
        state.lastCStat = '137';
        // Cooldown preventivo de 1 hora conforme NT 2014.002
        state.blockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        storage.saveState(state);
        if (onProgress) onProgress({ status: 'info', message: 'Nenhum documento novo na SEFAZ. Repouso preventivo de 1h ativado.' });
        break;
      }

      if (response.cStat === '656') {
        state.lastSyncTime = new Date().toISOString();
        state.lastCStat = '656';
        state.blockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        storage.saveState(state);
        throw new Error('Aviso da SEFAZ: Consumo Indevido (Rejeição 656). A SEFAZ bloqueou temporariamente novas consultas. Aguarde 1 hora antes de consultar novamente.');
      }

      if (response.cStat === '138') {
        const docs = response.docs || [];
        if (onProgress) {
          onProgress({
            status: 'info',
            message: `Processando lote com ${docs.length} documento(s)...`
          });
        }

        for (const doc of docs) {
          let xmlContent;
          try {
            xmlContent = storage.decompressDocZip(doc.contentBase64);
          } catch (err) {
            continue;
          }

          const parsed = storage.parseDoc(xmlContent);

          if (parsed.type === 'resNFe') {
            const alreadyManifested = state.manifestedKeys && state.manifestedKeys[parsed.chNFe];
            if (!alreadyManifested) {
              if (onProgress) {
                onProgress({
                  status: 'info',
                  message: `Manifestando Ciência: ${parsed.xNomeEmitente} (R$ ${parsed.vNF})...`
                });
              }

              try {
                let retManif = await manifestacao.darCiencia(parsed.chNFe);
                // Se a nota tiver mais de 10 dias, a SEFAZ rejeita Ciência (596). O prazo da Confirmação é de 180 dias!
                if (!retManif.success && retManif.cStatEvento === '596') {
                  if (onProgress) {
                    onProgress({
                      status: 'info',
                      message: `Prazo >10 dias: confirmando operação de ${parsed.xNomeEmitente}...`
                    });
                  }
                  retManif = await manifestacao.confirmarOperacao(parsed.chNFe);
                }

                if (retManif.success) {
                  state.manifestedKeys = state.manifestedKeys || {};
                  state.manifestedKeys[parsed.chNFe] = {
                    date: new Date().toISOString(),
                    status: retManif.cStatEvento,
                    nProt: retManif.nProt
                  };
                  totalManifestadas++;
                  await sleep(600); // Pausa suave entre manifestações de eventos
                }
              } catch (errManif) {
                console.warn('Erro ao manifestar:', errManif.message);
              }
            }
          } else if (parsed.type === 'procNFe') {
            const saveRes = storage.saveFullXml(parsed.chNFe, xmlContent, {
              dhEmi: parsed.dhEmi,
              ufEmit: parsed.ufEmit,
              ufDest: parsed.ufDest || company.uf
            });
            const savedPath = saveRes.filePath;
            const pdfPath = savedPath.replace('-nfe.xml', '-danfe.pdf').replace('.xml', '-danfe.pdf');
            try {
              await danfe.gerarDanfeFromFile(savedPath, pdfPath);
            } catch (_) {}

            state.downloadedKeys = state.downloadedKeys || {};
            state.downloadedKeys[parsed.chNFe] = {
              date: new Date().toISOString(),
              filePath: savedPath,
              pdfPath: fs.existsSync(pdfPath) ? pdfPath : undefined,
              emitente: parsed.xNomeEmitente,
              cnpjEmitente: parsed.cnpjEmitente,
              valor: parsed.vNF,
              dhEmi: parsed.dhEmi,
              ufEmit: parsed.ufEmit,
              ufDest: parsed.ufDest || company.uf
            };
            totalBaixadas++;
          }
        }

        state.ultNSU = response.ultNSU;
        state.maxNSU = response.maxNSU;
        state.lastSyncTime = new Date().toISOString();
        state.lastCStat = '138';
        storage.saveState(state);

        const nsuAtual = BigInt(response.ultNSU);
        const nsuMax = BigInt(response.maxNSU);

        if (nsuAtual < nsuMax) {
          if (onProgress) {
            onProgress({
              status: 'info',
              message: `Pausa de segurança anti-flood (2,5s)... Próximo lote: NSU ${state.ultNSU} de ${state.maxNSU}`
            });
          }
          await sleep(2500); // Pausa de 2,5s recomendada pela SEFAZ
        } else {
          // Chegou ao fim de todas as notas disponíveis: ativa repouso preventivo de 1h
          state.blockedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
          storage.saveState(state);
          continuar = false;
        }
      } else {
        storage.saveState(state);
        break;
      }
    }

    // Se novas notas foram baixadas e a geração não foi diferida para o lote geral, gera os DANFEs faltantes
    if (!skipDanfeGeneration && totalBaixadas > 0) {
      if (onProgress) {
        onProgress({
          status: 'info',
          message: `Gerando DANFEs em PDF para as ${totalBaixadas} nova(s) nota(s) baixada(s)...`
        });
      }
      try {
        await this.generateMissingDanfes({
          cnpj: cleanCnpj,
          razaoSocial: company.razaoSocial,
          onProgress
        });
      } catch (eDanfe) {
        console.warn('Aviso ao gerar DANFEs pós-captação:', eDanfe.message);
      }
    }

    return {
      success: true,
      ultNSU: state.ultNSU,
      maxNSU: state.maxNSU,
      totalBaixadas,
      totalManifestadas,
      totalHistorico: Object.keys(state.downloadedKeys || {}).length
    };
  }

  loadMetadataCache(companyDir, cnpj) {
    const matchCnpj = String(companyDir || '').match(/(\d{14})/);
    const clean = String(cnpj || (matchCnpj ? matchCnpj[1] : path.basename(companyDir))).replace(/\D/g, '');
    this.stateDb.migrateLegacyFiles(companyDir, clean);
    return this.stateDb.loadMetadataCache(clean);
  }

  saveMetadataCache(companyDir, cache, cnpj) {
    const matchCnpj = String(companyDir || '').match(/(\d{14})/);
    const clean = String(cnpj || (matchCnpj ? matchCnpj[1] : path.basename(companyDir))).replace(/\D/g, '');
    this.stateDb.saveMetadataCache(clean, cache);
  }

  extractXmlMetadata(xmlText, fileName, folder, fullPath) {
    const getTagValue = (tag, source) => {
      const match = source.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`));
      return match ? match[1].trim() : '';
    };

    const getSection = (tag, source) => {
      const match = source.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\/${tag}>`));
      return match ? match[0] : '';
    };

    const ide = getSection('ide', xmlText);
    const emit = getSection('emit', xmlText);
    const dest = getSection('dest', xmlText);
    const icmsTot = getSection('ICMSTot', xmlText);

    // Chave de 44 dígitos
    const chNFeMatch = xmlText.match(/Id="NFe(\d{44})"/i) || fileName.match(/(\d{44})/);
    const chNFe = chNFeMatch ? chNFeMatch[1] : '';

    const nNF = getTagValue('nNF', ide) || '-';
    const serie = getTagValue('serie', ide) || '1';
    const dhEmi = getTagValue('dhEmi', ide) || getTagValue('dEmi', ide) || '';
    const dhSaiEnt = getTagValue('dhSaiEnt', ide) || getTagValue('dSaiEnt', ide) || '';

    let formattedDate = dhEmi;
    if (dhEmi) {
      try {
        const d = new Date(dhEmi);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        }
      } catch (e) {}
    }

    const mod = getTagValue('mod', ide) || (chNFe.length === 44 ? chNFe.substring(20, 22) : '55');

    const emitente = getTagValue('xNome', emit) || 'Emitente Desconhecido';
    const cnpjEmitente = getTagValue('CNPJ', emit) || getTagValue('CPF', emit) || '';
    const ufRem = getTagValue('UF', getSection('enderEmit', emit)) || '';

    const destinatario = getTagValue('xNome', dest) || '';
    const cnpjDest = getTagValue('CNPJ', dest) || getTagValue('CPF', dest) || '';
    const ufDest = getTagValue('UF', getSection('enderDest', dest)) || '';

    const vNFStr = getTagValue('vNF', icmsTot) || '0';
    const vNF = parseFloat(vNFStr) || 0;

    const isInterestadual = !!(ufRem && ufDest && ufRem.toUpperCase() !== ufDest.toUpperCase());

    return {
      name: fileName,
      fullPath: fullPath || '',
      folder: folder || 'indefinido',
      chNFe,
      modelo: mod,
      nNF,
      serie,
      dhEmi,
      dhSaiEnt,
      formattedDate,
      emitente,
      cnpjEmitente,
      ufRem,
      destinatario,
      cnpjDest,
      ufDest,
      vNF,
      isInterestadual
    };
  }

  listCompanyXmls({ cnpj, razaoSocial, yearMonth }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    if (!fs.existsSync(companyDir)) {
      return [];
    }

    const cache = this.loadMetadataCache(companyDir, cleanCnpj);
    let cacheDirty = false;
    const xmlList = [];
    const seenKeys = new Set();

    const scan = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const lowerName = entry.name.toLowerCase();
          if (['danfes', 'saidas', 'transportes', 'servicos', 'nfce', 'cte', 'nfse'].includes(lowerName)) continue;
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.xml')) {
          const lowerPath = fullPath.toLowerCase();
          if (
            lowerPath.includes(path.sep + 'saidas' + path.sep) ||
            lowerPath.includes(path.sep + 'transportes' + path.sep) ||
            lowerPath.includes(path.sep + 'servicos' + path.sep) ||
            lowerPath.includes(path.sep + 'nfce' + path.sep) ||
            lowerPath.includes(path.sep + 'cte' + path.sep) ||
            lowerPath.includes(path.sep + 'nfse' + path.sep) ||
            entry.name.endsWith('-nfce.xml') ||
            entry.name.endsWith('-cte.xml') ||
            entry.name.endsWith('-nfse.xml')
          ) {
            continue;
          }
          const match = entry.name.match(/(\d{44})/);
          const chNFe = match ? match[1] : entry.name;
          if (seenKeys.has(chNFe)) {
            continue;
          }

          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch (e) {
            continue;
          }

          let meta = cache[chNFe];
          if (meta && meta.mtimeMs === stat.mtimeMs) {
            meta.fullPath = fullPath;
            const mPath = fullPath.match(/(\d{4})[\\/](\d{2})/);
            if (mPath && meta.folder !== `${mPath[1]}-${mPath[2]}`) {
              meta.folder = `${mPath[1]}-${mPath[2]}`;
              cacheDirty = true;
            }
          } else {
            let content = '';
            try {
              content = fs.readFileSync(fullPath, 'utf8');
            } catch (e) {
              continue;
            }

            if (content.includes('<infCte') || content.includes('<cteProc') || content.includes('<CTe')) {
              continue;
            }

            let fileYearMonth = 'indefinido';
            const mPath = fullPath.match(/(\d{4})[\\/](\d{2})/);
            if (mPath) {
              fileYearMonth = `${mPath[1]}-${mPath[2]}`;
            } else {
              const relFolder = path.basename(path.dirname(fullPath));
              if (/^\d{4}-\d{2}$/.test(relFolder)) {
                fileYearMonth = relFolder;
              } else {
                const mSaiEnt = content.match(/<d[h]?SaiEnt>(\d{4}-\d{2})/);
                if (mSaiEnt) {
                  fileYearMonth = mSaiEnt[1];
                } else if (chNFe && chNFe.length === 44) {
                  const yy = chNFe.substring(2, 4);
                  const mm = chNFe.substring(4, 6);
                  if (/^\d{2}$/.test(yy) && /^(0[1-9]|1[0-2])$/.test(mm)) {
                    fileYearMonth = `20${yy}-${mm}`;
                  }
                }
              }
            }
            if (fileYearMonth === 'indefinido') {
              const mDate = content.match(/<d[h]?Emi>(\d{4}-\d{2})/);
              if (mDate) {
                fileYearMonth = mDate[1];
              }
            }

            meta = this.extractXmlMetadata(content, entry.name, fileYearMonth, fullPath);
            meta.mtimeMs = stat.mtimeMs;
            cache[chNFe] = meta;
            cacheDirty = true;
          }

          seenKeys.add(chNFe);

          // Restringe estritamente a NF-e Modelo 55 (descarta CT-e Modelo 57, NFC-e Modelo 65, etc.)
          if (meta.modelo && meta.modelo !== '55') {
            continue;
          }

          if (yearMonth && yearMonth !== 'all' && meta.folder !== yearMonth) {
            continue;
          }

          xmlList.push(meta);
        }
      }
    };

    scan(companyDir);

    if (cacheDirty) {
      this.saveMetadataCache(companyDir, cache, cleanCnpj);
    }

    return xmlList;
  }

  async syncCompanyNfce({ company, diasRetroativos = 90, forceFullScan = false, onProgress }) {
    const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
    const ambiente = Number(company.ambiente) || 1;
    const companyDir = this.getCompanyDir(cleanCnpj, company.razaoSocial);

    if (onProgress) onProgress({ status: 'info', message: 'Carregando certificado digital A1...' });
    const certManager = new CertManager(company.certPath, company.password);
    const certInfo = certManager.load();

    if (certInfo.isExpired) {
      throw new Error('O certificado digital da empresa está expirado!');
    }

    const soapClient = new SoapClient(
      certManager.getFullCertChainPem(),
      certManager.getKeyPem(),
      certManager.getCaPems()
    );

    const nfceService = new SaeNfceService(soapClient, {
      cnpj: cleanCnpj,
      ambiente,
      delayMs: 350
    });

    this.stateDb.migrateLegacyFiles(companyDir, cleanCnpj);
    const stateNfce = this.stateDb.getState(cleanCnpj, 'nfce', {
      lastExecution: null,
      lastSyncTime: null,
      ultimaDataEmissao: null,
      downloadedKeys: {}
    });
    stateNfce.downloadedKeys = stateNfce.downloadedKeys || {};

    const danfe = new DanfeService();
    const maxDias = Math.min(Number(diasRetroativos) || 90, 100);
    const agora = new Date();
    const dataLimiteRetroativa = new Date(agora.getTime() - maxDias * 24 * 60 * 60 * 1000);
    dataLimiteRetroativa.setHours(0, 0, 0, 0);

    let dataInicial = dataLimiteRetroativa;

    // Localiza a data da última nota baixada para buscar a partir dela (evitando redundância e duplicação)
    let ultimaDataRef = stateNfce.ultimaDataEmissao ? new Date(stateNfce.ultimaDataEmissao) : null;
    if (!ultimaDataRef && stateNfce.downloadedKeys && Object.keys(stateNfce.downloadedKeys).length > 0) {
      for (const k in stateNfce.downloadedKeys) {
        const item = stateNfce.downloadedKeys[k];
        if (item && item.dhEmi) {
          const d = new Date(item.dhEmi);
          if (!isNaN(d.getTime()) && (!ultimaDataRef || d > ultimaDataRef)) {
            ultimaDataRef = d;
          }
        }
      }
    }

    // Se temos a última nota e não foi solicitada varredura forçada completa, busca a partir da última nota
    if (!forceFullScan && ultimaDataRef && !isNaN(ultimaDataRef.getTime())) {
      // Volta 1 hora antes da última nota como margem de segurança contra notas autorizadas no mesmo minuto
      const dataAposUltima = new Date(ultimaDataRef.getTime() - 60 * 60 * 1000);
      if (dataAposUltima > dataLimiteRetroativa) {
        dataInicial = dataAposUltima;
      }
    }

    // Mapeamento prévio dos XMLs já existentes no disco para blindagem total contra duplicidades
    const existingDiskKeys = new Map();
    const scanExistingNfce = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (['NFE ENTRADAS', 'CTE', 'NFSE', 'danfes', 'transportes'].includes(entry.name)) continue;
            scanExistingNfce(full);
          } else if (entry.isFile() && entry.name.endsWith('.xml') && (entry.name.endsWith('-nfce.xml') || full.includes(path.sep + 'NFCE' + path.sep))) {
            const match = entry.name.match(/(\d{44})/);
            if (match) existingDiskKeys.set(match[1], full);
          }
        }
      } catch (_) {}
    };
    if (fs.existsSync(companyDir)) scanExistingNfce(companyDir);

    if (onProgress) {
      const diasAprox = Math.ceil((agora.getTime() - dataInicial.getTime()) / (24 * 60 * 60 * 1000));
      const infoOrigem = !forceFullScan && ultimaDataRef && dataInicial > dataLimiteRetroativa
        ? `a partir da última nota (${dataInicial.toLocaleString('pt-BR')})`
        : `período completo de ${diasAprox} dias`;
      onProgress({
        status: 'info',
        message: `Consultando chaves de NFC-e autorizadas na SEFAZ-SP (${infoOrigem})...`
      });
    }

    const chaves = await nfceService.listarChavesRecursivo(dataInicial, agora);
    const totalLocalizadas = chaves.length;

    let totalBaixadas = 0;
    let jaExistentes = 0;
    const erros = [];

    if (totalLocalizadas === 0) {
      stateNfce.lastExecution = new Date().toISOString();
      stateNfce.lastSyncTime = new Date().toISOString();
      this.stateDb.saveState(cleanCnpj, 'nfce', stateNfce);
      if (onProgress) {
        onProgress({ status: 'info', message: 'Nenhuma nova NFC-e emitida no período consultado.' });
      }
      return { success: true, totalLocalizadas: 0, totalBaixadas: 0, jaExistentes: 0, erros: [] };
    }

    let indice = 0;
    for (const item of chaves) {
      indice++;
      const chave = item.chNFe;

      // 1. Verificação de existência no cache SQLite criptografado
      if (stateNfce.downloadedKeys && stateNfce.downloadedKeys[chave]) {
        const existingPath = stateNfce.downloadedKeys[chave].filePath;
        if (existingPath && fs.existsSync(existingPath)) {
          jaExistentes++;
          if (onProgress) {
            onProgress({
              status: 'progress',
              current: indice,
              total: totalLocalizadas,
              chave,
              action: 'skipped',
              message: `[${indice}/${totalLocalizadas}] Chave já armazenada (cache): ${chave}`
            });
          }
          continue;
        }
      }

      // 2. Verificação de existência física no disco
      if (existingDiskKeys.has(chave)) {
        const diskPath = existingDiskKeys.get(chave);
        if (fs.existsSync(diskPath)) {
          jaExistentes++;
          stateNfce.downloadedKeys[chave] = {
            date: new Date().toISOString(),
            filePath: diskPath
          };
          if (onProgress) {
            onProgress({
              status: 'progress',
              current: indice,
              total: totalLocalizadas,
              chave,
              action: 'skipped',
              message: `[${indice}/${totalLocalizadas}] Chave já existente no disco: ${chave}`
            });
          }
          continue;
        }
      }

      try {
        if (onProgress) {
          onProgress({
            status: 'progress',
            current: indice,
            total: totalLocalizadas,
            chave,
            action: 'downloading',
            message: `[${indice}/${totalLocalizadas}] Baixando XML: ${chave}`
          });
        }

        const downloadRes = await nfceService.baixarXml(chave);
        const xmlContent = downloadRes.xmlContent;

        let ym = 'indefinido';
        const mDate = xmlContent.match(/<d[h]?Emi>(\d{4}-\d{2})/);
        if (mDate) {
          ym = mDate[1];
        } else if (item.dhEmi && item.dhEmi.length >= 7) {
          ym = item.dhEmi.substring(0, 7);
        } else {
          ym = agora.toISOString().substring(0, 7);
        }

        const targetFolder = this.resolveModelFolder(companyDir, ym, 'NFCE');
        const xmlPath = path.join(targetFolder, `${chave}-nfce.xml`);
        fs.writeFileSync(xmlPath, xmlContent, 'utf8');

        const pdfPath = path.join(targetFolder, `${chave}-nfce-danfe.pdf`);
        try {
          await danfe.gerarDanfeFromXml(xmlContent, pdfPath);
        } catch (ePdf) {
          console.warn(`Aviso ao gerar DANFE da NFC-e ${chave}:`, ePdf.message);
        }

        const meta = this.extractXmlMetadata(xmlContent, `${chave}-nfce.xml`, ym, xmlPath);
        stateNfce.downloadedKeys[chave] = {
          date: new Date().toISOString(),
          filePath: xmlPath,
          pdfPath: fs.existsSync(pdfPath) ? pdfPath : undefined,
          valor: meta.vNF,
          dhEmi: meta.dhEmi,
          nNF: meta.nNF,
          serie: meta.serie,
          emitente: meta.emitente,
          destinatario: meta.destinatario
        };

        // Atualiza o ponteiro da última nota emitida
        if (meta.dhEmi) {
          const d = new Date(meta.dhEmi);
          if (!isNaN(d.getTime())) {
            if (!stateNfce.ultimaDataEmissao || d > new Date(stateNfce.ultimaDataEmissao)) {
              stateNfce.ultimaDataEmissao = meta.dhEmi;
              stateNfce.ultimaChave = chave;
            }
          }
        }

        totalBaixadas++;
      } catch (err) {
        erros.push({ chave, error: err.message });
        if (onProgress) {
          onProgress({
            status: 'progress',
            current: indice,
            total: totalLocalizadas,
            chave,
            action: 'error',
            message: `[${indice}/${totalLocalizadas}] Erro ao baixar ${chave}: ${err.message}`
          });
        }
      }
    }

    stateNfce.lastExecution = new Date().toISOString();
    stateNfce.lastSyncTime = new Date().toISOString();
    this.stateDb.saveState(cleanCnpj, 'nfce', stateNfce);

    return {
      success: true,
      totalLocalizadas,
      totalBaixadas,
      jaExistentes,
      totalErros: erros.length,
      erros
    };
  }

  listCompanyNfceXmls({ cnpj, razaoSocial, yearMonth }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    if (!fs.existsSync(companyDir)) {
      return [];
    }

    const nfceList = [];
    const seenKeys = new Set();

    const scan = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['NFE ENTRADAS', 'CTE', 'NFSE', 'danfes', 'transportes'].includes(entry.name)) continue;
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.xml') && (entry.name.endsWith('-nfce.xml') || fullPath.includes(path.sep + 'NFCE' + path.sep) || fullPath.includes(path.sep + 'nfce' + path.sep))) {
          const match = entry.name.match(/(\d{44})/);
          const chNFe = match ? match[1] : entry.name;
          if (seenKeys.has(chNFe)) continue;

          let content = '';
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch (e) {
            continue;
          }

          let fileYearMonth = 'indefinido';
          const mPath = fullPath.match(/(\d{4})[\\/](\d{2})/);
          if (mPath) {
            fileYearMonth = `${mPath[1]}-${mPath[2]}`;
          } else {
            const relFolder = path.basename(path.dirname(fullPath));
            if (/^\d{4}-\d{2}$/.test(relFolder)) {
              fileYearMonth = relFolder;
            } else if (chNFe && chNFe.length === 44) {
              const yy = chNFe.substring(2, 4);
              const mm = chNFe.substring(4, 6);
              if (/^\d{2}$/.test(yy) && /^(0[1-9]|1[0-2])$/.test(mm)) {
                fileYearMonth = `20${yy}-${mm}`;
              }
            }
          }
          if (fileYearMonth === 'indefinido') {
            const mDate = content.match(/<d[h]?Emi>(\d{4}-\d{2})/);
            if (mDate) fileYearMonth = mDate[1];
          }

          const meta = this.extractXmlMetadata(content, entry.name, fileYearMonth, fullPath);
          meta.modelo = meta.modelo || '65';

          // Procura o PDF na mesma pasta (prioritário) ou legado
          const sameDirPdf = path.join(dir, `${chNFe}-nfce-danfe.pdf`);
          const sameDirPdf2 = path.join(dir, `${chNFe}-danfe.pdf`);
          const legacyPdf = fullPath
            .replace(path.join('xmls', 'saidas', 'nfce'), path.join('danfes', 'saidas', 'nfce'))
            .replace('.xml', '-danfe.pdf');

          if (fs.existsSync(sameDirPdf)) {
            meta.pdfPath = sameDirPdf;
          } else if (fs.existsSync(sameDirPdf2)) {
            meta.pdfPath = sameDirPdf2;
          } else if (fs.existsSync(legacyPdf)) {
            meta.pdfPath = legacyPdf;
          }

          seenKeys.add(chNFe);

          if (yearMonth && yearMonth !== 'all' && meta.folder !== yearMonth) {
            continue;
          }

          nfceList.push(meta);
        }
      }
    };

    scan(companyDir);

    nfceList.sort((a, b) => {
      const dateA = a.dhEmi ? new Date(a.dhEmi).getTime() : 0;
      const dateB = b.dhEmi ? new Date(b.dhEmi).getTime() : 0;
      return dateB - dateA;
    });

    return nfceList;
  }

  listAvailableNfceMonths({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const monthsSet = new Set();

    // 1. Estrutura nova EMPRESA/ANO/MÊS/NFCE
    try {
      const topEntries = fs.readdirSync(companyDir, { withFileTypes: true });
      for (const top of topEntries) {
        if (top.isDirectory() && /^\d{4}$/.test(top.name)) {
          const year = top.name;
          const monthEntries = fs.readdirSync(path.join(companyDir, year), { withFileTypes: true });
          for (const m of monthEntries) {
            if (m.isDirectory()) {
              const nfceSub = path.join(companyDir, year, m.name, 'NFCE');
              if (fs.existsSync(nfceSub)) {
                const mMatch = m.name.match(/^(\d{2})/);
                if (mMatch) monthsSet.add(`${year}-${mMatch[1]}`);
              }
            }
          }
        }
      }
    } catch (_) {}

    // 2. Estrutura legada xmls/saidas/nfce
    const baseXmlNfceDir = path.join(companyDir, 'xmls', 'saidas', 'nfce');
    if (fs.existsSync(baseXmlNfceDir)) {
      try {
        const entries = fs.readdirSync(baseXmlNfceDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name)) {
            monthsSet.add(e.name);
          }
        }
      } catch (e) {}
    }

    return Array.from(monthsSet).sort().reverse();
  }

  readXmlsContent(filePaths) {
    if (!Array.isArray(filePaths) || filePaths.length === 0) return [];
    const results = [];
    for (const p of filePaths) {
      try {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          results.push({
            name: path.basename(p),
            fullPath: p,
            content
          });
        }
      } catch (e) {
        console.warn(`Falha ao ler XML ${p}:`, e.message);
      }
    }
    return results;
  }

  listAvailableMonths({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    if (!fs.existsSync(companyDir)) {
      return [];
    }

    const monthsSet = new Set();

    // 1. Lê do banco SQLite criptografado (e migra state.json legado se existir)
    this.stateDb.migrateLegacyFiles(companyDir, cleanCnpj);
    const state = this.stateDb.getState(cleanCnpj, 'nfe', {});
    if (state && state.downloadedKeys) {
      for (const k of Object.keys(state.downloadedKeys)) {
        const item = state.downloadedKeys[k];
        if (item && item.dhEmi && item.dhEmi.length >= 7) {
          monthsSet.add(item.dhEmi.substring(0, 7));
        }
      }
    }

    // 2. Lê pastas legadas em xmls/
    const xmlDir = path.join(companyDir, 'xmls');
    if (fs.existsSync(xmlDir)) {
      try {
        const entries = fs.readdirSync(xmlDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name)) {
            monthsSet.add(e.name);
          }
        }
      } catch (e) {}
    }

    // 3. Lê pastas na estrutura hierárquica [ANO]/[MÊS]/
    try {
      const topEntries = fs.readdirSync(companyDir, { withFileTypes: true });
      for (const top of topEntries) {
        if (top.isDirectory() && /^\d{4}$/.test(top.name)) {
          const year = top.name;
          const monthEntries = fs.readdirSync(path.join(companyDir, year), { withFileTypes: true });
          for (const m of monthEntries) {
            if (m.isDirectory()) {
              const mMatch = m.name.match(/^(\d{2})/);
              if (mMatch) {
                monthsSet.add(`${year}-${mMatch[1]}`);
              }
            }
          }
        }
      }
    } catch (e) {}

    return Array.from(monthsSet).sort().reverse();
  }

  getDanfePath({ cnpj, razaoSocial, chNFe, yearMonth }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const cleanKey = String(chNFe || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    if (!fs.existsSync(companyDir)) return null;

    const findPdf = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return null;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'xmls') continue;
          const found = findPdf(full);
          if (found) return found;
        } else if (entry.isFile() && entry.name.includes(cleanKey) && entry.name.endsWith('.pdf')) {
          return full;
        }
      }
      return null;
    };

    return findPdf(companyDir);
  }

  getXmlPath({ cnpj, razaoSocial, chNFe, yearMonth }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const cleanKey = String(chNFe || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    if (!fs.existsSync(companyDir)) return null;

    const findXml = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return null;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'danfes') continue;
          const found = findXml(full);
          if (found) return found;
        } else if (entry.isFile() && entry.name.includes(cleanKey) && entry.name.endsWith('.xml')) {
          return full;
        }
      }
      return null;
    };

    return findXml(companyDir);
  }

  exportCompetencia({ cnpj, companyName, yearMonth, startDate, endDate, specificKeys, exportType, targetZipPath }) {
    const AdmZip = require('adm-zip');
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, companyName);
    const xmlDir = path.join(companyDir, 'xmls');
    const danfeDir = path.join(companyDir, 'danfes');

    const zip = new AdmZip();
    let fileCount = 0;

    const shouldIncludeXml = exportType === 'all' || exportType === 'xml';
    const shouldIncludePdf = exportType === 'all' || exportType === 'pdf';

    const keysSet = specificKeys && Array.isArray(specificKeys) && specificKeys.length > 0
      ? new Set(specificKeys.map(k => String(k).replace(/\D/g, '')))
      : null;

    const isFileIncluded = (fileName, folderName) => {
      const match = fileName.match(/(\d{44})/);
      const chNFe = match ? match[1] : '';

      if (keysSet) {
        return chNFe ? keysSet.has(chNFe) : false;
      }

      if (yearMonth && yearMonth !== 'all' && folderName !== yearMonth) {
        return false;
      }

      if (startDate || endDate) {
        const folderMonth = folderName.length === 7 ? folderName : '';
        if (folderMonth) {
          if (startDate && folderMonth < startDate.substring(0, 7)) return false;
          if (endDate && folderMonth > endDate.substring(0, 7)) return false;
        }
      }

      return true;
    };

    // 1. Scan estrutura nova EMPRESA/ANO/MÊS/NFE ENTRADAS
    try {
      const scanNfeDir = (dir, currentYear, currentMonth) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (/^\d{4}$/.test(entry.name)) {
              scanNfeDir(fullPath, entry.name, currentMonth);
            } else if (entry.name === 'NFE ENTRADAS' || entry.name === 'DENTRO DO ESTADO' || entry.name === 'FORA DO ESTADO') {
              scanNfeDir(fullPath, currentYear, currentMonth);
            } else if (currentYear) {
              const mMatch = entry.name.match(/^(\d{2})/);
              const mNum = mMatch ? mMatch[1] : '';
              scanNfeDir(fullPath, currentYear, mNum ? `${currentYear}-${mNum}` : entry.name);
            }
          } else if (entry.isFile() && fullPath.includes(path.sep + 'NFE ENTRADAS' + path.sep)) {
            const folderLabel = currentMonth || 'Geral';
            const route = fullPath.includes('FORA DO ESTADO') ? 'FORA DO ESTADO' : (fullPath.includes('DENTRO DO ESTADO') ? 'DENTRO DO ESTADO' : '');
            const zipFolder = route ? `${folderLabel}/${route}` : folderLabel;
            if (shouldIncludeXml && entry.name.endsWith('.xml') && !entry.name.endsWith('-cte.xml') && !entry.name.endsWith('-nfce.xml') && !entry.name.endsWith('-nfse.xml') && isFileIncluded(entry.name, folderLabel)) {
              const subDirInZip = exportType === 'all' ? `XMLs/${zipFolder}` : `${zipFolder}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
            if (shouldIncludePdf && entry.name.endsWith('.pdf') && isFileIncluded(entry.name, folderLabel)) {
              const subDirInZip = exportType === 'all' ? `DANFEs/${zipFolder}` : `${zipFolder}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
          }
        }
      };
      if (fs.existsSync(companyDir)) scanNfeDir(companyDir, null, null);
    } catch (_) {}

    // 2. Scan XMLs legados (se existirem)
    if (shouldIncludeXml && fs.existsSync(xmlDir)) {
      const folders = fs.readdirSync(xmlDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name !== 'transportes' && e.name !== 'saidas' && e.name !== 'servicos' && e.name !== 'danfes');
      for (const folder of folders) {
        if (!keysSet && yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) {
          continue;
        }
        const currentFolderDir = path.join(xmlDir, folder.name);
        const files = fs.readdirSync(currentFolderDir)
          .filter(f => f.endsWith('.xml') && !f.endsWith('-cte.xml') && !f.endsWith('-nfce.xml') && !f.endsWith('-nfse.xml'));
        for (const f of files) {
          if (isFileIncluded(f, folder.name)) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `XMLs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      }
    }

    // Scan DANFEs (PDFs de NF-e)
    if (shouldIncludePdf && fs.existsSync(danfeDir)) {
      const folders = fs.readdirSync(danfeDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && e.name !== 'transportes' && e.name !== 'saidas' && e.name !== 'servicos');
      for (const folder of folders) {
        if (!keysSet && yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) {
          continue;
        }
        const currentFolderDir = path.join(danfeDir, folder.name);
        const files = fs.readdirSync(currentFolderDir)
          .filter(f => f.endsWith('.pdf') && !f.includes('-cte-danfe.pdf'));
        for (const f of files) {
          if (isFileIncluded(f, folder.name)) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `DANFEs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      }
    }

    if (fileCount === 0) {
      throw new Error(`Nenhum arquivo encontrado para o período ou competência selecionada.`);
    }

    zip.writeZip(targetZipPath);
    return {
      success: true,
      fileCount,
      targetZipPath
    };
  }

  saveSingleXml({ cnpj, chNFe, yearMonth, targetFilePath }) {
    const xmlPath = this.getXmlPath({ cnpj, chNFe, yearMonth });
    if (!xmlPath || !fs.existsSync(xmlPath)) {
      throw new Error('Arquivo XML da NF-e não encontrado.');
    }
    fs.copyFileSync(xmlPath, targetFilePath);
    return { success: true, targetFilePath };
  }

  async fetchSingleByChave({ company, chNFe, onProgress }) {
    const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
    const cleanKey = String(chNFe || '').replace(/\D/g, '');

    if (cleanKey.length !== 44) {
      throw new Error('A chave de acesso deve conter exatamente 44 dígitos numéricos.');
    }

    const ufUpper = (company.uf || 'SP').toUpperCase();
    const cUFAutor = UF_TO_IBGE[ufUpper] || '35';
    const ambiente = Number(company.ambiente) || 1;

    const companyDir = this.getCompanyDir(cleanCnpj, company.razaoSocial);
    const storage = new XmlStorage(companyDir, cleanCnpj);
    const state = storage.loadState();
    const danfe = new DanfeService();

    if (onProgress) onProgress({ status: 'info', message: 'Validando certificado digital...' });
    const certManager = new CertManager(company.certPath, company.password);
    const certInfo = certManager.load();

    if (certInfo.isExpired) {
      throw new Error('O certificado digital da empresa está expirado!');
    }

    const soapClient = new SoapClient(
      certManager.getFullCertChainPem(),
      certManager.getKeyPem(),
      certManager.getCaPems()
    );
    const xmlSigner = new XmlSigner(certManager.getKeyPem(), certManager.getCertPem());

    const distribuicao = new DistribuicaoService(soapClient, {
      cnpj: cleanCnpj,
      cUFAutor,
      ambiente
    });

    const manifestacao = new ManifestacaoService(soapClient, xmlSigner, {
      cnpj: cleanCnpj,
      ambiente
    });

    if (onProgress) onProgress({ status: 'info', message: `Consultando NF-e ${cleanKey.slice(-8)} na SEFAZ Nacional...` });
    let distRes = await distribuicao.consultarPorChave(cleanKey);

    let procDoc = null;
    let resDoc = null;

    for (const doc of (distRes.docs || [])) {
      try {
        const xml = storage.decompressDocZip(doc.contentBase64);
        const parsed = storage.parseDoc(xml);
        if (parsed.type === 'procNFe') {
          procDoc = { xml, parsed };
          break;
        } else if (parsed.type === 'resNFe') {
          resDoc = { xml, parsed };
        }
      } catch (e) {}
    }

    // Se ainda não temos procNFe (por ex. veio apenas resumo resNFe ou vazia), manifestamos para a SEFAZ liberar!
    if (!procDoc) {
      if (onProgress) onProgress({ status: 'info', message: 'Manifestando NF-e para liberação do XML completo...' });
      let manifRes = await manifestacao.darCiencia(cleanKey);

      // Se a nota tiver mais de 10 dias, a SEFAZ rejeita Ciência (596). Confirmação tem até 180 dias!
      if (!manifRes.success && manifRes.cStatEvento === '596') {
        if (onProgress) onProgress({ status: 'info', message: 'Prazo de Ciência excedido (>10 dias). Confirmando Operação...' });
        manifRes = await manifestacao.confirmarOperacao(cleanKey);
      }

      if (!manifRes.success && !manifRes.alreadyManifested) {
        throw new Error(`Falha ao manifestar NF-e: ${manifRes.xMotivo} (cStat: ${manifRes.cStatEvento})`);
      }

      state.manifestedKeys = state.manifestedKeys || {};
      state.manifestedKeys[cleanKey] = {
        date: new Date().toISOString(),
        status: manifRes.cStatEvento,
        nProt: manifRes.nProt
      };

      if (onProgress) onProgress({ status: 'info', message: 'Aguardando liberação do XML pela SEFAZ...' });
      await sleep(1500);

      distRes = await distribuicao.consultarPorChave(cleanKey);
      for (const doc of (distRes.docs || [])) {
        try {
          const xml = storage.decompressDocZip(doc.contentBase64);
          const parsed = storage.parseDoc(xml);
          if (parsed.type === 'procNFe') {
            procDoc = { xml, parsed };
            break;
          }
        } catch (e) {}
      }
    }

    if (!procDoc) {
      throw new Error('A NF-e foi manifestada com sucesso na SEFAZ, mas o XML completo ainda está sendo gerado pela SEFAZ Nacional. Aguarde cerca de 1 minuto e tente buscar novamente.');
    }

    // Salva o XML completo
    const saveRes = storage.saveFullXml(cleanKey, procDoc.xml, {
      dhEmi: procDoc.parsed.dhEmi,
      ufEmit: procDoc.parsed.ufEmit,
      ufDest: procDoc.parsed.ufDest || company.uf
    });
    const savedXmlPath = saveRes.filePath;

    // Gera o DANFE PDF na mesma pasta do XML (NFE ENTRADAS)
    const hierDanfePath = path.join(saveRes.targetDir, `${cleanKey}-danfe.pdf`);
    try {
      await danfe.gerarDanfeFromXml(procDoc.xml, hierDanfePath);
    } catch (ePdf) {
      console.warn('Erro ao gerar DANFE PDF:', ePdf.message);
    }

    // Registra no state.json
    state.downloadedKeys = state.downloadedKeys || {};
    state.downloadedKeys[cleanKey] = {
      date: new Date().toISOString(),
      filePath: savedXmlPath,
      emitente: procDoc.parsed.xNomeEmitente,
      cnpjEmitente: procDoc.parsed.cnpjEmitente,
      valor: procDoc.parsed.vNF,
      dhEmi: procDoc.parsed.dhEmi,
      ufEmit: procDoc.parsed.ufEmit,
      ufDest: procDoc.parsed.ufDest || company.uf
    };
    storage.saveState(state);

    return {
      success: true,
      chNFe: cleanKey,
      xmlPath: savedXmlPath,
      danfePath: hierDanfePath,
      emitente: procDoc.parsed.xNomeEmitente,
      cnpjEmitente: procDoc.parsed.cnpjEmitente,
      valor: procDoc.parsed.vNF,
      dhEmi: procDoc.parsed.dhEmi,
      yearMonth
    };
  }

  async syncAllCompanies({ companies, onProgress, syncNfseFn }) {
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return { success: true, message: 'Nenhuma empresa para sincronizar.', results: [] };
    }

    const total = companies.length;
    const summary = {
      nfe: { totalProcessed: 0, totalDownloaded: 0, skipped: 0, errors: 0 },
      nfce: { totalProcessed: 0, totalDownloaded: 0, skipped: 0, errors: 0 },
      cte: { totalProcessed: 0, totalDownloaded: 0, skipped: 0, errors: 0 },
      nfse: { totalProcessed: 0, totalDownloaded: 0, skipped: 0, errors: 0 }
    };
    const results = [];

    // =========================================================================
    // ETAPA 1/4: SINCRONIZAÇÃO DE NF-E (MODELO 55 - ENTRADAS)
    // =========================================================================
    if (onProgress) {
      onProgress({
        type: 'stage_start',
        stage: 1,
        totalStages: 4,
        stageName: 'NF-e Entradas (Mod. 55)',
        total,
        message: '>>> INICIANDO ETAPA 1/4: SINCRONIZAÇÃO DE NF-E (MODELO 55) <<<'
      });
    }

    for (let i = 0; i < total; i++) {
      const company = companies[i];
      const companyName = company.razaoSocial || company.cnpj;
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');

      const isNfeEnabled = company.modelosHabilitados ? company.modelosHabilitados.nfe !== false : true;

      if (!isNfeEnabled) {
        summary.nfe.skipped++;
        if (onProgress) {
          onProgress({
            type: 'company_skipped',
            stage: 1,
            stageName: 'NF-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 1/4 - NF-e] ${companyName}: Ignorada (Modelo 55 desabilitado no painel).`
          });
        }
        continue;
      }

      if (onProgress) {
        onProgress({
          type: 'company_start',
          stage: 1,
          stageName: 'NF-e',
          index: i + 1,
          total,
          companyName,
          cnpj: cleanCnpj,
          message: `[Etapa 1/4 - NF-e] Sincronizando ${companyName} (${i + 1} de ${total})...`
        });
      }

      try {
        const res = await this.syncCompany({
          company,
          forceSync: false,
          skipDanfeGeneration: true,
          onProgress: (p) => {
            if (onProgress) {
              onProgress({
                stage: 1,
                stageName: 'NF-e',
                index: i + 1,
                total,
                companyName,
                cnpj: cleanCnpj,
                ...p,
                message: `[Etapa 1/4 - NF-e] ${p.message || ''}`
              });
            }
          }
        });

        results.push({
          model: 'nfe',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: res.success,
          isCooldown: res.isCooldown || false,
          totalBaixadas: res.totalBaixadas || 0,
          totalManifestadas: res.totalManifestadas || 0,
          ultNSU: res.ultNSU,
          error: res.error || null
        });

        if (res.isCooldown) {
          summary.nfe.skipped++;
          if (onProgress) {
            onProgress({
              type: 'company_skipped',
              stage: 1,
              stageName: 'NF-e',
              index: i + 1,
              total,
              companyName,
              cnpj: cleanCnpj,
              message: `[Etapa 1/4 - NF-e] ${companyName}: Em repouso preventivo (${res.error || 'Aguardando intervalo SEFAZ'}).`
            });
          }
        } else {
          summary.nfe.totalProcessed++;
          summary.nfe.totalDownloaded += (res.totalBaixadas || 0);
          if (onProgress) {
            onProgress({
              type: 'company_done',
              stage: 1,
              stageName: 'NF-e',
              index: i + 1,
              total,
              companyName,
              cnpj: cleanCnpj,
              message: `[Etapa 1/4 - NF-e] ${companyName}: Concluído! (${res.totalBaixadas || 0} novas notas baixadas)`
            });
          }
        }
      } catch (err) {
        summary.nfe.errors++;
        results.push({
          model: 'nfe',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: false,
          error: err.message
        });

        if (onProgress) {
          onProgress({
            type: 'company_error',
            stage: 1,
            stageName: 'NF-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            error: err.message,
            message: `[Etapa 1/4 - NF-e] Erro ao sincronizar ${companyName}: ${err.message}`
          });
        }
      }

      if (i < total - 1) {
        await sleep(3000);
      }
    }

    // FASE 1.5: Geração de DANFEs em PDF para as notas baixadas de NF-e
    if (onProgress) {
      onProgress({
        type: 'stage_danfe_start',
        stage: 1,
        stageName: 'NF-e DANFE',
        total,
        message: '[Etapa 1/4 - NF-e] Gerando DANFEs em PDF pendentes para as notas baixadas...'
      });
    }

    for (let i = 0; i < total; i++) {
      const company = companies[i];
      const companyName = company.razaoSocial || company.cnpj;
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
      const isNfeEnabled = company.modelosHabilitados ? company.modelosHabilitados.nfe !== false : true;
      if (!isNfeEnabled) continue;

      try {
        await this.generateMissingDanfes({
          cnpj: cleanCnpj,
          razaoSocial: company.razaoSocial,
          onProgress: (p) => {
            if (onProgress) {
              onProgress({
                stage: 1,
                stageName: 'NF-e DANFE',
                index: i + 1,
                total,
                companyName,
                cnpj: cleanCnpj,
                ...p
              });
            }
          }
        });
      } catch (eDanfe) {
        console.warn(`Erro na geração de DANFEs para ${companyName}:`, eDanfe.message);
      }
    }

    // =========================================================================
    // ETAPA 2/4: SINCRONIZAÇÃO DE NFC-E (MODELO 65 - SAÍDAS SP)
    // =========================================================================
    if (onProgress) {
      onProgress({
        type: 'stage_start',
        stage: 2,
        totalStages: 4,
        stageName: 'NFC-e Saídas (Mod. 65)',
        total,
        message: '>>> INICIANDO ETAPA 2/4: SINCRONIZAÇÃO DE NFC-E (MODELO 65) <<<'
      });
    }

    for (let i = 0; i < total; i++) {
      const company = companies[i];
      const companyName = company.razaoSocial || company.cnpj;
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');

      const isNfceEnabled = company.modelosHabilitados
        ? (company.modelosHabilitados.nfce === true || (company.modelosHabilitados.nfce !== false && ((company.razaoSocial && company.razaoSocial.toUpperCase().includes('GAS')))))
        : ((company.razaoSocial && company.razaoSocial.toUpperCase().includes('GAS')));

      if (!isNfceEnabled) {
        summary.nfce.skipped++;
        if (onProgress) {
          onProgress({
            type: 'company_skipped',
            stage: 2,
            stageName: 'NFC-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 2/4 - NFC-e] ${companyName}: Ignorada (Modelo 65 desabilitado no painel).`
          });
        }
        continue;
      }

      if (onProgress) {
        onProgress({
          type: 'company_start',
          stage: 2,
          stageName: 'NFC-e',
          index: i + 1,
          total,
          companyName,
          cnpj: cleanCnpj,
          message: `[Etapa 2/4 - NFC-e] Sincronizando ${companyName} (${i + 1} de ${total})...`
        });
      }

      try {
        const res = await this.syncCompanyNfce({
          company,
          diasRetroativos: 90,
          onProgress: (p) => {
            if (onProgress) {
              onProgress({
                stage: 2,
                stageName: 'NFC-e',
                index: i + 1,
                total,
                companyName,
                cnpj: cleanCnpj,
                ...p,
                message: `[Etapa 2/4 - NFC-e] ${p.message || ''}`
              });
            }
          }
        });

        summary.nfce.totalProcessed++;
        summary.nfce.totalDownloaded += (res.totalBaixadas || 0);

        results.push({
          model: 'nfce',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: res.success,
          totalBaixadas: res.totalBaixadas || 0,
          totalLocalizadas: res.totalLocalizadas || 0
        });

        if (onProgress) {
          onProgress({
            type: 'company_done',
            stage: 2,
            stageName: 'NFC-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 2/4 - NFC-e] ${companyName}: Concluído! (${res.totalBaixadas || 0} cupons baixados)`
          });
        }
      } catch (err) {
        summary.nfce.errors++;
        results.push({
          model: 'nfce',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: false,
          error: err.message
        });

        if (onProgress) {
          onProgress({
            type: 'company_error',
            stage: 2,
            stageName: 'NFC-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            error: err.message,
            message: `[Etapa 2/4 - NFC-e] Erro ao sincronizar ${companyName}: ${err.message}`
          });
        }
      }

      if (i < total - 1) {
        await sleep(3000);
      }
    }

    // =========================================================================
    // ETAPA 3/4: SINCRONIZAÇÃO DE CT-E (MODELO 57 - FRETES)
    // =========================================================================
    if (onProgress) {
      onProgress({
        type: 'stage_start',
        stage: 3,
        totalStages: 4,
        stageName: 'CT-e Fretes (Mod. 57)',
        total,
        message: '>>> INICIANDO ETAPA 3/4: SINCRONIZAÇÃO DE CT-E (MODELO 57) <<<'
      });
    }

    for (let i = 0; i < total; i++) {
      const company = companies[i];
      const companyName = company.razaoSocial || company.cnpj;
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');

      const isCteEnabled = company.modelosHabilitados ? company.modelosHabilitados.cte !== false : true;

      if (!isCteEnabled) {
        summary.cte.skipped++;
        if (onProgress) {
          onProgress({
            type: 'company_skipped',
            stage: 3,
            stageName: 'CT-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 3/4 - CT-e] ${companyName}: Ignorada (Modelo 57 desabilitado no painel).`
          });
        }
        continue;
      }

      if (onProgress) {
        onProgress({
          type: 'company_start',
          stage: 3,
          stageName: 'CT-e',
          index: i + 1,
          total,
          companyName,
          cnpj: cleanCnpj,
          message: `[Etapa 3/4 - CT-e] Sincronizando ${companyName} (${i + 1} de ${total})...`
        });
      }

      try {
        const res = await this.syncCompanyCte({
          company,
          onProgress: (p) => {
            if (onProgress) {
              onProgress({
                stage: 3,
                stageName: 'CT-e',
                index: i + 1,
                total,
                companyName,
                cnpj: cleanCnpj,
                ...p,
                message: `[Etapa 3/4 - CT-e] ${p.message || ''}`
              });
            }
          }
        });

        summary.cte.totalProcessed++;
        summary.cte.totalDownloaded += (res.totalBaixadas || 0);

        results.push({
          model: 'cte',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: res.success,
          totalBaixadas: res.totalBaixadas || 0,
          ultimoNsuCte: res.ultimoNsuCte
        });

        if (onProgress) {
          onProgress({
            type: 'company_done',
            stage: 3,
            stageName: 'CT-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 3/4 - CT-e] ${companyName}: Concluído! (${res.totalBaixadas || 0} CT-e baixados)`
          });
        }
      } catch (err) {
        summary.cte.errors++;
        results.push({
          model: 'cte',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: false,
          error: err.message
        });

        if (onProgress) {
          onProgress({
            type: 'company_error',
            stage: 3,
            stageName: 'CT-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            error: err.message,
            message: `[Etapa 3/4 - CT-e] Erro ao sincronizar ${companyName}: ${err.message}`
          });
        }
      }

      if (i < total - 1) {
        await sleep(3000);
      }
    }

    // =========================================================================
    // ETAPA 4/4: SINCRONIZAÇÃO DE NFS-E (SERVIÇOS - PORTAL NACIONAL ADN)
    // =========================================================================
    if (onProgress) {
      onProgress({
        type: 'stage_start',
        stage: 4,
        totalStages: 4,
        stageName: 'NFS-e Serviços',
        total,
        message: '>>> INICIANDO ETAPA 4/4: SINCRONIZAÇÃO DE NFS-E (PORTAL NACIONAL) <<<'
      });
    }

    for (let i = 0; i < total; i++) {
      const company = companies[i];
      const companyName = company.razaoSocial || company.cnpj;
      const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');

      const isNfseEnabled = company.modelosHabilitados ? company.modelosHabilitados.nfse !== false : true;

      if (!isNfseEnabled) {
        summary.nfse.skipped++;
        if (onProgress) {
          onProgress({
            type: 'company_skipped',
            stage: 4,
            stageName: 'NFS-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 4/4 - NFS-e] ${companyName}: Ignorada (NFS-e desabilitada no painel).`
          });
        }
        continue;
      }

      if (!syncNfseFn) {
        summary.nfse.skipped++;
        if (onProgress) {
          onProgress({
            type: 'company_skipped',
            stage: 4,
            stageName: 'NFS-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 4/4 - NFS-e] ${companyName}: Módulo NFS-e indisponível no processo principal.`
          });
        }
        continue;
      }

      if (onProgress) {
        onProgress({
          type: 'company_start',
          stage: 4,
          stageName: 'NFS-e',
          index: i + 1,
          total,
          companyName,
          cnpj: cleanCnpj,
          message: `[Etapa 4/4 - NFS-e] Sincronizando ${companyName} (${i + 1} de ${total})...`
        });
      }

      try {
        const res = await syncNfseFn(company, (p) => {
          if (onProgress) {
            onProgress({
              stage: 4,
              stageName: 'NFS-e',
              index: i + 1,
              total,
              companyName,
              cnpj: cleanCnpj,
              ...p,
              message: `[Etapa 4/4 - NFS-e] ${p.message || ''}`
            });
          }
        });

        const baixados = (res && res.totalDocsBaixados !== undefined) ? res.totalDocsBaixados : 0;
        summary.nfse.totalProcessed++;
        summary.nfse.totalDownloaded += baixados;

        results.push({
          model: 'nfse',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: res?.sucesso ?? true,
          totalDocsBaixados: baixados,
          novoNsu: res?.novoNsu
        });

        if (onProgress) {
          onProgress({
            type: 'company_done',
            stage: 4,
            stageName: 'NFS-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            message: `[Etapa 4/4 - NFS-e] ${companyName}: Concluído! (${baixados} notas baixadas)`
          });
        }
      } catch (err) {
        summary.nfse.errors++;
        results.push({
          model: 'nfse',
          cnpj: cleanCnpj,
          razaoSocial: companyName,
          success: false,
          error: err.message
        });

        if (onProgress) {
          onProgress({
            type: 'company_error',
            stage: 4,
            stageName: 'NFS-e',
            index: i + 1,
            total,
            companyName,
            cnpj: cleanCnpj,
            error: err.message,
            message: `[Etapa 4/4 - NFS-e] Erro ao sincronizar ${companyName}: ${err.message}`
          });
        }
      }

      if (i < total - 1) {
        await sleep(3000);
      }
    }

    const totalBaixadasGeral = summary.nfe.totalDownloaded + summary.nfce.totalDownloaded + summary.cte.totalDownloaded + summary.nfse.totalDownloaded;

    if (onProgress) {
      onProgress({
        type: 'all_finished',
        total,
        summary,
        totalBaixadasGeral,
        message: `Sincronização geral concluída para todas as ${total} empresas! (Baixadas: NF-e: ${summary.nfe.totalDownloaded} | NFC-e: ${summary.nfce.totalDownloaded} | CT-e: ${summary.cte.totalDownloaded} | NFS-e: ${summary.nfse.totalDownloaded})`
      });
    }

    return {
      success: true,
      total,
      summary,
      totalBaixadasGeral,
      results
    };
  }

  async generateMissingDanfes({ cnpj, razaoSocial, onProgress }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    if (!fs.existsSync(companyDir)) return { totalGenerated: 0, totalChecked: 0 };

    const danfe = new DanfeService();
    const missing = [];

    const scanDir = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === 'danfes') continue;
          scanDir(full);
        } else if (entry.isFile() && entry.name.endsWith('.xml')) {
          const match = entry.name.match(/(\d{44})/);
          if (match) {
            const chNFe = match[1];
            const pdfSameDir = path.join(dir, `${chNFe}-danfe.pdf`);
            const pdfAlternative = path.join(dir, `${path.basename(entry.name, '.xml')}.pdf`);
            const hasPdf = (fs.existsSync(pdfSameDir) && fs.statSync(pdfSameDir).size > 0) ||
                           (fs.existsSync(pdfAlternative) && fs.statSync(pdfAlternative).size > 0);
            if (!hasPdf) {
              missing.push({ chNFe, xmlPath: full, targetPdfPath: pdfSameDir });
            }
          }
        }
      }
    };

    scanDir(companyDir);

    let totalGenerated = 0;
    const total = missing.length;
    for (let i = 0; i < total; i++) {
      const item = missing[i];
      if (onProgress) {
        onProgress({
          status: 'info',
          message: `Gerando DANFE PDF (${i + 1} de ${total}): NF-e ${item.chNFe.slice(-8)}...`,
          current: i + 1,
          total
        });
      }
      try {
        await danfe.gerarDanfeFromFile(item.xmlPath, item.targetPdfPath);
        totalGenerated++;
      } catch (eDanfe) {
        console.warn(`Aviso ao gerar DANFE para ${item.chNFe}:`, eDanfe.message);
      }
      // Pausa suave de 100ms entre DANFEs para manter CPU livre e PC responsivo
      await sleep(100);
    }

    return { totalGenerated, totalChecked: missing.length };
  }

  exportNfceCompetencia({ cnpj, razaoSocial, yearMonth, exportType = 'all', targetZipPath }) {
    const AdmZip = require('adm-zip');
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    const zip = new AdmZip();
    let fileCount = 0;

    const shouldIncludeXml = exportType === 'all' || exportType === 'xml';
    const shouldIncludePdf = exportType === 'all' || exportType === 'pdf';

    // 1. Scan estrutura nova EMPRESA/ANO/MÊS/NFCE
    try {
      const scanNfceDir = (dir, currentYear, currentMonth) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (/^\d{4}$/.test(entry.name)) {
              scanNfceDir(fullPath, entry.name, currentMonth);
            } else if (currentYear && !entry.name.includes('NFCE')) {
              const mMatch = entry.name.match(/^(\d{2})/);
              const mNum = mMatch ? mMatch[1] : '';
              scanNfceDir(fullPath, currentYear, mNum ? `${currentYear}-${mNum}` : entry.name);
            } else if (entry.name === 'NFCE' || entry.name === 'nfce') {
              scanNfceDir(fullPath, currentYear, currentMonth);
            }
          } else if (entry.isFile() && (fullPath.includes(path.sep + 'NFCE' + path.sep) || fullPath.includes(path.sep + 'nfce' + path.sep))) {
            const folderLabel = currentMonth || 'Geral';
            if (yearMonth && yearMonth !== 'all' && folderLabel !== yearMonth) continue;

            if (shouldIncludeXml && entry.name.endsWith('.xml')) {
              const subDirInZip = exportType === 'all' ? `XMLs/${folderLabel}` : `${folderLabel}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
            if (shouldIncludePdf && entry.name.endsWith('.pdf')) {
              const subDirInZip = exportType === 'all' ? `DANFEs/${folderLabel}` : `${folderLabel}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
          }
        }
      };
      if (fs.existsSync(companyDir)) scanNfceDir(companyDir, null, null);
    } catch (_) {}

    // 2. Scan estrutura legada (se existir)
    const baseXmlDir = path.join(companyDir, 'xmls', 'saidas', 'nfce');
    const baseDanfeDir = path.join(companyDir, 'danfes', 'saidas', 'nfce');

    if (shouldIncludeXml && fs.existsSync(baseXmlDir)) {
      try {
        const folders = fs.readdirSync(baseXmlDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const folder of folders) {
          if (yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) continue;
          const currentFolderDir = path.join(baseXmlDir, folder.name);
          const files = fs.readdirSync(currentFolderDir).filter(f => f.endsWith('.xml'));
          for (const f of files) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `XMLs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      } catch (_) {}
    }

    if (shouldIncludePdf && fs.existsSync(baseDanfeDir)) {
      try {
        const folders = fs.readdirSync(baseDanfeDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const folder of folders) {
          if (yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) continue;
          const currentFolderDir = path.join(baseDanfeDir, folder.name);
          const files = fs.readdirSync(currentFolderDir).filter(f => f.endsWith('.pdf'));
          for (const f of files) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `DANFEs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      } catch (_) {}
    }

    if (fileCount === 0) {
      throw new Error(`Nenhum arquivo NFC-e encontrado para a competência selecionada.`);
    }

    zip.writeZip(targetZipPath);
    return { fileCount, targetZipPath };
  }

  extractCteMetadata(xmlText, fileName, folder, fullPath) {
    const dacte = new DacteService();
    const data = dacte.parseCteXml(xmlText);
    const isInterestadual = !!(data.ufEmit && data.ufDest && data.ufEmit.toUpperCase() !== data.ufDest.toUpperCase()) ||
                            !!(data.ufRem && data.ufDest && data.ufRem.toUpperCase() !== data.ufDest.toUpperCase());

    return {
      name: fileName,
      fullPath: fullPath || '',
      folder: folder || 'indefinido',
      chCTe: data.chCTe,
      modelo: '57',
      nCT: data.nCT,
      serie: data.serie,
      dhEmi: data.dhEmi,
      formattedDate: data.formattedDate,
      emitente: data.emitente,
      cnpjEmitente: data.cnpjEmit,
      ufEmit: data.enderEmit ? (data.enderEmit.split('/').pop() || '').trim() : '',
      remetente: data.remetente,
      cnpjRem: data.cnpjRem,
      ufRem: data.enderRem ? (data.enderRem.split('/').pop() || '').trim() : '',
      destinatario: data.destinatario,
      cnpjDest: data.cnpjDest,
      ufDest: data.enderDest ? (data.enderDest.split('/').pop() || '').trim() : '',
      tomador: data.tomadorNome,
      cnpjTomador: data.cnpjTomador,
      papelTomador: data.tomaPapel,
      vTPrest: data.vTPrest,
      vRec: data.vRec,
      modal: data.modalLabel,
      cfop: data.cfop,
      isInterestadual,
      isCancelada: xmlText.includes('110111') || xmlText.toLowerCase().includes('cancelada')
    };
  }

  async syncCompanyCte({ company, onProgress }) {
    const cleanCnpj = String(company.cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, company.razaoSocial);
    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });

    const certManager = new CertManager(company.certPath, company.password);
    const certInfo = certManager.load();
    if (certInfo.isExpired) {
      throw new Error('Certificado digital da empresa está expirado.');
    }

    const soapClient = new SoapClient(
      certManager.getFullCertChainPem(),
      certManager.getKeyPem(),
      certManager.getCaPems()
    );

    const ufUpper = (company.uf || 'SP').toUpperCase();
    const cUFAutor = UF_TO_IBGE[ufUpper] || '35';
    const cteService = new CteDistribuicaoService(soapClient, {
      cnpj: cleanCnpj,
      cUFAutor,
      ambiente: Number(company.ambiente) || 1
    });

    const storage = new XmlStorage(companyDir, cleanCnpj);
    const dacte = new DacteService();

    this.stateDb.migrateLegacyFiles(companyDir, cleanCnpj);
    const stateCte = this.stateDb.getState(cleanCnpj, 'cte', {
      ultimoNsuCte: '0',
      downloadedKeys: {}
    });
    stateCte.downloadedKeys = stateCte.downloadedKeys || {};

    let ultNSU = stateCte.ultimoNsuCte || '0';
    let totalBaixadas = 0;
    let keepGoing = true;
    let iterations = 0;

    while (keepGoing && iterations < 15) {
      iterations++;
      if (onProgress) {
        onProgress({ status: 'info', message: `Consultando CT-e na SEFAZ Nacional a partir do NSU ${ultNSU}...` });
      }

      const res = await cteService.consultarPorNSU(ultNSU);

      if (res.cStat !== '138') {
        break;
      }

      const docs = res.docs || [];
      if (docs.length === 0) break;

      for (const doc of docs) {
        try {
          const xml = storage.decompressDocZip(doc.contentBase64);
          if (xml.includes('<CTe') || xml.includes('<cteProc')) {
            const chMatch = xml.match(/Id=["']CTe(\d{44})["']/i) || xml.match(/<chCTe>(\d{44})<\/chCTe>/i);
            const chCTe = chMatch ? chMatch[1] : `cte_${Date.now()}`;

            let ym = 'indefinido';
            const mDate = xml.match(/<dhEmi>(\d{4}-\d{2})/);
            if (mDate) ym = mDate[1];
            else ym = new Date().toISOString().substring(0, 7);

            const folderDir = this.resolveModelFolder(companyDir, ym, 'CTE');
            const xmlPath = path.join(folderDir, `${chCTe}-cte.xml`);
            fs.writeFileSync(xmlPath, xml, 'utf8');

            const pdfPath = path.join(folderDir, `${chCTe}-cte-danfe.pdf`);
            try {
              await dacte.gerarDactePdf(xml, pdfPath);
            } catch (ePdf) {
              console.warn('Aviso ao gerar DACTE PDF:', ePdf.message);
            }

            stateCte.downloadedKeys = stateCte.downloadedKeys || {};
            stateCte.downloadedKeys[chCTe] = {
              date: new Date().toISOString(),
              xmlPath,
              pdfPath: fs.existsSync(pdfPath) ? pdfPath : undefined,
              nsu: doc.nsu
            };

            totalBaixadas++;
          }
        } catch (eDoc) {
          console.warn('Erro ao processar documento CT-e:', eDoc.message);
        }
      }

      ultNSU = res.ultNSU;
      stateCte.ultimoNsuCte = ultNSU;

      if (parseInt(ultNSU, 10) >= parseInt(res.maxNSU || '0', 10)) {
        keepGoing = false;
      }

      await sleep(1000);
    }

    stateCte.lastSync = new Date().toISOString();
    this.stateDb.saveState(cleanCnpj, 'cte', stateCte);

    return {
      success: true,
      totalBaixadas,
      ultimoNsuCte: stateCte.ultimoNsuCte
    };
  }

  listCompanyCteXmls({ cnpj, razaoSocial, yearMonth }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    if (!fs.existsSync(companyDir)) return [];

    const cteList = [];
    const seenKeys = new Set();

    const scan = (dir) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (['NFE ENTRADAS', 'NFCE', 'NFSE', 'danfes', 'saidas'].includes(entry.name)) continue;
          scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.xml') && (entry.name.endsWith('-cte.xml') || fullPath.includes(path.sep + 'CTE' + path.sep) || fullPath.includes(path.sep + 'cte' + path.sep))) {
          const match = entry.name.match(/(\d{44})/);
          const chCTe = match ? match[1] : entry.name;
          if (seenKeys.has(chCTe)) continue;

          let content = '';
          try {
            content = fs.readFileSync(fullPath, 'utf8');
          } catch (e) {
            continue;
          }

          let fileYearMonth = 'indefinido';
          const mPath = fullPath.match(/(\d{4})[\\/](\d{2})/);
          if (mPath) {
            fileYearMonth = `${mPath[1]}-${mPath[2]}`;
          } else {
            const relFolder = path.basename(path.dirname(fullPath));
            if (/^\d{4}-\d{2}$/.test(relFolder)) {
              fileYearMonth = relFolder;
            } else if (chCTe && chCTe.length === 44) {
              const yy = chCTe.substring(2, 4);
              const mm = chCTe.substring(4, 6);
              if (/^\d{2}$/.test(yy) && /^(0[1-9]|1[0-2])$/.test(mm)) {
                fileYearMonth = `20${yy}-${mm}`;
              }
            }
          }
          if (fileYearMonth === 'indefinido') {
            const mDate = content.match(/<dhEmi>(\d{4}-\d{2})/);
            if (mDate) {
              fileYearMonth = mDate[1];
            }
          }

          const meta = this.extractCteMetadata(content, entry.name, fileYearMonth, fullPath);

          // Procura o PDF na mesma pasta primeiro, depois no caminho legado
          const sameDirPdf = path.join(dir, `${chCTe}-cte-danfe.pdf`);
          const sameDirPdf2 = path.join(dir, `${chCTe}-danfe.pdf`);
          const legacyPdf = fullPath
            .replace(path.join('xmls', 'transportes', 'cte'), path.join('danfes', 'transportes', 'cte'))
            .replace('.xml', '-danfe.pdf');

          if (fs.existsSync(sameDirPdf)) {
            meta.pdfPath = sameDirPdf;
          } else if (fs.existsSync(sameDirPdf2)) {
            meta.pdfPath = sameDirPdf2;
          } else if (fs.existsSync(legacyPdf)) {
            meta.pdfPath = legacyPdf;
          }

          seenKeys.add(chCTe);

          if (yearMonth && yearMonth !== 'all' && meta.folder !== yearMonth) {
            continue;
          }

          cteList.push(meta);
        }
      }
    };

    scan(companyDir);

    cteList.sort((a, b) => {
      const dateA = a.dhEmi ? new Date(a.dhEmi).getTime() : 0;
      const dateB = b.dhEmi ? new Date(b.dhEmi).getTime() : 0;
      return dateB - dateA;
    });

    return cteList;
  }

  listAvailableCteMonths({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const monthsSet = new Set();

    // 1. Estrutura nova EMPRESA/ANO/MÊS/CTE
    try {
      const topEntries = fs.readdirSync(companyDir, { withFileTypes: true });
      for (const top of topEntries) {
        if (top.isDirectory() && /^\d{4}$/.test(top.name)) {
          const year = top.name;
          const monthEntries = fs.readdirSync(path.join(companyDir, year), { withFileTypes: true });
          for (const m of monthEntries) {
            if (m.isDirectory()) {
              const cteSub = path.join(companyDir, year, m.name, 'CTE');
              if (fs.existsSync(cteSub)) {
                const mMatch = m.name.match(/^(\d{2})/);
                if (mMatch) monthsSet.add(`${year}-${mMatch[1]}`);
              }
            }
          }
        }
      }
    } catch (_) {}

    // 2. Estrutura legada xmls/transportes/cte
    const baseCteDir = path.join(companyDir, 'xmls', 'transportes', 'cte');
    if (fs.existsSync(baseCteDir)) {
      try {
        const entries = fs.readdirSync(baseCteDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && /^\d{4}-\d{2}$/.test(e.name)) {
            monthsSet.add(e.name);
          }
        }
      } catch (e) {}
    }

    return Array.from(monthsSet).sort().reverse();
  }

  exportCteCompetencia({ cnpj, razaoSocial, yearMonth, exportType = 'all', targetZipPath }) {
    const AdmZip = require('adm-zip');
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    const zip = new AdmZip();
    let fileCount = 0;

    const shouldIncludeXml = exportType === 'all' || exportType === 'xml';
    const shouldIncludePdf = exportType === 'all' || exportType === 'pdf';

    // 1. Scan estrutura nova EMPRESA/ANO/MÊS/CTE
    try {
      const scanCteDir = (dir, currentYear, currentMonth) => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (/^\d{4}$/.test(entry.name)) {
              scanCteDir(fullPath, entry.name, currentMonth);
            } else if (currentYear && !entry.name.includes('CTE')) {
              const mMatch = entry.name.match(/^(\d{2})/);
              const mNum = mMatch ? mMatch[1] : '';
              scanCteDir(fullPath, currentYear, mNum ? `${currentYear}-${mNum}` : entry.name);
            } else if (entry.name === 'CTE' || entry.name === 'cte') {
              scanCteDir(fullPath, currentYear, currentMonth);
            }
          } else if (entry.isFile() && (fullPath.includes(path.sep + 'CTE' + path.sep) || fullPath.includes(path.sep + 'cte' + path.sep))) {
            const folderLabel = currentMonth || 'Geral';
            if (yearMonth && yearMonth !== 'all' && folderLabel !== yearMonth) continue;

            if (shouldIncludeXml && entry.name.endsWith('.xml')) {
              const subDirInZip = exportType === 'all' ? `XMLs/${folderLabel}` : `${folderLabel}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
            if (shouldIncludePdf && entry.name.endsWith('.pdf')) {
              const subDirInZip = exportType === 'all' ? `DACTEs/${folderLabel}` : `${folderLabel}`;
              zip.addLocalFile(fullPath, subDirInZip);
              fileCount++;
            }
          }
        }
      };
      if (fs.existsSync(companyDir)) scanCteDir(companyDir, null, null);
    } catch (_) {}

    // 2. Scan estrutura legada (se existir)
    const baseXmlDir = path.join(companyDir, 'xmls', 'transportes', 'cte');
    const baseDanfeDir = path.join(companyDir, 'danfes', 'transportes', 'cte');

    if (shouldIncludeXml && fs.existsSync(baseXmlDir)) {
      try {
        const folders = fs.readdirSync(baseXmlDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const folder of folders) {
          if (yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) continue;
          const currentFolderDir = path.join(baseXmlDir, folder.name);
          const files = fs.readdirSync(currentFolderDir).filter(f => f.endsWith('.xml'));
          for (const f of files) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `XMLs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      } catch (_) {}
    }

    if (shouldIncludePdf && fs.existsSync(baseDanfeDir)) {
      try {
        const folders = fs.readdirSync(baseDanfeDir, { withFileTypes: true }).filter(e => e.isDirectory());
        for (const folder of folders) {
          if (yearMonth && yearMonth !== 'all' && folder.name !== yearMonth) continue;
          const currentFolderDir = path.join(baseDanfeDir, folder.name);
          const files = fs.readdirSync(currentFolderDir).filter(f => f.endsWith('.pdf'));
          for (const f of files) {
            const fullPath = path.join(currentFolderDir, f);
            const subDirInZip = exportType === 'all' ? `DACTEs/${folder.name}` : `${folder.name}`;
            zip.addLocalFile(fullPath, subDirInZip);
            fileCount++;
          }
        }
      } catch (_) {}
    }

    if (fileCount === 0) {
      throw new Error(`Nenhum arquivo CT-e encontrado para a competência selecionada.`);
    }

    zip.writeZip(targetZipPath);
    return { fileCount, targetZipPath };
  }

  getCompanyNfceCacheState({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    this.stateDb.migrateLegacyFiles(companyDir, cleanCnpj);
    return this.stateDb.getState(cleanCnpj, 'nfce', {
      lastExecution: null,
      lastSyncTime: null,
      ultimaDataEmissao: null,
      ultimaChave: null,
      downloadedKeys: {}
    });
  }

  resetCompanyNfceCache({ cnpj, razaoSocial, clearFiles = false }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const stateNfcePath = path.join(companyDir, 'state_nfce.json');

    const freshState = {
      lastExecution: null,
      lastSyncTime: null,
      ultimaDataEmissao: null,
      ultimaChave: null,
      downloadedKeys: {}
    };

    this.stateDb.saveState(cleanCnpj, 'nfce', freshState);

    if (fs.existsSync(companyDir)) {
      if (fs.existsSync(stateNfcePath)) {
        try { fs.rmSync(stateNfcePath, { force: true }); } catch (_) {}
      }

      if (clearFiles) {
        const baseXmlNfceDir = path.join(companyDir, 'xmls', 'saidas', 'nfce');
        const baseDanfeNfceDir = path.join(companyDir, 'danfes', 'saidas', 'nfce');
        if (fs.existsSync(baseXmlNfceDir)) {
          try { fs.rmSync(baseXmlNfceDir, { recursive: true, force: true }); } catch (_) {}
        }
        if (fs.existsSync(baseDanfeNfceDir)) {
          try { fs.rmSync(baseDanfeNfceDir, { recursive: true, force: true }); } catch (_) {}
        }

        // Limpa NFCE na nova estrutura ANO/MÊS/NFCE
        try {
          const entries = fs.readdirSync(companyDir, { withFileTypes: true });
          for (const y of entries) {
            if (y.isDirectory() && /^\d{4}$/.test(y.name)) {
              const yDir = path.join(companyDir, y.name);
              const months = fs.readdirSync(yDir, { withFileTypes: true });
              for (const m of months) {
                if (m.isDirectory()) {
                  const mDir = path.join(yDir, m.name);
                  const nfceSub = path.join(mDir, 'NFCE');
                  if (fs.existsSync(nfceSub)) {
                    try { fs.rmSync(nfceSub, { recursive: true, force: true }); } catch (_) {}
                  }
                  try { if (fs.readdirSync(mDir).length === 0) fs.rmdirSync(mDir); } catch (_) {}
                }
              }
              try { if (fs.readdirSync(yDir).length === 0) fs.rmdirSync(yDir); } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    return { success: true };
  }

  getCompanyCteNsuState({ cnpj, razaoSocial }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    this.stateDb.migrateLegacyFiles(companyDir, cleanCnpj);
    return this.stateDb.getState(cleanCnpj, 'cte', {
      ultimoNsuCte: '0',
      downloadedKeys: {},
      lastSync: null
    });
  }

  resetCompanyCteNsu({ cnpj, razaoSocial, targetNsu = '0', clearFiles = false }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);
    const stateCtePath = path.join(companyDir, 'state_cte.json');

    const cleanTargetNsu = String(parseInt(String(targetNsu || '0'), 10) || 0);
    const freshState = {
      ultimoNsuCte: cleanTargetNsu,
      downloadedKeys: {},
      lastSync: null
    };

    this.stateDb.saveState(cleanCnpj, 'cte', freshState);

    if (fs.existsSync(companyDir)) {
      if (fs.existsSync(stateCtePath)) {
        try { fs.rmSync(stateCtePath, { force: true }); } catch (_) {}
      }

      if (clearFiles) {
        const baseCteDir = path.join(companyDir, 'xmls', 'transportes', 'cte');
        const baseDacteDir = path.join(companyDir, 'danfes', 'transportes', 'cte');
        if (fs.existsSync(baseCteDir)) {
          try { fs.rmSync(baseCteDir, { recursive: true, force: true }); } catch (_) {}
        }
        if (fs.existsSync(baseDacteDir)) {
          try { fs.rmSync(baseDacteDir, { recursive: true, force: true }); } catch (_) {}
        }

        // Limpa CTE na nova estrutura ANO/MÊS/CTE
        try {
          const entries = fs.readdirSync(companyDir, { withFileTypes: true });
          for (const y of entries) {
            if (y.isDirectory() && /^\d{4}$/.test(y.name)) {
              const yDir = path.join(companyDir, y.name);
              const months = fs.readdirSync(yDir, { withFileTypes: true });
              for (const m of months) {
                if (m.isDirectory()) {
                  const mDir = path.join(yDir, m.name);
                  const cteSub = path.join(mDir, 'CTE');
                  if (fs.existsSync(cteSub)) {
                    try { fs.rmSync(cteSub, { recursive: true, force: true }); } catch (_) {}
                  }
                  try { if (fs.readdirSync(mDir).length === 0) fs.rmdirSync(mDir); } catch (_) {}
                }
              }
              try { if (fs.readdirSync(yDir).length === 0) fs.rmdirSync(yDir); } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    return { success: true, targetNsu: cleanTargetNsu };
  }

  resetCompanyAllModelsNsu({ cnpj, razaoSocial, clearFiles = false, clearManifestations = false }) {
    const cleanCnpj = String(cnpj || '').replace(/\D/g, '');
    const companyDir = this.getCompanyDir(cleanCnpj, razaoSocial);

    // 1. NF-e (Modelo 55 - Entradas)
    const nfeRes = this.resetCompanyNsu({ cnpj: cleanCnpj, targetNsu: '0', clearManifestations, razaoSocial, clearFiles });

    // 2. NFC-e (Modelo 65 - Saídas SP)
    const nfceRes = this.resetCompanyNfceCache({ cnpj: cleanCnpj, razaoSocial, clearFiles });

    // 3. CT-e (Modelo 57 - Fretes)
    const cteRes = this.resetCompanyCteNsu({ cnpj: cleanCnpj, razaoSocial, targetNsu: '0', clearFiles });

    // 4. NFS-e (Serviços - Portal Nacional ADN & Prefeitura de SP)
    let nfseRes = { success: true };
    try {
      this.stateDb.saveState(cleanCnpj, 'nfse', { ultimoNsuNfse: 0, ultimaDataSp: null, lastSync: null });
      const nfseStateRoot = path.join(companyDir, 'nfse_state.json');
      if (fs.existsSync(nfseStateRoot)) {
        try { fs.rmSync(nfseStateRoot, { force: true }); } catch (_) {}
      }
      const nfseDir = path.join(companyDir, 'nfse');
      if (fs.existsSync(nfseDir)) {
        const statePath = path.join(nfseDir, 'nfse_state.json');
        if (fs.existsSync(statePath)) {
          try { fs.rmSync(statePath, { force: true }); } catch (_) {}
        }
        if (clearFiles) {
          try { fs.rmSync(nfseDir, { recursive: true, force: true }); } catch (_) {}
        }
      }
    } catch (eNfse) {
      nfseRes = { success: false, error: eNfse.message };
    }

    // Se clearFiles for true, limpa também caches e todas as pastas de modelos na estrutura nova e legadas
    if (clearFiles) {
      this.stateDb.clearMetadataCache(cleanCnpj);
      if (fs.existsSync(companyDir)) {
        try {
          const cachePath = path.join(companyDir, 'metadata_cache.json');
          if (fs.existsSync(cachePath)) {
            try { fs.rmSync(cachePath, { force: true }); } catch (_) {}
          }

          // Limpa pastas legadas completas
          for (const leg of ['xmls', 'danfes', 'nfse']) {
            const legPath = path.join(companyDir, leg);
            if (fs.existsSync(legPath)) {
              try { fs.rmSync(legPath, { recursive: true, force: true }); } catch (_) {}
            }
          }

          // Limpa subpastas dos 4 modelos na nova hierarquia EMPRESA/ANO/MÊS/
          const top = fs.readdirSync(companyDir, { withFileTypes: true });
          for (const y of top) {
            if (y.isDirectory() && /^\d{4}$/.test(y.name)) {
              const yDir = path.join(companyDir, y.name);
              const months = fs.readdirSync(yDir, { withFileTypes: true });
              for (const m of months) {
                if (m.isDirectory()) {
                  const mDir = path.join(yDir, m.name);
                  for (const sub of ['NFE ENTRADAS', 'NFCE', 'CTE', 'NFSE']) {
                    const targetSub = path.join(mDir, sub);
                    if (fs.existsSync(targetSub)) {
                      try { fs.rmSync(targetSub, { recursive: true, force: true }); } catch (_) {}
                    }
                  }
                  try {
                    if (fs.readdirSync(mDir).length === 0) fs.rmdirSync(mDir);
                  } catch (_) {}
                }
              }
              try {
                if (fs.readdirSync(yDir).length === 0) fs.rmdirSync(yDir);
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    }

    return {
      success: true,
      cnpj: cleanCnpj,
      razaoSocial,
      nfe: nfeRes,
      nfce: nfceRes,
      cte: cteRes,
      nfse: nfseRes
    };
  }

  resetAllCompaniesAllModelsNsu({ companies, clearFiles = false, clearManifestations = false }) {
    if (!companies || !Array.isArray(companies)) {
      return { success: false, error: 'Lista de empresas inválida.' };
    }
    const results = [];
    for (const company of companies) {
      const res = this.resetCompanyAllModelsNsu({
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        clearFiles,
        clearManifestations
      });
      results.push(res);
    }
    return {
      success: true,
      total: companies.length,
      results
    };
  }
}

module.exports = SefazManager;

