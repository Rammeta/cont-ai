import React, { useState, useEffect, useMemo } from "react";
import { EmpresaSefaz, SefazSyncStatus, CnpjConsultaResult } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import {
  Building2,
  RefreshCw,
  Calendar,
  Settings,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Search,
  Download,
  FileText,
  Copy,
  Check,
  FolderOpen,
  Archive,
  Globe,
  Building,
  ArrowRight,
  Calculator,
  DownloadCloud,
  Sparkles,
  CheckCircle,
  X,
  Info,
  RotateCcw,
  Clock,
  FileSpreadsheet,
} from "lucide-react";
import {
  syncCompanySefaz,
  listCompanyXmls,
  listAvailableMonths,
  onSyncProgress,
  openDanfePdf,
  saveSingleXml,
  exportCompetencia,
  openCompanyFolder,
  consultarCnpj,
  consultarCnpjsLote,
  obterCnpjCache,
  onCnpjConsultaProgress,
  fetchNfeByChave,
  getCompanySefazState,
  resetCompanyNsu,
  getAppSettings,
  onSchedulerTrigger,
  AppSettings,
  readXmlsContent,
  saveCsvFile,
} from "../utils/electronBridge";
import { formatBRL } from "../utils/calc";
import CertificateBadge from "./CertificateBadge";
import logoImg from "../../assets/logo.png";

export interface CapturedNfe {
  name: string;
  fullPath: string;
  folder: string;
  chNFe: string;
  nNF: string;
  serie: string;
  dhEmi: string;
  dhSaiEnt?: string;
  formattedDate: string;
  emitente: string;
  cnpjEmitente: string;
  ufRem: string;
  destinatario: string;
  cnpjDest: string;
  ufDest: string;
  vNF: number;
  vProd?: number;
  vBC?: number;
  vICMS?: number;
  vBCST?: number;
  vST?: number;
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vIPI?: number;
  vPIS?: number;
  vCOFINS?: number;
  vOutro?: number;
  isInterestadual: boolean;
  content?: string;
  modelo?: string;
}

interface CaptacaoViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onSendToDifal: (
    xmls: Array<{ name: string; content: string }>,
    company: EmpresaSefaz
  ) => void;
  onNotify: (text: string, type: "success" | "error") => void;
  onCnpjsUpdated?: (results: Record<string, CnpjConsultaResult>) => void;
  onNavigateHub?: () => void;
  refreshKey?: number;
}

// Helper rápido para extrair campos essenciais do XML sem sobrecarregar a memória
function extractNfeMetadata(xmlText: string, fileName: string, folder: string): CapturedNfe {
  const getTagValue = (tag: string, source: string): string => {
    const match = source.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`));
    return match ? match[1].trim() : "";
  };

  const getSection = (tag: string, source: string): string => {
    const match = source.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\/${tag}>`));
    return match ? match[0] : "";
  };

  const ide = getSection("ide", xmlText);
  const emit = getSection("emit", xmlText);
  const dest = getSection("dest", xmlText);
  const icmsTot = getSection("ICMSTot", xmlText);

  // Chave de 44 dígitos
  const chNFeMatch = xmlText.match(/Id="NFe(\d{44})"/i) || fileName.match(/(\d{44})/);
  const chNFe = chNFeMatch ? chNFeMatch[1] : "";

  const nNF = getTagValue("nNF", ide) || "-";
  const serie = getTagValue("serie", ide) || "1";
  const dhEmi = getTagValue("dhEmi", ide) || getTagValue("dEmi", ide) || "";
  const dhSaiEnt = getTagValue("dhSaiEnt", ide) || getTagValue("dSaiEnt", ide) || "";

  let formattedDate = dhEmi;
  if (dhEmi) {
    try {
      const d = new Date(dhEmi);
      if (!isNaN(d.getTime())) {
        formattedDate = d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      }
    } catch {
      // mantém dhEmi
    }
  }

  const emitente = getTagValue("xNome", emit) || "Emitente Desconhecido";
  const cnpjEmitente = getTagValue("CNPJ", emit) || getTagValue("CPF", emit) || "";
  const ufRem = getTagValue("UF", getSection("enderEmit", emit)) || "";

  const destinatario = getTagValue("xNome", dest) || "";
  const cnpjDest = getTagValue("CNPJ", dest) || getTagValue("CPF", dest) || "";
  const ufDest = getTagValue("UF", getSection("enderDest", dest)) || "";

  const vNFStr = getTagValue("vNF", icmsTot) || "0";
  const vNF = parseFloat(vNFStr) || 0;
  const vProd = parseFloat(getTagValue("vProd", icmsTot) || "0") || 0;
  const vBC = parseFloat(getTagValue("vBC", icmsTot) || "0") || 0;
  const vICMS = parseFloat(getTagValue("vICMS", icmsTot) || "0") || 0;
  const vBCST = parseFloat(getTagValue("vBCST", icmsTot) || "0") || 0;
  const vST = parseFloat(getTagValue("vST", icmsTot) || "0") || 0;
  const vFrete = parseFloat(getTagValue("vFrete", icmsTot) || "0") || 0;
  const vSeg = parseFloat(getTagValue("vSeg", icmsTot) || "0") || 0;
  const vDesc = parseFloat(getTagValue("vDesc", icmsTot) || "0") || 0;
  const vIPI = parseFloat(getTagValue("vIPI", icmsTot) || "0") || 0;
  const vPIS = parseFloat(getTagValue("vPIS", icmsTot) || "0") || 0;
  const vCOFINS = parseFloat(getTagValue("vCOFINS", icmsTot) || "0") || 0;
  const vOutro = parseFloat(getTagValue("vOutro", icmsTot) || "0") || 0;

  const isInterestadual = !!(ufRem && ufDest && ufRem.toUpperCase() !== ufDest.toUpperCase());

  return {
    name: fileName,
    fullPath: "",
    folder,
    chNFe,
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
    vProd,
    vBC,
    vICMS,
    vBCST,
    vST,
    vFrete,
    vSeg,
    vDesc,
    vIPI,
    vPIS,
    vCOFINS,
    vOutro,
    isInterestadual,
    content: xmlText,
  };
}

// Helper para determinar a Competência Fiscal de uma NF-e de Entrada
export function getNotaCompetencia(n: {
  folder?: string;
  dhSaiEnt?: string;
  chNFe?: string;
  dhEmi?: string;
}): string {
  // 1. Se pasta for YYYY-MM
  if (n.folder && /^\d{4}-\d{2}$/.test(n.folder)) {
    return n.folder;
  }
  // 2. Data de Saída / Entrada (dhSaiEnt) é a competência fiscal legal da entrada
  if (n.dhSaiEnt && /^\d{4}-\d{2}/.test(n.dhSaiEnt)) {
    return n.dhSaiEnt.substring(0, 7);
  }
  // 3. Chave de acesso de 44 dígitos (posições 2 a 6 representam AAMM da emissão)
  if (n.chNFe && n.chNFe.length === 44) {
    const yy = n.chNFe.substring(2, 4);
    const mm = n.chNFe.substring(4, 6);
    if (/^\d{2}$/.test(yy) && /^(0[1-9]|1[0-2])$/.test(mm)) {
      return `20${yy}-${mm}`;
    }
  }
  // 4. Data de Emissão (dhEmi)
  if (n.dhEmi && /^\d{4}-\d{2}/.test(n.dhEmi)) {
    return n.dhEmi.substring(0, 7);
  }
  return "";
}

