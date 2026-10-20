const axios = require('axios');
const fs = require('fs');
const path = require('path');

let BrowserWindow = null;
try {
  const electron = require('electron');
  BrowserWindow = electron.BrowserWindow;
} catch (e) {
  BrowserWindow = null;
}

function validarCNPJ(cnpjRaw) {
  const digits = String(cnpjRaw || '').replace(/\D/g, '').padStart(14, '0');
  if (!digits || digits.length !== 14) {
    return { valido: false, digits, motivo: `Tamanho incorreto (${digits.length} dígitos).` };
  }
  if (/^(\d)\1{13}$/.test(digits)) {
    return { valido: false, digits, motivo: 'Dígitos repetidos inválidos.' };
  }

  // 1º dígito verificador
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) soma1 += parseInt(digits[i], 10) * pesos1[i];
  const resto1 = soma1 % 11;
  const d1 = resto1 < 2 ? 0 : 11 - resto1;
  if (parseInt(digits[12], 10) !== d1) {
    return { valido: false, digits, motivo: 'Dígito verificador 1 incorreto.' };
  }

  // 2º dígito verificador
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma2 = 0;
  for (let i = 0; i < 13; i++) soma2 += parseInt(digits[i], 10) * pesos2[i];
  const resto2 = soma2 % 11;
  const d2 = resto2 < 2 ? 0 : 11 - resto2;
  if (parseInt(digits[13], 10) !== d2) {
    return { valido: false, digits, motivo: 'Dígito verificador 2 incorreto.' };
  }

  return { valido: true, digits, motivo: 'CNPJ Válido' };
}

function formatarCNPJ(cnpjRaw) {
  const digits = String(cnpjRaw || '').replace(/\D/g, '').padStart(14, '0');
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  return cnpjRaw;
}

