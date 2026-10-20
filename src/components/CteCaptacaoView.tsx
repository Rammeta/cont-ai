import React, { useState, useEffect, useMemo } from "react";
import { EmpresaSefaz, ParsedCte, AppSettings } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import {
  Truck,
  RotateCw,
  FolderOpen,
  Download,
  Search,
  Filter,
  Calendar,
  FileText,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ChevronDown,
  Archive,
  RefreshCw,
  RotateCcw,
  Info,
  X,
  DollarSign,
  Copy,
  Check,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Settings
} from "lucide-react";
import {
  syncCompanyCte,
  listCompanyCteXmls,
  openCompanyCteFolder,
  openCteDactePdf,
  exportCteCompetencia,
  saveSingleCteXml,
  onCteProgress,
  getCompanyCteNsuState,
  resetCompanyCteNsu,
  getAppSettings,
  onSchedulerTrigger,
  saveCsvFile
} from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";
import logoImg from "../../assets/logo.png";

interface CteCaptacaoViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresaId: string | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNotify: (msg: string, type: "success" | "error" | "info") => void;
  appSettings?: AppSettings | null;
  onNavigateHub?: () => void;
  refreshKey?: number;
}

export default function CteCaptacaoView({
  empresas,
  activeEmpresaId,
  onSelectEmpresa,
  onOpenCompanyModal,
  onNotify,
  appSettings: propSettings,
  onNavigateHub,
  refreshKey,
}: CteCaptacaoViewProps) {
  const [ctes, setCtes] = useState<ParsedCte[]>([]);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ step?: string; message?: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [exporting, setExporting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [localAppSettings, setLocalAppSettings] = useState<AppSettings | null>(null);
  const appSettings = localAppSettings || propSettings;

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

  // Estados de Reinício de NSU do CT-e
  const [showResetNsuModal, setShowResetNsuModal] = useState(false);
  const [resettingNsu, setResettingNsu] = useState(false);
  const [targetNsuInput, setTargetNsuInput] = useState("0");
  const [clearFilesOption, setClearFilesOption] = useState(false);
  const [syncNowOption, setSyncNowOption] = useState(true);
  const [cteNsuState, setCteNsuState] = useState<{
    ultimoNsuCte: string;
    downloadedKeys: Record<string, any>;
    lastSync?: string;
  } | null>(null);

  const loadCteNsuState = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await getCompanyCteNsuState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      if (res.success && res.result) {
        setCteNsuState(res.result);
      }
    } catch (_) {}
  };

  const activeEmpresa = useMemo(() => {
    return empresas.find((e) => e.id === activeEmpresaId) || empresas[0] || null;
  }, [empresas, activeEmpresaId]);

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

  useEffect(() => {
    getAppSettings().then((st) => {
      if (st) setLocalAppSettings(st);
    });

    const unsubscribe = onSchedulerTrigger((payload?: any) => {
      if (!payload || payload.type === "cte") {
        if (activeEmpresa?.modelosHabilitados && activeEmpresa.modelosHabilitados.cte === false) {
          return;
        }
        onNotify(`Horário agendado atingido (${payload?.time || "diário"}): busca de CT-e disparada!`, "success");
        if (activeEmpresa && activeEmpresa.certPath && !syncing) {
          handleSyncCte();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeEmpresa, syncing, refreshKey]);

  // Carregar lista de CT-e ao trocar de empresa ou mês
  useEffect(() => {
    if (activeEmpresa) {
      loadCtes(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
      loadCteNsuState();
    } else {
      setCtes([]);
      setAvailableMonths([]);
      setCteNsuState(null);
    }
  }, [activeEmpresaId, selectedMonth, refreshKey]);

  // Listener de progresso de sincronização do CT-e
  useEffect(() => {
    const unsubscribe = onCteProgress((info: any) => {
      setSyncProgress({
        step: info.step,
        message: info.message || "",
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadCtes = async (cnpj: string, razaoSocial?: string, ym?: string) => {
    setLoading(true);
    try {
      const res = await listCompanyCteXmls(cnpj, razaoSocial, ym);
      if (res.success) {
        setCtes(res.list || []);
        if (res.months) {
          setAvailableMonths(res.months);
        }
      } else {
        onNotify(res.error || "Erro ao carregar conhecimentos de transporte.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro na leitura do CT-e: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCte = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa com certificado digital A1.", "error");
      return;
    }

    if (!activeEmpresa.certPath) {
      onNotify("Empresa sem Certificado Digital A1 configurado.", "error");
      onOpenCompanyModal();
      return;
    }

    setSyncing(true);
    setSyncProgress({ step: "Iniciando", message: "Conectando ao WebService CTeDistribuicaoDFe..." });

    try {
      const res = await syncCompanyCte(activeEmpresa);
      if (res.success) {
        const novos = res.result?.novosDocumentos || 0;
        onNotify(
          `Sincronização CT-e concluída! ${novos} novo(s) documento(s) capturado(s).`,
          "success"
        );
        await loadCtes(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
        await loadCteNsuState();
      } else {
        onNotify(res.error || "Erro na consulta do WebService CT-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Falha ao sincronizar CT-e: ${err.message}`, "error");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleResetNsuConfirm = async () => {
    if (!activeEmpresa) return;
    setResettingNsu(true);
    try {
      const res = await resetCompanyCteNsu(
        activeEmpresa.cnpj,
        activeEmpresa.razaoSocial,
        targetNsuInput,
        clearFilesOption
      );
      if (res.success) {
        setShowResetNsuModal(false);
        await loadCteNsuState();
        if (clearFilesOption) {
          await loadCtes(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
        }
        if (syncNowOption) {
          onNotify(`NSU do CT-e reiniciado para ${targetNsuInput}. Iniciando busca na SEFAZ Nacional...`, "success");
          handleSyncCte();
        } else {
          onNotify(`NSU do CT-e reiniciado com sucesso para ${targetNsuInput}.`, "success");
        }
      } else {
        onNotify(res.error || "Falha ao reiniciar NSU do CT-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao reiniciar NSU: ${err.message}`, "error");
    } finally {
      setResettingNsu(false);
    }
  };

  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await openCompanyCteFolder(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir o diretório.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro: ${err.message}`, "error");
    }
  };

  const handleOpenDacte = async (cte: ParsedCte) => {
    try {
      const res = await openCteDactePdf(cte.pdfPath, cte.fullPath);
      if (!res.success) {
        onNotify(res.error || "Erro ao abrir DACTE PDF.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir DACTE: ${err.message}`, "error");
    }
  };

  const handleCopyKey = (chave: string) => {
    navigator.clipboard.writeText(chave);
    setCopiedKey(chave);
    onNotify("Chave de acesso copiada para a área de transferência!", "success");
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };

  const handleExportZip = async (exportType: "all" | "xml" | "pdf" = "all") => {
    if (!activeEmpresa) return;
    setExporting(true);
    try {
      const res = await exportCteCompetencia(
        activeEmpresa.cnpj,
        activeEmpresa.razaoSocial,
        selectedMonth,
        exportType
      );
      if (res.canceled) return;
      if (res.success) {
        onNotify(`Pacote compactado exportado com sucesso! (${res.fileCount || 0} arquivos)`, "success");
      } else {
        onNotify(res.error || "Erro ao exportar arquivos.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro na exportação: ${err.message}`, "error");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveXml = async (cte: ParsedCte) => {
    if (!activeEmpresa) return;
    try {
      const res = await saveSingleCteXml(
        activeEmpresa.cnpj,
        cte.chCTe,
        activeEmpresa.razaoSocial,
        cte.fullPath
      );
      if (res.canceled) return;
      if (res.success) {
        onNotify("Arquivo XML do CT-e salvo com sucesso!", "success");
      } else {
        onNotify(res.error || "Erro ao salvar XML do CT-e.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao salvar XML: ${err.message}`, "error");
    }
  };

  // Exportar Relatório em Planilha CSV / Excel
  const handleExportCsv = async () => {
    if (filteredCtes.length === 0) {
      onNotify("Nenhum CT-e encontrado para exportar o relatório.", "error");
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
      "Número CT-e",
      "Série",
      "Chave de Acesso",
      "CFOP",
      "Modal",
      "Transportadora (Emitente)",
      "CNPJ Transportadora",
      "UF Emit",
      "Tomador do Frete",
      "CNPJ Tomador",
      "Papel do Tomador",
      "Remetente",
      "CNPJ Remetente",
      "UF Rem",
      "Destinatário",
      "CNPJ Destinatário",
      "UF Dest",
      "Valor Prestação (vTPrest)",
      "Valor a Receber (vRec)",
      "Operação",
      "Situação"
    ];

    let totTPrest = 0, totRec = 0;

    const rows = filteredCtes.map((c) => {
      const vTPrest = Number(c.vTPrest) || 0;
      const vRec = Number(c.vRec) || 0;
      totTPrest += vTPrest;
      totRec += vRec;

      const comp = c.folder && c.folder !== "indefinido" ? c.folder : (c.dhEmi ? c.dhEmi.substring(0, 7) : "-");
      const chaveExcel = c.chCTe ? `="${c.chCTe}"` : '""';
      const escape = (txt: string) => `"${String(txt || "").replace(/"/g, '""')}"`;
      const situacao = c.isCancelada ? "Cancelada" : "Autorizada";

      return [
        escape(comp),
        escape(c.formattedDate || c.dhEmi || "-"),
        escape(c.nCT || "-"),
        escape(c.serie || "1"),
        chaveExcel,
        escape(c.cfop || "-"),
        escape(c.modal || "Rodoviário"),
        escape(c.emitente || ""),
        escape(formatDoc(c.cnpjEmitente)),
        escape(c.ufEmit || ""),
        escape(c.tomador || ""),
        escape(formatDoc(c.cnpjTomador)),
        escape(c.papelTomador || "Tomador"),
        escape(c.remetente || ""),
        escape(formatDoc(c.cnpjRem)),
        escape(c.ufRem || ""),
        escape(c.destinatario || ""),
        escape(formatDoc(c.cnpjDest)),
        escape(c.ufDest || ""),
        escape(formatMoeda(vTPrest)),
        escape(formatMoeda(vRec)),
        escape(c.isInterestadual ? "Interestadual" : "Interna"),
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
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      `"${filteredCtes.length} conhecimento(s)"`,
      `"${formatMoeda(totTPrest)}"`,
      `"${formatMoeda(totRec)}"`,
      '""',
      '""'
    ].join(";");

    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...rows, linhaTotais].join("\r\n");
    const periodoSlug = selectedMonth === "all" ? "geral" : selectedMonth;
    const defaultName = `relatorio_cte_${activeEmpresa?.cnpj || "empresa"}_${periodoSlug}.csv`;

    const res = await saveCsvFile(defaultName, csvContent, "Salvar Relatório de CT-e (.csv)");
    if (res.canceled) return;
    if (res.success) {
      onNotify(`Relatório em Planilha Excel exportado com sucesso! (${filteredCtes.length} CT-e)`, "success");
    } else {
      onNotify(res.error || "Erro ao exportar planilha CSV.", "error");
    }
  };

  // Filtros aplicados
  const filteredCtes = useMemo(() => {
    return ctes.filter((c) => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.trim().toLowerCase();
      const numQuery = term.replace(/^(n[º°o]?|ct-?e|#)\s*/i, "").trim();
      const isShortNumeric = /^\d{1,10}$/.test(numQuery);
      const emitCnpjDigits = String(c.cnpjEmitente || "").replace(/\D/g, "");

      if (isShortNumeric) {
        const normDocNum = String(c.nCT || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
        const normQuery = numQuery.replace(/^0+/, "") || "0";
        const rawDocDigits = String(c.nCT || "").replace(/\D/g, "");
        const numMatch =
          normDocNum === normQuery ||
          normDocNum.startsWith(normQuery) ||
          rawDocDigits === numQuery;
        const cnpjMatch = numQuery.length >= 8 && emitCnpjDigits.includes(numQuery);
        return numMatch || cnpjMatch;
      }

      const termDigits = term.replace(/\D/g, "");
      const num = String(c.nCT || "").toLowerCase();
      const chave = String(c.chCTe || "").toLowerCase();
      const trans = String(c.emitente || "").toLowerCase();
      const tom = String(c.tomador || "").toLowerCase();
      const rem = String(c.remetente || "").toLowerCase();
      const dest = String(c.destinatario || "").toLowerCase();
      const valor = String(c.vTPrest || "").replace(".", ",");
      return (
        num.includes(term) ||
        chave.includes(term) ||
        (termDigits.length >= 11 && chave.includes(termDigits)) ||
        trans.includes(term) ||
        (termDigits.length >= 6 && emitCnpjDigits.includes(termDigits)) ||
        tom.includes(term) ||
        rem.includes(term) ||
        dest.includes(term) ||
        valor.includes(term)
      );
    });
  }, [ctes, searchTerm]);

  // Indicadores
  const metrics = useMemo(() => {
    const total = filteredCtes.length;
    const valorTotal = filteredCtes.reduce((acc, c) => acc + (Number(c.vTPrest) || 0), 0);
    const media = total > 0 ? valorTotal / total : 0;
    return {
      total,
      valorTotal,
      media,
    };
  }, [filteredCtes]);

  // Ordenação dos CT-es (menor para o maior / maior para o menor)
  const sortedCtes = useMemo(() => {
    return [...filteredCtes].sort((a, b) => {
      let valA: any = "";
      let valB: any = "";
      switch (sortColumn) {
        case "numero":
          valA = Number(String(a.nCT || "0").replace(/\D/g, "")) || 0;
          valB = Number(String(b.nCT || "0").replace(/\D/g, "")) || 0;
          break;
        case "dataEmissao":
          valA = a.dhEmi || "";
          valB = b.dhEmi || "";
          break;
        case "emitente":
          valA = (a.emitente || "").toLowerCase();
          valB = (b.emitente || "").toLowerCase();
          break;
        case "tomador":
          valA = (a.tomadorNome || "").toLowerCase();
          valB = (b.tomadorNome || "").toLowerCase();
          break;
        case "rota":
          valA = ((a.ufIni || "") + (a.ufFim || "")).toLowerCase();
          valB = ((b.ufIni || "") + (b.ufFim || "")).toLowerCase();
          break;
        case "valor":
          valA = Number(a.vTPrest) || 0;
          valB = Number(b.vTPrest) || 0;
          break;
        default:
          valA = "";
          valB = "";
      }
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCtes, sortColumn, sortDirection]);

  // CT-es fatiados com base no limite de exibição para máxima performance
  const displayedCtes = useMemo(() => {
    return sortedCtes.slice(0, displayLimit);
  }, [sortedCtes, displayLimit]);

  // CT-e selecionado na grid
  const selectedCte = useMemo(() => {
    return filteredCtes.find((c) => c.chCTe === selectedChave) || null;
  }, [filteredCtes, selectedChave]);

  // Seleciona o primeiro CT-e automaticamente se nenhum estiver selecionado
  useEffect(() => {
    if (filteredCtes.length > 0 && !selectedChave) {
      setSelectedChave(filteredCtes[0].chCTe);
    }
  }, [filteredCtes, selectedChave]);

  // Atalhos de teclado (Enter para abrir DACTE, Setas para navegar, F5 para sincronizar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Enter" && selectedCte) {
        e.preventDefault();
        handleOpenDacte(selectedCte);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const curIdx = displayedCtes.findIndex((c) => c.chCTe === selectedChave);
        if (curIdx >= 0 && curIdx < displayedCtes.length - 1) {
          setSelectedChave(displayedCtes[curIdx + 1].chCTe);
        } else if (curIdx === -1 && displayedCtes.length > 0) {
          setSelectedChave(displayedCtes[0].chCTe);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curIdx = displayedCtes.findIndex((c) => c.chCTe === selectedChave);
        if (curIdx > 0) {
          setSelectedChave(displayedCtes[curIdx - 1].chCTe);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        handleSyncCte();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedCtes, selectedChave, selectedCte]);

  const formatBRL = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

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
          white-space: nowrap;
        }
        .datagrid-table tr.selected {
          background-color: #005a9e !important;
          color: #ffffff !important;
        }
        .datagrid-table tr.selected td {
          color: #ffffff !important;
          border-right-color: #004578;
        }
        .datagrid-table tr:hover:not(.selected) {
          background-color: #eef5fd;
        }
      `}</style>

      {/* 3. BARRA DE FERRAMENTAS CLÁSSICA PADRONIZADA (TOOLBAR ERP) */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-2xs">
        {/* Grupo Esquerdo: Ação Principal de Sincronização e Pasta Local */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSyncCte}
            disabled={syncing || !activeEmpresa}
            className="vb-btn vb-btn-primary"
            title="Consultar WebService CTeDistribuicaoDFe da SEFAZ Nacional (Atalho: F5)"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin text-[#003366]" : "text-[#003366]"} />
            <span>{syncing ? "Consultando SEFAZ..." : "⚡ Sincronizar CT-e (F5)"}</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta local no Windows Explorer onde os XMLs e DACTEs estão armazenados"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta</span>
          </button>
        </div>

        {/* Grupo Direito: Exportações e Manutenção NSU */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exporting || filteredCtes.length === 0}
            className="vb-btn"
            title="Exportar planilha consolidada de conhecimentos de transporte (CT-e) para o Microsoft Excel (.csv)"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportZip("all")}
            disabled={exporting || filteredCtes.length === 0}
            className="vb-btn"
            title="Salvar arquivo ZIP compactado contendo XMLs e DACTEs em PDF"
          >
            <Archive size={13} className={exporting ? "animate-spin text-[#005a9e]" : "text-[#005a9e]"} />
            <span>Exportar Pacote (.ZIP)</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportZip("xml")}
            disabled={exporting || filteredCtes.length === 0}
            className="vb-btn"
            title="Salvar arquivo ZIP contendo exclusivamente os arquivos XMLs assinados"
          >
            <Download size={13} className="text-[#005a9e]" />
            <span>Apenas XMLs</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              setTargetNsuInput("0");
              loadCteNsuState();
              setShowResetNsuModal(true);
            }}
            disabled={syncing || !activeEmpresa}
            className="vb-btn"
            title="Reiniciar ponteiro NSU sequencial do CT-e para busca completa na SEFAZ"
          >
            <RotateCcw size={13} className="text-[#aa4400]" />
            <span>Reiniciar NSU</span>
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL DE CONTEÚDO */}
      <div className="p-2 flex flex-col gap-2 flex-1 overflow-auto">
        {/* GROUPBOX 1: STATUS DO WEBSERVICE SEFAZ & IDENTIFICAÇÃO DA EMPRESA */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Truck size={13} />
            <span>Status da Conexão SEFAZ (CTeDistribuicaoDFe) & Identificação da Empresa</span>
          </legend>
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
                <CertificateBadge
                  certInfo={activeEmpresa?.certInfo}
                  onClick={() => onOpenCompanyModal("empresas")}
                />
              </div>

              <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]" />
                <span>NSU CT-e: <strong>{cteNsuState?.ultimoNsuCte || "0"}</strong> ({Object.keys(cteNsuState?.downloadedKeys || {}).length} docs em cache)</span>
              </div>

              {appSettings?.modelSchedulers?.cte?.enabled && (
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px]">
                  <Clock size={11} className="text-[#005a9e]" />
                  <span>Busca Diária: <strong>{appSettings.modelSchedulers.cte.time}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenCompanyModal("empresas")}
                className="vb-btn text-[11px]"
              >
                <Building2 size={12} />
                <span>Gerenciar Cadastro</span>
              </button>
            </div>
          </div>

          {/* Barra de Progresso quando Sincronizando */}
          {syncProgress && (
            <div className="mt-2 p-1.5 bg-[#fff8e7] border border-[#f0c36d] text-[#8a5300] text-[11px] flex items-center gap-2">
              <RotateCw size={13} className="animate-spin text-amber-700 shrink-0" />
              <span className="font-bold">SEFAZ Nacional CT-e:</span>
              <span>{syncProgress.message}</span>
            </div>
          )}
        </fieldset>

        {/* GROUPBOX 2: FILTROS DE PESQUISA & INDICADORES RÁPIDOS */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Filter size={13} />
            <span>Filtros de Pesquisa & Indicadores Rápidos de Frete</span>
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Controles de Filtro */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#444444]">Competência:</span>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="vb-input font-bold text-[#003366] bg-white cursor-pointer w-44"
                >
                  <option value="all">Todas as Competências</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#444444]">Pesquisa Rápida:</span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nº CT-e, chave, transportadora, tomador..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="vb-input w-64 pr-5"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-[#777777] hover:text-[#000000] text-[10px]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (activeEmpresa) {
                    loadCtes(activeEmpresa.cnpj, activeEmpresa.razaoSocial, selectedMonth);
                    onNotify("Lista de conhecimentos CT-e recarregada!", "success");
                  }
                }}
                disabled={loading}
                className="vb-btn"
                title="Recarregar dados do disco local"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Painel de Indicadores Financeiros do CT-e */}
            <div className="flex items-center gap-2 bg-[#ffffff] border border-[#c0c0c0] p-1 px-2.5">
              <div className="text-right pr-2 border-r border-[#e0e0e0]">
                <span className="text-[10px] text-[#555555] block">Total CT-e:</span>
                <strong className="text-[12px] font-mono text-[#003366]">{metrics.total}</strong>
              </div>
              <div className="text-right pr-2 border-r border-[#e0e0e0]">
                <span className="text-[10px] text-[#555555] block">Total Fretes R$:</span>
                <strong className="text-[12px] font-mono text-emerald-800">{formatBRL(metrics.valorTotal)}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#555555] block">Frete Médio R$:</span>
                <strong className="text-[12px] font-mono text-blue-900">{formatBRL(metrics.media)}</strong>
              </div>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 3: PAINEL DE DADOS DO CONHECIMENTO SELECIONADO NA GRID */}
        {selectedCte && (
          <fieldset className="vb-groupbox bg-[#fdfdfd]">
            <legend className="vb-legend flex items-center gap-1.5">
              <FileText size={13} className="text-[#003366]" />
              <span>
                Dados do Conhecimento Selecionado na Grid (CT-e nº {selectedCte.nCT || "-"} • Série {selectedCte.serie || "1"})
              </span>
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px] items-center">
              <div>
                <span className="text-[#555555] block">Chave de Acesso (44 dígitos):</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-[#222222] truncate max-w-[180px]" title={selectedCte.chCTe}>
                    {selectedCte.chCTe || "-"}
                  </span>
                  {selectedCte.chCTe && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(selectedCte.chCTe)}
                      className="text-blue-700 hover:text-blue-900 cursor-pointer"
                      title="Copiar chave de acesso completa"
                    >
                      {copiedKey === selectedCte.chCTe ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>

              <div>
                <span className="text-[#555555] block">Transportadora (Emitente):</span>
                <strong className="text-[#003366] truncate block" title={selectedCte.emitente || ""}>
                  {selectedCte.emitente || "Não informada"}
                </strong>
                <span className="text-[10px] text-[#666666] font-mono">
                  {selectedCte.cnpjEmitente ? `CNPJ: ${selectedCte.cnpjEmitente}` : ""} {selectedCte.ufEmit ? `(${selectedCte.ufEmit})` : ""}
                </span>
              </div>

              <div>
                <span className="text-[#555555] block">Tomador do Frete ({selectedCte.papelTomador || "Tomador"}):</span>
                <strong className="text-[#222222] truncate block" title={selectedCte.tomador || ""}>
                  {selectedCte.tomador || "Não informado"}
                </strong>
                <span className="text-[10px] text-[#666666] font-mono">
                  {selectedCte.cnpjTomador ? `CNPJ: ${selectedCte.cnpjTomador}` : ""}
                </span>
              </div>

              <div>
                <span className="text-[#555555] block">Rota & Modal:</span>
                <div className="font-bold text-[#333333] flex items-center gap-1">
                  <span>{selectedCte.ufRem || selectedCte.ufEmit || "?"}</span>
                  <ArrowRight size={11} className="text-amber-700" />
                  <span>{selectedCte.ufDest || "?"}</span>
                  <span className="text-[10px] font-normal text-[#777777] ml-1">({selectedCte.modal || "Rodoviário"})</span>
                </div>
                <span className="text-[10px] text-[#666666]">
                  Emissão: {selectedCte.formattedDate || selectedCte.dhEmi || "-"}
                </span>
              </div>

              {/* Botões de Ação para a Linha Selecionada */}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenDacte(selectedCte)}
                  className="vb-btn vb-btn-primary"
                  title="Abrir DACTE oficial do CT-e em PDF no leitor padrão (Pressione Enter)"
                >
                  <FileText size={12} className="text-rose-700" />
                  <span>Abrir DACTE (Enter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveXml(selectedCte)}
                  className="vb-btn"
                  title="Salvar arquivo XML original do CT-e"
                >
                  <Download size={12} className="text-blue-700" />
                  <span>Salvar XML</span>
                </button>
              </div>
            </div>
          </fieldset>
        )}

        {/* 4. DATAGRID ERP DE CONHECIMENTOS DE TRANSPORTE (CT-E) */}
        <div className="border border-[#999999] bg-white flex flex-col flex-1 min-h-[280px] overflow-hidden">
          <div className="overflow-auto flex-1">
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("numero")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px" }}
                    title="Clique para ordenar por número do CT-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>CT-e / Série</span>
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
                      <span>Emissão / Compet.</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "dataEmissao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("emitente")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    title="Clique para ordenar por transportadora"
                  >
                    <div className="flex items-center justify-between">
                      <span>Transportadora (Emitente)</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "emitente" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("tomador")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    title="Clique para ordenar por tomador"
                  >
                    <div className="flex items-center justify-between">
                      <span>Tomador / Papel</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "tomador" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("rota")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "110px" }}
                    title="Clique para ordenar por rota"
                  >
                    <div className="flex items-center justify-between">
                      <span>Rota / Modal</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "rota" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valor")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "115px", textAlign: "right" }}
                    title="Clique para ordenar por valor do frete"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Frete</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valor" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "140px", textAlign: "center" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#555555]">
                      <RotateCw size={16} className="animate-spin inline mr-1 text-[#003366]" />
                      Carregando conhecimentos de transporte do disco...
                    </td>
                  </tr>
                ) : filteredCtes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-[#777777]">
                      Nenhum CT-e localizado com os critérios pesquisados.
                    </td>
                  </tr>
                ) : (
                  displayedCtes.map((c) => {
                    const isSelected = selectedChave === c.chCTe;
                    const chaveCurta = c.chCTe
                      ? `${c.chCTe.substring(0, 6)}...${c.chCTe.substring(Math.max(0, c.chCTe.length - 6))}`
                      : "";

                    return (
                      <tr
                        key={c.chCTe}
                        className={isSelected ? "selected" : ""}
                        onClick={() => setSelectedChave(c.chCTe)}
                        onDoubleClick={() => handleOpenDacte(c)}
                        style={{ cursor: "pointer" }}
                      >
                        {/* CT-e / Série */}
                        <td>
                          <div className="font-mono font-bold text-[11px]">
                            {c.nCT || "-"} <span className="text-[10px] font-normal opacity-80">(s.{c.serie || "1"})</span>
                          </div>
                          <div className="text-[9px] opacity-75 font-mono">{chaveCurta}</div>
                        </td>

                        {/* Data Emissão / Competência */}
                        <td>
                          <div>{c.formattedDate || c.dhEmi || "-"}</div>
                          <div className="text-[9px] opacity-75">Comp: {c.folder || "-"}</div>
                        </td>

                        {/* Transportadora */}
                        <td>
                          <div className="font-semibold truncate max-w-xs" title={c.emitente || ""}>
                            {c.emitente || "Transportadora"}
                          </div>
                          <div className="text-[9px] opacity-75 font-mono">
                            {c.cnpjEmitente ? `CNPJ: ${c.cnpjEmitente}` : ""} {c.ufEmit ? `(${c.ufEmit})` : ""}
                          </div>
                        </td>

                        {/* Tomador */}
                        <td>
                          <div className="font-semibold truncate max-w-xs" title={c.tomador || ""}>
                            {c.tomador || "Tomador do Frete"}
                          </div>
                          <div className="text-[9px] opacity-75">
                            {c.papelTomador ? `Papel: ${c.papelTomador}` : "Tomador"} {c.cnpjTomador ? `• ${c.cnpjTomador}` : ""}
                          </div>
                        </td>

                        {/* Rota / Modal */}
                        <td>
                          <div className="font-bold text-[10px] flex items-center gap-1">
                            <span>{c.ufRem || c.ufEmit || "?"}</span>
                            <span>➜</span>
                            <span>{c.ufDest || "?"}</span>
                          </div>
                          <div className="text-[9px] opacity-75">{c.modal || "Rodoviário"}</div>
                        </td>

                        {/* Valor Prestação */}
                        <td style={{ textAlign: "right" }} className="font-mono font-bold">
                          {formatBRL(c.vTPrest)}
                        </td>

                        {/* Ações */}
                        <td style={{ textAlign: "center" }}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDacte(c);
                              }}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Abrir DACTE oficial do CT-e em PDF"
                            >
                              <FileText size={10} className="text-rose-700" />
                              DACTE
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveXml(c);
                              }}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Salvar XML assinado do CT-e"
                            >
                              <Download size={10} className="text-blue-700" />
                              XML
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

          {/* Paginação de Alta Performance */}
          <div className="bg-[#f0f0f0] border-t border-[#b0b0b0] p-1.5 flex flex-wrap items-center justify-between text-[11px] gap-2">
            <div className="text-[#333333]">
              Exibindo <strong>{displayedCtes.length}</strong> de <strong>{filteredCtes.length}</strong> conhecimentos de transporte
              {filteredCtes.length !== ctes.length && <span> (filtrados do total de {ctes.length})</span>}
            </div>

            <div className="flex items-center gap-1.5">
              {filteredCtes.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 100)}
                  className="vb-btn"
                >
                  + Carregar Mais 100 Conhecimentos
                </button>
              )}
              {filteredCtes.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(filteredCtes.length)}
                  className="vb-btn"
                >
                  Exibir Todos ({filteredCtes.length})
                </button>
              )}
              {displayLimit > 100 && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(100)}
                  className="vb-btn"
                >
                  Recolher para 100
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. MODAL CLASSICO WINFORMS: REINICIAR NSU CT-E */}
      {showResetNsuModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-lg w-full overflow-hidden text-[11px]">
            {/* Header WinForms */}
            <div className="bg-[#003366] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <RotateCcw size={13} />
                Reiniciar NSU do CT-e (Busca Completa na SEFAZ Nacional)
              </span>
              <button
                type="button"
                onClick={() => setShowResetNsuModal(false)}
                disabled={resettingNsu}
                className="text-white hover:bg-rose-700 px-1.5 py-0.2 rounded text-[10px]"
              >
                ✕
              </button>
            </div>

            <div className="p-3 flex flex-col gap-3">
              <div className="bg-[#ffffff] border border-[#b0b0b0] p-2.5 text-[#333333]">
                <strong className="text-[#003366] block mb-1">Como funciona a busca por NSU no CT-e?</strong>
                <p className="leading-relaxed">
                  O WebService <strong>CTeDistribuicaoDFe</strong> da SEFAZ Nacional entrega os conhecimentos emitidos contra seu CNPJ em ordem sequencial.
                  Ao definir o ponteiro para <strong>0</strong>, o sistema fará uma varredura completa de todos os CT-es emitidos nos últimos 90 dias.
                </p>
              </div>

              <div className="bg-[#ffffff] border border-[#b0b0b0] p-2 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[#666666] block">Ponteiro Atual (ultimoNsuCte):</span>
                  <strong className="font-mono text-[#003366] text-[12px]">{cteNsuState?.ultimoNsuCte || "0"}</strong>
                </div>
                <div>
                  <span className="text-[#666666] block">Docs no Histórico:</span>
                  <strong className="font-mono text-emerald-800 text-[12px]">
                    {Object.keys(cteNsuState?.downloadedKeys || {}).length} documento(s)
                  </strong>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#333333] block mb-1">Novo NSU Inicial:</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={targetNsuInput}
                    onChange={(e) => setTargetNsuInput(e.target.value)}
                    disabled={resettingNsu}
                    className="vb-input w-28 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetNsuInput("0")}
                    disabled={resettingNsu}
                    className="vb-btn"
                  >
                    Definir 0 (Busca Completa)
                  </button>
                </div>
              </div>

              <div className="border-t border-[#d0d0d0] pt-2 space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearFilesOption}
                    onChange={(e) => setClearFilesOption(e.target.checked)}
                    disabled={resettingNsu}
                  />
                  <span>Apagar arquivos locais existentes e reescrever do zero</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncNowOption}
                    onChange={(e) => setSyncNowOption(e.target.checked)}
                    disabled={resettingNsu}
                  />
                  <span>Iniciar sincronização imediatamente com a SEFAZ</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#d0d0d0] pt-2.5">
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
                  className="vb-btn vb-btn-primary"
                >
                  <RotateCcw size={12} className={resettingNsu ? "animate-spin" : ""} />
                  <span>{resettingNsu ? "Reiniciando..." : syncNowOption ? "Reiniciar & Sincronizar" : "Apenas Reiniciar NSU"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. STATUSBAR CLASSICA CONT-AI COM INDICADORES FUNCIONAIS DE CAPS E NUM */}
      <div className="bg-[#f0f0f0] border-t border-[#a0a0a0] px-2 py-1 flex items-center justify-between text-[11px] text-[#333333] shadow-inner">
        {/* Seção Esquerda: Identidade & Conexão SEFAZ */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border-r border-[#c0c0c0] pr-3">
            <img src={logoImg} alt="CONT-AI" className="h-3.5 w-auto object-contain" />
            <span className="font-bold text-[#003366]">CONT-AI - Gestor de Movimento fiscal</span>
          </div>

          <div className="flex items-center gap-1.5 border-r border-[#c0c0c0] pr-3">
            <span className={`w-2 h-2 rounded-full ${syncing ? "bg-amber-500 animate-pulse" : "bg-emerald-600"}`} />
            <span>SEFAZ WS CT-e: {syncing ? "Sincronizando..." : "Conectado"}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 border-r border-[#c0c0c0] pr-3">
            <span>Conhecimentos:</span>
            <strong>{filteredCtes.length}</strong>
            <span className="text-[#666666]">({ctes.length} total)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 border-r border-[#c0c0c0] pr-3">
            <span>Total da Seleção:</span>
            <strong className="text-emerald-800 font-mono">{formatBRL(metrics.valorTotal)}</strong>
          </div>
        </div>

        {/* Seção Direita: Relógio & Teclado (CAPS / NUM) */}
        <div className="flex items-center gap-2 font-mono text-[10px]">
          <span className="text-[#555555] hidden md:inline border-r border-[#c0c0c0] pr-2">{clock}</span>

          {/* Indicador CAPS LOCK */}
          <div
            className={`px-1.5 py-0.2 border transition-colors ${
              isCapsLockOn
                ? "bg-amber-200 border-amber-600 text-amber-900 font-bold"
                : "bg-[#e4e4e4] border-[#c0c0c0] text-[#999999]"
            }`}
            title={`CAPS LOCK está ${isCapsLockOn ? "ATIVADO" : "DESATIVADO"}`}
          >
            CAPS
          </div>

          {/* Indicador NUM LOCK */}
          <div
            className={`px-1.5 py-0.2 border transition-colors ${
              isNumLockOn
                ? "bg-emerald-200 border-emerald-600 text-emerald-900 font-bold"
                : "bg-[#e4e4e4] border-[#c0c0c0] text-[#999999]"
            }`}
            title={`NUM LOCK está ${isNumLockOn ? "ATIVADO" : "DESATIVADO"}`}
          >
            NUM
          </div>
        </div>
      </div>
    </div>
  );
}
