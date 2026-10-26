import React, { useState, useEffect } from "react";
import { defaultCfopData } from "./data/cfops";
import {
  AppConfig,
  ParsedItem,
  ParsedNota,
  RegimeRemetente,
  RegimeDestinatario,
  EmitterRegimesMap,
  RecipientRegimesMap,
  ItemConsumerOverridesMap,
  NcmRateRule,
  EmpresaSefaz,
  CnpjConsultaResult,
} from "./types";
import {
  calculateLegal,
  summarizeNota,
  parseXMLContent,
  toCSV,
  downloadTextFile,
  normalizeDoc,
  getRegimeLabel,
} from "./utils/calc";
import { calculateDaysRemaining } from "./utils/certUtils";
import DifalView from "./components/DifalView";
import { Calculator, FileText, Layers, RefreshCw, CheckCircle2, Building2, Building, Printer, HelpCircle, DownloadCloud, ShieldCheck, Landmark, ShoppingBag, AlertCircle, Truck, Settings, FolderOpen, Home } from "lucide-react";
import ReportPrintModal from "./components/ReportPrintModal";
import OnboardingModal from "./components/OnboardingModal";
import CaptacaoView from "./components/CaptacaoView";
import NfceCaptacaoView from "./components/NfceCaptacaoView";
import CteCaptacaoView from "./components/CteCaptacaoView";
import NfseCaptacaoView from "./components/NfseCaptacaoView";
import GuiaAcompanhamentoView from "./components/GuiaAcompanhamentoView";
import EmpresasHubView from "./components/EmpresasHubView";
import UnifiedConfigModal from "./components/UnifiedConfigModal";
import SyncAllProgressModal from "./components/SyncAllProgressModal";
import LauncherPortalView from "./components/LauncherPortalView";
import LoadingGearOverlay from "./components/LoadingGearOverlay";
import NfseEmissorView from "./components/NfseEmissorView";
import logoImg from "../assets/logo.png";

const REGIME_STORAGE_KEY = "difal_emitente_regimes_v1";
const REGIME_DEST_STORAGE_KEY = "difal_destinatario_regimes_v1";
const ITEM_CONSUMER_STORAGE_KEY = "difal_item_consumer_overrides_v1";
const NCM_RATES_STORAGE_KEY = "difal_ncm_rates_v1";
const TUTORIAL_STORAGE_KEY = "difal_has_seen_tutorial_v1";
const EMPRESAS_STORAGE_KEY = "difal_empresas_sefaz_v1";
const ACTIVE_EMPRESA_KEY = "difal_active_empresa_id_v1";
const WORKSPACE_STORAGE_KEY = "cont_ai_default_workspace_v1";

// Initial standard configurations
const DEFAULT_CONFIG: AppConfig = {
  consumerFinalMode: "auto",
  regimeRemet: "simples",
  regimeDest: "normal",
  aliqInterna: "18,00",
  aliqFcp: "2,00",
  aliqInterMode: "auto",
  calcPorDentro: "yes",
  includeIPI: "yes",
  applyFcpAntecipacao: "no",
  obsLivre: "",
};

