import {
  AppConfig,
  ParsedItem,
  ParsedNota,
  RegimeRemetente,
  RegimeDestinatario,
  YesNoSelection,
  EmitterRegimesMap,
  ItemConsumerOverridesMap,
  NcmRateRule,
} from "../types";

export function round2(value: number): number {
  const n = Number(value || 0);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function formatBRL(value: number): string {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatNum(value: number, decimals = 2): string {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function toNumber(value: any): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  let text = String(value).trim();
  if (!text) return 0;

  text = text.replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "");

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");

  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(",");
    const lastDot = text.lastIndexOf(".");
    if (lastComma > lastDot) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (hasComma) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = text.split(".");
    if (parts.length > 2) {
      const decimalsPart = parts.pop();
      text = parts.join("") + "." + decimalsPart;
    }
  }
  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
}

export function clampPercent(value: any): number {
  const n = toNumber(value);
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

export function normalizeDoc(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

// XML Parsing helpers
function getFirst(parent: Element, tag: string): Element | null {
  if (!parent) return null;
  const list = parent.getElementsByTagNameNS("*", tag);
  return list && list.length ? list[0] : null;
}

function getText(parent: Element | null, tag: string): string {
  if (!parent) return "";
  const el = getFirst(parent, tag);
  return el ? (el.textContent || "").trim() : "";
}

function getChild(parent: Element | null, tag: string): Element | null {
  if (!parent) return null;
  return Array.from(parent.children || []).find((ch) => ch.localName === tag) || null;
}

function getFirstChildElement(parent: Element | null): Element | null {
  return parent ? Array.from(parent.children || [])[0] || null : null;
}

function getICMSNode(impostoNode: Element | null): Element | null {
  if (!impostoNode) return null;
  const icms = getChild(impostoNode, "ICMS");
  return getFirstChildElement(icms);
}

function getIPINode(impostoNode: Element | null): Element | null {
  if (!impostoNode) return null;
  return getChild(impostoNode, "IPI");
}

export function parseDate(iso: string): string {
  if (!iso) return "";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleString("pt-BR");
  } catch {
    return iso;
  }
}

// Normalize Text key helper for item overrides mapping
export function normalizeTextKey(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getItemConfigKey(entity: {
  emitenteKey?: string;
  cnpjCpfRem?: string;
  cProd?: string;
  cfop?: string;
  ncm?: string;
  xProd?: string;
}): string {
  return [
    normalizeDoc(entity.emitenteKey || entity.cnpjCpfRem || ""),
    normalizeTextKey(entity.cProd || ""),
    normalizeTextKey(entity.cfop || ""),
    normalizeTextKey(entity.ncm || ""),
    normalizeTextKey(entity.xProd || ""),
  ].join("|");
}

export function getRegimeLabel(value: string): string {
  if (value === "simples") return "Simples Nacional";
  if (value === "normal") return "Regime normal";
  return "Outro / não informado";
}

export function getEffectiveRegimeRemet(
  emitenteKey: string,
  cnpjCpfRem: string,
  globalRegimeRemet: RegimeRemetente,
  emitterRegimes: EmitterRegimesMap,
  xmlCrt?: string
): RegimeRemetente {
  const key = emitenteKey || normalizeDoc(cnpjCpfRem);
  if (key && emitterRegimes[key]) {
    return emitterRegimes[key];
  }
  if (xmlCrt === "1" || xmlCrt === "2") {
    return "simples";
  }
  if (xmlCrt === "3") {
    return "normal";
  }
  return globalRegimeRemet;
}

export function getEffectiveRegimeDest(
  cnpjCpfDest: string | undefined,
  globalRegimeDest: RegimeDestinatario,
  recipientRegimes?: Record<string, RegimeDestinatario>
): RegimeDestinatario {
  const key = cnpjCpfDest ? normalizeDoc(cnpjCpfDest) : "";
  if (key && recipientRegimes && recipientRegimes[key]) {
    return recipientRegimes[key];
  }
  return globalRegimeDest;
}

export function getConsumerFinalForItem(
  itemKey: string,
  notaIndFinal: string,
  globalConsumerFinalMode: string,
  itemConsumerOverrides: ItemConsumerOverridesMap
): boolean {
  const override = itemConsumerOverrides[itemKey];
  if (override === "yes") return true;
  if (override === "no") return false;

  if (globalConsumerFinalMode === "yes") return true;
  if (globalConsumerFinalMode === "no") return false;
  return String(notaIndFinal || "") === "1";
}

export function getConsumerFinalSource(
  itemKey: string,
  notaIndFinal: string,
  globalConsumerFinalMode: string,
  itemConsumerOverrides: ItemConsumerOverridesMap
): string {
  const override = itemConsumerOverrides[itemKey];
  if (override === "yes") return "Produto: Sim (Sobrescrito)";
  if (override === "no") return "Produto: Não (Sobrescrito)";

  if (globalConsumerFinalMode === "yes") return "Geral: Sim";
  if (globalConsumerFinalMode === "no") return "Geral: Não";
  return `XML indFinal: ${String(notaIndFinal || "") === "1" ? "Sim" : "Não"}`;
}

export function getModeLabel(mode: string): string {
  if (mode === "antecipacao") return "Antecipação";
  if (mode === "difal_consumidor_final") return "DIFAL consumidor final";
  if (mode === "misto") return "Misto por item";
  return "Sem DIFAL";
}

export function getModeBadge(mode: string): string {
  if (mode === "antecipacao") return "badge-orange";
  if (mode === "difal_consumidor_final") return "badge-blue";
  if (mode === "misto") return "badge-purple";
  return "badge-green";
}

export function getFundamentoResumido(mode: string): string {
  if (mode === "antecipacao") {
    return "Destinatário não consumidor final: antecipação sobre o valor da operação sem IPI.";
  }
  if (mode === "difal_consumidor_final") {
    return "Consumidor final: DIFAL com base do destino (por dentro, se habilitada), FCP separado.";
  }
  if (mode === "misto") {
    return "A nota possui itens com enquadramentos diferentes, conforme configuração por produto.";
  }
  return "Operação interna ou sem diferença de UF: sem DIFAL pelo critério do aplicativo.";
}

// Central Calculation logic
export function calculateLegal(
  item: {
    ufRem: string;
    ufDest: string;
    vProd: number;
    vFreteItem: number;
    vSegItem: number;
    vOutroItem: number;
    vDescItem: number;
    vIPIItem: number;
    pICMS: number;
    itemConfigKey: string;
    indFinal: string;
    emitenteKey: string;
    cnpjCpfRem: string;
    cnpjCpfDest?: string;
    ncm: string;
    crt?: string;
  },
  config: AppConfig,
  emitterRegimes: EmitterRegimesMap,
  itemConsumerOverrides: ItemConsumerOverridesMap,
  ncmRateRules?: NcmRateRule[],
  recipientRegimes?: Record<string, RegimeDestinatario>
) {
  let aliqInterna = clampPercent(config.aliqInterna);
  let aliqFcp = clampPercent(config.aliqFcp);
  let customNcmRuleOrigin = "";

  if (ncmRateRules && ncmRateRules.length > 0 && item.ncm) {
    const cleanItemNcm = String(item.ncm).replace(/\D/g, "");
    const matchingRules = ncmRateRules.filter((rule) => {
      const cleanRuleNcm = String(rule.ncm || "").replace(/\D/g, "");
      const ufMatch =
        !rule.ufDest ||
        rule.ufDest === "TODOS" ||
        rule.ufDest.toUpperCase() === String(item.ufDest || "").toUpperCase();
      const ncmMatch = cleanItemNcm.startsWith(cleanRuleNcm) && cleanRuleNcm.length > 0;
      return ufMatch && ncmMatch;
    });

    if (matchingRules.length > 0) {
      // Sort matching rules: longest NCM match first, then specific UF (non-TODOS) first
      matchingRules.sort((a, b) => {
        const lenA = String(a.ncm || "").replace(/\D/g, "").length;
        const lenB = String(b.ncm || "").replace(/\D/g, "").length;
        if (lenA !== lenB) return lenB - lenA;
        const isSpecificA = a.ufDest && a.ufDest !== "TODOS";
        const isSpecificB = b.ufDest && b.ufDest !== "TODOS";
        if (isSpecificA && !isSpecificB) return -1;
        if (!isSpecificA && isSpecificB) return 1;
        return 0;
      });

      const bestRule = matchingRules[0];
      aliqInterna = bestRule.aliqInterna;
      aliqFcp = bestRule.aliqFcp;
      customNcmRuleOrigin = `NCM ${bestRule.ncm}${
        bestRule.ufDest && bestRule.ufDest !== "TODOS" ? ` (Destino ${bestRule.ufDest})` : ""
      }`;
    }
  }

  const obsLivre = config.obsLivre.trim();

  const xmlCrt = item.crt;
  const regimeRemetAplicado = getEffectiveRegimeRemet(
    item.emitenteKey,
    item.cnpjCpfRem,
    config.regimeRemet,
    emitterRegimes,
    xmlCrt
  );
  const regimeRemetOrigem = emitterRegimes[item.emitenteKey || normalizeDoc(item.cnpjCpfRem)]
    ? "Configuração por emitente"
    : (xmlCrt === "1" || xmlCrt === "2" || xmlCrt === "3" ? "Detectado no XML (CRT)" : "Padrão geral");

  const regimeDestAplicado = getEffectiveRegimeDest(
    item.cnpjCpfDest,
    config.regimeDest,
    recipientRegimes
  );
  const regimeDestOrigem = recipientRegimes && item.cnpjCpfDest && recipientRegimes[normalizeDoc(item.cnpjCpfDest)]
    ? "Configuração por cliente"
    : "Padrão geral";

  const consumerFinalApplied = getConsumerFinalForItem(
    item.itemConfigKey,
    item.indFinal,
    config.consumerFinalMode,
    itemConsumerOverrides
  );
  const consumerFinalSource = getConsumerFinalSource(
    item.itemConfigKey,
    item.indFinal,
    config.consumerFinalMode,
    itemConsumerOverrides
  );

  // Interestate rate configuration selection: Auto by default from XML pICMS, falling back to 12%
  const p = clampPercent(item.pICMS || 0);
  const aliqInter = p > 0 ? p : 12;

  // Determine mode
  let mode: "sem_difal" | "antecipacao" | "difal_consumidor_final" = "antecipacao";
  if (item.ufRem && item.ufDest && item.ufRem === item.ufDest) {
    mode = "sem_difal";
  } else {
    mode = consumerFinalApplied ? "difal_consumidor_final" : "antecipacao";
  }

  // STANDARD TAX REGULATION AUTOMATION:
  // 1. IPI is included in the ICMS calculation base ONLY if the transaction is destined to a Final Consumer (Art. 155, § 2º, XI, Federal Constitution)
  const includeIPI = consumerFinalApplied;

  // 2. Base dupla / "Cálculo por dentro" only applies to DIFAL with corporate Non-Simples buyers & sellers (normal to normal)
  const isSellerSimples = regimeRemetAplicado === "simples";
  const isBuyerSimples = regimeDestAplicado === "simples";
  const calcPorDentro = mode === "difal_consumidor_final" && !isSellerSimples && !isBuyerSimples;

  // 3. FCP in standard Antecipação is not applied by state law
  const applyFcpAntecipacao = false;

  const valorOperSemIPI = round2(
    toNumber(item.vProd || 0) +
      toNumber(item.vFreteItem || 0) +
      toNumber(item.vSegItem || 0) +
      toNumber(item.vOutroItem || 0) -
      toNumber(item.vDescItem || 0)
  );
  const valorIPI = round2(toNumber(item.vIPIItem || 0));
  const baseOrigem = round2(valorOperSemIPI + (includeIPI ? valorIPI : 0));

  let baseCalculo = 0;
  let icmsOrigemCalc = 0;
  let difalPuro = 0;
  let fcpCalc = 0;
  let totalRecolher = 0;
  let memory = "";
  const difalRate = Math.max(aliqInterna - aliqInter, 0);

  if (mode === "sem_difal") {
    memory = `UF remetente (${item.ufRem || "-"}) e UF destinatário (${item.ufDest || "-"}) coincidem. Isento de DIFAL interestadual pelo critério do app.`;
    if (obsLivre) memory += ` Obs: ${obsLivre}.`;

    return {
      mode,
      modeLabel: getModeLabel(mode),
      modeBadge: getModeBadge(mode),
      fundamento: getFundamentoResumido(mode),
      valorOperSemIPI,
      valorIPI,
      baseOrigem: 0,
      baseCalculo: 0,
      aliqInter,
      aliqInterna,
      aliqFcp: 0,
      difalRate: 0,
      icmsOrigemCalc: 0,
      difalPuro: 0,
      fcpCalc: 0,
      totalRecolher: 0,
      memory,
      memoryShort: `Sem DIFAL · base ${formatBRL(0)} · total ${formatBRL(0)}`,
      consumerFinalApplied,
      consumerFinalSource,
      regimeRemetAplicado,
      regimeRemetOrigem,
      regimeDestAplicado,
    };
  }

  if (mode === "antecipacao") {
    baseCalculo = round2(valorOperSemIPI);
    difalPuro = round2(baseCalculo * (difalRate / 100));
    fcpCalc = applyFcpAntecipacao ? round2(baseCalculo * (aliqFcp / 100)) : 0;
    totalRecolher = round2(difalPuro + fcpCalc);

    memory =
      `Antecipação: Base = valor da operação sem IPI = ${formatBRL(valorOperSemIPI)}. ` +
      `DIFAL = ${formatBRL(baseCalculo)} × (${formatNum(aliqInterna)}% - ${formatNum(aliqInter)}%) = ${formatBRL(difalPuro)}.`;
    if (applyFcpAntecipacao) {
      memory += ` FCP = ${formatBRL(baseCalculo)} × ${formatNum(aliqFcp)}% = ${formatBRL(fcpCalc)}.`;
    }
    memory += ` Total a recolher = ${formatBRL(totalRecolher)}.`;
  } else {
    // Consumer final calculation
    const isSellerSimples = regimeRemetAplicado === "simples";
    const isBuyerSimples = regimeDestAplicado === "simples";
    baseCalculo =
      calcPorDentro && aliqInterna < 100 && !isSellerSimples && !isBuyerSimples
        ? round2(baseOrigem / (1 - aliqInterna / 100))
        : round2(baseOrigem);

    // CORRECÇÃO: O ICMS de origem deve incidir sobre a baseOrigem (valor real do XML)
    icmsOrigemCalc = round2(baseOrigem * (aliqInter / 100));

    difalPuro = round2(baseCalculo * (difalRate / 100));
    fcpCalc = round2(baseCalculo * (aliqFcp / 100));
    totalRecolher = round2(difalPuro + fcpCalc);

    memory =
      `DIFAL Consumidor Final: Valor sem IPI = ${formatBRL(valorOperSemIPI)}; ` +
      `IPI ${includeIPI ? "incluído" : "bloqueado"} = ${formatBRL(includeIPI ? valorIPI : 0)}; ` +
      `Base origem = ${formatBRL(baseOrigem)}; ` +
      `${
        isSellerSimples
          ? `Base simples aplicada (R$ ${formatNum(baseCalculo)}) porque o remetente é do Simples Nacional (Isento de base dupla para este adquirente); `
          : isBuyerSimples
          ? `Base simples aplicada (R$ ${formatNum(baseCalculo)}) porque o destinatário é do Simples Nacional (Isento de base dupla); `
          : calcPorDentro
          ? `Base por dentro = ${formatBRL(baseOrigem)} / (1 - ${formatNum(aliqInterna)}%) = ${formatBRL(baseCalculo)}; `
          : `Base destino = ${formatBRL(baseCalculo)}; `
      }` +
      `ICMS Origem calc. = ${formatBRL(baseOrigem)} × ${formatNum(aliqInter)}% = ${formatBRL(icmsOrigemCalc)}; ` +
      `DIFAL = ${formatBRL(baseCalculo)} × (${formatNum(aliqInterna)}% - ${formatNum(aliqInter)}%) = ${formatBRL(difalPuro)}; ` +
      `FCP = ${formatBRL(baseCalculo)} × ${formatNum(aliqFcp)}% = ${formatBRL(fcpCalc)}; ` +
      `Total = ${formatBRL(totalRecolher)}.`;
  }

  if (customNcmRuleOrigin) {
    memory += ` Alíquota destino ajustada pelo cadastro de exceção: ${customNcmRuleOrigin}.`;
  }
  memory += ` Consumidor final aplicado: ${consumerFinalApplied ? "Sim" : "Não"} (${consumerFinalSource}).`;
  memory += ` Regime emitente: ${getRegimeLabel(regimeRemetAplicado)} (${regimeRemetOrigem.toLowerCase()}).`;
  memory += ` Regime destinatário: ${getRegimeLabel(regimeDestAplicado)} (${regimeDestOrigem.toLowerCase()}).`;
  if (obsLivre) memory += ` Observação: ${obsLivre}.`;

  return {
    mode,
    modeLabel: getModeLabel(mode),
    modeBadge: getModeBadge(mode),
    fundamento: getFundamentoResumido(mode),
    valorOperSemIPI,
    valorIPI,
    baseOrigem,
    baseCalculo,
    aliqInter,
    aliqInterna,
    aliqFcp,
    difalRate,
    icmsOrigemCalc,
    difalPuro,
    fcpCalc,
    totalRecolher,
    memory,
    memoryShort: `Base ${formatBRL(baseCalculo)} · DIFAL ${formatBRL(difalPuro)} · FCP ${formatBRL(fcpCalc)} · Total ${formatBRL(totalRecolher)}`,
    consumerFinalApplied,
    consumerFinalSource,
    regimeRemetAplicado,
    regimeRemetOrigem,
    regimeDestAplicado,
    regimeDestOrigem,
  };
}

export function summarizeNota(
  itensNota: ParsedItem[],
  globalRegimeRemet: RegimeRemetente,
  globalRegimeDest: RegimeDestinatario = "normal"
): Partial<ParsedNota> {
  if (!itensNota.length) {
    return {
      mode: "sem_difal",
      modeLabel: getModeLabel("sem_difal"),
      modeBadge: getModeBadge("sem_difal"),
      valorOperSemIPITotal: 0,
      valorIPITotal: 0,
      baseOrigemTotal: 0,
      baseCalculoTotal: 0,
      icmsOrigemCalcTotal: 0,
      difalPuroTotal: 0,
      fcpCalcTotal: 0,
      totalRecolher: 0,
      fundamento: getFundamentoResumido("sem_difal"),
      regimeRemetAplicado: globalRegimeRemet,
      regimeRemetOrigem: "Padrão geral",
      regimeDestAplicado: globalRegimeDest,
      regimeDestOrigem: "Padrão geral",
    };
  }

  const uniqueModes = [...new Set(itensNota.map((i) => i.mode))];
  const mode = uniqueModes.length === 1 ? uniqueModes[0] : "misto";

  return {
    mode,
    modeLabel: getModeLabel(mode),
    modeBadge: getModeBadge(mode),
    valorOperSemIPITotal: round2(itensNota.reduce((a, i) => a + toNumber(i.valorOperSemIPI), 0)),
    valorIPITotal: round2(itensNota.reduce((a, i) => a + toNumber(i.valorIPI), 0)),
    baseOrigemTotal: round2(itensNota.reduce((a, i) => a + toNumber(i.baseOrigem), 0)),
    baseCalculoTotal: round2(itensNota.reduce((a, i) => a + toNumber(i.baseCalculo), 0)),
    icmsOrigemCalcTotal: round2(itensNota.reduce((a, i) => a + toNumber(i.icmsOrigemCalc), 0)),
    difalPuroTotal: round2(itensNota.reduce((a, i) => a + toNumber(i.difalPuro), 0)),
    fcpCalcTotal: round2(itensNota.reduce((a, i) => a + toNumber(i.fcpCalc), 0)),
    totalRecolher: round2(itensNota.reduce((a, i) => a + toNumber(i.totalRecolher), 0)),
    fundamento: getFundamentoResumido(mode),
    regimeRemetAplicado: itensNota[0].regimeRemetAplicado,
    regimeRemetOrigem: itensNota[0].regimeRemetOrigem,
    regimeDestAplicado: itensNota[0].regimeDestAplicado,
    regimeDestOrigem: itensNota[0].regimeDestOrigem || "Padrão geral",
  };
}

// Browser-based XML parsing to parse NF-e (Modelo 55) string
export function parseXMLContent(
  text: string,
  fileName: string,
  config: AppConfig,
  emitterRegimes: EmitterRegimesMap,
  itemConsumerOverrides: ItemConsumerOverridesMap,
  cfopMap: Map<string, string>,
  ncmRateRules?: NcmRateRule[],
  recipientRegimes?: Record<string, RegimeDestinatario>
): { nota: ParsedNota; itens: ParsedItem[] } {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "application/xml");
  const parserError = xml.getElementsByTagName("parsererror")[0];
  if (parserError) {
    throw new Error("Formato XML inválido ou arquivo danificado.");
  }

  const infNFe = xml.getElementsByTagNameNS("*", "infNFe")[0];
  if (!infNFe) {
    throw new Error("Tag principal <infNFe> não encontrada. Certifique-se de que é uma NF-e modelo 55 válida.");
  }

  const ide = getChild(infNFe, "ide");
  const emit = getChild(infNFe, "emit");
  const dest = getChild(infNFe, "dest");
  const total = getChild(infNFe, "total");
  const icmsTot = total ? getChild(total, "ICMSTot") : null;

  const cnpjCpfRem = getText(emit, "CNPJ") || getText(emit, "CPF");
  const emitenteKey = normalizeDoc(cnpjCpfRem);

  const nota: ParsedNota = {
    arquivo: fileName,
    nNF: getText(ide, "nNF"),
    dataEmissaoRaw: getText(ide, "dhEmi"),
    dataEmissao: parseDate(getText(ide, "dhEmi") || getText(ide, "dEmi")), // fallback para dEmi antiga
    ufRem: getText(emit ? getChild(emit, "enderEmit") : null, "UF"),
    ufDest: getText(dest ? getChild(dest, "enderDest") : null, "UF"),
    idDest: getText(ide, "idDest"),
    indFinal: getText(ide, "indFinal"),
    cnpjCpfRem,
    emitenteKey,
    cnpjCpfDest: getText(dest, "CNPJ") || getText(dest, "CPF"),
    razaoRem: getText(emit, "xNome"),
    razaoDest: getText(dest, "xNome"),
    vBC: toNumber(getText(icmsTot, "vBC")),
    vICMS: toNumber(getText(icmsTot, "vICMS")),
    vBCST: toNumber(getText(icmsTot, "vBCST")),
    vST: toNumber(getText(icmsTot, "vST")),
    vII: toNumber(getText(icmsTot, "vII")),
    vICMSUFRemet: toNumber(getText(icmsTot, "vICMSUFRemet")),
    vFCP: toNumber(getText(icmsTot, "vFCP")),
    vPIS: toNumber(getText(icmsTot, "vPIS")),
    vProd: toNumber(getText(icmsTot, "vProd")),
    vFrete: toNumber(getText(icmsTot, "vFrete")),
    vSeg: toNumber(getText(icmsTot, "vSeg")),
    vDesc: toNumber(getText(icmsTot, "vDesc")),
    vOutro: toNumber(getText(icmsTot, "vOutro")),
    vIPI: toNumber(getText(icmsTot, "vIPI")),
    vICMSUFDest: toNumber(getText(icmsTot, "vICMSUFDest")),
    vTotTrib: toNumber(getText(icmsTot, "vTotTrib")),
    vCOFINS: toNumber(getText(icmsTot, "vCOFINS")),
    vNF: toNumber(getText(icmsTot, "vNF")),

    // Default calculations placeholder
    mode: "sem_difal",
    modeLabel: getModeLabel("sem_difal"),
    modeBadge: getModeBadge("sem_difal"),
    valorOperSemIPITotal: 0,
    valorIPITotal: 0,
    baseOrigemTotal: 0,
    baseCalculoTotal: 0,
    icmsOrigemCalcTotal: 0,
    difalPuroTotal: 0,
    fcpCalcTotal: 0,
    totalRecolher: 0,
    fundamento: getFundamentoResumido("sem_difal"),
    regimeRemetAplicado: config.regimeRemet,
    regimeRemetOrigem: "Padrão geral",
    regimeDestAplicado: config.regimeDest,
    regimeDestOrigem: "Padrão geral",
  };

  const detList = Array.from(infNFe.getElementsByTagNameNS("*", "det"));
  const itens: ParsedItem[] = detList.map((det, idx) => {
    const prod = getChild(det, "prod");
    const imposto = getChild(det, "imposto");
    const icmsNode = getICMSNode(imposto);
    const ipiNode = getIPINode(imposto);

    const cProd = getText(prod, "cProd");
    const cfop = getText(prod, "CFOP");
    const ncm = getText(prod, "NCM");
    const xProd = getText(prod, "xProd");

    const itemConfigKey = getItemConfigKey({
      emitenteKey,
      cProd,
      cfop,
      ncm,
      xProd,
    });

    const basicItem = {
      arquivo: fileName,
      nNF: nota.nNF,
      dataEmissao: nota.dataEmissao,
      dataEmissaoRaw: nota.dataEmissaoRaw,
      ufRem: nota.ufRem,
      ufDest: nota.ufDest,
      cnpjCpfRem: nota.cnpjCpfRem,
      emitenteKey: nota.emitenteKey,
      cnpjCpfDest: nota.cnpjCpfDest,
      razaoRem: nota.razaoRem,
      razaoDest: nota.razaoDest,
      indFinal: nota.indFinal,
      itemSeq: det.getAttribute("nItem") || String(idx + 1),
      itemConfigKey,
      cProd,
      xProd,
      ncm,
      orig: getText(icmsNode, "orig"),
      crt: getText(emit, "CRT"),
      cst: getText(icmsNode, "CST") || getText(icmsNode, "CSOSN") || getText(ipiNode, "CST") || "00",
      ocst: [
        getText(icmsNode, "orig"),
        getText(icmsNode, "CST") || getText(icmsNode, "CSOSN"),
      ]
        .filter(Boolean)
        .join("/"),
      cfop,
      cfopDesc: cfopMap.get(normalizeDoc(cfop)) || "",
      unidade: getText(prod, "uCom"),
      quantidade: toNumber(getText(prod, "qCom")),
      vUnCom: toNumber(getText(prod, "vUnCom")),
      vProd: toNumber(getText(prod, "vProd")),
      vFreteItem: toNumber(getText(prod, "vFrete")),
      vSegItem: toNumber(getText(prod, "vSeg")),
      vOutroItem: toNumber(getText(prod, "vOutro")),
      vDescItem: toNumber(getText(prod, "vDesc")),
      vItem: toNumber(getText(det, "vItem")) || toNumber(getText(prod, "vProd")),
      vBCItem: toNumber(getText(icmsNode, "vBC")),
      vICMSItem: toNumber(getText(icmsNode, "vICMS")),
      vIPIItem: toNumber(getText(ipiNode, "vIPI")),
      pICMS: toNumber(getText(icmsNode, "pICMS")),
      pIPI: toNumber(getText(ipiNode, "pIPI")),
    };

    const calc = calculateLegal(basicItem, config, emitterRegimes, itemConsumerOverrides, ncmRateRules, recipientRegimes);
    return { ...basicItem, ...calc } as ParsedItem;
  });

  const aggregate = summarizeNota(itens, config.regimeRemet, config.regimeDest);
  Object.assign(nota, aggregate);

  return { nota, itens };
}

// Convert dataset to standard semicolon-delimited CSV with UTF-8 BOM for perfect Excel compatibility in Brazil
export function toCSV(rows: Array<Record<string, any>>): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (v: any) => {
    const str = String(v ?? "").replace(/"/g, '""');
    return `"${str}"`;
  };

  const lines = [
    headers.map(escapeCell).join(";"),
    ...rows.map((row) => headers.map((key) => escapeCell(row[key])).join(";")),
  ];
  // Excel em português requer BOM UTF-8 (\uFEFF) e quebras de linha CRLF (\r\n)
  return "\uFEFF" + lines.join("\r\n");
}

export function formatCpfCnpj(doc: string): string {
  if (!doc) return "";
  const d = String(doc).replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  } else if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function formatChaveExcel(chave: string): string {
  if (!chave) return "";
  const clean = String(chave).replace(/\D/g, "");
  // Formata como formula de texto para evitar que o Excel trunque em notacao cientifica (ex: 3.526E+43)
  return `="${clean}"`;
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Normaliza qualquer data ou competência para o padrão contábil MM/AAAA e chave canônica YYYY-MM
 */
export function normalizeCompetencia(rawDateOrComp?: string): {
  key: string;      // "YYYY-MM" (para ordenação cronológica consistente)
  label: string;    // "MM/AAAA" (padrão contábil oficial)
  year: number;
  month: number;
} {
  if (!rawDateOrComp || typeof rawDateOrComp !== "string") {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    return { key: `${y}-${m}`, label: `${m}/${y}`, year: y, month: Number(m) };
  }

  const str = rawDateOrComp.trim();

  // 1. Padrão ISO / Ano primeiro: YYYY-MM ou YYYY/MM (ex: 2026-08-15, 2026-08, 2026/08)
  const matchIso = str.match(/(20\d{2})[-/.](\d{1,2})/);
  if (matchIso) {
    const y = Number(matchIso[1]);
    const m = Number(matchIso[2]);
    if (m >= 1 && m <= 12) {
      const mStr = String(m).padStart(2, "0");
      return { key: `${y}-${mStr}`, label: `${mStr}/${y}`, year: y, month: m };
    }
  }

  // 2. Padrão Brasileiro: DD/MM/YYYY ou MM/YYYY (ex: 15/08/2026, 08/2026, 8/2026)
  const matchBr = str.match(/(\d{1,2})[-/.](\d{1,2})?[-/.]?(20\d{2})/);
  if (matchBr) {
    if (matchBr[2] && matchBr[3]) {
      const m = Number(matchBr[2]);
      const y = Number(matchBr[3]);
      if (m >= 1 && m <= 12) {
        const mStr = String(m).padStart(2, "0");
        return { key: `${y}-${mStr}`, label: `${mStr}/${y}`, year: y, month: m };
      }
    } else if (matchBr[1] && matchBr[3]) {
      const m = Number(matchBr[1]);
      const y = Number(matchBr[3]);
      if (m >= 1 && m <= 12) {
        const mStr = String(m).padStart(2, "0");
        return { key: `${y}-${mStr}`, label: `${mStr}/${y}`, year: y, month: m };
      }
    }
  }

  // 3. Fallback inteligente: buscar ano de 4 dígitos (2020 a 2035)
  const yearMatch = str.match(/(20\d{2})/);
  const monthMatch = str.match(/\b(0?[1-9]|1[0-2])\b/);
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    const m = monthMatch ? Number(monthMatch[1]) : 1;
    const mStr = String(m).padStart(2, "0");
    return { key: `${y}-${mStr}`, label: `${mStr}/${y}`, year: y, month: m };
  }

  const currY = new Date().getFullYear();
  return { key: `${currY}-01`, label: `01/${currY}`, year: currY, month: 1 };
}

/**
 * Converte qualquer formato de data em timestamp numérico (ms) para ordenação cronológica precisa
 */
export function parseDateToTimestamp(dateStr?: string): number {
  if (!dateStr || typeof dateStr !== "string") return 0;
  const s = dateStr.trim();

  // Padrão ISO com T ou data direta YYYY-MM-DD
  if (s.includes("T") || (s.length >= 10 && s[4] === "-" && s[7] === "-")) {
    const t = new Date(s).getTime();
    if (!isNaN(t)) return t;
  }

  // Padrão DD/MM/YYYY ou DD/MM/YYYY HH:mm:ss
  const brMatch = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (brMatch) {
    const day = Number(brMatch[1]);
    const month = Number(brMatch[2]) - 1;
    const year = Number(brMatch[3]);
    const hour = brMatch[4] ? Number(brMatch[4]) : 12;
    const min = brMatch[5] ? Number(brMatch[5]) : 0;
    const sec = brMatch[6] ? Number(brMatch[6]) : 0;
    const d = new Date(year, month, day, hour, min, sec);
    if (!isNaN(d.getTime())) return d.getTime();
  }

  // Padrão YYYY-MM
  const norm = normalizeCompetencia(s);
  return new Date(norm.year, norm.month - 1, 1).getTime();
}


