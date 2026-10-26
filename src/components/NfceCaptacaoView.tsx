import React, { useState, useEffect, useMemo } from "react";
import { EmpresaSefaz, ParsedNfce } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import { useDebounce } from "../utils/useDebounce";
import {
  ShoppingBag,
  Building2,
  Calendar,
  Search,
  Download,
  FileText,
  Copy,
  Check,
  FolderOpen,
  RefreshCw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  RotateCw,
  RotateCcw,
  Info,
  X,
  Eye,
  FileSpreadsheet,
  Archive,
  Settings
} from "lucide-react";
import {
  syncCompanyNfce,
  listCompanyNfceXmls,
  openCompanyNfceFolder,
  openNfceDanfePdf,
  onNfceProgress,
  onSchedulerTrigger,
  getAppSettings,
  AppSettings,
  exportNfceCompetencia,
  saveSingleNfceXml,
  getCompanyNfceCacheState,
  resetCompanyNfceCache,
  saveCsvFile
} from "../utils/electronBridge";
import { formatBRL, parseDateToTimestamp } from "../utils/calc";
import CertificateBadge from "./CertificateBadge";
import logoImg from "../../assets/logo.png";

interface NfceCaptacaoViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNotify: (text: string, type: "success" | "error") => void;
  onNavigateHub?: () => void;
  refreshKey?: number;
}