export default function CaptacaoView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onOpenCompanyModal,
  onSendToDifal,
  onNotify,
  onCnpjsUpdated,
  onNavigateHub,
  refreshKey,
}: CaptacaoViewProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [capturedNotas, setCapturedNotas] = useState<CapturedNfe[]>([]);
  const [loadingXmls, setLoadingXmls] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados para seleção de linha, limite de exibição e StatusBar
  const [selectedChave, setSelectedChave] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  // Estados da consulta cadastral de CNPJ / Simples Nacional
  const [cnpjDataMap, setCnpjDataMap] = useState<Record<string, CnpjConsultaResult>>({});
  const [consultandoLote, setConsultandoLote] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState<{ current: number; total: number; cnpj: string; razao?: string } | null>(null);
  const [consultandoIndiv, setConsultandoIndiv] = useState<Record<string, boolean>>({});
  const [selectedCnpjModal, setSelectedCnpjModal] = useState<CnpjConsultaResult | null>(null);

  // Filtros da tabela
  const [searchTerm, setSearchTerm] = useState("");
  const [routeFilter, setRouteFilter] = useState<"all" | "interestadual" | "interna">("all");
  const [tableMonthFilter, setTableMonthFilter] = useState<string>("all");
  const [dataInicioFilter, setDataInicioFilter] = useState<string>("");
  const [dataFimFilter, setDataFimFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<string>("dataEmissao");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleHeaderSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Estados para Exportação por Período
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportMode, setExportMode] = useState<"periodo" | "competencia" | "filtradas">("periodo");
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportSelectedMonth, setExportSelectedMonth] = useState("all");
  const [exportTypeChoice, setExportTypeChoice] = useState<"all" | "xml" | "pdf">("all");

  // Status da sincronização com a SEFAZ
  const [syncStatus, setSyncStatus] = useState<SefazSyncStatus>({
    syncing: false,
    message: "",
  });

  // Estados para Busca pontual por Chave de Acesso
  const [showSearchChaveModal, setShowSearchChaveModal] = useState(false);
  const [chaveInput, setChaveInput] = useState("");
  const [searchingChave, setSearchingChave] = useState(false);
  const [searchChaveResult, setSearchChaveResult] = useState<any | null>(null);

  // Estados para Gestão e Reinício de NSU
  const [nsuState, setNsuState] = useState<{
    ultNSU: string;
    maxNSU: string;
    lastSyncTime?: string | null;
    lastCStat?: string | null;
    blockedUntil?: string | null;
    isBlocked?: boolean;
    remainingMinutes?: number;
    remainingSeconds?: number;
  } | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);
  const [showForceModal, setShowForceModal] = useState(false);

  const [showResetNsuModal, setShowResetNsuModal] = useState(false);
  const [targetNsuInput, setTargetNsuInput] = useState("0");
  const [clearManifOption, setClearManifOption] = useState(false);
  const [clearFilesOption, setClearFilesOption] = useState(false);
  const [syncNowOption, setSyncNowOption] = useState(true);
  const [resettingNsu, setResettingNsu] = useState(false);

  // Estados de Configurações e Agendador
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Carrega configurações do app e escuta disparo do agendador em background
  useEffect(() => {
    getAppSettings().then((st) => {
      if (st) setAppSettings(st);
    });

    const unsubscribe = onSchedulerTrigger((payload?: any) => {
      if (!payload || payload.type === "sefaz" || payload.type === "nfe") {
        if (activeEmpresa?.modelosHabilitados && activeEmpresa.modelosHabilitados.nfe === false) {
          return;
        }
        onNotify(`Horário agendado atingido (${payload?.time || "diário"}): busca de NF-e disparada!`, "success");
        if (activeEmpresa && activeEmpresa.certPath && !syncStatus.syncing) {
          handleSyncSefaz();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeEmpresa, selectedMonth, syncStatus.syncing, refreshKey]);

  // Timer de Cooldown em tempo real (Anti-656 NT 2014.002)
  useEffect(() => {
    if (!nsuState?.blockedUntil) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const diffMs = new Date(nsuState.blockedUntil!).getTime() - Date.now();
      const secs = Math.max(0, Math.ceil(diffMs / 1000));
      setCooldownRemaining(secs);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [nsuState?.blockedUntil]);

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, "0")}s`;
  };

  // Atualização do relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitoramento de CAPS LOCK e NUM LOCK em tempo real
  useEffect(() => {
    const handleModifiers = (e: KeyboardEvent | MouseEvent) => {
      if (e && typeof (e as any).getModifierState === "function") {
        setIsCapsLockOn((e as any).getModifierState("CapsLock"));
        setIsNumLockOn((e as any).getModifierState("NumLock"));
      }
    };
    window.addEventListener("keydown", handleModifiers);
    window.addEventListener("keyup", handleModifiers);
    window.addEventListener("mousemove", handleModifiers);
    return () => {
      window.removeEventListener("keydown", handleModifiers);
      window.removeEventListener("keyup", handleModifiers);
      window.removeEventListener("mousemove", handleModifiers);
    };
  }, []);

  // Carrega cache de CNPJs na inicialização
  useEffect(() => {
    obterCnpjCache().then((cache) => {
      if (cache) {
        setCnpjDataMap(cache);
        if (onCnpjsUpdated && Object.keys(cache).length > 0) {
          onCnpjsUpdated(cache);
        }
      }
    });
  }, []);

  // Listener para progresso de consulta em lote de CNPJ
  useEffect(() => {
    const unsubscribe = onCnpjConsultaProgress((info) => {
      setLoteProgresso({
        current: info.current,
        total: info.total,
        cnpj: info.cnpj,
        razao: info.razao,
      });
    });
    return unsubscribe;
  }, []);

  // Atualiza meses disponíveis, estado do NSU e carrega XMLs ao mudar empresa
  useEffect(() => {
    if (activeEmpresa) {
      listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial).then((months) => {
        setAvailableMonths(months);
      });
      loadXmlsForCompany(activeEmpresa.cnpj, selectedMonth, activeEmpresa.razaoSocial);
      loadNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
    } else {
      setAvailableMonths([]);
      setCapturedNotas([]);
      setNsuState(null);
    }
  }, [activeEmpresa, selectedMonth, refreshKey]);

  // Listener para progresso de sincronização com SEFAZ
  useEffect(() => {
    const unsubscribe = onSyncProgress((info) => {
      setSyncStatus((prev) => ({
        ...prev,
        message: info.message || prev.message,
      }));
    });
    return unsubscribe;
  }, []);

  const loadNsuState = async (cnpj: string, razaoSocial?: string) => {
    try {
      const res = await getCompanySefazState(cnpj, razaoSocial);
      if (res.success && res.result) {
        setNsuState(res.result);
      }
    } catch (e) {}
  };

  const loadXmlsForCompany = async (cnpj: string, month: string, razaoSocial?: string) => {
    setLoadingXmls(true);
    try {
      const monthFilter = month === "all" ? undefined : month;
      const xmls = await listCompanyXmls(cnpj, monthFilter, razaoSocial);
      // Filtra estritamente para Modelo 55 (NF-e Entradas), descartando Modelo 57 (CT-e) ou Modelo 65 (NFC-e)
      const nfeOnly = (xmls as CapturedNfe[]).filter((n) => {
        if (n.modelo && n.modelo !== "55") return false;
        if (n.name && n.name.toLowerCase().endsWith("-cte.xml")) return false;
        if (n.chNFe && n.chNFe.length === 44 && n.chNFe.substring(20, 22) === "57") return false;
        return true;
      });
      setCapturedNotas(nfeOnly);
    } catch (err: any) {
      console.warn("Erro ao listar XMLs:", err.message);
      setCapturedNotas([]);
    } finally {
      setLoadingXmls(false);
    }
  };

  // Notas filtradas pelo período/competência selecionado na tabela
  const notasPeriodo = useMemo(() => {
    return capturedNotas.filter((n) => {
      const comp = getNotaCompetencia(n);
      if (tableMonthFilter !== "all") {
        if (comp !== tableMonthFilter) return false;
      }
      if (dataInicioFilter || dataFimFilter) {
        const rawDate = comp ? `${comp}-01` : (n.dhEmi ? n.dhEmi.substring(0, 10) : "");
        if (rawDate) {
          if (dataInicioFilter && rawDate < dataInicioFilter) return false;
          if (dataFimFilter && rawDate > dataFimFilter) return false;
        }
      }
      return true;
    });
  }, [capturedNotas, tableMonthFilter, dataInicioFilter, dataFimFilter]);

  // Métricas calculadas respeitando o período filtrado
  const metrics = useMemo(() => {
    let totalValor = 0;
    let interestaduaisCount = 0;
    let internasCount = 0;
    const emitentesSet = new Set<string>();

    for (const n of notasPeriodo) {
      totalValor += n.vNF;
      if (n.isInterestadual) {
        interestaduaisCount++;
      } else {
        internasCount++;
      }
      if (n.cnpjEmitente) emitentesSet.add(n.cnpjEmitente);
    }

    return {
      totalNotas: notasPeriodo.length,
      totalValor,
      interestaduaisCount,
      internasCount,
      totalEmitentes: emitentesSet.size,
    };
  }, [notasPeriodo]);

  // Sincronização com a SEFAZ
  const handleSyncSefaz = async (
    options?: { resetNsu?: boolean; clearManifestations?: boolean; targetNsu?: string; forceSync?: boolean } | any
  ) => {
    if (!activeEmpresa) {
      onNotify("Selecione ou cadastre uma empresa primeiro.", "error");
      return;
    }
    if (!activeEmpresa.certPath) {
      onNotify("A empresa selecionada não possui arquivo de certificado vinculado.", "error");
      return;
    }

    // Se options for um SyntheticEvent do React (ex: chamado de onClick direto), descarta o evento
    const isReactEvent = options && (options.nativeEvent || options._reactName || typeof options.preventDefault === "function");
    const cleanOptions = isReactEvent ? undefined : options;

    // Se estiver em período de repouso e não estiver forçando, abre modal de confirmação
    if (cooldownRemaining > 0 && !cleanOptions?.forceSync) {
      setShowForceModal(true);
      return;
    }

    setSyncStatus({
      syncing: true,
      message: "Conectando à SEFAZ Nacional...",
    });

    try {
      const res = await syncCompanySefaz(activeEmpresa, cleanOptions);
      if (res.isCooldown) {
        setSyncStatus({
          syncing: false,
          message: "",
          error: res.error,
        });
        onNotify(res.error, "error");
        await loadNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
        return;
      }
      if (res.success) {
        setSyncStatus({
          syncing: false,
          message: `Sincronização concluída! ${res.result.totalBaixadas} nova(s) nota(s) baixada(s).`,
          totalBaixadas: res.result.totalBaixadas,
          totalManifestadas: res.result.totalManifestadas,
        });
        onNotify(`SEFAZ Sincronizada com sucesso! ${res.result.totalBaixadas} nova(s) NF-e baixada(s).`, "success");
        // Recarrega os meses, os XMLs e o estado do NSU
        const months = await listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
        setAvailableMonths(months);
        await loadXmlsForCompany(activeEmpresa.cnpj, selectedMonth, activeEmpresa.razaoSocial);
        await loadNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      } else {
        setSyncStatus({
          syncing: false,
          message: "",
          error: res.error || "Erro desconhecido ao sincronizar com a SEFAZ.",
        });
        onNotify(res.error || "Erro ao consultar a SEFAZ.", "error");
        await loadNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      }
    } catch (err: any) {
      setSyncStatus({
        syncing: false,
        message: "",
        error: err.message,
      });
      onNotify(`Falha na sincronização: ${err.message}`, "error");
      await loadNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
    }
  };

  // Confirmação de Reinício de NSU
  const handleResetNsuConfirm = async () => {
    if (!activeEmpresa) return;

    setResettingNsu(true);
    try {
      const res = await resetCompanyNsu(activeEmpresa.cnpj, targetNsuInput, clearManifOption, activeEmpresa.razaoSocial, clearFilesOption);
      if (res.success) {
        setNsuState({
          ultNSU: res.ultNSU || targetNsuInput,
          maxNSU: res.maxNSU || nsuState?.maxNSU || "0",
        });
        if (clearFilesOption) {
          setCapturedNotas([]);
          listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial).then((m) => setAvailableMonths(m));
        }
        setShowResetNsuModal(false);

        if (syncNowOption) {
          onNotify(`NSU reiniciado para ${targetNsuInput}. Iniciando busca completa na SEFAZ...`, "success");
          handleSyncSefaz();
        } else {
          onNotify(`NSU reiniciado com sucesso para ${targetNsuInput}.`, "success");
        }
      } else {
        onNotify(res.error || "Falha ao reiniciar NSU.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao reiniciar NSU: ${err.message}`, "error");
    } finally {
      setResettingNsu(false);
    }
  };

  // Busca pontual por Chave de Acesso
  const handleSearchByChave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = chaveInput.replace(/\D/g, "");
    if (cleanKey.length !== 44) {
      onNotify("A chave de acesso deve ter exatamente 44 dígitos numéricos.", "error");
      return;
    }
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa primeiro.", "error");
      return;
    }

    setSearchingChave(true);
    setSearchChaveResult(null);
    try {
      const res = await fetchNfeByChave(activeEmpresa, cleanKey);
      if (res.success && res.result) {
        setSearchChaveResult(res.result);
        onNotify(`NF-e capturada e DANFE gerado com sucesso! Emitente: ${res.result.emitente}`, "success");
        // Recarregar os meses e os XMLs
        const months = await listAvailableMonths(activeEmpresa.cnpj);
        setAvailableMonths(months);
        await loadXmlsForCompany(activeEmpresa.cnpj, selectedMonth);
      } else {
        onNotify(res.error || "Falha ao buscar NF-e na SEFAZ.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro na busca: ${err.message}`, "error");
    } finally {
      setSearchingChave(false);
    }
  };

  // Exportação por competência
  const handleExport = async (exportType: "all" | "xml" | "pdf") => {
    if (!activeEmpresa) return;
    if (capturedNotas.length === 0) {
      onNotify("Não há notas fiscais no período para exportar.", "error");
      return;
    }

    setExporting(true);
    try {
      const res = await exportCompetencia(
        activeEmpresa.cnpj,
        activeEmpresa.razaoSocial,
        selectedMonth,
        exportType
      );

      if (res.canceled) {
        setExporting(false);
        return;
      }

      if (res.success) {
        const typeLabel = exportType === "all" ? "Pacote Completo (XMLs + DANFEs)" : exportType === "pdf" ? "DANFEs (PDFs)" : "XMLs";
        onNotify(`${typeLabel} exportado com sucesso! ${res.fileCount} arquivo(s) salvos no .ZIP.`, "success");
      } else {
        onNotify(res.error || "Erro ao exportar arquivos.", "error");
      }
    } catch (err: any) {
      onNotify(`Falha ao exportar: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // Exportação customizada por período / competência / notas filtradas
  const handleExportCustom = async () => {
    if (!activeEmpresa) return;
    setExporting(true);
    try {
      let specificKeys: string[] | undefined = undefined;
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;
      let periodLabel: string | undefined = undefined;
      let targetMonth = selectedMonth;

      if (exportMode === "periodo") {
        if (!exportStartDate && !exportEndDate) {
          onNotify("Informe ao menos a data inicial ou a data final para o período.", "error");
          setExporting(false);
          return;
        }
        startDate = exportStartDate || undefined;
        endDate = exportEndDate || undefined;
        periodLabel = startDate && endDate ? `${startDate}_a_${endDate}` : startDate ? `a_partir_de_${startDate}` : `ate_${endDate}`;
        targetMonth = "all";
      } else if (exportMode === "competencia") {
        targetMonth = exportSelectedMonth;
        periodLabel = targetMonth === "all" ? "Todas_Competencias" : `Competencia_${targetMonth.replace("/", "-")}`;
      } else if (exportMode === "filtradas") {
        if (filteredNotas.length === 0) {
          onNotify("Não há notas filtradas para exportar.", "error");
          setExporting(false);
          return;
        }
        specificKeys = filteredNotas.map((n) => n.chNFe).filter(Boolean);
        periodLabel = `Filtro_Personalizado_${specificKeys.length}_notas`;
      }

      const res = await exportCompetencia(
        activeEmpresa.cnpj,
        activeEmpresa.razaoSocial,
        targetMonth,
        exportTypeChoice,
        {
          specificKeys,
          startDate,
          endDate,
          periodLabel,
        }
      );

      if (res.canceled) {
        setExporting(false);
        return;
      }

      if (res.success) {
        const typeLabel =
          exportTypeChoice === "all"
            ? "Pacote Completo (XMLs + DANFEs)"
            : exportTypeChoice === "pdf"
            ? "DANFEs (PDFs)"
            : "XMLs";
        onNotify(`${typeLabel} exportado com sucesso! ${res.fileCount} arquivo(s) salvos no .ZIP.`, "success");
        setShowExportModal(false);
      } else {
        onNotify(res.error || "Erro ao exportar arquivos.", "error");
      }
    } catch (err: any) {
      onNotify(`Falha ao exportar: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // Exportar Relatório em Planilha CSV / Excel
  const handleExportCsv = async () => {
    if (filteredNotas.length === 0) {
      onNotify("Nenhuma nota fiscal encontrada para exportar o relatório.", "error");
      return;
    }

    const formatMoeda = (val?: number) => {
      if (val == null || isNaN(val)) return "0,00";
      return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const formatDoc = (doc?: string) => {
      if (!doc) return "";
      const d = String(doc).replace(/\D/g, "");
      if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
      if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
      return doc;
    };

    const headers = [
      "Competência",
      "Data Emissão",
      "Número NF",
      "Série",
      "Chave de Acesso",
      "Emitente (Fornecedor)",
      "CNPJ Emitente",
      "UF Origem",
      "Destinatário",
      "CNPJ Destinatário",
      "UF Destino",
      "Operação",
      "Valor dos Produtos",
      "Valor Frete",
      "Valor Seguro",
      "Desconto",
      "Outras Despesas",
      "Base ICMS",
      "Valor ICMS",
      "Valor ST",
      "Valor IPI",
      "Valor PIS",
      "Valor COFINS",
      "Valor Total NF"
    ];

    let totProd = 0, totFrete = 0, totSeg = 0, totDesc = 0, totOutro = 0, totBC = 0, totICMS = 0, totST = 0, totIPI = 0, totPIS = 0, totCOFINS = 0, totNF = 0;

    const rows = filteredNotas.map((n) => {
      const vProd = n.vProd || 0;
      const vFrete = n.vFrete || 0;
      const vSeg = n.vSeg || 0;
      const vDesc = n.vDesc || 0;
      const vOutro = n.vOutro || 0;
      const vBC = n.vBC || 0;
      const vICMS = n.vICMS || 0;
      const vST = n.vST || 0;
      const vIPI = n.vIPI || 0;
      const vPIS = n.vPIS || 0;
      const vCOFINS = n.vCOFINS || 0;
      const vNF = n.vNF || 0;

      totProd += vProd;
      totFrete += vFrete;
      totSeg += vSeg;
      totDesc += vDesc;
      totOutro += vOutro;
      totBC += vBC;
      totICMS += vICMS;
      totST += vST;
      totIPI += vIPI;
      totPIS += vPIS;
      totCOFINS += vCOFINS;
      totNF += vNF;

      const comp = n.folder && n.folder !== "indefinido" ? n.folder : (n.dhEmi ? n.dhEmi.substring(0, 7) : "-");
      const chaveExcel = n.chNFe ? `="${n.chNFe}"` : '""';
      const escape = (txt: string) => `"${String(txt || "").replace(/"/g, '""')}"`;

      return [
        escape(comp),
        escape(n.formattedDate || n.dhEmi || "-"),
        escape(n.nNF || "-"),
        escape(n.serie || "1"),
        chaveExcel,
        escape(n.emitente || ""),
        escape(formatDoc(n.cnpjEmitente)),
        escape(n.ufRem || ""),
        escape(n.destinatario || ""),
        escape(formatDoc(n.cnpjDest)),
        escape(n.ufDest || ""),
        escape(n.isInterestadual ? "Interestadual" : "Interna"),
        escape(formatMoeda(vProd)),
        escape(formatMoeda(vFrete)),
        escape(formatMoeda(vSeg)),
        escape(formatMoeda(vDesc)),
        escape(formatMoeda(vOutro)),
        escape(formatMoeda(vBC)),
        escape(formatMoeda(vICMS)),
        escape(formatMoeda(vST)),
        escape(formatMoeda(vIPI)),
        escape(formatMoeda(vPIS)),
        escape(formatMoeda(vCOFINS)),
        escape(formatMoeda(vNF))
      ].join(";");
    });

    const linhaTotais = [
      '"TOTAIS"',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      `"${filteredNotas.length} nota(s)"`,
      `"${formatMoeda(totProd)}"`,
      `"${formatMoeda(totFrete)}"`,
      `"${formatMoeda(totSeg)}"`,
      `"${formatMoeda(totDesc)}"`,
      `"${formatMoeda(totOutro)}"`,
      `"${formatMoeda(totBC)}"`,
      `"${formatMoeda(totICMS)}"`,
      `"${formatMoeda(totST)}"`,
      `"${formatMoeda(totIPI)}"`,
      `"${formatMoeda(totPIS)}"`,
      `"${formatMoeda(totCOFINS)}"`,
      `"${formatMoeda(totNF)}"`
    ].join(";");

    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...rows, linhaTotais].join("\r\n");
    const periodoSlug = selectedMonth === "all" ? "geral" : selectedMonth;
    const defaultName = `relatorio_nfe_entradas_${activeEmpresa?.cnpj || "empresa"}_${periodoSlug}.csv`;

    const res = await saveCsvFile(defaultName, csvContent, "Salvar Relatório de NF-e Entradas (.csv)");
    if (res.canceled) return;
    if (res.success) {
      onNotify(`Relatório em Planilha Excel exportado com sucesso! (${filteredNotas.length} notas)`, "success");
    } else {
      onNotify(res.error || "Erro ao exportar planilha CSV.", "error");
    }
  };

  // Abrir pasta no Explorer
  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    await openCompanyFolder(activeEmpresa.cnpj, undefined, activeEmpresa.razaoSocial);
  };

  // Abrir DANFE PDF
  const handleOpenDanfe = async (nota: CapturedNfe) => {
    if (!activeEmpresa) return;
    if (!nota.chNFe) {
      onNotify("Chave da NF-e não identificada.", "error");
      return;
    }
    const res = await openDanfePdf(activeEmpresa.cnpj, nota.chNFe, nota.folder, activeEmpresa.razaoSocial);
    if (!res.success) {
      onNotify(res.error || "Não foi possível abrir o PDF do DANFE.", "error");
    }
  };

  // Salvar XML individual
  const handleSaveXml = async (nota: CapturedNfe) => {
    if (!activeEmpresa) return;
    const res = await saveSingleXml(activeEmpresa.cnpj, nota.chNFe, nota.folder);
    if (res.canceled) return;
    if (res.success) {
      onNotify("Arquivo XML salvo com sucesso!", "success");
    } else {
      onNotify(res.error || "Erro ao salvar o arquivo XML.", "error");
    }
  };

  // Copiar chave de 44 dígitos
  const handleCopyKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Competências disponíveis entre as notas carregadas
  const uniqueTableMonths = useMemo(() => {
    const set = new Set<string>();
    for (const n of capturedNotas) {
      const m = getNotaCompetencia(n);
      if (m && m.length === 7) set.add(m);
    }
    return Array.from(set).sort().reverse();
  }, [capturedNotas]);

  // Filtragem da tabela
  const filteredNotas = useMemo(() => {
    return notasPeriodo.filter((n) => {
      // Filtro de Rota
      if (routeFilter === "interestadual" && !n.isInterestadual) return false;
      if (routeFilter === "interna" && n.isInterestadual) return false;

      // Busca textual inteligente
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        const numQuery = term.replace(/^(n[º°o]?|nf(?:-?e)?|#)\s*/i, "").trim();
        const isShortNumeric = /^\d{1,10}$/.test(numQuery);
        const cnpjDigits = String(n.cnpjEmitente || "").replace(/\D/g, "");

        if (isShortNumeric) {
          const normDocNum = String(n.nNF || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
          const normQuery = numQuery.replace(/^0+/, "") || "0";
          const rawDocDigits = String(n.nNF || "").replace(/\D/g, "");
          const numMatch =
            normDocNum === normQuery ||
            normDocNum.startsWith(normQuery) ||
            rawDocDigits === numQuery;
          const cnpjMatch = numQuery.length >= 8 && cnpjDigits.includes(numQuery);
          return numMatch || cnpjMatch;
        }

        const termDigits = term.replace(/\D/g, "");
        const matches =
          (n.nNF || "").toLowerCase().includes(term) ||
          (n.emitente || "").toLowerCase().includes(term) ||
          (n.cnpjEmitente || "").toLowerCase().includes(term) ||
          (termDigits.length >= 6 && cnpjDigits.includes(termDigits)) ||
          (n.chNFe || "").toLowerCase().includes(term) ||
          (termDigits.length >= 11 && (n.chNFe || "").includes(termDigits)) ||
          (n.ufRem || "").toLowerCase().includes(term) ||
          (n.ufDest || "").toLowerCase().includes(term);
        if (!matches) return false;
      }

      return true;
    });
  }, [notasPeriodo, routeFilter, searchTerm]);

  // Ação: Calcular DIFAL das interestaduais do período selecionado (carrega XMLs sob demanda)
  const handleCalculateDifal = async () => {
    if (!activeEmpresa) return;
    const interestadualNotas = notasPeriodo.filter(
      (n) => n.isInterestadual && (!n.modelo || n.modelo === "55") && !n.name?.toLowerCase().endsWith("-cte.xml")
    );

    if (interestadualNotas.length === 0) {
      onNotify("Nenhuma nota interestadual encontrada neste período para cálculo do DIFAL.", "error");
      return;
    }

    try {
      const paths = interestadualNotas.map((n) => n.fullPath).filter(Boolean);
      let xmlsWithContent: Array<{ name: string; content: string }> = [];

      if (paths.length > 0) {
        xmlsWithContent = await readXmlsContent(paths);
      }

      if (xmlsWithContent.length === 0) {
        xmlsWithContent = interestadualNotas
          .filter((n) => n.content)
          .map((n) => ({ name: n.name, content: n.content! }));
      }

      if (xmlsWithContent.length === 0) {
        onNotify("Não foi possível carregar os arquivos XML das notas interestaduais.", "error");
        return;
      }

      onSendToDifal(xmlsWithContent, activeEmpresa);
    } catch (err: any) {
      onNotify(`Erro ao carregar XMLs para o cálculo: ${err.message}`, "error");
    }
  };

  // CNPJs de emitentes das notas filtradas que ainda não foram consultados no Portal RFB
  const pendingCnpjs = useMemo(() => {
    const set = new Set<string>();
    for (const n of filteredNotas) {
      const clean = (n.cnpjEmitente || "").replace(/\D/g, "");
      if (
        clean.length === 14 &&
        (!cnpjDataMap[clean] || !cnpjDataMap[clean].sucesso || !cnpjDataMap[clean].consultado_portal_rfb)
      ) {
        set.add(clean);
      }
    }
    return Array.from(set);
  }, [filteredNotas, cnpjDataMap]);

  // Todos os CNPJs únicos visíveis no filtro atual (para permitir reconsulta direta no Portal RFB)
  const allFilteredCnpjs = useMemo(() => {
    const set = new Set<string>();
    for (const n of filteredNotas) {
      const clean = (n.cnpjEmitente || "").replace(/\D/g, "");
      if (clean.length === 14) set.add(clean);
    }
    return Array.from(set);
  }, [filteredNotas]);

  // Consulta em lote de fornecedores do período filtrado direto no Portal do Simples Nacional
  const handleConsultarLote = async (forceRefresh: boolean = false) => {
    const targetList = forceRefresh ? allFilteredCnpjs : pendingCnpjs;
    if (targetList.length === 0) {
      onNotify("Todos os fornecedores do período filtrado já foram consultados no Portal do Simples Nacional!", "success");
      return;
    }
    setConsultandoLote(true);
    setLoteProgresso({ current: 0, total: targetList.length, cnpj: "" });

    try {
      const results = await consultarCnpjsLote(targetList, forceRefresh);
      setCnpjDataMap((prev) => {
        const updated = { ...prev, ...results };
        if (onCnpjsUpdated) onCnpjsUpdated(updated);
        return updated;
      });
      const totalConsultados = Object.keys(results).length;
      const sucessos = Object.values(results).filter((r: any) => r && r.sucesso).length;
      const instaveis = totalConsultados - sucessos;
      if (instaveis > 0) {
        onNotify(
          `Consulta concluída: ${sucessos} fornecedor(es) consultados. ${instaveis} apresentaram instabilidade no Portal da Receita Federal (tente novamente mais tarde).`,
          sucessos > 0 ? "success" : "error"
        );
      } else {
        onNotify(
          `Consulta no Portal do Simples Nacional (RFB) concluída com sucesso para todos os ${totalConsultados} fornecedor(es)!`,
          "success"
        );
      }
    } catch (err: any) {
      onNotify(`Instabilidade na consulta ao Portal da Receita Federal: ${err.message}`, "error");
    } finally {
      setConsultandoLote(false);
      setLoteProgresso(null);
    }
  };

  // Consulta individual de um fornecedor direto no Portal do Simples Nacional
  const handleConsultarIndividual = async (cnpjRaw: string, forceRefresh: boolean = false) => {
    const clean = String(cnpjRaw || "").replace(/\D/g, "");
    if (clean.length !== 14) return;
    setConsultandoIndiv((prev) => ({ ...prev, [clean]: true }));
    try {
      const res = await consultarCnpj(clean, forceRefresh);
      setCnpjDataMap((prev) => {
        const updated = { ...prev, [clean]: res };
        if (onCnpjsUpdated) onCnpjsUpdated(updated);
        return updated;
      });
      if (selectedCnpjModal && selectedCnpjModal.cnpj.replace(/\D/g, "") === clean && res.sucesso) {
        setSelectedCnpjModal(res);
      }
      if (res && res.sucesso) {
        onNotify(`Status RFB de ${res.razao_social || clean}: ${res.opcao_simples || "Consultado"}`, "success");
      } else {
        onNotify(
          res?.erro ||
            "Instabilidade no Portal do Simples Nacional da Receita Federal. Não foi possível verificar o enquadramento oficial no momento.",
          "error"
        );
      }
    } catch (err: any) {
      onNotify(`Instabilidade no Portal da Receita Federal: ${err.message}`, "error");
    } finally {
      setConsultandoIndiv((prev) => ({ ...prev, [clean]: false }));
    }
  };

  // Helper para renderizar o badge de Simples Nacional do emitente
  const renderSimplesBadge = (cnpjRaw: string) => {
    const clean = String(cnpjRaw || "").replace(/\D/g, "");
    if (!clean || clean.length !== 14) return null;

    const info = cnpjDataMap[clean];
    const isConsultando = consultandoIndiv[clean];

    if (isConsultando) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-600 animate-pulse border border-slate-200">
          <RefreshCw size={9} className="animate-spin text-blue-600" />
          Portal RFB...
        </span>
      );
    }

    if (info && info.sucesso && info.consultado_portal_rfb) {
      if (info.opcao_simei_raw) {
        return (
          <button
            type="button"
            onClick={() => setSelectedCnpjModal(info)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition-all cursor-pointer shadow-xs"
            title={`${info.opcao_simei || "MEI"} · Consultado no Portal RFB (${info.data_consulta_portal || "hoje"}) · Clique para detalhes`}
          >
            <Sparkles size={9} className="text-amber-700" />
            <span>MEI (SIMEI)</span>
          </button>
        );
      }

      if (info.opcao_simples_raw) {
        return (
          <button
            type="button"
            onClick={() => setSelectedCnpjModal(info)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 transition-all cursor-pointer shadow-xs"
            title={`${info.opcao_simples || "Optante pelo Simples Nacional"} · Consultado no Portal RFB (${info.data_consulta_portal || "hoje"}) · Clique para detalhes`}
          >
            <CheckCircle size={9} className="text-emerald-700" />
            <span>Simples Nacional</span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => setSelectedCnpjModal(info)}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-blue-100 text-blue-900 border border-blue-300 hover:bg-blue-200 transition-all cursor-pointer shadow-xs"
          title={`${info.opcao_simples || "NÃO Optante"} (Regime Normal) · Consultado no Portal RFB (${info.data_consulta_portal || "hoje"}) · Clique para detalhes`}
        >
          <Building2 size={9} className="text-blue-700" />
          <span>Regime Normal</span>
        </button>
      );
    }

    if (info && !info.sucesso) {
      return (
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleConsultarIndividual(clean, true)}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 transition-all cursor-pointer"
            title={info.erro || "Instabilidade no Portal da Receita Federal. Clique para tentar novamente."}
          >
            <AlertCircle size={9} className="text-amber-700" />
            <span>Portal Instável</span>
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleConsultarIndividual(clean, true)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer"
        title="Consultar diretamente no Portal do Simples Nacional da Receita Federal"
      >
        <Search size={9} />
        <span>Consultar SN</span>
      </button>
    );
  };

  // Ordenação das notas (menor para o maior / maior para o menor)
  const sortedNotas = useMemo(() => {
    return [...filteredNotas].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      switch (sortColumn) {
        case "numero":
          valA = Number(String(a.nNF || "0").replace(/\D/g, "")) || 0;
          valB = Number(String(b.nNF || "0").replace(/\D/g, "")) || 0;
          break;
        case "dataEmissao":
          valA = a.dhEmi || a.formattedDate || "";
          valB = b.dhEmi || b.formattedDate || "";
          break;
        case "emitente":
          valA = (a.emitente || "").toLowerCase();
          valB = (b.emitente || "").toLowerCase();
          break;
        case "cnpj":
          valA = (a.cnpjEmitente || "").replace(/\D/g, "");
          valB = (b.cnpjEmitente || "").replace(/\D/g, "");
          break;
        case "rota":
          valA = (a.ufEmitente || "").toLowerCase();
          valB = (b.ufEmitente || "").toLowerCase();
          break;
        case "valorProd":
          valA = Number(a.vProd) || 0;
          valB = Number(b.vProd) || 0;
          break;
        case "valorTotal":
          valA = Number(a.vNF) || 0;
          valB = Number(b.vNF) || 0;
          break;
        default:
          valA = "";
          valB = "";
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredNotas, sortColumn, sortDirection]);

  // Notas fatiadas com base no limite de exibição para máxima performance
  const displayedNotas = useMemo(() => {
    return sortedNotas.slice(0, displayLimit);
  }, [sortedNotas, displayLimit]);

  // Nota selecionada na grid
  const selectedNota = useMemo(() => {
    return filteredNotas.find((n) => n.chNFe === selectedChave) || null;
  }, [filteredNotas, selectedChave]);

  // Seleciona a primeira nota automaticamente se nenhuma estiver selecionada
  useEffect(() => {
    if (filteredNotas.length > 0 && !selectedChave) {
      setSelectedChave(filteredNotas[0].chNFe);
    }
  }, [filteredNotas, selectedChave]);

  // Atalhos de teclado (Enter para abrir DANFE, Setas para navegar, F5 para sincronizar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Enter" && selectedNota) {
        e.preventDefault();
        handleOpenDanfe(selectedNota);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const curIdx = displayedNotas.findIndex((n) => n.chNFe === selectedChave);
        if (curIdx >= 0 && curIdx < displayedNotas.length - 1) {
          setSelectedChave(displayedNotas[curIdx + 1].chNFe);
        } else if (curIdx === -1 && displayedNotas.length > 0) {
          setSelectedChave(displayedNotas[0].chNFe);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curIdx = displayedNotas.findIndex((n) => n.chNFe === selectedChave);
        if (curIdx > 0) {
          setSelectedChave(displayedNotas[curIdx - 1].chNFe);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        handleSyncSefaz();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedNotas, selectedChave, selectedNota]);

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[#f0f0f0] select-none text-[11px] text-[#000000] font-sans">
      <style>{`
        .vb-btn {
          background: linear-gradient(180deg, #ffffff 0%, #ececec 50%, #e0e0e0 100%);
          border: 1px solid #707070;
          border-radius: 2px;
          padding: 3px 9px;
          font-size: 11px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
          white-space: nowrap;
        }
        .vb-btn:hover {
          background: linear-gradient(180deg, #f5f8fc 0%, #e1e9f5 50%, #d4e1f2 100%);
          border-color: #3c7fb1;
        }
        .vb-btn:active {
          background: #d4d4d4;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }
        .vb-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          background: #e8e8e8;
          border-color: #a8a8a8;
        }
        .vb-btn-primary {
          background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
          border: 1px solid #336699;
          font-weight: 600;
          color: #002244;
        }
        .vb-btn-danger {
          background: linear-gradient(180deg, #fff2f2 0%, #fbd5d5 50%, #f6b5b5 100%);
          border: 1px solid #aa3333;
          color: #550000;
        }
        .vb-input {
          background-color: #ffffff;
          border: 1px solid #7a7a7a;
          border-radius: 0px;
          padding: 3px 6px;
          font-size: 11px;
          color: #000000;
          outline: none;
        }
        .vb-input:focus {
          border-color: #005a9e;
          box-shadow: 0 0 0 1px #005a9e;
        }
        fieldset.vb-groupbox {
          border: 1px solid #b0b0b0;
          padding: 7px 10px 8px 10px;
          margin-bottom: 6px;
          background-color: #f7f7f7;
        }
        legend.vb-legend {
          font-weight: 600;
          font-size: 11px;
          color: #003366;
          padding: 0 4px;
        }
        .datagrid-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border: 1px solid #999999;
          font-size: 11px;
        }
        .datagrid-table th {
          background: linear-gradient(180deg, #f5f5f5 0%, #e6e6e6 100%);
          border-right: 1px solid #b5b5b5;
          border-bottom: 1px solid #999999;
          padding: 4px 6px;
          font-weight: 600;
          color: #222222;
          text-align: left;
          font-size: 11px;
        }
        .datagrid-table td {
          border-right: 1px solid #e0e0e0;
          border-bottom: 1px solid #e0e0e0;
          padding: 3px 6px;
          font-size: 11px;
          color: #111111;
        }
        .datagrid-table tr.selected td {
          background-color: #005a9e !important;
          color: #ffffff !important;
        }
        .datagrid-table tr.selected td span,
        .datagrid-table tr.selected td strong,
        .datagrid-table tr.selected td div {
          color: #ffffff !important;
        }
        .datagrid-table tr:hover:not(.selected) td {
          background-color: #f0f7ff;
        }
      `}</style>

      {/* 3. Barra de Ferramentas / Action Toolbar Padronizada */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-2xs">
        {/* Grupo Esquerdo: Sincronização Principal, Busca e Pasta Local */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleSyncSefaz()}
            disabled={syncStatus.syncing || !activeEmpresa}
            className="vb-btn vb-btn-primary"
            title={cooldownRemaining > 0 ? `SEFAZ em repouso (restam ${formatCooldown(cooldownRemaining)})` : "Consultar novas notas fiscais na SEFAZ Nacional (Atalho: F5)"}
          >
            <RefreshCw size={13} className={syncStatus.syncing ? "animate-spin text-[#003366]" : "text-[#003366]"} />
            <span>{syncStatus.syncing ? "Sincronizando..." : cooldownRemaining > 0 ? `Repouso (${formatCooldown(cooldownRemaining)})` : "⚡ Sincronizar NF-e (F5)"}</span>
          </button>

          {cooldownRemaining > 0 && (
            <button
              type="button"
              onClick={() => setShowForceModal(true)}
              className="vb-btn vb-btn-danger"
              title="Clique para ver detalhes do repouso ou forçar sincronização"
            >
              <span>⏳ Repouso: {formatCooldown(cooldownRemaining)}</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              setChaveInput("");
              setSearchChaveResult(null);
              setShowSearchChaveModal(true);
            }}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Buscar nota fiscal específica diretamente pela chave de acesso de 44 dígitos"
          >
            <Search size={13} className="text-[#003366]" />
            <span>Buscar por Chave</span>
          </button>

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta local onde os arquivos XML e DANFEs são gravados"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta</span>
          </button>

          {metrics.interestaduaisCount > 0 && (
            <button
              type="button"
              onClick={handleCalculateDifal}
              className="vb-btn vb-btn-primary font-bold"
              title="Enviar notas interestaduais para auditoria e cálculo DIFAL"
            >
              <Calculator size={13} className="text-[#003366]" />
              <span>Enviar p/ Auditoria DIFAL ({metrics.interestaduaisCount})</span>
            </button>
          )}
        </div>

        {/* Grupo Direito: Exportações e Manutenção NSU */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || capturedNotas.length === 0}
            className="vb-btn"
            title="Exportar planilha detalhada com impostos para o Microsoft Excel (.csv)"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExportMode("periodo");
              setShowExportModal(true);
            }}
            disabled={exporting || capturedNotas.length === 0}
            className="vb-btn"
            title="Exportar notas por intervalo de datas, competência ou filtro em .ZIP"
          >
            <Archive size={13} className="text-[#005a9e]" />
            <span>Exportar Pacote (.ZIP)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              setTargetNsuInput("0");
              setShowResetNsuModal(true);
            }}
            disabled={syncStatus.syncing || !activeEmpresa}
            className="vb-btn"
            title="Reiniciar o ponteiro sequencial (NSU) para realizar busca completa desde o início na SEFAZ"
          >
            <RotateCcw size={13} className="text-[#aa4400]" />
            <span>Reiniciar NSU</span>
          </button>
        </div>
      </div>

      {/* 4. Área de Trabalho Principal */}
      <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">
        
        {/* Aviso de modelo desabilitado se aplicável */}
        {activeEmpresa && activeEmpresa.modelosHabilitados?.nfe === false && (
          <div className="bg-[#fff9e6] border border-[#d4a017] p-2 flex items-center justify-between text-[#664d03] text-[11px] mb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#b28900]" />
              <span>Esta empresa está configurada com a captação de <strong>NF-e Entradas (Mod. 55) desativada</strong> no painel de modelos.</span>
            </div>
            <button type="button" onClick={() => onOpenCompanyModal?.("empresas")} className="vb-btn">
              Habilitar no Painel
            </button>
          </div>
        )}

        {/* Notificação de Sincronização em Andamento */}
        {syncStatus.syncing && (
          <div className="bg-[#eef5fc] border border-[#99bce8] p-2 flex items-center gap-2 text-[#003366] text-[11px] animate-pulse">
            <RefreshCw size={13} className="animate-spin text-[#003366]" />
            <span className="font-semibold">{syncStatus.message || "Consultando WebService Nacional da SEFAZ..."}</span>
          </div>
        )}

        {/* Notificação de Erro na Sincronização */}
        {syncStatus.error && (
          <div className="bg-[#fdeeed] border border-[#e8a399] p-2 flex items-center justify-between text-[#8a1f11] text-[11px]">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-[#8a1f11]" />
              <span>{syncStatus.error}</span>
            </div>
            <button onClick={() => setSyncStatus((prev) => ({ ...prev, error: undefined }))} className="vb-btn text-[10px]">
              Fechar
            </button>
          </div>
        )}

        {/* GroupBox 1: Status SEFAZ & Parâmetros de Comunicação (Linha Única Compacta) */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Status da Conexão SEFAZ Nacional & Identificação da Empresa</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#333333]">Empresa Ativa:</span>
                <EmpresaSearchSelect
                  empresas={empresas}
                  value={activeEmpresa?.id || ""}
                  onChange={onSelectEmpresa}
                  className="w-[310px] max-w-[330px]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#333333]">Certificado A1:</span>
                <CertificateBadge certInfo={activeEmpresa?.certInfo} onClick={() => onOpenCompanyModal?.("empresas")} />
              </div>

              {nsuState && (
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]" />
                  <span>NSU SEFAZ: <strong>{Number(nsuState.ultNSU)}</strong> de {Number(nsuState.maxNSU)}</span>
                </div>
              )}

              {appSettings?.scheduler?.enabled && (
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px]">
                  <Clock size={11} className="text-[#005a9e]" />
                  <span>Busca Diária: <strong>{appSettings.scheduler.time}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenCompanyModal?.("empresas")}
                className="vb-btn text-[11px]"
              >
                <Building2 size={12} />
                <span>Gerenciar Cadastro</span>
              </button>
            </div>
          </div>
        </fieldset>

        {/* GroupBox 2: Resumo Operacional da Competência (Totais e Alertas) */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Totais e Métricas da Competência Selecionada ({selectedMonth === "all" ? "Todas" : selectedMonth})</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Notas Captadas</span>
              <span className="text-base font-bold text-[#003366]">{metrics.totalNotas}</span>
              <span className="text-[10px] text-[#777777]">Documentos autorizados</span>
            </div>

            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Valor Total das Notas</span>
              <span className="text-sm font-bold text-[#107c41] font-mono">{formatBRL(metrics.totalValor)}</span>
              <span className="text-[10px] text-[#777777]">Soma de valor total</span>
            </div>

            <div className="bg-[#f0f6ff] border border-[#99bce8] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#003366] font-semibold uppercase">Interestaduais (Fora UF)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-base font-bold text-[#003366]">{metrics.interestaduaisCount}</span>
                <span className="text-[9px] bg-[#003366] text-white px-1 py-0.5 font-bold">DIFAL</span>
              </div>
              <span className="text-[10px] text-[#5577aa]">Candidatas ao cálculo DIFAL</span>
            </div>

            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Internas (Mesmo Estado)</span>
              <span className="text-base font-bold text-[#333333]">{metrics.internasCount}</span>
              <span className="text-[10px] text-[#777777]">Sem incidência de DIFAL</span>
            </div>

            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Fornecedores Únicos</span>
              <span className="text-base font-bold text-[#885500]">{metrics.totalEmitentes}</span>
              <span className="text-[10px] text-[#777777]">Emitentes distintos</span>
            </div>
          </div>
        </fieldset>

        {/* GroupBox 3: Filtros de Pesquisa e Operação Fiscal */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Filtros de Pesquisa e Operação Fiscal</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#333333]">Competência:</span>
                <select
                  value={tableMonthFilter}
                  onChange={(e) => setTableMonthFilter(e.target.value)}
                  className="vb-input font-semibold"
                >
                  <option value="all">Todas as Competências</option>
                  {uniqueTableMonths.map((m) => (
                    <option key={m} value={m}>
                      Competência: {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#333333]">Período:</span>
                <span className="text-[10px] text-[#666666]">De:</span>
                <input
                  type="date"
                  value={dataInicioFilter}
                  onChange={(e) => setDataInicioFilter(e.target.value)}
                  className="vb-input py-0.5"
                />
                <span className="text-[10px] text-[#666666]">Até:</span>
                <input
                  type="date"
                  value={dataFimFilter}
                  onChange={(e) => setDataFimFilter(e.target.value)}
                  className="vb-input py-0.5"
                />
                {(dataInicioFilter || dataFimFilter || tableMonthFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setDataInicioFilter("");
                      setDataFimFilter("");
                      setTableMonthFilter("all");
                    }}
                    className="vb-btn py-0 px-1 text-[10px]"
                    title="Limpar filtros de data"
                  >
                    ✕ Limpar
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 border-l border-[#d0d0d0] pl-2">
                <span className="font-semibold text-[#333333]">Rota:</span>
                <button
                  type="button"
                  onClick={() => setRouteFilter("all")}
                  className={`vb-btn ${routeFilter === "all" ? "vb-btn-primary" : ""}`}
                >
                  Todas ({notasPeriodo.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRouteFilter("interestadual")}
                  className={`vb-btn ${routeFilter === "interestadual" ? "vb-btn-primary" : ""}`}
                >
                  Interestadual ({metrics.interestaduaisCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRouteFilter("interna")}
                  className={`vb-btn ${routeFilter === "interna" ? "vb-btn-primary" : ""}`}
                >
                  Interna ({metrics.internasCount})
                </button>
              </div>

              <div className="border-l border-[#d0d0d0] pl-2">
                <button
                  type="button"
                  onClick={() => handleConsultarLote(pendingCnpjs.length === 0)}
                  disabled={consultandoLote || allFilteredCnpjs.length === 0}
                  className="vb-btn"
                  title="Consultar opção pelo Simples Nacional direto no Portal da Receita Federal"
                >
                  <RefreshCw size={11} className={consultandoLote ? "animate-spin" : ""} />
                  <span>
                    {consultandoLote
                      ? `Portal RFB (${loteProgresso?.current || 0}/${loteProgresso?.total || 0})...`
                      : pendingCnpjs.length > 0
                      ? `🔍 Consultar SN (${pendingCnpjs.length} pendentes)`
                      : "✓ SN Verificado (Reconsultar)"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">Pesquisar:</span>
              <input
                type="text"
                placeholder="Nº NF, Chave, Fornecedor, CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="vb-input w-56 font-mono"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="vb-btn py-0 px-1 text-[10px]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </fieldset>

        {/* GroupBox 4: Dados da Nota Selecionada na Grid */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Dados da Nota Selecionada na Grid (Atalhos: Enter = Abrir DANFE | F5 = Sincronizar)</legend>
          {selectedNota ? (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ffffff] border border-[#d0d0d0] p-2">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] text-[#666666] block">Número / Série:</span>
                  <span className="font-bold text-[#003366] text-xs">NF-e {selectedNota.nNF} (Série {selectedNota.serie})</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Data Emissão:</span>
                  <span className="font-semibold text-[#222222]">{selectedNota.formattedDate || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Fornecedor / Emitente:</span>
                  <span className="font-bold text-[#222222] max-w-xs truncate inline-block" title={selectedNota.emitente}>
                    {selectedNota.emitente}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">CNPJ Emitente:</span>
                  <span className="font-mono text-[#444444]">{selectedNota.cnpjEmitente || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Rota:</span>
                  <span className={`font-semibold px-1 py-0.2 rounded text-[10px] ${selectedNota.isInterestadual ? "bg-[#e0eaff] text-[#003366]" : "bg-[#eeeeee] text-[#444444]"}`}>
                    {selectedNota.isInterestadual ? `INTERESTADUAL (${selectedNota.ufRem} ➔ ${selectedNota.ufDest || activeEmpresa?.uf || "SP"})` : `INTERNA (${selectedNota.ufRem})`}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Valor Total:</span>
                  <span className="font-mono font-bold text-[#107c41] text-xs">{formatBRL(selectedNota.vNF)}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenDanfe(selectedNota)}
                  className="vb-btn vb-btn-primary"
                  title="Abrir DANFE oficial em PDF no leitor padrão do Windows"
                >
                  <FileText size={12} className="text-[#aa2222]" />
                  <span>➔ Abrir DANFE PDF (Enter)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveXml(selectedNota)}
                  className="vb-btn"
                  title="Salvar arquivo XML individual da nota"
                >
                  <Download size={12} />
                  <span>Salvar XML</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyKey(selectedNota.chNFe)}
                  className="vb-btn"
                  title="Copiar chave de acesso completa de 44 dígitos"
                >
                  {copiedKey === selectedNota.chNFe ? <Check size={12} className="text-[#107c41]" /> : <Copy size={12} />}
                  <span>{copiedKey === selectedNota.chNFe ? "Copiada!" : "Copiar Chave"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[#666666] italic py-1 text-center bg-[#ffffff] border border-[#d0d0d0]">
              Nenhuma nota selecionada. Clique em uma linha na grid abaixo para visualizar ações rápidas.
            </div>
          )}
        </fieldset>

        {/* 5. DataGrid Clássica de Notas Fiscais */}
        <div className="border border-[#999999] bg-[#ffffff] flex-1 flex flex-col min-h-[300px]">
          <div className="bg-[#f0f0f0] border-b border-[#c0c0c0] px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#003366]">
            <span>Relação de Notas Fiscais de Entrada ({filteredNotas.length} registro(s) encontrado(s))</span>
            <span className="text-[10px] text-[#555555]">
              Exibindo {displayedNotas.length} de {filteredNotas.length} notas | Duplo clique para abrir DANFE
            </span>
          </div>

          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("numero")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "100px" }}
                    title="Clique para ordenar por número da NF-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>NF-e / Série</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "numero" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("dataEmissao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "125px" }}
                    title="Clique para ordenar por data de emissão"
                  >
                    <div className="flex items-center justify-between">
                      <span>Data Emissão</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "dataEmissao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("emitente")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    title="Clique para ordenar por fornecedor"
                  >
                    <div className="flex items-center justify-between">
                      <span>Fornecedor / Emitente</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "emitente" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("cnpj")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "135px" }}
                    title="Clique para ordenar por CNPJ do emitente"
                  >
                    <div className="flex items-center justify-between">
                      <span>CNPJ Emitente</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "cnpj" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "120px" }}>Regime / SN</th>
                  <th
                    onClick={() => handleHeaderSort("rota")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "120px" }}
                    title="Clique para ordenar por rota / UF"
                  >
                    <div className="flex items-center justify-between">
                      <span>Rota</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "rota" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valorProd")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "115px", textAlign: "right" }}
                    title="Clique para ordenar por valor dos produtos"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Produtos</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valorProd" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valorTotal")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "120px", textAlign: "right" }}
                    title="Clique para ordenar por valor total da NF-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Total NF</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valorTotal" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "165px", textAlign: "center" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {loadingXmls ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[#555555]">
                      <RefreshCw size={16} className="animate-spin inline mr-2 text-[#003366]" />
                      Carregando documentos fiscais da empresa...
                    </td>
                  </tr>
                ) : displayedNotas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[#555555]">
                      Nenhuma nota fiscal encontrada com os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  displayedNotas.map((n) => {
                    const isSelected = n.chNFe === selectedChave;
                    return (
                      <tr
                        key={n.chNFe}
                        className={isSelected ? "selected cursor-pointer" : "cursor-pointer"}
                        onClick={() => setSelectedChave(n.chNFe)}
                        onDoubleClick={() => handleOpenDanfe(n)}
                      >
                        <td className="font-mono font-bold">
                          {n.nNF} <span className="text-[10px] font-normal opacity-80">(s.{n.serie})</span>
                        </td>
                        <td className="font-mono whitespace-nowrap">
                          <div>{n.formattedDate || "-"}</div>
                          {(() => {
                            const comp = getNotaCompetencia(n);
                            if (comp) {
                              const [ano, mes] = comp.split("-");
                              return (
                                <div className={`text-[10px] font-semibold ${isSelected ? "text-white/80" : "text-[#005a9e]"}`}>
                                  Comp: {mes}/{ano}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="font-semibold truncate max-w-[280px]" title={n.emitente}>
                          {n.emitente}
                        </td>
                        <td className="font-mono">
                          {n.cnpjEmitente || "-"}
                        </td>
                        <td>
                          {renderSimplesBadge(n.cnpjEmitente)}
                        </td>
                        <td>
                          <span className={`px-1 py-0.2 rounded text-[10px] font-semibold ${n.isInterestadual ? (isSelected ? "bg-[#ffffff]/20 text-[#ffffff]" : "bg-[#e0eaff] text-[#003366]") : (isSelected ? "bg-[#ffffff]/20 text-[#ffffff]" : "bg-[#f0f0f0] text-[#555555]")}`}>
                            {n.isInterestadual ? `INTER (${n.ufRem}➔${n.ufDest || activeEmpresa?.uf || "SP"})` : `INTERNA (${n.ufRem})`}
                          </span>
                        </td>
                        <td className="text-right font-mono">
                          {formatBRL(n.vProd || 0)}
                        </td>
                        <td className="text-right font-mono font-bold">
                          {formatBRL(n.vNF)}
                        </td>
                        <td className="text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDanfe(n);
                              }}
                              className="vb-btn py-0 px-1 text-[10px]"
                              title="Abrir DANFE oficial em PDF"
                            >
                              <FileText size={10} className="text-[#aa2222]" />
                              DANFE
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveXml(n);
                              }}
                              className="vb-btn py-0 px-1 text-[10px]"
                              title="Salvar arquivo XML individual"
                            >
                              <Download size={10} />
                              XML
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyKey(n.chNFe);
                              }}
                              className="vb-btn py-0 px-1 text-[10px]"
                              title="Copiar chave de acesso de 44 dígitos"
                            >
                              {copiedKey === n.chNFe ? <Check size={10} className="text-[#107c41]" /> : <Copy size={10} />}
                              Chave
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação e Resumo da Grid */}
          <div className="bg-[#f0f0f0] border-t border-[#c0c0c0] px-3 py-1 flex items-center justify-between text-[11px] text-[#444444]">
            <div className="flex items-center gap-2">
              <span>Exibindo <strong>{displayedNotas.length}</strong> de <strong>{filteredNotas.length}</strong> notas no filtro.</span>
              {filteredNotas.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 100)}
                  className="vb-btn py-0 px-1.5 text-[10px]"
                >
                  [+ Carregar Mais 100]
                </button>
              )}
              {filteredNotas.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(filteredNotas.length)}
                  className="vb-btn py-0 px-1.5 text-[10px]"
                >
                  [Exibir Todas ({filteredNotas.length})]
                </button>
              )}
              {displayLimit > 100 && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(100)}
                  className="vb-btn py-0 px-1.5 text-[10px]"
                >
                  [Recolher para 100]
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              <span>Total Exibido: <strong className="text-[#107c41] font-mono">{formatBRL(displayedNotas.reduce((acc, n) => acc + n.vNF, 0))}</strong></span>
              <span>Total do Filtro: <strong className="text-[#003366] font-mono">{formatBRL(filteredNotas.reduce((acc, n) => acc + n.vNF, 0))}</strong></span>
            </div>
          </div>
        </div>

      </div>

      {/* 6. StatusBar Clássica */}
      <div className="bg-[#e8e8e8] border-t border-[#b0b0b0] px-3 py-1 flex items-center justify-between text-[11px] text-[#333333] shrink-0 font-medium">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <img src={logoImg} alt="CONT-AI" className="h-3.5 w-3.5 object-contain" />
            <span className="font-bold text-[#003366]">CONT-AI - Gestor de Movimento fiscal</span>
          </div>
          <span className="text-[#888888]">|</span>
          <span>Status SEFAZ: <strong className={cooldownRemaining > 0 ? "text-[#cc6600]" : "text-[#107c41]"}>{cooldownRemaining > 0 ? `Repouso (${formatCooldown(cooldownRemaining)})` : "Pronto para Sincronização"}</strong></span>
          <span className="text-[#888888]">|</span>
          <span>Registros: <strong>{filteredNotas.length}</strong> notas carregadas</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className={`px-1 py-0.2 border ${isCapsLockOn ? "bg-[#005a9e] text-white border-[#003366] font-bold" : "bg-[#dedede] text-[#888888] border-[#c0c0c0]"}`}>
              CAPS
            </span>
            <span className={`px-1 py-0.2 border ${isNumLockOn ? "bg-[#005a9e] text-white border-[#003366] font-bold" : "bg-[#dedede] text-[#888888] border-[#c0c0c0]"}`}>
              NUM
            </span>
          </div>
          <span className="text-[#888888]">|</span>
          <span className="font-mono text-[#444444]">{clock}</span>
        </div>
      </div>

      {/* MODAL 1: DETALHES CADASTRAIS DO FORNECEDOR (CNPJ & SIMPLES NACIONAL RFB) */}
      {selectedCnpjModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-xl w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <span className="font-bold text-xs">Dados Cadastrais da Empresa - Portal da Receita Federal</span>
              <button type="button" onClick={() => setSelectedCnpjModal(null)} className="text-white hover:bg-red-600 px-1.5 py-0.2 font-bold cursor-pointer">✕</button>
            </div>

            <div className="p-3 space-y-3 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Identificação da Empresa</legend>
                <div className="space-y-1">
                  <div><strong>Razão Social:</strong> {selectedCnpjModal.razao_social || "Não informado"}</div>
                  <div><strong>Nome Fantasia:</strong> {selectedCnpjModal.nome_fantasia || "Não informado"}</div>
                  <div><strong>CNPJ:</strong> <span className="font-mono">{selectedCnpjModal.cnpj_formatado || selectedCnpjModal.cnpj}</span></div>
                  <div><strong>Situação Cadastral:</strong> {selectedCnpjModal.situacao_cadastral || "ATIVA"}</div>
                  <div><strong>Município / UF:</strong> {selectedCnpjModal.municipio || "-"} / {selectedCnpjModal.uf || "-"}</div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Situação no Simples Nacional & SIMEI</legend>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 font-bold ${selectedCnpjModal.opcao_simples_raw ? "bg-[#d4edda] text-[#155724] border border-[#c3e6cb]" : "bg-[#d1ecf1] text-[#0c5460] border border-[#bee5eb]"}`}>
                      {selectedCnpjModal.opcao_simples_raw ? "Optante pelo Simples Nacional" : "NÃO Optante (Regime Normal)"}
                    </span>
                    {selectedCnpjModal.opcao_simei_raw && (
                      <span className="px-2 py-0.5 bg-[#fff3cd] text-[#856404] border border-[#ffeeba] font-bold">
                        MEI (SIMEI)
                      </span>
                    )}
                  </div>
                  <div><strong>Detalhamento RFB:</strong> {selectedCnpjModal.opcao_simples || "Sem detalhamento"}</div>
                  {selectedCnpjModal.data_consulta_portal && (
                    <div className="text-[10px] text-[#666666]">Data da Consulta no Portal: {selectedCnpjModal.data_consulta_portal}</div>
                  )}
                </div>
              </fieldset>

              {selectedCnpjModal.periodos_anteriores_simples && selectedCnpjModal.periodos_anteriores_simples.length > 0 && (
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend">Períodos Anteriores no Simples Nacional</legend>
                  <table className="datagrid-table">
                    <thead>
                      <tr>
                        <th>Data Inicial</th>
                        <th>Data Final</th>
                        <th>Detalhamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCnpjModal.periodos_anteriores_simples.map((p, idx) => (
                        <tr key={idx}>
                          <td className="font-mono">{p.dataInicial}</td>
                          <td className="font-mono">{p.dataFinal}</td>
                          <td>{p.detalhamento}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </fieldset>
              )}

              {selectedCnpjModal.cnae_principal && (
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend">Atividade Econômica Principal (CNAE)</legend>
                  <div className="font-mono font-bold text-[#003366]">{selectedCnpjModal.cnae_principal.codigo}</div>
                  <div>{selectedCnpjModal.cnae_principal.descricao}</div>
                </fieldset>
              )}
            </div>

            <div className="bg-[#e8e8e8] border-t border-[#c0c0c0] px-3 py-2 flex items-center justify-between">
              <button
                type="button"
                disabled={consultandoIndiv[selectedCnpjModal.cnpj.replace(/\D/g, "")]}
                onClick={() => handleConsultarIndividual(selectedCnpjModal.cnpj, true)}
                className="vb-btn"
              >
                <RefreshCw size={11} className={consultandoIndiv[selectedCnpjModal.cnpj.replace(/\D/g, "")] ? "animate-spin" : ""} />
                <span>{consultandoIndiv[selectedCnpjModal.cnpj.replace(/\D/g, "")] ? "Consultando..." : "Reconsultar Agora no Portal RFB"}</span>
              </button>

              <button type="button" onClick={() => setSelectedCnpjModal(null)} className="vb-btn">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: BUSCA POR CHAVE DE ACESSO */}
      {showSearchChaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-lg w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <span className="font-bold text-xs">Buscar NF-e por Chave de Acesso (44 Dígitos)</span>
              <button
                type="button"
                onClick={() => {
                  setShowSearchChaveModal(false);
                  setSearchChaveResult(null);
                }}
                className="text-white hover:bg-red-600 px-1.5 py-0.2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="bg-[#fff9e6] border border-[#d4a017] p-2 text-[11px] text-[#664d03]">
                Digite a chave de acesso de 44 dígitos para a aplicação consultar a SEFAZ Nacional, registrar a Confirmação da Operação e baixar o XML completo e o DANFE PDF instantaneamente.
              </div>

              <form onSubmit={handleSearchByChave} className="space-y-3">
                <div>
                  <label className="font-semibold block mb-1">Chave de Acesso da NF-e (44 dígitos):</label>
                  <input
                    type="text"
                    value={chaveInput}
                    onChange={(e) => setChaveInput(e.target.value)}
                    placeholder="Ex: 42260707826504000295550020001856271442644701"
                    maxLength={44}
                    disabled={searchingChave}
                    className="vb-input w-full font-mono text-xs"
                  />
                  <div className="flex justify-between text-[10px] text-[#666666] mt-0.5">
                    <span>Dígitos inseridos: {chaveInput.replace(/\D/g, "").length} / 44</span>
                    {chaveInput.replace(/\D/g, "").length === 44 && (
                      <span className="text-[#107c41] font-bold">✓ Chave com 44 dígitos válidos</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d0d0]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSearchChaveModal(false);
                      setSearchChaveResult(null);
                    }}
                    disabled={searchingChave}
                    className="vb-btn"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={searchingChave || chaveInput.replace(/\D/g, "").length !== 44}
                    className="vb-btn vb-btn-primary"
                  >
                    {searchingChave ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Consultando SEFAZ...</span>
                      </>
                    ) : (
                      <>
                        <Download size={12} />
                        <span>Buscar e Baixar NF-e</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {searchChaveResult && (
                <div className="bg-[#ffffff] border border-[#107c41] p-3 space-y-2">
                  <div className="font-bold text-[#107c41]">✓ NF-e Capturada e Salva com Sucesso!</div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div><strong>Emitente:</strong> {searchChaveResult.emitente}</div>
                    <div><strong>Valor Total:</strong> {formatBRL(searchChaveResult.valor)}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-[#e0e0e0]">
                    <button
                      type="button"
                      onClick={() => openDanfePdf(activeEmpresa!.cnpj, searchChaveResult.chNFe, searchChaveResult.yearMonth)}
                      className="vb-btn vb-btn-primary"
                    >
                      <FileText size={12} className="text-[#aa2222]" />
                      <span>Visualizar DANFE PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => saveSingleXml(activeEmpresa!.cnpj, searchChaveResult.chNFe, searchChaveResult.yearMonth)}
                      className="vb-btn"
                    >
                      <Download size={12} />
                      <span>Salvar XML</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REINICIAR NSU */}
      {showResetNsuModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-lg w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <span className="font-bold text-xs">Reiniciar NSU (Busca Completa na SEFAZ Nacional)</span>
              <button
                type="button"
                onClick={() => setShowResetNsuModal(false)}
                disabled={resettingNsu}
                className="text-white hover:bg-red-600 px-1.5 py-0.2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="bg-[#fff9e6] border border-[#d4a017] p-2 text-[11px] text-[#664d03] leading-relaxed">
                O <strong>NSU (Número Sequencial Único)</strong> é a régua mantida pela SEFAZ Nacional. Ao reiniciar para <strong>0</strong>, o captador varre todas as notas emitidas contra a empresa nos últimos 90 dias, manifestando automaticamente notas pendentes e baixando quaisquer XMLs e DANFEs faltantes.
              </div>

              <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>Ponteiro Atual (ultNSU): <strong className="font-mono text-[#003366]">{nsuState?.ultNSU || "0"}</strong></div>
                <div>Último NSU na SEFAZ (maxNSU): <strong className="font-mono text-[#107c41]">{nsuState?.maxNSU || "0"}</strong></div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold block">Definir Novo NSU Inicial:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={targetNsuInput}
                    onChange={(e) => setTargetNsuInput(e.target.value)}
                    disabled={resettingNsu}
                    className="vb-input w-36 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetNsuInput("0")}
                    disabled={resettingNsu}
                    className="vb-btn"
                  >
                    Definir 0 (Início Completo)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#d0d0d0]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearManifOption}
                    onChange={(e) => setClearManifOption(e.target.checked)}
                    disabled={resettingNsu}
                  />
                  <span>Limpar histórico de manifestações locais (re-manifestar notas em resumo)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearFilesOption}
                    onChange={(e) => setClearFilesOption(e.target.checked)}
                    disabled={resettingNsu}
                  />
                  <span>Limpar arquivos locais de NF-e do disco para baixar do zero</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncNowOption}
                    onChange={(e) => setSyncNowOption(e.target.checked)}
                    disabled={resettingNsu}
                  />
                  <span>Iniciar sincronização com a SEFAZ imediatamente após confirmar</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d0d0]">
                <button
                  type="button"
                  onClick={() => setShowResetNsuModal(false)}
                  disabled={resettingNsu}
                  className="vb-btn"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleResetNsuConfirm}
                  disabled={resettingNsu}
                  className="vb-btn vb-btn-primary font-bold"
                >
                  <RotateCcw size={12} className={resettingNsu ? "animate-spin" : ""} />
                  <span>{resettingNsu ? "Reiniciando..." : syncNowOption ? "Reiniciar & Sincronizar" : "Apenas Reiniciar NSU"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: EXPORTAÇÃO AVANÇADA .ZIP */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-lg w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <span className="font-bold text-xs">Exportar Notas Fiscais em Pacote Compactado (.ZIP)</span>
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={exporting}
                className="text-white hover:bg-red-600 px-1.5 py-0.2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <fieldset className="vb-groupbox">
                <legend className="vb-legend">1. Seleção das Notas a Exportar</legend>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExportMode("periodo")}
                    className={`vb-btn ${exportMode === "periodo" ? "vb-btn-primary" : ""}`}
                  >
                    Por Intervalo de Datas
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportMode("competencia")}
                    className={`vb-btn ${exportMode === "competencia" ? "vb-btn-primary" : ""}`}
                  >
                    Por Competência
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportMode("filtradas")}
                    className={`vb-btn ${exportMode === "filtradas" ? "vb-btn-primary" : ""}`}
                  >
                    Notas Filtradas ({filteredNotas.length})
                  </button>
                </div>

                {exportMode === "periodo" && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px]">De:</span>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="vb-input py-0.5"
                    />
                    <span className="text-[10px]">Até:</span>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="vb-input py-0.5"
                    />
                  </div>
                )}

                {exportMode === "competencia" && (
                  <div className="mt-2">
                    <select
                      value={exportSelectedMonth}
                      onChange={(e) => setExportSelectedMonth(e.target.value)}
                      className="vb-input font-bold"
                    >
                      <option value="all">Todas as Competências Salvas</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>Competência {m}</option>
                      ))}
                    </select>
                  </div>
                )}
              </fieldset>

              <fieldset className="vb-groupbox">
                <legend className="vb-legend">2. Conteúdo do Arquivo .ZIP</legend>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExportTypeChoice("all")}
                    className={`vb-btn ${exportTypeChoice === "all" ? "vb-btn-primary" : ""}`}
                  >
                    Completo (XMLs + DANFEs PDF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportTypeChoice("pdf")}
                    className={`vb-btn ${exportTypeChoice === "pdf" ? "vb-btn-primary" : ""}`}
                  >
                    Apenas DANFEs (PDFs)
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportTypeChoice("xml")}
                    className={`vb-btn ${exportTypeChoice === "xml" ? "vb-btn-primary" : ""}`}
                  >
                    Apenas Arquivos XMLs
                  </button>
                </div>
              </fieldset>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d0d0]">
                <button
                  type="button"
                  onClick={() => setShowExportModal(false)}
                  disabled={exporting}
                  className="vb-btn"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleExportCustom}
                  disabled={exporting || (exportMode === "filtradas" && filteredNotas.length === 0)}
                  className="vb-btn vb-btn-primary font-bold"
                >
                  <Download size={12} className={exporting ? "animate-bounce" : ""} />
                  <span>{exporting ? "Gerando pacote..." : "Gerar e Salvar Pacote .ZIP"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: REPOUSO PREVENTIVO SEFAZ ANTI-656 */}
      {showForceModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#aa3333] shadow-2xl max-w-md w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#aa3333] to-[#cc4444] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-bold text-xs">SEFAZ Nacional em Período de Repouso Preventivo</span>
              <button
                type="button"
                onClick={() => setShowForceModal(false)}
                className="text-white hover:bg-black/30 px-1.5 py-0.2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="bg-[#fff9e6] border border-[#d4a017] p-2 space-y-1">
                <div className="flex items-center justify-between font-bold">
                  <span>Tempo Restante de Repouso:</span>
                  <span className="font-mono text-sm bg-white border border-[#d4a017] px-2 py-0.5 text-[#aa3333]">
                    {formatCooldown(cooldownRemaining)}
                  </span>
                </div>
                <p className="text-[10px] text-[#664d03]">
                  A SEFAZ Nacional exige intervalo de 1 hora após confirmação de fim de documentos ou notificação de consumo indevido. Liberação normal prevista para às{" "}
                  <strong>{new Date(nsuState?.blockedUntil || "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d0d0]">
                <button
                  type="button"
                  onClick={() => setShowForceModal(false)}
                  className="vb-btn"
                >
                  Aguardar (Recomendado)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowForceModal(false);
                    handleSyncSefaz({ forceSync: true });
                  }}
                  className="vb-btn vb-btn-danger font-bold"
                >
                  Forçar Consulta Mesmo Assim
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