function formatarDataBR(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (s.includes('/')) return s;
  if (s.includes('-')) {
    const parts = s.split('T')[0].split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return s;
}

function formatarStatusSimples(d) {
  if (d.opcao_pelo_simples === true || String(d.opcao_pelo_simples).toLowerCase() === 'sim') {
    const dt = formatarDataBR(d.data_opcao_pelo_simples || d.data_opcao_simples);
    return dt ? `Optante pelo Simples Nacional desde ${dt}` : `Optante pelo Simples Nacional`;
  }
  if (d.data_exclusao_do_simples || d.data_exclusao_simples) {
    const dtEx = formatarDataBR(d.data_exclusao_do_simples || d.data_exclusao_simples);
    const dtIni = formatarDataBR(d.data_opcao_pelo_simples || d.data_opcao_simples);
    return `NÃO optante pelo Simples Nacional (Excluído em ${dtEx}${dtIni ? `, optou em ${dtIni}` : ''})`;
  }
  return `NÃO optante pelo Simples Nacional`;
}

function formatarStatusSimei(d) {
  if (d.opcao_pelo_mei === true || d.opcao_pelo_simei === true || String(d.opcao_simei).toLowerCase() === 'sim') {
    const dt = formatarDataBR(d.data_opcao_pelo_mei || d.data_opcao_pelo_simei);
    return dt ? `Enquadrado no SIMEI desde ${dt}` : `Enquadrado no SIMEI (MEI)`;
  }
  return `NÃO enquadrado no SIMEI`;
}

function stripHTMLTags(html) {
  return String(html || '')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '    ')
    .replace(/<\/th>/gi, '    ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\r/g, '');
}

function parseSimplesHTMLOrText(content) {
  if (!content) return null;

  const str = stripHTMLTags(content);

  const result = {
    dataConsulta: '',
    cnpj: '',
    razaoSocial: '',
    situacaoSimples: '',
    situacaoSimei: '',
    periodosAnterioresSimples: [],
    periodosAnterioresSimei: [],
    eventosFuturosSimples: [],
    alertaExclusaoFutura: false
  };

  // 1. Data da consulta
  const mData = str.match(/Data\s+da\s+consulta:\s*([0-9\/\s\:]+)/i);
  if (mData) result.dataConsulta = mData[1].trim();

  // 2. CNPJ
  const mCnpj =
    str.match(/CNPJ:\s*([0-9\.\-\/]{14,18})/i) ||
    str.match(/([0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}\-[0-9]{2})/);
  if (mCnpj) result.cnpj = mCnpj[1].trim();

  // 3. Nome Empresarial / Razão Social
  const mNome = str.match(/Nome\s+Empresarial:\s*([^\n\r]+)/i);
  if (mNome) result.razaoSocial = mNome[1].trim().replace(/\s+/g, ' ');

  // 4. Situação Atual no Simples Nacional
  const mSitSimples = str.match(/Situa[çc][ãa]o\s+no\s+Simples\s+Nacional:\s*([^\n\r]+)/i);
  if (mSitSimples) {
    result.situacaoSimples = mSitSimples[1].trim().replace(/\s+/g, ' ');
  } else if (/Optante pelo Simples Nacional desde/i.test(str)) {
    const m = str.match(/Optante pelo Simples Nacional desde\s+([0-9\/]+)/i);
    result.situacaoSimples = m ? `Optante pelo Simples Nacional desde ${m[1]}` : 'Optante pelo Simples Nacional';
  } else if (/N[ãa]o optante pelo Simples Nacional/i.test(str)) {
    result.situacaoSimples = 'NÃO optante pelo Simples Nacional';
  }

  // 5. Situação no SIMEI
  const mSitSimei = str.match(/Situa[çc][ãa]o\s+no\s+SIMEI:\s*([^\n\r]+)/i);
  if (mSitSimei) {
    result.situacaoSimei = mSitSimei[1].trim().replace(/\s+/g, ' ');
  } else if (/N[ÃA]O enquadrado no SIMEI/i.test(str)) {
    result.situacaoSimei = 'NÃO enquadrado no SIMEI';
  } else if (/Enquadrado no SIMEI desde/i.test(str)) {
    const m = str.match(/Enquadrado no SIMEI desde\s+([0-9\/]+)/i);
    result.situacaoSimei = m ? `Enquadrado no SIMEI desde ${m[1]}` : 'Enquadrado no SIMEI';
  }

  // 6. Períodos Anteriores do Simples Nacional (estritamente dentro da seção do Simples Nacional!)
  const secSimplesAnt = str.match(
    /Op[çc][õo]es\s+pelo\s+Simples\s+Nacional\s+em\s+Per[íi]odos\s+Anteriores[\s\S]*?(?=Enquadramentos\s+no\s+SIMEI|Eventos\s+Futuros|Informa[çc][õo]es|$)/i
  );
  const textoSimplesAnt = secSimplesAnt ? secSimplesAnt[0] : '';
  if (textoSimplesAnt && !/N[ãa]o\s+Existem/i.test(textoSimplesAnt)) {
    const regexPeriodo = /([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([^\n\r]+)/gi;
    let matchP;
    while ((matchP = regexPeriodo.exec(textoSimplesAnt)) !== null) {
      const dataIni = matchP[1].trim();
      const dataFim = matchP[2].trim();
      const detalhe = matchP[3].trim().replace(/\s+/g, ' ');
      if (
        !detalhe.toLowerCase().includes('data efeito') &&
        !detalhe.toLowerCase().includes('descrição') &&
        !detalhe.toLowerCase().includes('inicial')
      ) {
        result.periodosAnterioresSimples.push({
          dataInicial: dataIni,
          dataFinal: dataFim,
          detalhamento: detalhe
        });
      }
    }
  }

  // 7. Períodos Anteriores do SIMEI (separado para não misturar com Simples Nacional)
  const secSimeiAnt = str.match(
    /Enquadramentos\s+no\s+SIMEI\s+em\s+Per[íi]odos\s+Anteriores[\s\S]*?(?=Eventos\s+Futuros|Informa[çc][õo]es|$)/i
  );
  const textoSimeiAnt = secSimeiAnt ? secSimeiAnt[0] : '';
  if (textoSimeiAnt && !/N[ãa]o\s+Existem/i.test(textoSimeiAnt)) {
    const regexPeriodoSimei = /([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([^\n\r]+)/gi;
    let matchS;
    while ((matchS = regexPeriodoSimei.exec(textoSimeiAnt)) !== null) {
      result.periodosAnterioresSimei.push({
        dataInicial: matchS[1].trim(),
        dataFinal: matchS[2].trim(),
        detalhamento: matchS[3].trim().replace(/\s+/g, ' ')
      });
    }
  }

  // 8. Eventos Futuros (Simples Nacional)
  const secFuturo = str.match(
    /Eventos\s+Futuros\s*\(Simples\s+Nacional\)[\s\S]*?(?=Eventos\s+Futuros\s*\(SIMEI\)|Informa[çc][õo]es|$)/i
  );
  if (secFuturo) {
    const textFuturo = secFuturo[0];
    if (!/N[ãa]o\s+Existem/i.test(textFuturo)) {
      const regexEvento = /([A-Za-zÀ-ÿ0-9\s\-\/\.\,]+?)\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/g;
      let mEv;
      while ((mEv = regexEvento.exec(textFuturo)) !== null) {
        const desc = mEv[1].replace(/Descri[çc][ãa]o do Evento|Data Efeito/gi, '').trim().replace(/\s+/g, ' ');
        const dt = mEv[2].trim();
        if (
          desc &&
          desc.length > 3 &&
          !desc.toLowerCase().includes('eventos futuros') &&
          !desc.toLowerCase().includes('descrição')
        ) {
          result.eventosFuturosSimples.push({
            descricao: desc,
            dataEfeito: dt
          });
          result.alertaExclusaoFutura = true;
        }
      }
    }
  }

  return result;
}

const SCRIPT_INJECAO_EXTRACAO = `
(function() {
  try {
    const bodyText = document.body ? document.body.innerText : '';
    const bodyHtml = document.body ? document.body.innerHTML : '';

    const isResultado =
      bodyText.includes('Identificação do Contribuinte') ||
      bodyText.includes('Situação Atual') ||
      bodyHtml.includes('Nome Empresarial');

    if (!isResultado) {
      return { isResultado: false };
    }

    const divMaisInfo = document.getElementById('maisInfo');
    const btnMaisInfo = document.getElementById('btnMaisInfo');
    const hdnCnpj = document.getElementById('hdnCnpj');

    const maisInfoCarregado = divMaisInfo && (
      divMaisInfo.innerHTML.includes('Períodos Anteriores') ||
      divMaisInfo.innerHTML.includes('Eventos Futuros') ||
      divMaisInfo.innerHTML.includes('Não Existem')
    );

    if (!maisInfoCarregado) {
      if (typeof window.$ === 'function' && hdnCnpj && hdnCnpj.value) {
        if (!window.__ajaxMaisInfoDisparado) {
          window.__ajaxMaisInfoDisparado = true;
          window.$.ajax({
            type: "GET",
            url: "/consultaoptantes/Home/AjaxMaisInfo?cnpjHdn=" + hdnCnpj.value,
            success: function(data) {
              if (divMaisInfo) {
                divMaisInfo.innerHTML = data;
                divMaisInfo.classList.add('in');
                divMaisInfo.style.display = 'block';
              }
            }
          });
        }
      } else if (btnMaisInfo && !btnMaisInfo.disabled) {
        btnMaisInfo.click();
      }
      return { isResultado: true, pronto: false };
    }

    return {
      isResultado: true,
      pronto: true,
      text: document.body ? document.body.innerText : '',
      html: document.body ? document.body.innerHTML : ''
    };
  } catch (e) {
    return { isResultado: false, erro: e.message };
  }
})();
`;

/**
 * Realiza a captação direta no Portal do Simples Nacional da Receita Federal
 * em segundo plano (janela oculta Electron com sessão isolada).
 */
async function consultarSimplesPortalOnce(cnpjDigits, timeoutMs = 11000) {
  if (!BrowserWindow) return null;

  return new Promise((resolve) => {
    let portalWindow = null;
    let resolved = false;
    let checkInterval = null;
    let timeoutTimer = null;

    const cleanup = () => {
      if (checkInterval) clearInterval(checkInterval);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (portalWindow && !portalWindow.isDestroyed()) {
        try {
          portalWindow.destroy();
        } catch (_) {}
      }
    };

    const finish = (val) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve(val);
    };

    try {
      portalWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          backgroundThrottling: false,
          partition: `inmemory-rfb-${cnpjDigits}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        }
      });

      portalWindow.loadURL('https://consopt.www8.receita.fazenda.gov.br/consultaoptantes');

      checkInterval = setInterval(async () => {
        if (resolved || !portalWindow || portalWindow.isDestroyed()) {
          cleanup();
          return;
        }

        try {
          await portalWindow.webContents.executeJavaScript(`
            (function() {
              try {
                const input = document.querySelector('#Cnpj, input[name="Cnpj"], input[type="text"]');
                const btn = document.querySelector('button.btn-verde, button[type="submit"], input[type="submit"]');
                const hasHcaptcha = typeof window.hcaptcha !== 'undefined';

                if (input && !input.value.includes('${cnpjDigits.slice(0, 8)}')) {
                  input.focus();
                  input.value = '${cnpjDigits}';
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  input.blur();
                }

                if (btn && hasHcaptcha && !window.__clickedBtn && input && input.value.replace(/\\D/g, '') === '${cnpjDigits}') {
                  window.__clickedBtn = true;
                  setTimeout(() => { btn.click(); }, 150);
                }
              } catch (err) {}
            })();
          `);

          const res = await portalWindow.webContents.executeJavaScript(SCRIPT_INJECAO_EXTRACAO);
          if (res && res.isResultado && res.pronto) {
            const parsed = parseSimplesHTMLOrText(res.text || res.html);
            if (parsed && parsed.situacaoSimples) {
              finish(parsed);
            }
          }
        } catch (_) {
          // Ignora erros transitórios durante o redirecionamento da página
        }
      }, 350);

      timeoutTimer = setTimeout(() => {
        finish(null);
      }, timeoutMs);

      portalWindow.on('closed', () => {
        finish(null);
      });
    } catch (err) {
      finish(null);
    }
  });
}

async function consultarSimplesPortalBackground(cnpjDigits) {
  if (!BrowserWindow) return null;
  let res = await consultarSimplesPortalOnce(cnpjDigits, 10500);
  if (!res || !res.situacaoSimples) {
    res = await consultarSimplesPortalOnce(cnpjDigits, 11000);
  }
  return res;
}

class CnpjService {
  constructor(cacheDir) {
    this.cacheDir = cacheDir || path.join(__dirname, 'cache');
    if (!fs.existsSync(this.cacheDir)) {
      try {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      } catch (e) {}
    }
    this.cacheFilePath = path.join(this.cacheDir, 'cnpj_cache.json');
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const parsed = JSON.parse(raw);
        const validCache = {};
        for (const [k, v] of Object.entries(parsed || {})) {
          // Mantém no cache apenas consultas que já foram validadas diretamente no Portal do Simples Nacional da RFB
          if (v && v.sucesso && v.consultado_portal_rfb === true) {
            validCache[k] = v;
          }
        }
        return validCache;
      }
    } catch (e) {
      console.warn('Falha ao carregar cache de CNPJ:', e.message);
    }
    return {};
  }

  saveCache() {
    try {
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(this.cache, null, 2), 'utf8');
    } catch (e) {
      console.warn('Falha ao salvar cache de CNPJ:', e.message);
    }
  }

  getAllCached() {
    return { ...this.cache };
  }

  async consultarDadosCadastraisAPI(cnpjDigits) {
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json'
    };

    // 1. BrasilAPI
    try {
      const res = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`, { headers, timeout: 6000 });
      if (res.status === 200 && res.data && res.data.razao_social) {
        const d = res.data;
        const isSimples = d.opcao_pelo_simples === true || String(d.opcao_pelo_simples).toLowerCase() === 'sim';
        const isMei = d.opcao_pelo_mei === true || String(d.opcao_pelo_mei).toLowerCase() === 'sim';

        return {
          sucesso: true,
          fonte: 'BrasilAPI',
          cnpj: cnpjDigits,
          cnpj_formatado: formatarCNPJ(cnpjDigits),
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || '',
          situacao_cadastral: d.descricao_situacao_cadastral || 'ATIVA',
          data_abertura: formatarDataBR(d.data_inicio_atividade) || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
          opcao_simples_raw: isSimples,
          opcao_simples: formatarStatusSimples(d),
          data_opcao_simples: formatarDataBR(d.data_opcao_pelo_simples),
          data_exclusao_simples: formatarDataBR(d.data_exclusao_do_simples),
          opcao_simei_raw: isMei,
          opcao_simei: formatarStatusSimei(d),
          cnae_principal: {
            codigo: String(d.cnae_fiscal || ''),
            descricao: d.cnae_fiscal_descricao || ''
          }
        };
      }
    } catch (e) {}

    // 2. CNPJá
    try {
      const res = await axios.get(`https://open.cnpja.com/office/${cnpjDigits}`, { headers, timeout: 6000 });
      if (res.status === 200 && res.data && res.data.company) {
        const d = res.data;
        const comp = d.company || {};
        const princ = d.mainActivity || {};
        const sim = comp.simples || {};
        const isSimples = sim.optant === true;
        const isMei = comp.simei?.optant === true;

        const dAdapted = {
          opcao_pelo_simples: isSimples,
          data_opcao_pelo_simples: sim.since,
          opcao_pelo_mei: isMei,
          data_opcao_pelo_mei: comp.simei?.since
        };

        return {
          sucesso: true,
          fonte: 'CNPJá',
          cnpj: cnpjDigits,
          cnpj_formatado: formatarCNPJ(cnpjDigits),
          razao_social: comp.name || '',
          nome_fantasia: d.alias || '',
          situacao_cadastral: d.status?.text || 'ATIVA',
          data_abertura: formatarDataBR(d.founded) || '',
          municipio: d.address?.city || '',
          uf: d.address?.state || '',
          opcao_simples_raw: isSimples,
          opcao_simples: formatarStatusSimples(dAdapted),
          data_opcao_simples: formatarDataBR(sim.since),
          data_exclusao_simples: '',
          opcao_simei_raw: isMei,
          opcao_simei: formatarStatusSimei(dAdapted),
          cnae_principal: {
            codigo: String(princ.id || ''),
            descricao: princ.text || ''
          }
        };
      }
    } catch (e) {}

    // 3. CNPJ.ws
    try {
      const res = await axios.get(`https://publica.cnpj.ws/cnpj/${cnpjDigits}`, { headers, timeout: 6000 });
      if (res.status === 200 && res.data && res.data.razao_social) {
        const d = res.data;
        const estab = d.estabelecimento || {};
        const princ = estab.atividade_principal || {};
        const isSimples = d.simples?.simples === 'Sim' || d.simples?.simples === true;
        const isMei = d.simples?.mei === 'Sim' || d.simples?.mei === true;

        const dAdapted = {
          opcao_pelo_simples: isSimples,
          data_opcao_pelo_simples: d.simples?.data_opcao_simples,
          data_exclusao_do_simples: d.simples?.data_exclusao_simples,
          opcao_pelo_mei: isMei,
          data_opcao_pelo_mei: d.simples?.data_opcao_mei
        };

        return {
          sucesso: true,
          fonte: 'CNPJ.ws',
          cnpj: cnpjDigits,
          cnpj_formatado: formatarCNPJ(cnpjDigits),
          razao_social: d.razao_social || '',
          nome_fantasia: estab.nome_fantasia || '',
          situacao_cadastral: estab.situacao_cadastral || 'ATIVA',
          data_abertura: formatarDataBR(estab.data_inicio_atividade) || '',
          municipio: estab.cidade?.nome || '',
          uf: estab.estado?.sigla || '',
          opcao_simples_raw: isSimples,
          opcao_simples: formatarStatusSimples(dAdapted),
          data_opcao_simples: formatarDataBR(d.simples?.data_opcao_simples),
          data_exclusao_simples: formatarDataBR(d.simples?.data_exclusao_simples),
          opcao_simei_raw: isMei,
          opcao_simei: formatarStatusSimei(dAdapted),
          cnae_principal: {
            codigo: String(princ.subclasse || princ.id || ''),
            descricao: princ.descricao || ''
          }
        };
      }
    } catch (e) {}

    // 4. Minha Receita
    try {
      const res = await axios.get(`https://minhareceita.org/${cnpjDigits}`, { headers, timeout: 6000 });
      if (res.status === 200 && res.data && res.data.razao_social) {
        const d = res.data;
        const isSimples = d.opcao_pelo_simples === true || String(d.opcao_pelo_simples).toLowerCase() === 'sim';
        const isMei = d.opcao_pelo_mei === true || String(d.opcao_pelo_mei).toLowerCase() === 'sim';

        return {
          sucesso: true,
          fonte: 'Minha Receita',
          cnpj: cnpjDigits,
          cnpj_formatado: formatarCNPJ(cnpjDigits),
          razao_social: d.razao_social || '',
          nome_fantasia: d.nome_fantasia || '',
          situacao_cadastral: d.descricao_situacao_cadastral || 'ATIVA',
          data_abertura: formatarDataBR(d.data_inicio_atividade) || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
          opcao_simples_raw: isSimples,
          opcao_simples: formatarStatusSimples(d),
          data_opcao_simples: formatarDataBR(d.data_opcao_pelo_simples),
          data_exclusao_simples: formatarDataBR(d.data_exclusao_do_simples),
          opcao_simei_raw: isMei,
          opcao_simei: formatarStatusSimei(d),
          cnae_principal: {
            codigo: String(d.cnae_fiscal || ''),
            descricao: d.cnae_fiscal_descricao || ''
          }
        };
      }
    } catch (e) {}

    // 5. ReceitaWS
    try {
      const res = await axios.get(`https://receitaws.com.br/v1/cnpj/${cnpjDigits}`, { headers, timeout: 6000 });
      if (res.status === 200 && res.data && res.data.status !== 'ERROR' && res.data.nome) {
        const d = res.data;
        const cPrinc = (d.atividade_principal && d.atividade_principal[0]) || {};
        const simplesOpt = d.simples ? d.simples.optante : false;
        const simeiOpt = d.simei ? d.simei.optante : false;

        const dAdapted = {
          opcao_pelo_simples: simplesOpt,
          data_opcao_pelo_simples: d.simples?.data_opcao,
          data_exclusao_do_simples: d.simples?.data_exclusao,
          opcao_pelo_mei: simeiOpt
        };

        return {
          sucesso: true,
          fonte: 'ReceitaWS',
          cnpj: cnpjDigits,
          cnpj_formatado: formatarCNPJ(cnpjDigits),
          razao_social: d.nome || '',
          nome_fantasia: d.fantasia || '',
          situacao_cadastral: d.situacao || 'ATIVA',
          data_abertura: formatarDataBR(d.abertura) || '',
          municipio: d.municipio || '',
          uf: d.uf || '',
          opcao_simples_raw: simplesOpt,
          opcao_simples: formatarStatusSimples(dAdapted),
          data_opcao_simples: formatarDataBR(d.simples?.data_opcao),
          data_exclusao_simples: formatarDataBR(d.simples?.data_exclusao),
          opcao_simei_raw: simeiOpt,
          opcao_simei: formatarStatusSimei(dAdapted),
          cnae_principal: {
            codigo: String(cPrinc.code || ''),
            descricao: cPrinc.text || ''
          }
        };
      }
    } catch (e) {}

    return null;
  }

  async consultar(cnpjRaw, options = {}) {
    const val = validarCNPJ(cnpjRaw);
    if (!val.valido) {
      return {
        sucesso: false,
        cnpj: cnpjRaw,
        erro: val.motivo
      };
    }

    const cnpjDigits = val.digits;
    const forceRefresh = Boolean(options && options.forceRefresh);

    // Só retorna do cache se já tiver sido consultado diretamente no Portal do Simples Nacional da RFB
    if (!forceRefresh && this.cache[cnpjDigits] && this.cache[cnpjDigits].sucesso && this.cache[cnpjDigits].consultado_portal_rfb) {
      return { ...this.cache[cnpjDigits], doCache: true };
    }

    // Executa em paralelo a captação direta no Portal do Simples Nacional da RFB e dados cadastrais secundários
    const [apiResult, portalResult] = await Promise.all([
      this.consultarDadosCadastraisAPI(cnpjDigits),
      consultarSimplesPortalBackground(cnpjDigits)
    ]);

    // Sem fallback para Simples Nacional: se o Portal da RFB falhou ou apresentou instabilidade, alega instabilidade ao usuário
    if (!portalResult || !portalResult.situacaoSimples) {
      return {
        sucesso: false,
        cnpj: cnpjDigits,
        cnpj_formatado: formatarCNPJ(cnpjDigits),
        razao_social: apiResult?.razao_social || '',
        instabilidadePortal: true,
        consultado_portal_rfb: false,
        erro: 'Instabilidade no Portal do Simples Nacional da Receita Federal. Não foi possível verificar o enquadramento oficial no momento. Tente novamente mais tarde.'
      };
    }

    const sitSimples = portalResult.situacaoSimples;
    const sitSimei = portalResult.situacaoSimei || 'NÃO enquadrado no SIMEI';

    const isSimples =
      /optante pelo simples nacional/i.test(sitSimples) && !/n[ãa]o optante/i.test(sitSimples);
    const isSimei =
      /enquadrado no simei/i.test(sitSimei) && !/n[ãa]o enquadrado/i.test(sitSimei);

    const matchDesde = sitSimples.match(/desde\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const periodosAnt = Array.isArray(portalResult.periodosAnterioresSimples)
      ? portalResult.periodosAnterioresSimples
      : [];
    const ultimoPeriodoAnt = periodosAnt.length > 0 ? periodosAnt[0] : null;

    const base = {
      sucesso: true,
      fonte: 'Portal Simples Nacional (RFB)',
      cnpj: cnpjDigits,
      cnpj_formatado: formatarCNPJ(cnpjDigits),
      razao_social: portalResult.razaoSocial || apiResult?.razao_social || '',
      nome_fantasia: apiResult?.nome_fantasia || '',
      situacao_cadastral: apiResult?.situacao_cadastral || 'ATIVA',
      data_abertura: apiResult?.data_abertura || '',
      municipio: apiResult?.municipio || '',
      uf: apiResult?.uf || '',
      cnae_principal: apiResult?.cnae_principal || undefined,
      opcao_simples_raw: isSimples,
      opcao_simples: sitSimples,
      data_opcao_simples: matchDesde ? matchDesde[1] : (ultimoPeriodoAnt?.dataInicial || ''),
      data_exclusao_simples: !isSimples && ultimoPeriodoAnt ? ultimoPeriodoAnt.dataFinal : '',
      opcao_simei_raw: isSimei,
      opcao_simei: sitSimei,
      periodos_anteriores_simples: periodosAnt,
      eventos_futuros_simples: Array.isArray(portalResult.eventosFuturosSimples)
        ? portalResult.eventosFuturosSimples
        : [],
      consultado_portal_rfb: true,
      data_consulta_portal: portalResult.dataConsulta || new Date().toLocaleDateString('pt-BR'),
      consultado_em: new Date().toISOString()
    };

    this.cache[cnpjDigits] = base;
    this.saveCache();
    return base;
  }

  async consultarLote(cnpjs, onProgress, options = {}) {
    const uniqueDigits = Array.from(
      new Set(
        (cnpjs || [])
          .map((c) => String(c || '').replace(/\D/g, ''))
          .filter((d) => d.length === 14)
      )
    );

    const total = uniqueDigits.length;
    const results = {};

    for (let i = 0; i < total; i++) {
      const cnpj = uniqueDigits[i];
      try {
        const res = await this.consultar(cnpj, options);
        results[cnpj] = res;
        if (onProgress) {
          onProgress({
            current: i + 1,
            total,
            cnpj,
            razao: res.razao_social || '',
            isSimples: res.opcao_simples_raw,
            statusSimples: res.opcao_simples
          });
        }
      } catch (err) {
        results[cnpj] = { sucesso: false, cnpj, erro: err.message };
      }

      if (i < total - 1 && (!this.cache[cnpj] || !this.cache[cnpj].doCache)) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }

    return results;
  }
}

module.exports = {
  validarCNPJ,
  formatarCNPJ,
  formatarDataBR,
  parseSimplesHTMLOrText,
  consultarSimplesPortalBackground,
  CnpjService
};