export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [cfopMap, setCfopMap] = useState<Map<string, string>>(new Map());
  const [cfopFileName, setCfopFileName] = useState("Tabela Padrão (Interna)");
  
  // XML lists
  const [notas, setNotas] = useState<ParsedNota[]>([]);
  const [itens, setItens] = useState<ParsedItem[]>([]);

  // Persistent overrides stored in localStorage
  const [emitterRegimes, setEmitterRegimes] = useState<EmitterRegimesMap>({});
  const [recipientRegimes, setRecipientRegimes] = useState<RecipientRegimesMap>({});
  const [itemConsumerOverrides, setItemConsumerOverrides] = useState<ItemConsumerOverridesMap>({});
  const [ncmRateRules, setNcmRateRules] = useState<NcmRateRule[]>([]);

  // Top-level Workspace: "launcher" | "gestor" | "emissor"
  const [currentWorkspace, setCurrentWorkspace] = useState<"launcher" | "gestor" | "emissor">(() => {
    try {
      const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
      if (saved === "gestor" || saved === "emissor") return saved;
    } catch (_) {}
    return "launcher";
  });

  // Top-level Module: "hub" (Painel das Empresas) | "acompanhamento" (Guia Geral) | "captacao" | "nfce" | "cte" | "nfse" | "difal"
  const [appModule, setAppModule] = useState<"hub" | "acompanhamento" | "captacao" | "nfce" | "cte" | "nfse" | "difal">("hub");
  const [internalIgnoredCount, setInternalIgnoredCount] = useState<number>(0);
  const [isProcessingXmls, setIsProcessingXmls] = useState<boolean>(false);

  // Active Tab: "config" | "notas" | "itens"
  const [activeTab, setActiveTab] = useState<"config" | "notas" | "itens">("config");
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // SEFAZ Companies & Integration state
  const [empresas, setEmpresas] = useState<EmpresaSefaz[]>([]);
  const [activeEmpresaId, setActiveEmpresaId] = useState<string | null>(null);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalTab, setConfigModalTab] = useState<"empresas" | "schedulers" | "storage">("empresas");
  const [isSyncAllModalOpen, setIsSyncAllModalOpen] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  // Notifications
  const [notification, setNotification] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Load CFOP list on boot
  useEffect(() => {
    const map = new Map<string, string>();
    defaultCfopData.cfops.forEach((row) => {
      if (row.tipo === "cfop" && row.codigo) {
        // Strip non-digits from code standard lookup
        const cleanCode = row.codigo.replace(/\D/g, "");
        map.set(cleanCode, row.descricao || "");
      }
    });
    setCfopMap(map);

    // Load regimes
    try {
      const rawRegimes = localStorage.getItem(REGIME_STORAGE_KEY);
      if (rawRegimes) {
        setEmitterRegimes(JSON.parse(rawRegimes));
      }
    } catch (e) {
      console.warn("Nao foi possivel carregar regimes persistidos.", e);
    }

    try {
      const rawRecipientRegimes = localStorage.getItem(REGIME_DEST_STORAGE_KEY);
      if (rawRecipientRegimes) {
        setRecipientRegimes(JSON.parse(rawRecipientRegimes));
      }
    } catch (e) {
      console.warn("Nao foi possivel carregar regimes de destinatarios persistidos.", e);
    }

    // Load overrides
    try {
      const rawOverrides = localStorage.getItem(ITEM_CONSUMER_STORAGE_KEY);
      if (rawOverrides) {
        setItemConsumerOverrides(JSON.parse(rawOverrides));
      }
    } catch (e) {
      console.warn("Nao foi possivel carregar overrides de produtos persistidos.", e);
    }

    // Load NCM custom rules
    try {
      const rawNcmRules = localStorage.getItem(NCM_RATES_STORAGE_KEY);
      if (rawNcmRules) {
        setNcmRateRules(JSON.parse(rawNcmRules));
      }
    } catch (e) {
      console.warn("Nao foi possivel carregar regras de NCM persistidas.", e);
    }

    // Load SEFAZ Companies
    try {
      const rawEmpresas = localStorage.getItem(EMPRESAS_STORAGE_KEY);
      if (rawEmpresas) {
        const parsed = JSON.parse(rawEmpresas);
        const sanitized = (Array.isArray(parsed) ? parsed : [])
          .filter((e: EmpresaSefaz) => !(e.id === "emp_fast_01" && e.password === ""))
          .map((e: EmpresaSefaz) => {
            let rName = e.razaoSocial || "";
            const cleanC = String(e.cnpj || "").replace(/\D/g, "");
            if ((!rName || rName.replace(/\D/g, "") === cleanC) && e.certInfo?.subject) {
              rName = e.certInfo.subject.split(":")[0].trim();
            }
            let certInfo = e.certInfo;
            if (certInfo && certInfo.validTo) {
              const days = calculateDaysRemaining(certInfo.validTo);
              if (days !== null) {
                certInfo = {
                  ...certInfo,
                  daysRemaining: days,
                  isExpired: days < 0,
                };
              }
            }
            const trimmedNotas = Array.isArray(e.notasEmitidasNfse) && e.notasEmitidasNfse.length > 50
              ? e.notasEmitidasNfse.slice(0, 50)
              : e.notasEmitidasNfse;
            return { ...e, razaoSocial: rName || cleanC, certInfo, notasEmitidasNfse: trimmedNotas };
          })
          .sort((a: EmpresaSefaz, b: EmpresaSefaz) =>
            (a.razaoSocial || "").localeCompare(b.razaoSocial || "", "pt-BR", {
              sensitivity: "base",
              numeric: true,
            })
          );
        setEmpresas(sanitized);
        const rawActiveId = localStorage.getItem(ACTIVE_EMPRESA_KEY);
        if (rawActiveId && sanitized.some((e: EmpresaSefaz) => e.id === rawActiveId)) {
          setActiveEmpresaId(rawActiveId);
        } else if (sanitized.length > 0) {
          setActiveEmpresaId(sanitized[0].id);
        }
      } else {
        setEmpresas([]);
      }
    } catch (e) {
      console.warn("Nao foi possivel carregar empresas.", e);
    }

    // Check if tutorial has been seen
    const rawSeenTutorial = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!rawSeenTutorial && currentWorkspace !== "launcher") {
      setIsTutorialOpen(true);
    }
  }, []);

  const handleCloseTutorial = () => {
    setIsTutorialOpen(false);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  };

  // Show status alerts
  const alertStatus = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const activeEmpresa = empresas.find((e) => e.id === activeEmpresaId) || (empresas.length > 0 ? empresas[0] : null);

  const handleSaveEmpresas = (updated: EmpresaSefaz[]) => {
    const sorted = [...updated].sort((a, b) =>
      (a.razaoSocial || "").localeCompare(b.razaoSocial || "", "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );
    setEmpresas(sorted);
    localStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(sorted));
  };

  const handleSelectEmpresa = (id: string) => {
    setActiveEmpresaId(id);
    localStorage.setItem(ACTIVE_EMPRESA_KEY, id);
    const selected = empresas.find((e) => e.id === id);
    if (selected) {
      alertStatus(`Empresa ativa alterada para: ${selected.razaoSocial}`);
    }
  };

  const handleLoadXmlContents = (
    xmls: Array<{ name: string; content: string }>,
    company: EmpresaSefaz
  ) => {
    if (xmls.length === 0) return;

    if (company.cnpj) {
      const cleanCnpj = company.cnpj.replace(/\D/g, "");
      handleUpdateRecipientRegime(cleanCnpj, company.regime || "simples");
    }

    const currentNotas: ParsedNota[] = [];
    const currentItens: ParsedItem[] = [];
    let ignored = 0;

    for (const file of xmls) {
      try {
        // Ignora explicitamente CT-e (Modelo 57), NFC-e (Modelo 65) ou outros que não sejam NF-e (Modelo 55)
        if (
          file.name.toLowerCase().endsWith("-cte.xml") ||
          file.name.toLowerCase().endsWith("-nfce.xml") ||
          file.name.toLowerCase().endsWith("-nfse.xml") ||
          file.content.includes("<infCte") ||
          file.content.includes("<cteProc") ||
          file.content.includes("<CTe")
        ) {
          continue;
        }

        // Verifica se a nota é de fora do estado (Interestadual)
        const ufRemMatch = file.content.match(/<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
        const ufDestMatch = file.content.match(/<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
        const ufRem = ufRemMatch ? ufRemMatch[1].trim().toUpperCase() : "";
        const ufDest = ufDestMatch ? ufDestMatch[1].trim().toUpperCase() : (company.uf || "SP").toUpperCase();

        // Se a nota for do mesmo estado (Interna), descarta do cálculo do DIFAL
        if (ufRem && ufDest && ufRem === ufDest) {
          ignored++;
          continue;
        }

        const parsed = parseXMLContent(
          file.content,
          file.name,
          config,
          emitterRegimes,
          itemConsumerOverrides,
          cfopMap,
          ncmRateRules,
          recipientRegimes
        );
        currentNotas.push(parsed.nota);
        currentItens.push(...parsed.itens);
      } catch (err: any) {
        console.warn(`Falha ao ler ${file.name}:`, err.message);
      }
    }

    currentNotas.sort((a, b) => a.nNF.localeCompare(b.nNF, "pt-BR", { numeric: true }));
    currentItens.sort((a, b) =>
      `${a.nNF}-${a.itemSeq}`.localeCompare(`${b.nNF}-${b.itemSeq}`, "pt-BR", { numeric: true })
    );

    setNotas(currentNotas);
    setItens(currentItens);
    setInternalIgnoredCount(ignored);

    const ignoredMsg = ignored > 0 ? ` (${ignored} nota(s) interna(s) de ${company.uf || "SP"} foram ignoradas por não incidirem DIFAL)` : "";
    alertStatus(
      `${currentNotas.length} nota(s) interestadual(is) carregadas para cálculo do DIFAL${ignoredMsg}. ${currentItens.length} itens auditados!`
    );
    setAppModule("difal");
    setActiveTab("notas");
  };

  // Handler: Update Emitter Regime individual mapping
  const handleUpdateRegime = (cnpj: string, regime: RegimeRemetente | "default") => {
    const updated = { ...emitterRegimes };
    if (regime === "default") {
      delete updated[cnpj];
    } else {
      updated[cnpj] = regime;
    }
    setEmitterRegimes(updated);
    localStorage.setItem(REGIME_STORAGE_KEY, JSON.stringify(updated));
    alertStatus("Regime para o parceiro emitente atualizado com sucesso.");
  };

  // Handler: Sincronização automática dos regimes de emitentes a partir da consulta de CNPJ
  const handleCnpjsUpdated = (results: Record<string, CnpjConsultaResult>) => {
    setEmitterRegimes((prev) => {
      const updated = { ...prev };
      let changed = 0;
      for (const [cnpj, res] of Object.entries(results)) {
        if (res && res.sucesso && typeof res.opcao_simples_raw === "boolean") {
          const cleanCnpj = cnpj.replace(/\D/g, "");
          const targetRegime: RegimeRemetente = res.opcao_simples_raw ? "simples" : "normal";
          if (updated[cleanCnpj] !== targetRegime) {
            updated[cleanCnpj] = targetRegime;
            changed++;
          }
        }
      }
      if (changed > 0) {
        localStorage.setItem(REGIME_STORAGE_KEY, JSON.stringify(updated));
        alertStatus(`${changed} emitente(s) sincronizado(s) com a base do Simples Nacional!`);
      }
      return changed > 0 ? updated : prev;
    });
  };


  // Handler: Update Recipient Regime individual mapping
  const handleUpdateRecipientRegime = (cnpj: string, regime: RegimeDestinatario | "default") => {
    const updated = { ...recipientRegimes };
    if (regime === "default") {
      delete updated[cnpj];
    } else {
      updated[cnpj] = regime;
    }
    setRecipientRegimes(updated);
    localStorage.setItem(REGIME_DEST_STORAGE_KEY, JSON.stringify(updated));
    alertStatus("Regime para o cliente destinatário atualizado com sucesso.");
  };

  // Handler: Update product single consumer rule override
  const handleUpdateItemOverride = (itemConfigKey: string, value: string) => {
    const updated = { ...itemConsumerOverrides };
    if (value === "auto" || !value) {
      delete updated[itemConfigKey];
    } else {
      updated[itemConfigKey] = value;
    }
    setItemConsumerOverrides(updated);
    localStorage.setItem(ITEM_CONSUMER_STORAGE_KEY, JSON.stringify(updated));
    alertStatus("Auditoria de Consumidor Final sobrescrita para este produto.");
  };

  // Handler: Add custom NCM rate rule
  const handleAddNcmRule = (newRule: Omit<NcmRateRule, "id">) => {
    const rule: NcmRateRule = {
      ...newRule,
      id: "rule_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
    };
    const updated = [...ncmRateRules, rule];
    setNcmRateRules(updated);
    localStorage.setItem(NCM_RATES_STORAGE_KEY, JSON.stringify(updated));
    alertStatus(`Regra para o NCM ${rule.ncm} adicionada com sucesso.`);
  };

  // Handler: Remove custom NCM rate rule
  const handleRemoveNcmRule = (id: string) => {
    const target = ncmRateRules.find((r) => r.id === id);
    const updated = ncmRateRules.filter((r) => r.id !== id);
    setNcmRateRules(updated);
    localStorage.setItem(NCM_RATES_STORAGE_KEY, JSON.stringify(updated));
    if (target) {
      alertStatus(`Regra para o NCM ${target.ncm} removida com sucesso.`);
    }
  };

  // Handler: Update existing NCM rate rule
  const handleUpdateNcmRule = (updatedRule: NcmRateRule) => {
    const updated = ncmRateRules.map((r) => (r.id === updatedRule.id ? updatedRule : r));
    setNcmRateRules(updated);
    localStorage.setItem(NCM_RATES_STORAGE_KEY, JSON.stringify(updated));
    alertStatus(`Regra para o NCM ${updatedRule.ncm} atualizada com sucesso.`);
  };

  // Handler: Import bulk custom NCM rate rules from JSON backup
  const handleImportNcmRules = (rules: NcmRateRule[]) => {
    if (!Array.isArray(rules)) {
      alertStatus("O arquivo importado não é um formato de lista válido.", "error");
      return;
    }

    const validRules: NcmRateRule[] = [];
    let duplicatesSkipped = 0;

    for (const r of rules) {
      if (!r.ncm || typeof r.aliqInterna !== "number") continue;
      
      const cleanNcm = String(r.ncm).replace(/\D/g, "");
      if (!cleanNcm) continue;
      
      const ufDest = String(r.ufDest || "TODOS").toUpperCase();
      
      // Check if duplicate of an existing or newly added rule
      const existsInCurrent = ncmRateRules.some(
        (cur) => String(cur.ncm).replace(/\D/g, "") === cleanNcm && cur.ufDest.toUpperCase() === ufDest
      );
      const existsInImport = validRules.some(
        (imp) => String(imp.ncm).replace(/\D/g, "") === cleanNcm && imp.ufDest.toUpperCase() === ufDest
      );

      if (existsInCurrent || existsInImport) {
        duplicatesSkipped++;
        continue;
      }

      validRules.push({
        id: r.id || "rule_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7) + "_" + validRules.length,
        ncm: cleanNcm,
        ufDest: ufDest,
        aliqInterna: r.aliqInterna,
        aliqFcp: typeof r.aliqFcp === "number" ? r.aliqFcp : 0,
        description: r.description ? String(r.description).trim() : "",
      });
    }

    if (validRules.length === 0) {
      if (duplicatesSkipped > 0) {
        alertStatus(`Nenhuma regra importada. Todas as ${duplicatesSkipped} regras já estavam cadastradas.`, "error");
      } else {
        alertStatus("Nenhuma regra válida encontrada no arquivo.", "error");
      }
      return;
    }

    const updated = [...ncmRateRules, ...validRules];
    setNcmRateRules(updated);
    localStorage.setItem(NCM_RATES_STORAGE_KEY, JSON.stringify(updated));
    alertStatus(
      `Sucesso: ${validRules.length} regra(s) importada(s).${
        duplicatesSkipped > 0 ? ` (${duplicatesSkipped} duplicatas puladas)` : ""
      }`
    );
  };

  // Trigger global recalculation when config, regimes, or item overrides change
  useEffect(() => {
    if (notas.length === 0) return;

    const updatedItens = itens.map((item) => {
      const calc = calculateLegal(item, config, emitterRegimes, itemConsumerOverrides, ncmRateRules, recipientRegimes);
      return {
        ...item,
        ...calc,
        cfopDesc: cfopMap.get(item.cfop.replace(/\D/g, "")) || item.cfopDesc || "",
      };
    });

    const updatedNotas = notas.map((nota) => {
      const itensNota = updatedItens.filter((i) => i.arquivo === nota.arquivo && i.nNF === nota.nNF);
      const agg = summarizeNota(itensNota, config.regimeRemet, config.regimeDest);
      return { ...nota, ...agg } as ParsedNota;
    });

    setItens(updatedItens);
    setNotas(updatedNotas);
  }, [config, emitterRegimes, recipientRegimes, itemConsumerOverrides, ncmRateRules]);

  // Bulk apply standard parameters to remaining emitentes
  const handleApplyGlobalToUnconfigured = () => {
    const emitentesUnicos = getUniqueEmitters();
    if (emitentesUnicos.length === 0) {
      alertStatus("Carregue arquivos XML antes de aplicar esta acao.", "error");
      return;
    }

    const updatedRegimes = { ...emitterRegimes };
    let changed = 0;
    emitentesUnicos.forEach((e) => {
      if (!updatedRegimes[e.emitenteKey]) {
        updatedRegimes[e.emitenteKey] = config.regimeRemet;
        changed++;
      }
    });

    setEmitterRegimes(updatedRegimes);
    localStorage.setItem(REGIME_STORAGE_KEY, JSON.stringify(updatedRegimes));
    alertStatus(`${changed} emitente(s) configurados para o regime padrão: ${getRegimeLabel(config.regimeRemet)}.`);
  };

  // Bulk apply standard parameters to remaining destinatários
  const handleApplyGlobalToUnconfiguredRecipients = () => {
    const destinatariosUnicos = getUniqueRecipients();
    if (destinatariosUnicos.length === 0) {
      alertStatus("Carregue arquivos XML antes de aplicar esta acao.", "error");
      return;
    }

    const updatedRegimes = { ...recipientRegimes };
    let changed = 0;
    destinatariosUnicos.forEach((d) => {
      if (!updatedRegimes[d.destinatarioKey]) {
        updatedRegimes[d.destinatarioKey] = config.regimeDest;
        changed++;
      }
    });

    setRecipientRegimes(updatedRegimes);
    localStorage.setItem(REGIME_DEST_STORAGE_KEY, JSON.stringify(updatedRegimes));
    alertStatus(`${changed} destinatário(s) configurados para o regime padrão: ${getRegimeLabel(config.regimeDest)}.`);
  };

  // Parser: handle dropped or selected XML files
  const handleXMLsLoaded = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.name.toLowerCase().endsWith(".xml"));
    if (validFiles.length === 0) {
      alertStatus("Apenas arquivos .xml de Notas Fiscais são permitidos.", "error");
      return;
    }

    setIsProcessingXmls(true);
    let addedNotasCount = 0;
    let addedItensCount = 0;
    let ignoredNotasCount = 0;

    const currentNotas = [...notas];
    const currentItens = [...itens];

    try {
      for (const file of validFiles) {
        try {
          const text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ""));
            reader.onerror = reject;
            reader.readAsText(file, "utf-8");
          });

          // Ignora arquivos de CT-e (Modelo 57), NFC-e (Modelo 65) ou outros que não sejam NF-e (Modelo 55)
          if (
            file.name.toLowerCase().endsWith("-cte.xml") ||
            file.name.toLowerCase().endsWith("-nfce.xml") ||
            file.name.toLowerCase().endsWith("-nfse.xml") ||
            text.includes("<infCte") ||
            text.includes("<cteProc") ||
            text.includes("<CTe")
          ) {
            ignoredNotasCount++;
            continue;
          }

          // Verifica se a nota é interestadual
          const ufRemMatch = text.match(/<enderEmit[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
          const ufDestMatch = text.match(/<enderDest[^>]*>[\s\S]*?<UF>([^<]+)<\/UF>/i);
          const ufRem = ufRemMatch ? ufRemMatch[1].trim().toUpperCase() : "";
          const ufDest = ufDestMatch ? ufDestMatch[1].trim().toUpperCase() : (activeEmpresa?.uf || "SP").toUpperCase();

          if (ufRem && ufDest && ufRem === ufDest) {
            ignoredNotasCount++;
            continue;
          }

          const parsed = parseXMLContent(
            text,
            file.name,
            config,
            emitterRegimes,
            itemConsumerOverrides,
            cfopMap,
            ncmRateRules,
            recipientRegimes
          );

          // Delete existing file records to avoid duplicating on re-upload
          const cleanNotas = currentNotas.filter(
            (n) => !(n.arquivo === file.name && n.nNF === parsed.nota.nNF)
          );
          const cleanItens = currentItens.filter(
            (i) => !(i.arquivo === file.name && i.nNF === parsed.nota.nNF)
          );

          cleanNotas.push(parsed.nota);
          cleanItens.push(...parsed.itens);

          currentNotas.splice(0, currentNotas.length, ...cleanNotas);
          currentItens.splice(0, currentItens.length, ...cleanItens);

          addedNotasCount++;
          addedItensCount += parsed.itens.length;
        } catch (err: any) {
          console.error(err);
          alertStatus(`Falha ao ler ${file.name}: ${err.message}`, "error");
        }
      }

      // Sort lists numeric style
      currentNotas.sort((a, b) => a.nNF.localeCompare(b.nNF, "pt-BR", { numeric: true }));
      currentItens.sort((a, b) =>
        `${a.nNF}-${a.itemSeq}`.localeCompare(`${b.nNF}-${b.itemSeq}`, "pt-BR", { numeric: true })
      );

      setNotas(currentNotas);
      setItens(currentItens);
      setInternalIgnoredCount((prev) => prev + ignoredNotasCount);

      const ignoredMsg = ignoredNotasCount > 0 ? ` (${ignoredNotasCount} nota(s) interna(s) ignoradas por não incidirem DIFAL)` : "";
      alertStatus(`${addedNotasCount} XML(s) interestadual(is) carregado(s)${ignoredMsg}. ${addedItensCount} item(ns) identificados.`);
      
      // Automatically switch tabs for direct spreadsheet views
      setActiveTab("notas");
    } finally {
      setIsProcessingXmls(false);
    }
  };

  // Parser: handle CFOP base list swap
  const handleCFOPLoaded = async (file: File) => {
    try {
      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsText(file, "utf-8");
      });

      const json = JSON.parse(text);
      if (json && Array.isArray(json.cfops)) {
        const map = new Map<string, string>();
        json.cfops.forEach((row: any) => {
          if (row.tipo === "cfop" && row.codigo) {
            const cleanCode = String(row.codigo).replace(/\D/g, "");
            map.set(cleanCode, row.descricao || "");
          }
        });
        setCfopMap(map);
        setCfopFileName(file.name);
        alertStatus(`Nova base de CFOP mesclada com ${map.size} códigos.`);
      } else {
        throw new Error("O JSON selecionado nao contem uma estrutura valida de CFOPs.");
      }
    } catch (e: any) {
      console.error(e);
      alertStatus(`Falha ao ler JSON CFOP: ${e.message}`, "error");
    }
  };

  // Clean application spreadsheets
  const handleClear = () => {
    setNotas([]);
    setItens([]);
    alertStatus("Todas as notas fiscais importadas foram removidas da tela.");
    setActiveTab("config");
  };

  // Extract Emitter list
  const getUniqueEmitters = () => {
    const map = new Map();
    notas.forEach((nota) => {
      const key = nota.emitenteKey || normalizeDoc(nota.cnpjCpfRem);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          emitenteKey: key,
          cnpjCpfRem: nota.cnpjCpfRem || key,
          razaoRem: nota.razaoRem || "",
          ufRem: nota.ufRem || "",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.razaoRem.localeCompare(b.razaoRem, "pt-BR", { sensitivity: "base" })
    );
  };

  // Extract Recipient list
  const getUniqueRecipients = () => {
    const map = new Map();
    notas.forEach((nota) => {
      const key = nota.cnpjCpfDest ? normalizeDoc(nota.cnpjCpfDest) : "";
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          destinatarioKey: key,
          cnpjCpfDest: nota.cnpjCpfDest || key,
          razaoDest: nota.razaoDest || "",
          ufDest: nota.ufDest || "",
        });
      }
    });
    return Array.from(map.values()).sort((a, b) =>
      a.razaoDest.localeCompare(b.razaoDest, "pt-BR", { sensitivity: "base" })
    );
  };

  // Dynamic status message construction
  const getAuditStatusSummary = () => {
    const internalRate = config.aliqInterna;
    const fcpRate = config.aliqFcp;
    const isAuto = config.consumerFinalMode === "auto";
    const isYes = config.consumerFinalMode === "yes";
    const porDentro = config.calcPorDentro === "yes";
    const includeIPI = config.includeIPI === "yes";
    const fcpAntecipacao = config.applyFcpAntecipacao === "yes";

    let msg = "";
    if (isAuto) {
      msg += "Modo Consumidor Final 'Automático (XML)': a regra (DIFAL ou Antecipação) é resolvida dinamicamente baseada na tag indFinal de cada Nota. ";
    } else if (isYes) {
      msg += "Forçar Consumidor Final: Todos os itens interestaduais utilizam a regra do DIFAL Consumidor Final. ";
    } else {
      msg += "Forçar Revenda/Não Consumidor: Todas as operações interestaduais utilizam a regra da Antecipação simples. ";
    }

    msg += `Parâmetros aplicados: Alíquota Interna de ${internalRate}% e FCP de ${fcpRate}%. `;
    msg += porDentro
      ? "DIFAL Consumidor utilizando base de cálculo dupla integral ('por dentro'). "
      : "DIFAL Consumidor utilizando base de cálculo simples ('por fora'). ";
    msg += includeIPI
      ? "O IPI integra a base do DIFAL Consumidor. "
      : "O IPI está excluído da base do DIFAL Consumidor. ";
    msg += fcpAntecipacao
      ? "O Fundo de Combate à Pobreza (FCP) está habilitado e calculando na Antecipação."
      : "O FCP está excluído da Antecipação simples.";

    return msg;
  };

  // CSV consolidate exporter
  const handleExportNotas = () => {
    if (notas.length === 0) return;
    const rows = notas.map((n) => ({
      Arquivo: n.arquivo,
      NF: n.nNF,
      Emissao: n.dataEmissao,
      UF_Origem: n.ufRem,
      UF_Destino: n.ufDest,
      indFinal_XML: n.indFinal,
      Modo_Enquadramento: n.modeLabel,
      CNPJ_Remetente: n.cnpjCpfRem,
      Razao_Remetente: n.razaoRem,
      Regime_Remetente: getRegimeLabel(n.regimeRemetAplicado),
      Regime_Origem: n.regimeRemetOrigem,
      CNPJ_Destinatario: n.cnpjCpfDest,
      Razao_Destinatario: n.razaoDest,
      Valor_Operacao_Sem_IPI: n.valorOperSemIPITotal.toFixed(2).replace(".", ","),
      Valor_IPI: n.valorIPITotal.toFixed(2).replace(".", ","),
      Base_Calculo_DIFAL_Total: n.baseCalculoTotal.toFixed(2).replace(".", ","),
      ICMS_Origem_Calculado: n.icmsOrigemCalcTotal.toFixed(2).replace(".", ","),
      DIFAL_Total: n.difalPuroTotal.toFixed(2).replace(".", ","),
      FCP_Total: n.fcpCalcTotal.toFixed(2).replace(".", ","),
      Total_Recolher: n.totalRecolher.toFixed(2).replace(".", ","),
      Total_Nota_Eletronica: n.vNF.toFixed(2).replace(".", ","),
      Fundamento_Operacional: n.fundamento,
    }));

    const csvContent = toCSV(rows);
    downloadTextFile(`consolidado_notas_difal_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    alertStatus("Planilha Consolidada de Notas Fiscais exportada com sucesso.");
  };

  const handleExportItens = () => {
    if (itens.length === 0) return;
    const rows = itens.map((i) => ({
      NF: i.nNF,
      Item_Seq: i.itemSeq,
      Emissao: i.dataEmissao,
      Enquadramento: i.modeLabel,
      Consumidor_Final_Aplicado: i.consumerFinalApplied ? "Sim" : "Não",
      Config_Origem: i.consumerFinalSource,
      CNPJ_Emitente: i.cnpjCpfRem,
      Razao_Emitente: i.razaoRem,
      Regime_Emitente_Aplicado: getRegimeLabel(i.regimeRemetAplicado),
      Regime_Origem: i.regimeRemetOrigem,
      UF_Origem: i.ufRem,
      UF_Destino: i.ufDest,
      Crod_Prod: i.cProd,
      Descricao_Produto: i.xProd,
      NCM: i.ncm,
      Orig_CST_CSOSN: i.ocst,
      CFOP: i.cfop,
      CFOP_Descricao: i.cfopDesc,
      UN: i.unidade,
      Quantidade: i.quantidade.toString().replace(".", ","),
      VUn_Com: i.vUnCom.toFixed(4).replace(".", ","),
      V_Prod: i.vProd.toFixed(2).replace(".", ","),
      V_Frete: i.vFreteItem.toFixed(2).replace(".", ","),
      V_Desc: i.vDescItem.toFixed(2).replace(".", ","),
      Valor_Líquido_Sem_IPI: i.valorOperSemIPI.toFixed(2).replace(".", ","),
      Valor_IPI: i.valorIPI.toFixed(2).replace(".", ","),
      Base_Calculo_DIFAL: i.baseCalculo.toFixed(2).replace(".", ","),
      Aliq_Inter: i.aliqInter.toFixed(2).replace(".", ","),
      Aliq_Interna_Dest: i.aliqInterna.toFixed(2).replace(".", ","),
      ICMS_Origem_Calculado: i.icmsOrigemCalc.toFixed(2).replace(".", ","),
      DIFAL: i.difalPuro.toFixed(2).replace(".", ","),
      FCP: i.fcpCalc.toFixed(2).replace(".", ","),
      Total_DIFAL_FCP_Recolher: i.totalRecolher.toFixed(2).replace(".", ","),
      Memoria_Apoio: i.memoryShort,
      Memoria_Integral: i.memory,
    }));

    const csvContent = toCSV(rows);
    downloadTextFile(`itens_detalhados_difal_${new Date().toISOString().slice(0, 10)}.csv`, csvContent);
    alertStatus("Planilha Analítica de Itens de Mercadoria exportada com sucesso.");
  };

  // Totals calculations
  const totalPayable = notas.reduce((acc, n) => acc + n.totalRecolher, 0);

  const getPredominantModeLabel = () => {
    if (notas.length === 0) return "—";
    const modes = notas.reduce<Record<string, number>>((acc, n) => {
      acc[n.modeLabel] = (acc[n.modeLabel] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(modes).sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    return top ? top[0] : "—";
  };

  const detectedCompanyName = notas.length > 0 ? notas[0].razaoDest : (localStorage.getItem("difal_company_name_v2") || "EMPRESA SOB AUDITORIA LTDA");

  // 1. TELA INICIAL (LAUNCHER): Seleção entre Gestor Fiscal e Emissor NFS-e
  if (currentWorkspace === "launcher") {
    return (
      <>
        <LauncherPortalView
          onSelectGestor={(remember) => {
            if (remember) {
              localStorage.setItem(WORKSPACE_STORAGE_KEY, "gestor");
            } else {
              localStorage.removeItem(WORKSPACE_STORAGE_KEY);
            }
            setCurrentWorkspace("gestor");
            setAppModule("hub");
            if (!localStorage.getItem(TUTORIAL_STORAGE_KEY)) {
              setIsTutorialOpen(true);
            }
          }}
          onSelectEmissor={(remember) => {
            if (remember) {
              localStorage.setItem(WORKSPACE_STORAGE_KEY, "emissor");
            } else {
              localStorage.removeItem(WORKSPACE_STORAGE_KEY);
            }
            setCurrentWorkspace("emissor");
          }}
          empresasCount={empresas.length}
          activeEmpresa={activeEmpresa}
          onOpenConfig={(tab) => {
            setConfigModalTab(tab || "empresas");
            setIsConfigModalOpen(true);
          }}
          onOpenHelp={() => setIsTutorialOpen(true)}
        />

        {isConfigModalOpen && (
          <UnifiedConfigModal
            isOpen={isConfigModalOpen}
            initialTab={configModalTab}
            empresas={empresas}
            activeEmpresaId={activeEmpresaId}
            onSelectEmpresa={handleSelectEmpresa}
            onClose={() => setIsConfigModalOpen(false)}
            onEmpresasChange={(updated) => {
              setEmpresas(updated);
              localStorage.setItem(EMPRESAS_STORAGE_KEY, JSON.stringify(updated));
            }}
            onNotify={alertStatus}
          />
        )}

        {isTutorialOpen && (
          <OnboardingModal
            isOpen={isTutorialOpen}
            onClose={() => setIsTutorialOpen(false)}
          />
        )}
      </>
    );
  }

  // 2. MODO EMISSOR DE NFS-E
  if (currentWorkspace === "emissor") {
    return (
      <div className="h-screen overflow-hidden bg-[#e8e8e8] text-[#000000] flex flex-col font-sans select-none text-[11px]">
        {/* Global Toast Notification */}
        {notification && (
          <div
            className={`fixed bottom-8 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded shadow-lg border transition-all duration-300 text-xs font-semibold max-w-md ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                : "bg-red-50 border-red-400 text-red-900"
            }`}
          >
            <div>
              {notification.type === "success" ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-red-600 shrink-0" />
              )}
            </div>
            <div className="flex-1 font-semibold leading-snug">{notification.text}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-slate-800 ml-1 text-[11px] font-bold px-1 cursor-pointer"
              title="Fechar notificação"
            >
              ✕
            </button>
          </div>
        )}

        <NfseEmissorView
          empresas={empresas}
          activeEmpresa={activeEmpresa}
          onSelectEmpresa={handleSelectEmpresa}
          onNavigateLauncher={() => setCurrentWorkspace("launcher")}
          onNavigateGestor={() => {
            setCurrentWorkspace("gestor");
            setAppModule("hub");
          }}
          onNotify={alertStatus}
          onSaveEmpresas={handleSaveEmpresas}
          onOpenConfig={(tab) => {
            setConfigModalTab(tab || "empresas");
            setIsConfigModalOpen(true);
          }}
        />

        <UnifiedConfigModal
          isOpen={isConfigModalOpen}
          initialTab={configModalTab}
          empresas={empresas}
          activeEmpresaId={activeEmpresaId}
          onSelectEmpresa={handleSelectEmpresa}
          onClose={() => setIsConfigModalOpen(false)}
          onSaveEmpresas={handleSaveEmpresas}
        />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#e8e8e8] text-[#000000] flex flex-col font-sans select-none text-[11px]">
      <style>{`
        .vb-top-btn {
          background: linear-gradient(180deg, #ffffff 0%, #ececec 50%, #e0e0e0 100%);
          border: 1px solid #707070;
          border-radius: 2px;
          padding: 2.5px 6px;
          font-size: 11px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3.5px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
          white-space: nowrap;
        }
        .vb-top-btn:hover {
          background: linear-gradient(180deg, #f5f8fc 0%, #e1e9f5 50%, #d4e1f2 100%);
          border-color: #3c7fb1;
        }
        .vb-top-btn-active {
          background: #005a9e !important;
          border-color: #003366 !important;
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .vb-top-btn-sync {
          background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
          border: 1px solid #005a9e;
          font-weight: 700;
          color: #002244;
        }
        .vb-top-btn-sync:hover {
          background: linear-gradient(180deg, #e1effe 0%, #c3ddfd 50%, #a4cafe 100%);
          border-color: #003366;
        }
      `}</style>
      
      {/* Top Header ERP Ribbon - Single Compact Line */}
      <header className="shrink-0 border-b border-[#b0b0b0] bg-[#f0f0f0] px-2 py-1 shadow-xs z-30">
        <div className="w-full flex items-center justify-between gap-1.5 overflow-hidden">
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={() => setAppModule("hub")}
              title="CONT-AI - Gestor de Movimento Fiscal v2.0 (Clique para ir ao Painel de Empresas)"
            >
              <img
                src={logoImg}
                alt="Logo CONT-AI"
                className="h-5 w-auto object-contain shrink-0"
              />
              <span className="font-extrabold text-[#003366] text-[12px] tracking-tight">
                CONT-AI
              </span>
              <span className="text-[9px] font-bold text-[#005a9e] bg-[#dbe8f8] border border-[#99bce8] px-1 rounded-xs">
                v2.0
              </span>
            </div>

            {/* Início / Launcher Button */}
            <button
              type="button"
              onClick={() => setCurrentWorkspace("launcher")}
              className="vb-top-btn"
              style={{
                background: "linear-gradient(180deg, #f0f6ff 0%, #dbeafe 100%)",
                borderColor: "#60a5fa",
                color: "#1e3a8a",
                fontWeight: 600,
              }}
              title="Voltar para a Tela Inicial (Seleção entre Gestor Fiscal e Emissor NFS-e)"
            >
              <Home size={11} className="text-[#005a9e]" />
              <span>Início</span>
            </button>

            <div className="h-4 w-[1px] bg-[#b8b8b8] mx-0.5" />

            {/* Module Switcher Buttons */}
            <nav className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAppModule("hub")}
                className={`vb-top-btn ${appModule === "hub" ? "vb-top-btn-active" : ""}`}
                title="Visão Geral de Todas as Empresas e Certificados"
              >
                <Building2 size={12} className={appModule === "hub" ? "text-white" : "text-[#003366]"} />
                <span>Painel de Empresas</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("acompanhamento")}
                className={`vb-top-btn ${appModule === "acompanhamento" ? "vb-top-btn-active" : ""}`}
                title="Consolidação Fiscal dos 4 Modelos por Empresa"
              >
                <Layers size={12} className={appModule === "acompanhamento" ? "text-white" : "text-[#003366]"} />
                <span>Guia Geral de Notas</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("captacao")}
                className={`vb-top-btn ${appModule === "captacao" ? "vb-top-btn-active" : ""}`}
                title="Captação e Auditoria de NF-e Entradas (Modelo 55)"
              >
                <DownloadCloud size={12} className={appModule === "captacao" ? "text-white" : "text-sky-700"} />
                <span>NF-e Entradas (55)</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("nfce")}
                className={`vb-top-btn ${appModule === "nfce" ? "vb-top-btn-active" : ""}`}
                title="Captação de Cupons Fiscais Eletrônicos NFC-e (Modelo 65)"
              >
                <ShoppingBag size={12} className={appModule === "nfce" ? "text-white" : "text-purple-700"} />
                <span>NFC-e (65)</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("cte")}
                className={`vb-top-btn ${appModule === "cte" ? "vb-top-btn-active" : ""}`}
                title="Captação de Conhecimentos de Transporte CT-e (Modelo 57)"
              >
                <Truck size={12} className={appModule === "cte" ? "text-white" : "text-amber-700"} />
                <span>CT-e Fretes (57)</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("nfse")}
                className={`vb-top-btn ${appModule === "nfse" ? "vb-top-btn-active" : ""}`}
                title="Captação de Notas Fiscais de Serviço (Portal Nacional ADN & Prefeitura de SP)"
              >
                <Landmark size={12} className={appModule === "nfse" ? "text-white" : "text-emerald-700"} />
                <span>NFS-e (Nac. & SP)</span>
              </button>

              <button
                type="button"
                onClick={() => setAppModule("difal")}
                className={`vb-top-btn ${appModule === "difal" ? "vb-top-btn-active" : ""}`}
                title="Apuração e Memória de Cálculo de DIFAL / Antecipação Tributária"
              >
                <Calculator size={12} className={appModule === "difal" ? "text-white" : "text-indigo-700"} />
                <span>Cálculo DIFAL</span>
                {notas.length > 0 && (
                  <span className={`ml-0.5 px-1 rounded text-[9px] font-bold ${appModule === "difal" ? "bg-white text-[#005a9e]" : "bg-indigo-100 text-indigo-900"}`}>
                    {notas.length}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Right Global Utility Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {(appModule === "hub" || appModule === "acompanhamento") && (
              <>
                <button
                  onClick={() => setIsSyncAllModalOpen(true)}
                  className="vb-top-btn vb-top-btn-sync"
                  title="Sincronizar todos os 4 modelos fiscais (NF-e, NFC-e, CT-e e NFS-e) de todas as empresas cadastradas"
                >
                  <RefreshCw size={12} className="text-[#003366]" />
                  <span>Sincronizar Empresas</span>
                </button>
                <div className="h-4 w-[1px] bg-[#b8b8b8] mx-0.5" />
              </>
            )}

            <button
              onClick={() => {
                setConfigModalTab("storage");
                setIsConfigModalOpen(true);
              }}
              className="vb-top-btn !px-1.5"
              title={`Repositório de Arquivos XML e Diretórios de Salvamento${cfopFileName ? ` (CFOP: ${cfopFileName})` : ""}`}
            >
              <FolderOpen size={13} className="text-[#005a9e]" />
            </button>

            <button
              onClick={() => {
                setConfigModalTab("empresas");
                setIsConfigModalOpen(true);
              }}
              className="vb-top-btn !px-1.5"
              title="Configurações, Empresas e Agendadores"
            >
              <Settings size={13} className="text-[#333333]" />
            </button>

            <button
              onClick={() => setIsTutorialOpen(true)}
              className="vb-top-btn !px-1.5"
              title="Guia de Utilização e Ajuda do Sistema"
            >
              <HelpCircle size={13} className="text-[#333333]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Full-Screen Content Area */}
      <main className="flex-1 min-h-0 w-full flex flex-col overflow-hidden p-0 m-0 relative">
        {/* Global Toast Notification System (Bottom-right above status bar so it never blocks top toolbar buttons) */}
        {notification && (
          <div
            className={`fixed bottom-8 right-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded shadow-lg border transition-all duration-300 text-xs font-semibold max-w-md ${
              notification.type === "success"
                ? "bg-emerald-50 border-emerald-400 text-emerald-900"
                : "bg-red-50 border-red-400 text-red-900"
            }`}
          >
            <div>
              {notification.type === "success" ? (
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={15} className="text-red-600 shrink-0" />
              )}
            </div>
            <div className="flex-1 font-semibold leading-snug">{notification.text}</div>
            <button
              onClick={() => setNotification(null)}
              className="text-slate-500 hover:text-slate-800 ml-1 text-[11px] font-bold px-1 cursor-pointer"
              title="Fechar notificação"
            >
              ✕
            </button>
          </div>
        )}

        <LoadingGearOverlay
          isLoading={isProcessingXmls}
          title="Processando Notas Fiscais..."
          subtitle="Auditando notas interestaduais e calculando DIFAL..."
        />

        {appModule === "hub" ? (
          <EmpresasHubView
            empresas={empresas}
            activeEmpresaId={activeEmpresaId}
            onSelectEmpresa={(id) => {
              handleSelectEmpresa(id);
              setAppModule("acompanhamento");
            }}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNotify={(text, type) => alertStatus(text, type)}
            refreshKey={refreshCounter}
          />
        ) : appModule === "captacao" ? (
          <CaptacaoView
            empresas={empresas}
            activeEmpresa={activeEmpresa}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onSendToDifal={(interestadualXmls, company) => {
              handleLoadXmlContents(interestadualXmls, company);
            }}
            onNotify={(text, type) => alertStatus(text, type)}
            onCnpjsUpdated={handleCnpjsUpdated}
            onNavigateHub={() => setAppModule("hub")}
            refreshKey={refreshCounter}
          />
        ) : appModule === "nfce" ? (
          <NfceCaptacaoView
            empresas={empresas}
            activeEmpresa={activeEmpresa}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNotify={(text, type) => alertStatus(text, type)}
            onNavigateHub={() => setAppModule("hub")}
            refreshKey={refreshCounter}
          />
        ) : appModule === "cte" ? (
          <CteCaptacaoView
            empresas={empresas}
            activeEmpresaId={activeEmpresaId}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNotify={(text, type) => alertStatus(text, type === "info" ? "success" : type)}
            appSettings={null}
            onNavigateHub={() => setAppModule("hub")}
            refreshKey={refreshCounter}
          />
        ) : appModule === "nfse" ? (
          <NfseCaptacaoView
            empresas={empresas}
            activeEmpresa={activeEmpresa}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNotify={(text, type) => alertStatus(text, type)}
            onNavigateHub={() => setAppModule("hub")}
            refreshKey={refreshCounter}
          />
        ) : appModule === "acompanhamento" ? (
          <GuiaAcompanhamentoView
            empresas={empresas}
            activeEmpresa={activeEmpresa}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNavigateHub={() => setAppModule("hub")}
            onNotify={(text, type) => alertStatus(text, type)}
            refreshKey={refreshCounter}
          />
        ) : (
          <DifalView
            empresas={empresas}
            activeEmpresa={activeEmpresa}
            onSelectEmpresa={handleSelectEmpresa}
            onOpenCompanyModal={(tab) => {
              setConfigModalTab(tab || "empresas");
              setIsConfigModalOpen(true);
            }}
            onNotify={(text, type) => alertStatus(text, type)}
            onNavigateHub={() => setAppModule("hub")}
            onNavigateCaptacao={() => setAppModule("captacao")}
            notas={notas}
            itens={itens}
            internalIgnoredCount={internalIgnoredCount}
            detectedCompanyName={detectedCompanyName}
            totalPayable={totalPayable}
            predominantMode={getPredominantModeLabel()}
            cfopMap={cfopMap}
            cfopFileName={cfopFileName}
            config={config}
            onChangeConfig={(updated) => setConfig((prev) => ({ ...prev, ...updated }))}
            emitterRegimes={emitterRegimes}
            onUpdateEmitterRegime={handleUpdateRegime}
            onApplyGlobalToUnconfiguredEmitters={handleApplyGlobalToUnconfigured}
            recipientRegimes={recipientRegimes}
            onUpdateRecipientRegime={handleUpdateRecipientRegime}
            onApplyGlobalToUnconfiguredRecipients={handleApplyGlobalToUnconfiguredRecipients}
            itemConsumerOverrides={itemConsumerOverrides}
            onUpdateItemOverride={handleUpdateItemOverride}
            ncmRateRules={ncmRateRules}
            onAddNcmRule={handleAddNcmRule}
            onUpdateNcmRule={handleUpdateNcmRule}
            onRemoveNcmRule={handleRemoveNcmRule}
            onImportNcmRules={handleImportNcmRules}
            onLoadXmlContents={handleLoadXmlContents}
            onXMLsLoaded={handleXMLsLoaded}
            onCFOPLoaded={handleCFOPLoaded}
            onClear={handleClear}
            onExportNotas={handleExportNotas}
            onExportItens={handleExportItens}
            onOpenReport={() => setIsReportOpen(true)}
            auditStatusSummary={getAuditStatusSummary()}
            uniqueEmitters={getUniqueEmitters()}
            uniqueRecipients={getUniqueRecipients()}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab)}
          />
        )}
  </main>

      <ReportPrintModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        notas={notas}
        itensCount={itens.length}
        totalRecolher={totalPayable}
        defaultCompanyName={detectedCompanyName}
        config={config}
      />

      <OnboardingModal
        isOpen={isTutorialOpen}
        onClose={handleCloseTutorial}
      />

      <UnifiedConfigModal
        isOpen={isConfigModalOpen || isCompanyModalOpen}
        onClose={() => {
          setIsConfigModalOpen(false);
          setIsCompanyModalOpen(false);
        }}
        empresas={empresas}
        onSaveEmpresas={handleSaveEmpresas}
        activeEmpresaId={activeEmpresaId}
        onSelectEmpresa={handleSelectEmpresa}
        initialTab={configModalTab}
        onRefreshXmls={() => {
          setRefreshCounter((prev) => prev + 1);
        }}
      />

      <SyncAllProgressModal
        isOpen={isSyncAllModalOpen}
        onClose={() => setIsSyncAllModalOpen(false)}
        allCompanies={empresas}
        onComplete={() => {
          setRefreshCounter((prev) => prev + 1);
        }}
      />
    </div>
  );
}