export default function NfceCaptacaoView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onOpenCompanyModal,
  onNotify,
  onNavigateHub,
  refreshKey,
}: NfceCaptacaoViewProps) {
  // Filtros e Seleções
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [diasRetroativos, setDiasRetroativos] = useState<number>(90);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Estados de seleção de linha, limite e StatusBar
  const [selectedChave, setSelectedChave] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(100);
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
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  // Estados de Dados e Sincronização
  const [notas, setNotas] = useState<ParsedNfce[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    message: string;
    action: string;
  } | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // Estados de Reinício do Cache de NFC-e
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [resettingCache, setResettingCache] = useState<boolean>(false);
  const [clearFilesOption, setClearFilesOption] = useState<boolean>(false);
  const [syncNowOption, setSyncNowOption] = useState<boolean>(true);
  const [nfceCacheState, setNfceCacheState] = useState<{
    lastExecution: string | null;
    lastSyncTime: string | null;
    ultimaDataEmissao?: string | null;
    ultimaChave?: string | null;
    downloadedKeys: Record<string, any>;
  } | null>(null);

  const loadCacheState = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await getCompanyNfceCacheState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      if (res.success && res.result) {
        setNfceCacheState(res.result);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (activeEmpresa) {
      loadCacheState();
    }
  }, [activeEmpresa]);

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

  // Carrega configurações do app
  useEffect(() => {
    getAppSettings().then((st) => {
      if (st) setAppSettings(st);
    });

    const unsubscribe = onSchedulerTrigger((payload?: any) => {
      if (!payload || payload.type === "nfce") {
        if (activeEmpresa?.modelosHabilitados && activeEmpresa.modelosHabilitados.nfce === false) {
          return;
        }
        onNotify(`Horário agendado atingido (${payload?.time || "diário"}): busca automática de NFC-e disparada!`, "success");
        if (activeEmpresa && (activeEmpresa.certPath || activeEmpresa.certStore === "windows" || activeEmpresa.certThumbprint) && !syncing) {
          handleSyncNfce();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeEmpresa, syncing, refreshKey]);

  // Listener para progresso em tempo real da captura de NFC-e
  useEffect(() => {
    const unsub = onNfceProgress((info: any) => {
      if (info.current !== undefined && info.total !== undefined) {
        setSyncProgress({
          current: info.current,
          total: info.total,
          message: info.message || "",
          action: info.action || "progress",
        });
      }
    });

    return () => {
      unsub();
    };
  }, []);

  // Carrega notas da empresa ativa
  const loadNotas = async (cnpj: string, razaoSocial?: string, ym: string = selectedMonth) => {
    if (!cnpj) return;
    setLoading(true);
    try {
      const res = await listCompanyNfceXmls(cnpj, razaoSocial, ym);
      if (res.success) {
        setNotas(res.list || []);
        if (res.months) {
          setAvailableMonths(res.months);
        }
      } else {
        setNotas([]);
      }
    } catch (err: any) {
      console.error("Erro ao carregar NFC-e:", err);
      setNotas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeEmpresa) {
      loadNotas(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
      loadCacheState();
    } else {
      setNotas([]);
      setAvailableMonths([]);
    }
  }, [activeEmpresa?.id, selectedMonth, refreshKey]);

  // Disparo manual da sincronização
  const handleSyncNfce = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa para sincronizar.", "error");
      return;
    }
    if (!activeEmpresa.certPath && activeEmpresa.certStore !== "windows" && !activeEmpresa.certThumbprint) {
      onNotify("A empresa selecionada não possui Certificado Digital A1 configurado.", "error");
      onOpenCompanyModal();
      return;
    }

    setSyncing(true);
    setSyncProgress(null);
    onNotify(`Iniciando captação de NFC-e na SEFAZ-SP (últimos ${diasRetroativos} dias)...`, "success");

    try {
      const res = await syncCompanyNfce(activeEmpresa, { diasRetroativos });
      if (res.success && res.result) {
        const { totalLocalizadas, totalBaixadas, jaExistentes } = res.result;
        onNotify(
          `Captação NFC-e concluída! ${totalLocalizadas} notas encontradas (${totalBaixadas} novas baixadas, ${jaExistentes} já salvas).`,
          "success"
        );
        await loadNotas(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
      } else {
        onNotify(res.error || "Falha na sincronização de NFC-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro na captação de NFC-e: ${err.message}`, "error");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  // Confirmar reinício do cache de NFC-e
  const handleResetCacheConfirm = async () => {
    if (!activeEmpresa) return;
    setResettingCache(true);
    try {
      const res = await resetCompanyNfceCache(activeEmpresa.cnpj, activeEmpresa.razaoSocial, clearFilesOption);
      if (res.success) {
        setShowResetModal(false);
        await loadCacheState();
        if (clearFilesOption) {
          await loadNotas(activeEmpresa.cnpj, "all", activeEmpresa.razaoSocial);
        }
        if (syncNowOption) {
          onNotify("Cache de NFC-e reiniciado com sucesso! Iniciando busca na SEFAZ...", "success");
          handleSyncNfce();
        } else {
          onNotify("Cache de NFC-e reiniciado com sucesso!", "success");
        }
      } else {
        onNotify(res.error || "Falha ao reiniciar cache.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao reiniciar cache: ${err.message}`, "error");
    } finally {
      setResettingCache(false);
    }
  };

  // Abrir DANFE PDF
  const handleOpenDanfe = async (nota: ParsedNfce) => {
    try {
      const res = await openNfceDanfePdf(nota.pdfPath, nota.fullPath);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir o DANFE PDF.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir DANFE: ${err.message}`, "error");
    }
  };

  // Abrir pasta de NFC-e
  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await openCompanyNfceFolder(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir a pasta.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir pasta: ${err.message}`, "error");
    }
  };

  // Copiar chave
  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Exportar NFC-e por competência (ZIP com XMLs, DANFEs ou Ambos)
  const handleExport = async (type: "all" | "xml" | "pdf" = "all") => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa para exportar.", "error");
      return;
    }
    if (filteredNotas.length === 0) {
      onNotify("Nenhuma nota NFC-e encontrada para exportar no período.", "error");
      return;
    }
    setExporting(true);
    try {
      const res = await exportNfceCompetencia(
        activeEmpresa.cnpj,
        activeEmpresa.razaoSocial,
        selectedMonth,
        type
      );
      if (res.canceled) return;
      if (res.success) {
        onNotify(`Exportação concluída com sucesso! (${res.fileCount || 0} arquivos compactados)`, "success");
      } else {
        onNotify(res.error || "Falha na exportação de NFC-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro na exportação: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  // Exportar Relatório em Planilha CSV / Excel
  const handleExportCsv = async () => {
    if (filteredNotas.length === 0) {
      onNotify("Nenhuma nota NFC-e encontrada para exportar o relatório.", "error");
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
      "Data/Hora Emissão",
      "Número NFC-e",
      "Série",
      "Chave de Acesso",
      "Emitente",
      "CNPJ Emitente",
      "UF",
      "Destinatário / Consumidor",
      "CPF/CNPJ Destinatário",
      "Valor Total (vNF)",
      "Situação"
    ];

    let totValor = 0;

    const rows = filteredNotas.map((n) => {
      const vNF = n.vNF || 0;
      totValor += vNF;

      const comp = n.folder && n.folder !== "indefinido" ? n.folder : (n.dhEmi ? n.dhEmi.substring(0, 7) : "-");
      const chaveExcel = n.chNFe ? `="${n.chNFe}"` : '""';
      const escape = (txt: string) => `"${String(txt || "").replace(/"/g, '""')}"`;
      const situacao = n.isCancelada ? "Cancelada" : "Autorizada";

      return [
        escape(comp),
        escape(n.formattedDate || n.dhEmi || "-"),
        escape(n.nNF || "-"),
        escape(n.serie || "1"),
        chaveExcel,
        escape(n.emitente || ""),
        escape(formatDoc(n.cnpjEmitente)),
        escape(n.ufRem || ""),
        escape(n.destinatario || "Consumidor Final"),
        escape(formatDoc(n.cnpjDest)),
        escape(formatMoeda(vNF)),
        escape(situacao)
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
      `"${filteredNotas.length} nota(s)"`,
      `"${formatMoeda(totValor)}"`,
      '""'
    ].join(";");

    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...rows, linhaTotais].join("\r\n");
    const periodoSlug = selectedMonth === "all" ? "geral" : selectedMonth;
    const defaultName = `relatorio_nfce_${activeEmpresa?.cnpj || "empresa"}_${periodoSlug}.csv`;

    const res = await saveCsvFile(defaultName, csvContent, "Salvar Relatório de NFC-e (.csv)");
    if (res.canceled) return;
    if (res.success) {
      onNotify(`Relatório em Planilha Excel exportado com sucesso! (${filteredNotas.length} notas)`, "success");
    } else {
      onNotify(res.error || "Erro ao exportar planilha CSV.", "error");
    }
  };

  // Salvar XML individual de NFC-e
  const handleSaveXml = async (nota: ParsedNfce) => {
    if (!activeEmpresa) return;
    try {
      const res = await saveSingleNfceXml(
        activeEmpresa.cnpj,
        nota.chNFe,
        activeEmpresa.razaoSocial,
        nota.fullPath
      );
      if (res.canceled) return;
      if (res.success) {
        onNotify("Arquivo XML da NFC-e salvo com sucesso!", "success");
      } else {
        onNotify(res.error || "Erro ao salvar XML da NFC-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao salvar XML: ${err.message}`, "error");
    }
  };

  // Filtros aplicados
  const filteredNotas = useMemo(() => {
    return notas.filter((n) => {
      if (!debouncedSearchTerm.trim()) return true;
      const term = debouncedSearchTerm.trim().toLowerCase();
      const numQuery = term.replace(/^(n[º°o]?|nfc?-?e|#)\s*/i, "").trim();
      const isShortNumeric = /^\d{1,10}$/.test(numQuery);
      const destCnpjDigits = String(n.cnpjDest || "").replace(/\D/g, "");

      if (isShortNumeric) {
        const normDocNum = String(n.nNF || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
        const normQuery = numQuery.replace(/^0+/, "") || "0";
        const rawDocDigits = String(n.nNF || "").replace(/\D/g, "");
        const numMatch =
          normDocNum === normQuery ||
          normDocNum.startsWith(normQuery) ||
          rawDocDigits === numQuery;
        const cnpjMatch = numQuery.length >= 8 && destCnpjDigits.includes(numQuery);
        return numMatch || cnpjMatch;
      }

      const termDigits = term.replace(/\D/g, "");
      const num = String(n.nNF || "").toLowerCase();
      const chave = String(n.chNFe || "").toLowerCase();
      const dest = String(n.destinatario || "").toLowerCase();
      const destCnpj = String(n.cnpjDest || "").toLowerCase();
      const valor = String(n.vNF || "").replace(".", ",");
      return (
        num.includes(term) ||
        chave.includes(term) ||
        (termDigits.length >= 11 && chave.includes(termDigits)) ||
        dest.includes(term) ||
        destCnpj.includes(term) ||
        (termDigits.length >= 6 && destCnpjDigits.includes(termDigits)) ||
        valor.includes(term)
      );
    });
  }, [notas, debouncedSearchTerm]);

  // Indicadores
  const metrics = useMemo(() => {
    const total = filteredNotas.length;
    const valorTotal = filteredNotas.reduce((acc, n) => acc + (Number(n.vNF) || 0), 0);
    const media = total > 0 ? valorTotal / total : 0;
    return {
      total,
      valorTotal,
      media,
    };
  }, [filteredNotas]);

  // Ordenação das notas NFC-e (menor para o maior / maior para o menor)
  const sortedNotas = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filteredNotas].sort((a, b) => {
      switch (sortColumn) {
        case "numero": {
          const valA = Number(String(a.nNF || "0").replace(/\D/g, "")) || 0;
          const valB = Number(String(b.nNF || "0").replace(/\D/g, "")) || 0;
          return (valA - valB) * dir;
        }
        case "dataEmissao": {
          const tsA = parseDateToTimestamp(a.dhEmi || a.formattedDate || "");
          const tsB = parseDateToTimestamp(b.dhEmi || b.formattedDate || "");
          if (tsA !== tsB) return (tsA - tsB) * dir;
          const numA = Number(String(a.nNF || "0").replace(/\D/g, "")) || 0;
          const numB = Number(String(b.nNF || "0").replace(/\D/g, "")) || 0;
          return (numA - numB) * dir;
        }
        case "destinatario": {
          const dA = a.destinatario || "Consumidor Final";
          const dB = b.destinatario || "Consumidor Final";
          return dA.localeCompare(dB, "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        }
        case "cnpj": {
          const cA = (a.cnpjDest || "").replace(/\D/g, "");
          const cB = (b.cnpjDest || "").replace(/\D/g, "");
          return cA.localeCompare(cB) * dir;
        }
        case "situacao": {
          const sA = a.isCancelada ? 1 : 0;
          const sB = b.isCancelada ? 1 : 0;
          return (sA - sB) * dir;
        }
        case "valorTotal":
          return ((Number(a.vNF) || 0) - (Number(b.vNF) || 0)) * dir;
        default:
          return 0;
      }
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
        handleSyncNfce();
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
        {/* Grupo Esquerdo: Ação Principal de Sincronização e Pasta Local */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSyncNfce}
            disabled={syncing || !activeEmpresa || (activeEmpresa.certInfo?.isExpired ?? false)}
            className="vb-btn vb-btn-primary"
            title="Consultar WebService SEFAZ de NFC-e (Atalho: F5)"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin text-[#003366]" : "text-[#003366]"} />
            <span>{syncing ? "Sincronizando..." : "Sincronizar NFC-e (F5)"}</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta local onde os arquivos XML e DANFEs de NFC-e são gravados"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta</span>
          </button>
        </div>

        {/* Grupo Direito: Exportações e Manutenção de Cache */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || filteredNotas.length === 0}
            className="vb-btn"
            title="Exportar planilha consolidada com todas as notas NFC-e para o Microsoft Excel (.csv)"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport("all")}
            disabled={exporting || filteredNotas.length === 0}
            className="vb-btn"
            title="Salvar arquivo ZIP com XMLs e DANFEs da competência selecionada"
          >
            <Archive size={13} className="text-[#005a9e]" />
            <span>Exportar Pacote (.ZIP)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              if (activeEmpresa) {
                loadNotas(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
                onNotify("Lista de NFC-e atualizada!", "success");
              }
            }}
            disabled={loading}
            className="vb-btn"
            title="Atualizar lista de cupons da tabela"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>Atualizar Grid</span>
          </button>

          <button
            type="button"
            onClick={() => {
              loadCacheState();
              setShowResetModal(true);
            }}
            disabled={syncing || !activeEmpresa}
            className="vb-btn"
            title="Reiniciar cache de chaves da NFC-e para forçar nova consulta e download completo"
          >
            <RotateCcw size={13} className="text-[#aa4400]" />
            <span>Reiniciar Cache</span>
          </button>
        </div>
      </div>

      {/* 4. Área de Trabalho Principal */}
      <div className="p-2 flex-1 flex flex-col gap-2 overflow-y-auto">

        {/* Aviso de modelo desabilitado se aplicável */}
        {activeEmpresa && activeEmpresa.modelosHabilitados?.nfce === false && (
          <div className="bg-[#fff9e6] border border-[#d4a017] p-2 flex items-center justify-between text-[#664d03] text-[11px] mb-1">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} className="text-[#b28900]" />
              <span>Esta empresa está configurada com a captação de <strong>NFC-e (Mod. 65) desativada</strong> no painel de modelos.</span>
            </div>
            <button type="button" onClick={() => onOpenCompanyModal?.("empresas")} className="vb-btn">
              Habilitar no Painel
            </button>
          </div>
        )}

        {/* Barra de Progresso ao Vivo da Sincronização */}
        {syncing && syncProgress && (
          <div className="bg-[#eef5fc] border border-[#99bce8] p-2 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between font-semibold text-[#003366]">
              <span className="flex items-center gap-1.5">
                <RotateCw size={12} className="animate-spin text-[#003366]" />
                {syncProgress.message}
              </span>
              <span className="font-mono">
                {syncProgress.current} / {syncProgress.total} ({Math.round((syncProgress.current / (syncProgress.total || 1)) * 100)}%)
              </span>
            </div>
            <div className="w-full bg-[#d0e0f0] h-1.5 rounded-none overflow-hidden">
              <div
                className="bg-[#005a9e] h-full transition-all duration-200"
                style={{
                  width: `${Math.min(100, Math.round((syncProgress.current / (syncProgress.total || 1)) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* GroupBox 1: Parâmetros de Comunicação e Conexão SEFAZ (Linha Única Compacta) */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Status da Conexão SEFAZ & Parâmetros de Busca de NFC-e</legend>
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

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#333333]">Retroativo:</span>
                <select
                  value={diasRetroativos}
                  onChange={(e) => setDiasRetroativos(Number(e.target.value))}
                  disabled={syncing}
                  className="vb-input font-bold"
                >
                  <option value={15}>Últimos 15 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={60}>Últimos 60 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </div>

              {appSettings?.modelSchedulers?.nfce?.enabled && (
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px]">
                  <Clock size={11} className="text-[#005a9e]" />
                  <span>Busca Diária: <strong>{appSettings.modelSchedulers.nfce.time}</strong></span>
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

        {/* GroupBox 2: Resumo Operacional da Competência (Métricas) */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Totais e Resumo Financeiro da Competência ({selectedMonth === "all" ? "Todas" : selectedMonth})</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Total de Cupons (NFC-e)</span>
              <span className="text-base font-bold text-[#003366]">{metrics.total}</span>
              <span className="text-[10px] text-[#777777]">Cupons autorizados</span>
            </div>

            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Valor Total Movimentado</span>
              <span className="text-base font-bold text-[#107c41] font-mono">{formatBRL(metrics.valorTotal)}</span>
              <span className="text-[10px] text-[#777777]">Soma total dos cupons</span>
            </div>

            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <span className="text-[10px] text-[#555555] font-semibold uppercase">Ticket Médio</span>
              <span className="text-base font-bold text-[#333333] font-mono">{formatBRL(metrics.media)}</span>
              <span className="text-[10px] text-[#777777]">Média por cupom / venda</span>
            </div>
          </div>
        </fieldset>

        {/* GroupBox 3: Filtros de Pesquisa */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Filtros de Pesquisa e Seleção</legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#333333]">Competência:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="vb-input font-semibold"
              >
                <option value="all">Todas as Competências</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Competência: {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">Pesquisar Cupom:</span>
              <input
                type="text"
                placeholder="Número, chave, consumidor, valor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="vb-input w-64 font-mono"
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

        {/* GroupBox 4: Dados da NFC-e Selecionada na Grid */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Dados do Cupom Selecionado na Grid (Atalhos: Enter = Abrir DANFE | F5 = Sincronizar)</legend>
          {selectedNota ? (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-[#ffffff] border border-[#d0d0d0] p-2">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-[10px] text-[#666666] block">Número / Série:</span>
                  <span className="font-bold text-[#003366] text-xs">NFC-e {selectedNota.nNF} (Série {selectedNota.serie || "1"})</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Data Emissão:</span>
                  <span className="font-semibold text-[#222222]">{selectedNota.formattedDate || selectedNota.dhEmi || "-"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Destinatário:</span>
                  <span className="font-bold text-[#222222]">{selectedNota.destinatario || "Consumidor Final"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">CPF / CNPJ Destinatário:</span>
                  <span className="font-mono text-[#444444]">{selectedNota.cnpjDest || "Não informado"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666] block">Situação:</span>
                  <span className={`font-semibold px-1 py-0.2 rounded text-[10px] ${selectedNota.isCancelada ? "bg-[#fdeeed] text-[#8a1f11]" : "bg-[#d4edda] text-[#155724]"}`}>
                    {selectedNota.isCancelada ? "CANCELADA" : "AUTORIZADA"}
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
                  title="Abrir DANFE oficial da NFC-e em PDF no leitor padrão do Windows"
                >
                  <FileText size={12} className="text-[#aa2222]" />
                  <span>➔ Abrir DANFE PDF (Enter)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveXml(selectedNota)}
                  className="vb-btn"
                  title="Salvar arquivo XML individual da NFC-e"
                >
                  <Download size={12} />
                  <span>Salvar XML</span>
                </button>

                {selectedNota.chNFe && (
                  <button
                    type="button"
                    onClick={() => handleCopyKey(selectedNota.chNFe)}
                    className="vb-btn"
                    title="Copiar chave de acesso de 44 dígitos"
                  >
                    {copiedKey === selectedNota.chNFe ? <Check size={12} className="text-[#107c41]" /> : <Copy size={12} />}
                    <span>{copiedKey === selectedNota.chNFe ? "Copiada!" : "Copiar Chave"}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-[#666666] italic py-1 text-center bg-[#ffffff] border border-[#d0d0d0]">
              Nenhum cupom selecionado. Clique em uma linha na grid abaixo para visualizar ações rápidas.
            </div>
          )}
        </fieldset>

        {/* 5. DataGrid Clássica de NFC-e */}
        <div className="border border-[#999999] bg-[#ffffff] flex-1 flex flex-col min-h-[300px]">
          <div className="bg-[#f0f0f0] border-b border-[#c0c0c0] px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#003366]">
            <span>Relação de Cupons Fiscais (NFC-e Modelo 65) ({filteredNotas.length} registro(s) encontrado(s))</span>
            <span className="text-[10px] text-[#555555]">
              Exibindo {displayedNotas.length} de {filteredNotas.length} cupons | Duplo clique para abrir DANFE
            </span>
          </div>

          <div className="overflow-auto flex-1 custom-scrollbar">
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("numero")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px" }}
                    title="Clique para ordenar por número da NFC-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>NFC-e / Série</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "numero" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("dataEmissao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "135px" }}
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
                    onClick={() => handleHeaderSort("destinatario")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    title="Clique para ordenar por destinatário"
                  >
                    <div className="flex items-center justify-between">
                      <span>Destinatário / Consumidor</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "destinatario" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("cnpj")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "135px" }}
                    title="Clique para ordenar por CPF/CNPJ"
                  >
                    <div className="flex items-center justify-between">
                      <span>CPF / CNPJ</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "cnpj" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("situacao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "100px", textAlign: "center" }}
                    title="Clique para ordenar por situação"
                  >
                    <div className="flex items-center justify-between">
                      <span>Situação</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "situacao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valorTotal")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "120px", textAlign: "right" }}
                    title="Clique para ordenar por valor total"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Total</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valorTotal" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "165px", textAlign: "center" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#555555]">
                      <RefreshCw size={16} className="animate-spin inline mr-2 text-[#003366]" />
                      Carregando cupons NFC-e da empresa...
                    </td>
                  </tr>
                ) : displayedNotas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#555555]">
                      Nenhum cupom fiscal NFC-e encontrado com os filtros selecionados.
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
                          {n.nNF} <span className="text-[10px] font-normal opacity-80">(s.{n.serie || "1"})</span>
                        </td>
                        <td className="font-mono whitespace-nowrap">
                          {n.formattedDate || n.dhEmi || "-"}
                        </td>
                        <td className="font-semibold truncate max-w-[280px]" title={n.destinatario || "Consumidor Final"}>
                          {n.destinatario || "Consumidor Final"}
                        </td>
                        <td className="font-mono">
                          {n.cnpjDest || "-"}
                        </td>
                        <td className="text-center">
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${n.isCancelada ? (isSelected ? "bg-white/20 text-white" : "bg-[#fdeeed] text-[#8a1f11]") : (isSelected ? "bg-white/20 text-white" : "bg-[#d4edda] text-[#155724]")}`}>
                            {n.isCancelada ? "CANCELADA" : "AUTORIZADA"}
                          </span>
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
                              title="Abrir DANFE oficial da NFC-e em PDF"
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
                              title="Salvar arquivo XML individual da NFC-e"
                            >
                              <Download size={10} />
                              XML
                            </button>
                            {n.chNFe && (
                              <button
                                type="button"
                                onClick={(e) => {
                                e.stopPropagation();
                                handleCopyKey(n.chNFe);
                              }}
                              className="vb-btn py-0 px-1 text-[10px]"
                              title="Copiar chave de acesso completa de 44 dígitos"
                            >
                              {copiedKey === n.chNFe ? <Check size={10} className="text-[#107c41]" /> : <Copy size={10} />}
                              Chave
                            </button>
                            )}
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
              <span>Exibindo <strong>{displayedNotas.length}</strong> de <strong>{filteredNotas.length}</strong> cupons no filtro.</span>
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
              <span>Total Exibido: <strong className="text-[#107c41] font-mono">{formatBRL(displayedNotas.reduce((acc, n) => acc + (Number(n.vNF) || 0), 0))}</strong></span>
              <span>Total do Filtro: <strong className="text-[#003366] font-mono">{formatBRL(filteredNotas.reduce((acc, n) => acc + (Number(n.vNF) || 0), 0))}</strong></span>
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
          <span>Status NFC-e: <strong className={syncing ? "text-[#cc6600]" : "text-[#107c41]"}>{syncing ? "Sincronizando com a SEFAZ..." : "Pronto para Sincronização"}</strong></span>
          <span className="text-[#888888]">|</span>
          <span>Registros: <strong>{filteredNotas.length}</strong> cupons carregados</span>
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

      {/* MODAL: REINICIAR CACHE NFC-E */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-lg w-full text-[11px] text-[#000000]">
            <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <span className="font-bold text-xs">Reiniciar Cache de NFC-e (Busca Completa na SEFAZ)</span>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                disabled={resettingCache}
                className="text-white hover:bg-red-600 px-1.5 py-0.2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 space-y-3">
              <div className="bg-[#fff9e6] border border-[#d4a017] p-2 text-[11px] text-[#664d03] leading-relaxed">
                O captador armazena um índice das NFC-e que já foram baixadas para evitar requisições repetidas. Ao reiniciar o cache, o sistema esquecerá esse histórico e baixará novamente todos os XMLs e DANFEs das notas autorizadas encontradas no período retroativo configurado ({diasRetroativos} dias).
              </div>

              <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div>Chaves no Cache: <strong className="font-mono text-[#003366]">{Object.keys(nfceCacheState?.downloadedKeys || {}).length} nota(s)</strong></div>
                <div>Última Execução: <strong className="text-[#333333]">{nfceCacheState?.lastExecution ? new Date(nfceCacheState.lastExecution).toLocaleString('pt-BR') : "Nunca"}</strong></div>
                <div>Ponto Partida: <strong className="text-[#107c41]">{nfceCacheState?.ultimaDataEmissao ? new Date(nfceCacheState.ultimaDataEmissao).toLocaleDateString('pt-BR') : "Início"}</strong></div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-[#d0d0d0]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearFilesOption}
                    onChange={(e) => setClearFilesOption(e.target.checked)}
                    disabled={resettingCache}
                  />
                  <span>Apagar arquivos XML e DANFE locais existentes para reescrevê-los do zero</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncNowOption}
                    onChange={(e) => setSyncNowOption(e.target.checked)}
                    disabled={resettingCache}
                  />
                  <span>Iniciar sincronização imediatamente com a SEFAZ</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#d0d0d0]">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resettingCache}
                  className="vb-btn"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleResetCacheConfirm}
                  disabled={resettingCache}
                  className="vb-btn vb-btn-primary font-bold"
                >
                  <RotateCcw size={12} className={resettingCache ? "animate-spin" : ""} />
                  <span>{resettingCache ? "Reiniciando..." : syncNowOption ? "Reiniciar & Sincronizar" : "Apenas Reiniciar Cache"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
