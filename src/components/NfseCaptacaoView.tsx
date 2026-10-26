import React, { useState, useEffect, useMemo, useRef } from "react";
import { EmpresaSefaz, ParsedNfse, NfseMetricas, AppSettings } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import LoadingGearOverlay from "./LoadingGearOverlay";
import {
  Building2,
  RefreshCw,
  Calendar,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Search,
  Download,
  FileText,
  Copy,
  Check,
  FolderOpen,
  Archive,
  RotateCcw,
  Terminal,
  FileSpreadsheet,
  AlertTriangle,
  X,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  Sparkles,
  Clock,
  Save,
  RotateCw,
  Settings
} from "lucide-react";
import {
  syncCompanyNfse,
  syncSpNfse,
  getNfseMetrics,
  listNfseNotas,
  getNfseState,
  resetNfseNsu,
  exportNfseCsv,
  downloadNfseZip,
  openNfsePdf,
  saveNfseXml,
  openNfseFolder,
  onNfseProgress,
  NfseSyncProgressPayload,
  getAppSettings,
  saveNfseSchedulerSettings,
  onSchedulerTrigger
} from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";
import { formatBRL, parseDateToTimestamp } from "../utils/calc";
import logoImg from "../../assets/logo.png";
import { useDebounce } from "../utils/useDebounce";

interface NfseCaptacaoViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNotify: (text: string, type: "success" | "error") => void;
  onNavigateHub?: () => void;
  refreshKey?: number;
}

export default function NfseCaptacaoView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onOpenCompanyModal,
  onNotify,
  onNavigateHub,
  refreshKey,
}: NfseCaptacaoViewProps) {
  // Filtros Padrão
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>("all");
  const [dataInicioFilter, setDataInicioFilter] = useState<string>("" );
  const [dataFimFilter, setDataFimFilter] = useState<string>("");
  const [selectedTipo, setSelectedTipo] = useState<"todos" | "Tomadas" | "Prestadas">("todos");
  const [statusFilter, setStatusFilter] = useState<"todas" | "Canceladas" | "Retencoes">("todas");
  const [reportTipo, setReportTipo] = useState<"Tomadas" | "Prestadas">("Tomadas");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);

  // Dados
  const [notas, setNotas] = useState<ParsedNfse[]>([]);
  const [metricas, setMetricas] = useState<NfseMetricas | null>(null);
  const [ultimoNsu, setUltimoNsu] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncingNacional, setSyncingNacional] = useState(false);
  const [syncingSp, setSyncingSp] = useState(false);

  // Estados de seleção de linha, limite e StatusBar
  const [selectedChave, setSelectedChave] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [sortColumn, setSortColumn] = useState<string>("dataEmissao");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleHeaderSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  // Terminal de Logs
  const [logs, setLogs] = useState<Array<{ text: string; type: string; time: string }>>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Modais
  const [isSpModalOpen, setIsSpModalOpen] = useState(false);
  const [spAno, setSpAno] = useState(new Date().getFullYear().toString());
  const [spMes, setSpMes] = useState((new Date().getMonth() + 1).toString().padStart(2, "0"));
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [customResetNsu, setCustomResetNsu] = useState("0");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Agendador Diário de NFS-e (Horário Específico)
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [nfseSchedulerEnabled, setNfseSchedulerEnabled] = useState<boolean>(false);
  const [nfseSchedulerTime, setNfseSchedulerTime] = useState<string>("18:00");
  const [savingNfseScheduler, setSavingNfseScheduler] = useState<boolean>(false);
  const [isNfseSchedulerModalOpen, setIsNfseSchedulerModalOpen] = useState<boolean>(false);

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

  // Escuta configurações e agendador diário global do app
  useEffect(() => {
    getAppSettings().then((st) => {
      if (st) {
        setAppSettings(st);
        const nfseCfg = st.modelSchedulers?.nfse || st.nfseScheduler;
        setNfseSchedulerEnabled(nfseCfg?.enabled ?? false);
        setNfseSchedulerTime(nfseCfg?.time || "09:00");
      }
    });

    const unsubscribe = onSchedulerTrigger((payload?: any) => {
      if (!payload || payload.type === "nfse") {
        if (activeEmpresa?.modelosHabilitados && activeEmpresa.modelosHabilitados.nfse === false) {
          return;
        }
        onNotify(`Horário agendado atingido (${payload?.time || "diário"}): busca de NFS-e disparada!`, "success");
        if (activeEmpresa && !syncingNacional && !syncingSp) {
          handleSyncNacional();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [activeEmpresa, syncingNacional, syncingSp, refreshKey]);

  const handleSaveNfseScheduler = async () => {
    setSavingNfseScheduler(true);
    try {
      const res = await saveNfseSchedulerSettings({
        enabled: nfseSchedulerEnabled,
        time: nfseSchedulerTime
      });
      if (res.success) {
        onNotify(
          nfseSchedulerEnabled
            ? `Agendador NFS-e ativado: captação diária às ${nfseSchedulerTime}.`
            : "Agendador NFS-e desativado.",
          "success"
        );
        setIsNfseSchedulerModalOpen(false);
      } else {
        onNotify(res.error || "Erro ao salvar agendamento.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao salvar agendador: ${err.message}`, "error");
    } finally {
      setSavingNfseScheduler(false);
    }
  };

  const activeEmpresaCnpjRef = useRef<string | null>(activeEmpresa?.cnpj || null);
  const loadRequestIdRef = useRef<number>(0);

  useEffect(() => {
    activeEmpresaCnpjRef.current = activeEmpresa?.cnpj || null;
  }, [activeEmpresa?.cnpj]);

  // Listener para logs em tempo real e auto-recarga quando documentos chegam
  useEffect(() => {
    const unsub = onNfseProgress((info: NfseSyncProgressPayload) => {
      if (info.cnpj && activeEmpresaCnpjRef.current) {
        const cleanInfoCnpj = info.cnpj.replace(/\D/g, "");
        const cleanActiveCnpj = activeEmpresaCnpjRef.current.replace(/\D/g, "");
        if (cleanInfoCnpj && cleanActiveCnpj && cleanInfoCnpj !== cleanActiveCnpj) {
          return;
        }
      }

      setLogs((prev) => [
        {
          text: info.message,
          type: info.type || "info",
          time: new Date().toLocaleTimeString("pt-BR"),
        },
        ...prev.slice(0, 150),
      ]);
      if (info.docsCount && info.docsCount > 0) {
        loadCompanyData(activeEmpresa);
      }
    });
    return () => unsub();
  }, [activeEmpresa?.id, activeEmpresa?.cnpj]);

  // Carrega estado e notas da empresa ativa com proteção contra race conditions
  const loadCompanyData = async (empresaAlvo: EmpresaSefaz | null = activeEmpresa) => {
    if (!empresaAlvo) {
      setNotas([]);
      setMetricas(null);
      return;
    }

    const targetCnpj = empresaAlvo.cnpj;
    const targetRazao = empresaAlvo.razaoSocial;
    const reqId = ++loadRequestIdRef.current;

    setLoading(true);
    try {
      const stateRes = await getNfseState(targetCnpj, targetRazao);
      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;

      if (stateRes.success && stateRes.state) {
        setUltimoNsu(stateRes.state.ultimoNsuNfse || 0);
        setLastSync(stateRes.state.lastSync || null);
      }

      const listRes = await listNfseNotas(
        targetCnpj,
        targetRazao,
        "todos",
        "todos",
        "todos"
      );
      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;

      if (listRes.success) {
        setNotas(listRes.notas || []);
        if ((listRes as any).metricas) {
          setMetricas((listRes as any).metricas);
        } else {
          const metRes = await getNfseMetrics(
            targetCnpj,
            targetRazao,
            "todos",
            "todos",
            "todos"
          );
          if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;
          if (metRes.success && metRes.metricas) {
            setMetricas(metRes.metricas);
          }
        }
      } else {
        if (listRes.error) {
          onNotify(`Aviso ao carregar NFS-e: ${listRes.error}`, "error");
        }
      }
    } catch (e: any) {
      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;
      onNotify(`Erro ao carregar dados de NFS-e: ${e.message}`, "error");
    } finally {
      if (activeEmpresaCnpjRef.current === targetCnpj && loadRequestIdRef.current === reqId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setNotas([]);
    setMetricas(null);
    loadCompanyData(activeEmpresa);
  }, [activeEmpresa?.id, activeEmpresa?.cnpj, refreshKey]);

  // Sincronização Unificada NFS-e (Portal Nacional ADN + Prefeitura de São Paulo PMSP)
  const handleSyncNacional = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa para iniciar a busca.", "error");
      return;
    }
    const empresaSincronizada = activeEmpresa;
    setSyncingNacional(true);
    setShowLogs(true);
    try {
      const res: any = await syncCompanyNfse(empresaSincronizada);
      if (res.success) {
        const nac = res.baixadasNacional ?? res.totalDocsBaixados ?? 0;
        const sp = res.baixadasSp ?? 0;
        const total = res.totalDocsBaixados ?? (nac + sp);
        onNotify(
          `Captação NFS-e (${empresaSincronizada.razaoSocial}) concluída! +${total} nova(s) nota(s) (Portal SP: ${sp} | Portal Nacional: ${nac}).`,
          "success"
        );
      } else {
        onNotify(`Erro na captação de NFS-e: ${res.error}`, "error");
      }
    } catch (e: any) {
      onNotify(`Falha: ${e.message}`, "error");
    } finally {
      setSyncingNacional(false);
      if (activeEmpresaCnpjRef.current === empresaSincronizada.cnpj) {
        await loadCompanyData(empresaSincronizada);
      }
    }
  };

  // Sincronização Prefeitura de SP
  const handleSyncSp = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa para iniciar a busca em SP.", "error");
      return;
    }
    const empresaSincronizada = activeEmpresa;
    setSyncingSp(true);
    setShowLogs(true);
    try {
      const res = await syncSpNfse(empresaSincronizada, {
        ano: spAno,
        mes: spMes,
      });
      if (res.success) {
        onNotify(
          `Prefeitura de SP (${empresaSincronizada.razaoSocial}): ${res.totalBaixadas || 0} notas baixadas (${res.totalCanceladas || 0} canceladas).`,
          "success"
        );
        setIsSpModalOpen(false);
      } else {
        onNotify(`Erro na consulta de SP: ${res.error}`, "error");
      }
    } catch (e: any) {
      onNotify(`Falha: ${e.message}`, "error");
    } finally {
      setSyncingSp(false);
      if (activeEmpresaCnpjRef.current === empresaSincronizada.cnpj) {
        await loadCompanyData(empresaSincronizada);
      }
    }
  };

  // Reset NSU
  const handleResetNsu = async () => {
    if (!activeEmpresa) return;
    const target = parseInt(customResetNsu, 10) || 0;
    const res = await resetNfseNsu(activeEmpresa.cnpj, activeEmpresa.razaoSocial, target);
    if (res.success) {
      setUltimoNsu(target);
      setIsResetModalOpen(false);
      onNotify(`Ponteiro de NSU da NFS-e redefinido para ${target}.`, "success");
      await loadCompanyData();
    } else {
      onNotify(`Erro ao redefinir NSU: ${res.error}`, "error");
    }
  };

  const selectedAno = useMemo(() => {
    if (selectedCompetencia === "all") return "todos";
    const parts = selectedCompetencia.split("/");
    return parts.length === 2 ? parts[1] : "todos";
  }, [selectedCompetencia]);

  const selectedMes = useMemo(() => {
    if (selectedCompetencia === "all") return "todos";
    const parts = selectedCompetencia.split("/");
    return parts.length === 2 ? parts[0] : "todos";
  }, [selectedCompetencia]);

  // Exportar CSV
  const handleExportCsv = async (tipoEscolhido: "Tomadas" | "Prestadas" = reportTipo) => {
    if (!activeEmpresa) return;
    const res = await exportNfseCsv(
      activeEmpresa.cnpj,
      activeEmpresa.razaoSocial,
      selectedAno,
      selectedMes,
      tipoEscolhido,
      dataInicioFilter || undefined,
      dataFimFilter || undefined
    );
    if (res.success) {
      onNotify(
        `Relatório CSV de Serviços ${tipoEscolhido === "Prestadas" ? "Prestados" : "Tomados"} exportado com sucesso!`,
        "success"
      );
    } else if (!res.canceled) {
      onNotify(`Erro ao exportar CSV: ${res.error}`, "error");
    }
  };

  // Download ZIP
  const handleDownloadZip = async () => {
    if (!activeEmpresa) return;
    const res = await downloadNfseZip(
      activeEmpresa.cnpj,
      activeEmpresa.razaoSocial,
      selectedAno,
      selectedMes,
      selectedTipo,
      dataInicioFilter || undefined,
      dataFimFilter || undefined
    );
    if (res.success) {
      onNotify("Pacote ZIP com XMLs e PDFs gerado com sucesso!", "success");
    } else if (!res.canceled) {
      onNotify(`Erro ao gerar ZIP: ${res.error}`, "error");
    }
  };

  // Abrir pasta da empresa no Explorer
  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    const res = await openNfseFolder(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
    if (!res.success) {
      onNotify(`Erro ao abrir pasta: ${res.error}`, "error");
    }
  };

  // Abrir DANFSe PDF
  const handleOpenDanfse = async (nota: ParsedNfse) => {
    try {
      const res = await openNfsePdf(nota.caminhoPdf || undefined, nota.caminhoXml);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir o PDF do DANFSe.", "error");
      }
    } catch (e: any) {
      onNotify(`Erro ao abrir DANFSe: ${e.message}`, "error");
    }
  };

  // Salvar XML individual
  const handleSaveXml = async (nota: ParsedNfse) => {
    try {
      const defaultName = `NFSe_${nota.numeroNFe || "doc"}.xml`;
      const res = await saveNfseXml(nota.caminhoXml, defaultName);
      if (res.canceled) return;
      if (res.success) {
        onNotify("Arquivo XML da NFS-e salvo com sucesso!", "success");
      } else {
        onNotify(res.error || "Erro ao salvar o arquivo XML.", "error");
      }
    } catch (e: any) {
      onNotify(`Erro ao salvar XML: ${e.message}`, "error");
    }
  };

  // Copiar chave de acesso
  const handleCopyKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Helper robusto para extração de Competência Contábil da NFS-e
  const parseNfseCompetencia = (n: ParsedNfse): { compAno: string; compMes: string; key: string; label: string } => {
    // 1. Prioriza campo de competência contábil
    if (n.competencia) {
      const raw = String(n.competencia).trim();
      // MM/YYYY
      const mBrComp = raw.match(/^(\d{1,2})\/(\d{4})$/);
      if (mBrComp) {
        const mes = mBrComp[1].padStart(2, "0");
        const ano = mBrComp[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
      // YYYY-MM ou YYYY-MM-DD
      const mIso = raw.match(/^(\d{4})[-/.](\d{2})/);
      if (mIso) {
        const ano = mIso[1];
        const mes = mIso[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
      // DD/MM/YYYY
      const mBrFull = raw.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})$/);
      if (mBrFull) {
        const mes = mBrFull[1].padStart(2, "0");
        const ano = mBrFull[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
    }

    // 2. Caminho do arquivo (ex: /2026/08/ ou /2026/08 - Agosto/)
    if (n.caminhoXml) {
      const norm = n.caminhoXml.replace(/\\/g, "/");
      const mPath = norm.match(/(\d{4})[\\/](\d{2})/);
      if (mPath) {
        const ano = mPath[1];
        const mes = mPath[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
    }

    // 3. Fallback apenas se competência não informada: dataGeracao (emissão)
    if (n.dataGeracao) {
      const rawDg = String(n.dataGeracao).trim();
      const mBr = rawDg.match(/^\d{1,2}\/(\d{1,2})\/(\d{4})/);
      if (mBr) {
        const mes = mBr[1].padStart(2, "0");
        const ano = mBr[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
      const mIso = rawDg.match(/^(\d{4})[-/.](\d{2})/);
      if (mIso) {
        const ano = mIso[1];
        const mes = mIso[2];
        return { compAno: ano, compMes: mes, key: `${ano}-${mes}`, label: `${mes}/${ano}` };
      }
    }

    return { compAno: "", compMes: "", key: "", label: "" };
  };

  // Competências disponíveis (MM/YYYY)
  const availableCompetencias = useMemo(() => {
    const map = new Map<string, string>();
    notas.forEach((n) => {
      const info = parseNfseCompetencia(n);
      if (info.key && info.label) {
        map.set(info.key, info.label);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map((entry) => entry[1]);
  }, [notas]);

  const getNotaIsoDate = (n: ParsedNfse): string => {
    const info = parseNfseCompetencia(n);
    if (info.compAno && info.compMes) {
      return `${info.compAno}-${info.compMes}-01`;
    }
    return "";
  };

  const matchesPeriodo = (n: ParsedNfse, ano: string, mes: string) => {
    if (ano === "todos" && mes === "todos") return true;
    const mesPad = mes !== "todos" ? mes.padStart(2, "0") : null;
    const info = parseNfseCompetencia(n);

    if (ano !== "todos") {
      if (!info.compAno || info.compAno !== String(ano)) return false;
    }
    if (mesPad) {
      if (!info.compMes || info.compMes !== mesPad) return false;
    }

    return true;
  };

  const notasPeriodo = useMemo(() => {
    return notas.filter((n) => {
      if (!matchesPeriodo(n, selectedAno, selectedMes)) return false;
      if (dataInicioFilter || dataFimFilter) {
        const isoDate = getNotaIsoDate(n);
        if (isoDate) {
          if (dataInicioFilter && isoDate < dataInicioFilter) return false;
          if (dataFimFilter && isoDate > dataFimFilter) return false;
        }
      }
      return true;
    });
  }, [notas, selectedAno, selectedMes, dataInicioFilter, dataFimFilter]);

  const metrics = useMemo(() => {
    const totalNotas = notasPeriodo.length;
    let tomadasCount = 0;
    let prestadasCount = 0;
    let canceladasCount = 0;
    let comRetencaoCount = 0;
    let totalTomadas = 0;
    let totalPrestadas = 0;
    let totalRetencoes = 0;

    notasPeriodo.forEach((n) => {
      const isPrestada = (n.tipo || "").toLowerCase().includes("prest") || (n.tipo || "").toLowerCase().includes("emit");
      const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
      const v = Number(n.valorServicos) || 0;
      const valorLiquido = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
        ? Number(n.valorLiquido)
        : v;
      const descIncond = Number(n.descIncond) || 0;
      const descCond = Number(n.descCond) || 0;
      const totalDesconto = descIncond + descCond;
      const temRet = Boolean(v > 0 && valorLiquido > 0 && (v - valorLiquido - totalDesconto) >= 0.01);
      const ret = temRet ? Math.max(0, v - valorLiquido - totalDesconto) : 0;
      totalRetencoes += ret;
      if (temRet) comRetencaoCount++;

      if (isCancelada) {
        canceladasCount++;
        return;
      }

      if (isPrestada) {
        prestadasCount++;
        totalPrestadas += v;
      } else {
        tomadasCount++;
        totalTomadas += v;
      }
    });

    const totalMovimentado = totalPrestadas - totalTomadas;

    return {
      totalNotas,
      tomadasCount,
      prestadasCount,
      canceladasCount,
      comRetencaoCount,
      totalTomadas,
      totalPrestadas,
      totalMovimentado,
      totalRetencoes,
    };
  }, [notasPeriodo]);

  const filteredNotas = useMemo(() => {
    return notasPeriodo.filter((n) => {
      const isPrestada = (n.tipo || "").toLowerCase().includes("prest") || (n.tipo || "").toLowerCase().includes("emit");
      const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
      const v = Number(n.valorServicos) || 0;
      const valorLiquido = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
        ? Number(n.valorLiquido)
        : v;
      const descIncond = Number(n.descIncond) || 0;
      const descCond = Number(n.descCond) || 0;
      const totalDesconto = descIncond + descCond;
      const temRet = Boolean(v > 0 && valorLiquido > 0 && (v - valorLiquido - totalDesconto) >= 0.01);

      if (selectedTipo === "Tomadas" && isPrestada) return false;
      if (selectedTipo === "Prestadas" && !isPrestada) return false;

      if (statusFilter === "Canceladas" && !isCancelada) return false;
      if (statusFilter === "Retencoes" && !temRet) return false;

      if (!debouncedSearchTerm.trim()) return true;
      const term = debouncedSearchTerm.trim().toLowerCase();
      const numQuery = term.replace(/^(n[º°o]?|nf(?:s?-?e)?|rps|#)\s*/i, "").trim();
      const isShortNumeric = /^\d{1,10}$/.test(numQuery);

      const parceiroNome = isPrestada ? (n.tomadorNome || "") : (n.prestadorNome || "");
      const parceiroCnpj = isPrestada ? (n.tomadorCnpj || "") : (n.prestadorCnpj || "");
      const cnpjDigits = parceiroCnpj.replace(/\D/g, "");

      if (isShortNumeric) {
        const normDocNum = String(n.numeroNFe || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
        const normDpsNum = String(n.dpsNumero || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
        const normQuery = numQuery.replace(/^0+/, "") || "0";
        const rawDocDigits = String(n.numeroNFe || "").replace(/\D/g, "");
        const numMatch =
          normDocNum === normQuery ||
          normDocNum.startsWith(normQuery) ||
          rawDocDigits === numQuery ||
          (normDpsNum !== "0" && (normDpsNum === normQuery || normDpsNum.startsWith(normQuery)));
        const cnpjMatch = numQuery.length >= 8 && cnpjDigits.includes(numQuery);
        return numMatch || cnpjMatch;
      }

      const termDigits = term.replace(/\D/g, "");
      const numMatch =
        (n.numeroNFe || "").toLowerCase().includes(term) ||
        (n.dpsNumero || "").toLowerCase().includes(term);
      const parcMatch =
        parceiroNome.toLowerCase().includes(term) ||
        parceiroCnpj.toLowerCase().includes(term) ||
        (termDigits.length >= 6 && cnpjDigits.includes(termDigits));
      const chaveMatch =
        (n.chaveNotaNacional || "").toLowerCase().includes(term) ||
        (termDigits.length >= 11 && (n.chaveNotaNacional || "").includes(termDigits));
      const portalLabel = n.origemCaptacao === "PORTAL_SP" ? "portal sp" : "portal nacional";
      const portalMatch = portalLabel.includes(term);
      return numMatch || parcMatch || chaveMatch || portalMatch;
    });
  }, [notasPeriodo, selectedTipo, statusFilter, debouncedSearchTerm]);

  const totalTomadasFiltrado = useMemo(() => {
    return filteredNotas
      .filter((n) => {
        const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
        const isPrestada = (n.tipo || "").toLowerCase().includes("prest") || (n.tipo || "").toLowerCase().includes("emit");
        return !isCancelada && !isPrestada;
      })
      .reduce((sum, n) => sum + (Number(n.valorServicos) || 0), 0);
  }, [filteredNotas]);

  const totalPrestadasFiltrado = useMemo(() => {
    return filteredNotas
      .filter((n) => {
        const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
        const isPrestada = (n.tipo || "").toLowerCase().includes("prest") || (n.tipo || "").toLowerCase().includes("emit");
        return !isCancelada && isPrestada;
      })
      .reduce((sum, n) => sum + (Number(n.valorServicos) || 0), 0);
  }, [filteredNotas]);

  const totalFiltrado = useMemo(() => {
    if (selectedTipo === "Prestadas") return totalPrestadasFiltrado;
    if (selectedTipo === "Tomadas") return totalTomadasFiltrado;
    return totalPrestadasFiltrado - totalTomadasFiltrado;
  }, [selectedTipo, totalPrestadasFiltrado, totalTomadasFiltrado]);

  // Ordenação das notas filtradas (menor para o maior / maior para o menor)
  const sortedNotas = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filteredNotas].sort((a, b) => {
      switch (sortColumn) {
        case "numero": {
          const numA = Number(String(a.numeroNFe || "").replace(/\D/g, "")) || Number(String(a.dpsNumero || "").replace(/\D/g, "")) || 0;
          const numB = Number(String(b.numeroNFe || "").replace(/\D/g, "")) || Number(String(b.dpsNumero || "").replace(/\D/g, "")) || 0;
          return (numA - numB) * dir;
        }
        case "dataEmissao": {
          const tsA = parseDateToTimestamp(a.dataGeracao || a.competencia || "");
          const tsB = parseDateToTimestamp(b.dataGeracao || b.competencia || "");
          if (tsA !== tsB) return (tsA - tsB) * dir;
          const numA = Number(String(a.numeroNFe || "").replace(/\D/g, "")) || 0;
          const numB = Number(String(b.numeroNFe || "").replace(/\D/g, "")) || 0;
          return (numA - numB) * dir;
        }
        case "parceiro": {
          const isPrestA = (a.tipo || "").toLowerCase().includes("prest") || (a.tipo || "").toLowerCase().includes("emit");
          const isPrestB = (b.tipo || "").toLowerCase().includes("prest") || (b.tipo || "").toLowerCase().includes("emit");
          const pA = (isPrestA ? a.tomadorNome : a.prestadorNome) || "";
          const pB = (isPrestB ? b.tomadorNome : b.prestadorNome) || "";
          return pA.localeCompare(pB, "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        }
        case "operacao": {
          const opA = `${a.tipo || ""} ${a.origemCaptacao || ""}`;
          const opB = `${b.tipo || ""} ${b.origemCaptacao || ""}`;
          return opA.localeCompare(opB, "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        }
        case "valor": {
          const vA = Number(a.valorServicos) || 0;
          const vB = Number(b.valorServicos) || 0;
          return (vA - vB) * dir;
        }
        default:
          return 0;
      }
    });
  }, [filteredNotas, sortColumn, sortDirection]);

  // Fatiamento por limite de exibição para máxima performance
  const displayedNotas = useMemo(() => {
    return sortedNotas.slice(0, displayLimit);
  }, [sortedNotas, displayLimit]);

  // Nota selecionada
  const selectedNota = useMemo(() => {
    return filteredNotas.find((n) => (n.chaveNotaNacional || n.numeroNFe) === selectedChave) || null;
  }, [filteredNotas, selectedChave]);

  // Seleciona a primeira nota automaticamente se nenhuma estiver selecionada
  useEffect(() => {
    if (filteredNotas.length > 0 && !selectedChave) {
      setSelectedChave(filteredNotas[0].chaveNotaNacional || filteredNotas[0].numeroNFe || null);
    }
  }, [filteredNotas, selectedChave]);

  // Atalhos de teclado (Enter para abrir DANFSe, Setas para navegar, F5 para sincronizar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Enter" && selectedNota) {
        e.preventDefault();
        handleOpenDanfse(selectedNota);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const curIdx = displayedNotas.findIndex((n) => (n.chaveNotaNacional || n.numeroNFe) === selectedChave);
        if (curIdx >= 0 && curIdx < displayedNotas.length - 1) {
          const next = displayedNotas[curIdx + 1];
          setSelectedChave(next.chaveNotaNacional || next.numeroNFe || null);
        } else if (curIdx === -1 && displayedNotas.length > 0) {
          const first = displayedNotas[0];
          setSelectedChave(first.chaveNotaNacional || first.numeroNFe || null);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curIdx = displayedNotas.findIndex((n) => (n.chaveNotaNacional || n.numeroNFe) === selectedChave);
        if (curIdx > 0) {
          const prev = displayedNotas[curIdx - 1];
          setSelectedChave(prev.chaveNotaNacional || prev.numeroNFe || null);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        handleSyncNacional();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayedNotas, selectedChave, selectedNota]);

  const renderSimplesBadge = (simplesText?: string) => {
    if (!simplesText) return null;
    const txt = simplesText.toLowerCase();
    if (txt.includes("mei") || txt.includes("individual")) {
      return (
        <span className="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
          MEI
        </span>
      );
    }
    if (txt.includes("simples") || txt.includes("microempresa") || txt.includes("epp")) {
      return (
        <span className="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
          Simples Nac.
        </span>
      );
    }
    return (
      <span className="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-300">
        Regime Normal
      </span>
    );
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
        {/* Grupo Esquerdo: Captura Principal, Prefeitura SP e Pasta Local */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSyncNacional}
            disabled={syncingNacional || syncingSp || !activeEmpresa}
            className="vb-btn vb-btn-primary"
            title="Capturar notas fiscais de serviço no Portal Nacional ADN e Prefeitura de SP (Atalho: F5)"
          >
            <RefreshCw size={13} className={syncingNacional ? "animate-spin text-[#003366]" : "text-[#003366]"} />
            <span>{syncingNacional ? "Consultando Portais..." : "Capturar NFS-e (F5)"}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSpModalOpen(true)}
            disabled={syncingNacional || syncingSp || !activeEmpresa}
            className="vb-btn"
            title="Consultar Prefeitura de São Paulo (PMSP) por competência específica"
          >
            <Landmark size={13} className="text-[#005a9e]" />
            <span>Prefeitura de SP</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta local de NFS-e no Windows Explorer"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta</span>
          </button>
        </div>

        {/* Grupo Direito: Exportações, Logs e Manutenção NSU */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleExportCsv(reportTipo)}
            disabled={notasPeriodo.length === 0}
            className="vb-btn"
            title="Exportar planilha consolidada no formato CSV / Excel"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Excel / CSV ({reportTipo === "Prestadas" ? "Prestados" : "Tomados"})</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={filteredNotas.length === 0}
            className="vb-btn"
            title="Gerar pacote ZIP compactado com arquivos XMLs e DANFSe em PDF"
          >
            <Archive size={13} className="text-[#005a9e]" />
            <span>Exportar Pacote (.ZIP)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => setShowLogs(!showLogs)}
            className={`vb-btn ${showLogs ? "vb-btn-primary" : ""}`}
            title="Exibir ou ocultar console de logs de comunicação"
          >
            <Terminal size={13} className="text-[#008855]" />
            <span>Logs ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCustomResetNsu("0");
              setIsResetModalOpen(true);
            }}
            disabled={syncingNacional || !activeEmpresa}
            className="vb-btn"
            title="Reiniciar cursor NSU da NFS-e para busca retroativa completa"
          >
            <RotateCcw size={13} className="text-[#aa4400]" />
            <span>Reiniciar NSU</span>
          </button>
        </div>
      </div>

      {/* ÁREA CENTRAL DE CONTEÚDO */}
      <div className="p-2 flex flex-col gap-2 flex-1 overflow-auto">
        {/* GROUPBOX 1: STATUS DOS PORTAIS DE SERVIÇO & IDENTIFICAÇÃO DA EMPRESA */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Landmark size={13} />
            <span>Status dos Portais de Serviço (Portal Nacional ADN & SP) & Identificação da Empresa</span>
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
                <span>Cursor ADN: <strong>{ultimoNsu}</strong></span>
                {lastSync && <span className="text-[#777777] ml-1">({lastSync})</span>}
              </div>

              {nfseSchedulerEnabled && (
                <div className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px]">
                  <Clock size={11} className="text-[#005a9e]" />
                  <span>Busca Diária: <strong>{nfseSchedulerTime}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => onOpenCompanyModal("empresas")}
                className="vb-btn text-[11px]"
              >
                <Landmark size={12} />
                <span>Gerenciar Cadastro</span>
              </button>
            </div>
          </div>

          {/* Aviso se módulo estiver desabilitado */}
          {activeEmpresa && activeEmpresa.modelosHabilitados?.nfse === false && (
            <div className="mt-2 p-1.5 bg-[#fff8e7] border border-[#f0c36d] text-[#8a5300] text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <AlertTriangle size={13} className="text-amber-700" />
                A captação de <strong>NFS-e (Serviços)</strong> está desativada no cadastro desta empresa.
              </span>
              <button
                type="button"
                onClick={() => onOpenCompanyModal("empresas")}
                className="vb-btn"
                style={{ padding: "1px 6px", fontSize: "10px" }}
              >
                Habilitar
              </button>
            </div>
          )}

          {/* Notificação de busca em andamento */}
          {syncingNacional && (
            <div className="mt-2 p-1.5 bg-[#eef5fd] border border-[#336699] text-[#002244] text-[11px] flex items-center gap-2">
              <RotateCw size={13} className="animate-spin text-[#005a9e] shrink-0" />
              <span className="font-bold">Portal Nacional (ADN) & Prefeitura de SP (PMSP):</span>
              <span>Consultando lotes e sincronizando notas de serviço...</span>
            </div>
          )}
        </fieldset>

        {/* TERMINAL DE LOGS EM TEMPO REAL (QUANDO ABERTO) */}
        {showLogs && (
          <fieldset className="vb-groupbox bg-[#1e1e1e] text-[#cccccc] font-mono text-[10px] p-2">
            <legend className="vb-legend text-white flex items-center gap-1">
              <Terminal size={11} />
              <span>Console de Execução - Robô Fiscal NFS-e</span>
            </legend>
            <div className="flex items-center justify-between pb-1 border-b border-[#333333] mb-1">
              <span className="text-emerald-400">● Conexão ativa com robô em segundo plano</span>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[#888888] hover:text-white uppercase text-[9px] cursor-pointer"
              >
                Limpar Logs
              </button>
            </div>
            <div className="h-24 overflow-y-auto space-y-0.5 custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-[#666666] italic">Aguardando operações...</div>
              ) : (
                logs.map((lg, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-[#777777]">[{lg.time}]</span>
                    <span className={lg.type === "warn" ? "text-amber-400" : lg.type === "error" ? "text-rose-400" : "text-[#dddddd]"}>
                      {lg.text}
                    </span>
                  </div>
                ))
              )}
            </div>
          </fieldset>
        )}

        {/* GROUPBOX 2: FILTROS DE PESQUISA & TOTALIZADORES FINANCEIROS */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Search size={13} />
            <span>Filtros de Pesquisa & Painel de Operações de Serviço</span>
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Controles de Filtros */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#444444]">Competência:</span>
                <select
                  value={selectedCompetencia}
                  onChange={(e) => setSelectedCompetencia(e.target.value)}
                  className="vb-input font-bold text-[#003366] bg-white cursor-pointer w-36"
                >
                  <option value="all">Todas</option>
                  {availableCompetencias.map((comp) => (
                    <option key={comp} value={comp}>
                      {comp}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="font-semibold text-[#444444]">De:</span>
                <input
                  type="date"
                  value={dataInicioFilter}
                  onChange={(e) => setDataInicioFilter(e.target.value)}
                  className="vb-input w-28"
                />
                <span className="font-semibold text-[#444444]">Até:</span>
                <input
                  type="date"
                  value={dataFimFilter}
                  onChange={(e) => setDataFimFilter(e.target.value)}
                  className="vb-input w-28"
                />
              </div>

              {/* Botões de Seleção de Operação (Tomadas vs Prestadas) */}
              <div className="inline-flex items-center border border-[#b0b0b0] bg-white">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTipo("todos");
                    setStatusFilter("todas");
                  }}
                  className={`px-2 py-0.5 text-[10px] font-semibold border-r border-[#d0d0d0] cursor-pointer ${
                    selectedTipo === "todos" && statusFilter === "todas" ? "bg-[#005a9e] text-white" : "hover:bg-[#f0f0f0]"
                  }`}
                >
                  Todas ({metrics.totalNotas})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTipo("Tomadas");
                    setReportTipo("Tomadas");
                  }}
                  className={`px-2 py-0.5 text-[10px] font-semibold border-r border-[#d0d0d0] cursor-pointer ${
                    selectedTipo === "Tomadas" ? "bg-[#005a9e] text-white" : "hover:bg-[#f0f0f0] text-sky-800"
                  }`}
                >
                  Tomadas ({metrics.tomadasCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTipo("Prestadas");
                    setReportTipo("Prestadas");
                  }}
                  className={`px-2 py-0.5 text-[10px] font-semibold border-r border-[#d0d0d0] cursor-pointer ${
                    selectedTipo === "Prestadas" ? "bg-[#005a9e] text-white" : "hover:bg-[#f0f0f0] text-emerald-800"
                  }`}
                >
                  Prestadas ({metrics.prestadasCount})
                </button>
                {metrics.canceladasCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter((p) => (p === "Canceladas" ? "todas" : "Canceladas"))}
                    className={`px-2 py-0.5 text-[10px] font-semibold border-r border-[#d0d0d0] cursor-pointer ${
                      statusFilter === "Canceladas" ? "bg-rose-700 text-white" : "hover:bg-[#f0f0f0] text-rose-700"
                    }`}
                  >
                    Canceladas ({metrics.canceladasCount})
                  </button>
                )}
                {metrics.comRetencaoCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter((p) => (p === "Retencoes" ? "todas" : "Retencoes"))}
                    className={`px-2 py-0.5 text-[10px] font-semibold cursor-pointer ${
                      statusFilter === "Retencoes" ? "bg-amber-700 text-white" : "hover:bg-[#f0f0f0] text-amber-900"
                    }`}
                  >
                    C/ Retenção ({metrics.comRetencaoCount})
                  </button>
                )}
              </div>

              {/* Busca Rápida */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nº, tomador, prestador, CNPJ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="vb-input w-48 pr-5"
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

              <button
                type="button"
                onClick={() => loadCompanyData(activeEmpresa)}
                disabled={loading}
                className="vb-btn"
                title="Recarregar notas do disco"
              >
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Painel de Indicadores Financeiros */}
            <div className="flex items-center gap-2 bg-[#ffffff] border border-[#c0c0c0] p-1 px-2.5">
              <div className="text-right pr-2 border-r border-[#e0e0e0]">
                <span className="text-[10px] text-[#555555] block">Total Tomadas:</span>
                <strong className="text-[12px] font-mono text-sky-900">{formatBRL(metrics.totalTomadas)}</strong>
              </div>
              <div className="text-right pr-2 border-r border-[#e0e0e0]">
                <span className="text-[10px] text-[#555555] block">Total Prestadas:</span>
                <strong className="text-[12px] font-mono text-emerald-800">{formatBRL(metrics.totalPrestadas)}</strong>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#555555] block">Saldo Movimentado:</span>
                <strong className={`text-[12px] font-mono ${metrics.totalMovimentado >= 0 ? "text-[#003366]" : "text-rose-700"}`}>
                  {formatBRL(metrics.totalMovimentado)}
                </strong>
              </div>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 3: PAINEL DE DADOS DA NOTA SELECIONADA NA GRID */}
        {selectedNota && (
          <fieldset className="vb-groupbox bg-[#fdfdfd]">
            <legend className="vb-legend flex items-center gap-1.5">
              <FileText size={13} className="text-[#003366]" />
              <span>
                Dados da Nota de Serviço Selecionada na Grid (NFS-e nº {selectedNota.numeroNFe || "S/N"} • Série {selectedNota.dpsSerie || "1"})
              </span>
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-[11px] items-center">
              <div>
                <span className="text-[#555555] block">Chave de Acesso / DPS:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-[#222222] truncate max-w-[180px]" title={selectedNota.chaveNotaNacional || ""}>
                    {selectedNota.chaveNotaNacional || (selectedNota.dpsNumero ? `DPS: ${selectedNota.dpsNumero}` : "-")}
                  </span>
                  {selectedNota.chaveNotaNacional && (
                    <button
                      type="button"
                      onClick={() => handleCopyKey(selectedNota.chaveNotaNacional!)}
                      className="text-blue-700 hover:text-blue-900 cursor-pointer"
                      title="Copiar chave de acesso"
                    >
                      {copiedKey === selectedNota.chaveNotaNacional ? <Check size={12} className="text-emerald-700" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
                <div className="text-[9px] text-[#666666]">
                  Origem: {selectedNota.origemCaptacao === "PORTAL_SP" ? "Prefeitura de São Paulo" : "Portal Nacional ADN"}
                </div>
              </div>

              <div>
                <span className="text-[#555555] block">Prestador do Serviço:</span>
                <strong className="text-[#003366] truncate block" title={selectedNota.prestadorNome || ""}>
                  {selectedNota.prestadorNome || "Não informado"}
                </strong>
                <span className="text-[10px] text-[#666666] font-mono">
                  {selectedNota.prestadorCnpj ? `CNPJ: ${selectedNota.prestadorCnpj}` : ""}
                </span>
              </div>

              <div>
                <span className="text-[#555555] block">Tomador do Serviço:</span>
                <strong className="text-[#222222] truncate block" title={selectedNota.tomadorNome || ""}>
                  {selectedNota.tomadorNome || "Não informado"}
                </strong>
                <span className="text-[10px] text-[#666666] font-mono">
                  {selectedNota.tomadorCnpj ? `CNPJ/CPF: ${selectedNota.tomadorCnpj}` : ""}
                </span>
              </div>

              <div>
                <span className="text-[#555555] block">Valores do Serviço:</span>
                <div className="font-bold text-[#333333] font-mono">
                  Bruto: {formatBRL(Number(selectedNota.valorServicos) || 0)}
                  {selectedNota.valorLiquido && Number(selectedNota.valorLiquido) !== Number(selectedNota.valorServicos) && (
                    <span className="text-emerald-700 font-bold ml-1">
                      (Líq: {formatBRL(Number(selectedNota.valorLiquido))})
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-[#666666]">
                  Emissão: {selectedNota.dataGeracao || "-"} • Compet: {selectedNota.competencia || "-"}
                </span>
              </div>

              {/* Botões de Ação para a Linha Selecionada */}
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenDanfse(selectedNota)}
                  className="vb-btn vb-btn-primary"
                  title="Abrir DANFSe oficial da NFS-e em PDF no leitor padrão do Windows (Pressione Enter)"
                >
                  <FileText size={12} className="text-rose-700" />
                  <span>Abrir DANFSe (Enter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveXml(selectedNota)}
                  className="vb-btn"
                  title="Salvar arquivo XML assinado da NFS-e"
                >
                  <Download size={12} className="text-blue-700" />
                  <span>Salvar XML</span>
                </button>
              </div>
            </div>
          </fieldset>
        )}

        {/* 4. DATAGRID ERP DE NOTAS FISCAIS DE SERVIÇO (NFS-E) */}
        <div className="border border-[#999999] bg-white flex flex-col flex-1 min-h-[280px] overflow-hidden">
          <div className="overflow-auto flex-1 relative">
            <LoadingGearOverlay
              isLoading={loading && capturedNotas.length > 0}
              title="Sincronizando Notas Fiscais de Serviço (NFS-e)..."
              subtitle="Lendo e validando notas de serviço da empresa no disco..."
            />
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("numero")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px" }}
                    title="Clique para ordenar por número da nota (menor para maior / maior para menor)"
                  >
                    <div className="flex items-center justify-between">
                      <span>NFS-e / Série</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "numero" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("dataEmissao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "125px" }}
                    title="Clique para ordenar por data de emissão/competência"
                  >
                    <div className="flex items-center justify-between">
                      <span>Emissão / Compet.</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "dataEmissao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("parceiro")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    title="Clique para ordenar por parceiro (Prestador / Tomador)"
                  >
                    <div className="flex items-center justify-between">
                      <span>Parceiro (Prestador / Tomador)</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "parceiro" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("operacao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "140px" }}
                    title="Clique para ordenar por operação / portal de origem"
                  >
                    <div className="flex items-center justify-between">
                      <span>Operação / Portal</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "operacao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valor")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "125px", textAlign: "right" }}
                    title="Clique para ordenar por valor dos serviços"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Serviços</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valor" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "140px", textAlign: "center" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {loading && capturedNotas.length === 0 ? (
                  <LoadingGearOverlay
                    isLoading={true}
                    variant="table"
                    colSpan={6}
                    title="Carregando Notas Fiscais de Serviço (NFS-e)..."
                    subtitle="Lendo e validando notas tomadas e prestadas no disco..."
                  />
                ) : filteredNotas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#777777]">
                      Nenhuma NFS-e localizada com os critérios pesquisados.
                    </td>
                  </tr>
                ) : (
                  displayedNotas.map((n, idx) => {
                    const chaveUnica = n.chaveNotaNacional || n.numeroNFe || String(idx);
                    const isSelected = selectedChave === (n.chaveNotaNacional || n.numeroNFe);
                    const isPrestada = (n.tipo || "").toLowerCase().includes("prest") || (n.tipo || "").toLowerCase().includes("emit");
                    const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
                    const valorBruto = Number(n.valorServicos) || 0;
                    const valorLiquido = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
                      ? Number(n.valorLiquido)
                      : valorBruto;
                    const isPortalSp = n.origemCaptacao === "PORTAL_SP" || (n.tipo || "").toLowerCase().includes("são paulo");
                    const parceiroNome = isPrestada ? (n.tomadorNome || "NÃO INFORMADO") : (n.prestadorNome || "NÃO INFORMADO");
                    const parceiroCnpj = isPrestada ? (n.tomadorCnpj || "-") : (n.prestadorCnpj || "-");
                    const chaveCurta = n.chaveNotaNacional
                      ? `${n.chaveNotaNacional.substring(0, 6)}...${n.chaveNotaNacional.substring(n.chaveNotaNacional.length - 6)}`
                      : "";

                    return (
                      <tr
                        key={chaveUnica}
                        className={isSelected ? "selected" : ""}
                        onClick={() => setSelectedChave(n.chaveNotaNacional || n.numeroNFe || null)}
                        onDoubleClick={() => handleOpenDanfse(n)}
                        style={{ cursor: "pointer" }}
                      >
                        {/* NFS-e / DPS / Série */}
                        <td>
                          <div className="font-mono font-bold text-[11px]">
                            NF {n.numeroNFe || "S/N"}{" "}
                            <span className="text-[10px] font-normal opacity-80">(s.{n.dpsSerie || "1"})</span>
                          </div>
                          {chaveCurta ? (
                            <div className="text-[9px] opacity-75 font-mono">{chaveCurta}</div>
                          ) : n.dpsNumero ? (
                            <div className="text-[9px] opacity-75 font-mono">DPS: {n.dpsNumero}</div>
                          ) : null}
                        </td>

                        {/* Data Emissão / Competência */}
                        <td>
                          <div>{n.dataGeracao || "-"}</div>
                          <div className="text-[9px] opacity-75">Comp: {n.competencia || "-"}</div>
                        </td>

                        {/* Parceiro */}
                        <td>
                          <div className="font-semibold truncate max-w-xs" title={parceiroNome}>
                            {parceiroNome}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[9px] opacity-75 font-mono">
                            <span>{parceiroCnpj}</span>
                            {renderSimplesBadge(n.simplesNacional)}
                          </div>
                        </td>

                        {/* Operação & Portal */}
                        <td>
                          <div className="flex items-center gap-1 font-bold text-[10px]">
                            {isPrestada ? (
                              <span className={isSelected ? "text-emerald-200" : "text-emerald-800"}>▲ PRESTADA</span>
                            ) : (
                              <span className={isSelected ? "text-sky-200" : "text-sky-800"}>▼ TOMADA</span>
                            )}
                            {isCancelada && (
                              <span className="bg-rose-700 text-white px-1 rounded text-[9px]">CANC</span>
                            )}
                          </div>
                          <div className="text-[9px] opacity-75">
                            {isPortalSp ? "Portal SP (PMSP)" : "Portal Nacional (ADN)"}
                          </div>
                        </td>

                        {/* Valor Serviços */}
                        <td style={{ textAlign: "right" }} className="font-mono font-bold">
                          <div>{formatBRL(valorBruto)}</div>
                          {valorLiquido !== valorBruto && (
                            <div className={`text-[9px] font-normal ${isSelected ? "text-emerald-200" : "text-emerald-700"}`}>
                              Líq: {formatBRL(valorLiquido)}
                            </div>
                          )}
                        </td>

                        {/* Ações */}
                        <td style={{ textAlign: "center" }}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDanfse(n);
                              }}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Abrir DANFSe oficial em PDF"
                            >
                              <FileText size={10} className="text-rose-700" />
                              DANFSe
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveXml(n);
                              }}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Salvar arquivo XML da NFS-e"
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
              Exibindo <strong>{displayedNotas.length}</strong> de <strong>{filteredNotas.length}</strong> notas de serviço
              {filteredNotas.length !== notas.length && <span> (filtradas do total de {notas.length})</span>}
            </div>

            <div className="flex items-center gap-1.5">
              {filteredNotas.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 100)}
                  className="vb-btn"
                >
                  + Carregar Mais 100 Notas
                </button>
              )}
              {filteredNotas.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(filteredNotas.length)}
                  className="vb-btn"
                >
                  Exibir Todas ({filteredNotas.length})
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

      {/* 5. MODAIS CLASSICOS WINFORMS */}

      {/* MODAL 1: CONSULTA PREFEITURA DE SP */}
      {isSpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-sm w-full overflow-hidden text-[11px]">
            <div className="bg-[#003366] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Landmark size={13} />
                Consulta de NFS-e (Prefeitura de São Paulo - PMSP)
              </span>
              <button
                type="button"
                onClick={() => setIsSpModalOpen(false)}
                className="text-white hover:bg-rose-700 px-1.5 py-0.2 rounded text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <p className="text-[#333333] leading-relaxed">
                Consulta direta aos webservices oficiais da <strong>Prefeitura de São Paulo</strong> para capturar notas fiscais tomadas de prestadores paulistanos.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-[#333333] block mb-1">Ano:</label>
                  <select
                    value={spAno}
                    onChange={(e) => setSpAno(e.target.value)}
                    className="vb-input w-full font-bold"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-[#333333] block mb-1">Mês:</label>
                  <select
                    value={spMes}
                    onChange={(e) => setSpMes(e.target.value)}
                    className="vb-input w-full font-bold"
                  >
                    <option value="01">01 - Janeiro</option>
                    <option value="02">02 - Fevereiro</option>
                    <option value="03">03 - Março</option>
                    <option value="04">04 - Abril</option>
                    <option value="05">05 - Maio</option>
                    <option value="06">06 - Junho</option>
                    <option value="07">07 - Julho</option>
                    <option value="08">08 - Agosto</option>
                    <option value="09">09 - Setembro</option>
                    <option value="10">10 - Outubro</option>
                    <option value="11">11 - Novembro</option>
                    <option value="12">12 - Dezembro</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#d0d0d0] pt-2.5">
                <button
                  type="button"
                  onClick={() => setIsSpModalOpen(false)}
                  className="vb-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSyncSp}
                  disabled={syncingSp}
                  className="vb-btn vb-btn-primary"
                >
                  <RefreshCw size={12} className={syncingSp ? "animate-spin" : ""} />
                  <span>{syncingSp ? "Consultando SP..." : "Iniciar Captura SP"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RESET NSU NFS-E */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-sm w-full overflow-hidden text-[11px]">
            <div className="bg-[#003366] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <RotateCcw size={13} />
                Redefinir Cursor NSU (Portal Nacional ADN)
              </span>
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="text-white hover:bg-rose-700 px-1.5 py-0.2 rounded text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <p className="text-[#333333] leading-relaxed">
                O cursor atual é <strong>{ultimoNsu}</strong>. Ao redefinir para <strong>0</strong>, o robô irá consultar todo o histórico de notas fiscais do Portal Nacional novamente.
              </p>
              <div>
                <label className="font-bold text-[#333333] block mb-1">Novo Valor do NSU:</label>
                <input
                  type="number"
                  value={customResetNsu}
                  onChange={(e) => setCustomResetNsu(e.target.value)}
                  className="vb-input w-28 font-mono font-bold"
                />
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-[#d0d0d0] pt-2.5">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="vb-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleResetNsu}
                  className="vb-btn vb-btn-primary"
                >
                  Confirmar Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: AGENDADOR DIÁRIO NFS-E */}
      {isNfseSchedulerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl max-w-md w-full overflow-hidden text-[11px]">
            <div className="bg-[#003366] text-white px-3 py-1.5 flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                <Clock size={13} />
                Agendador Diário de NFS-e
              </span>
              <button
                type="button"
                onClick={() => setIsNfseSchedulerModalOpen(false)}
                className="text-white hover:bg-rose-700 px-1.5 py-0.2 rounded text-[10px]"
              >
                ✕
              </button>
            </div>
            <div className="p-3 flex flex-col gap-3">
              <div className="bg-[#ffffff] border border-[#b0b0b0] p-2 flex items-center justify-between">
                <div>
                  <strong className="block text-[#003366]">Captação Diária Automática</strong>
                  <span className="text-[#666666]">
                    {nfseSchedulerEnabled ? `Ativo: executará todos os dias às ${nfseSchedulerTime}` : "Desativado"}
                  </span>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer font-bold">
                  <input
                    type="checkbox"
                    checked={nfseSchedulerEnabled}
                    onChange={(e) => setNfseSchedulerEnabled(e.target.checked)}
                  />
                  <span>{nfseSchedulerEnabled ? "Habilitado" : "Desabilitado"}</span>
                </label>
              </div>

              <div>
                <label className="font-bold text-[#333333] block mb-1">Horário Diário da Captação:</label>
                <input
                  type="time"
                  value={nfseSchedulerTime}
                  disabled={!nfseSchedulerEnabled}
                  onChange={(e) => setNfseSchedulerTime(e.target.value)}
                  className="vb-input w-32 font-mono font-bold"
                />
              </div>

              <div className="text-[#666666] text-[10px] bg-[#f9f9f9] border border-[#d8d8d8] p-2 leading-relaxed">
                Ao chegar o horário programado, o robô do CONT-AI disparará automaticamente a sincronização das notas de serviço (Portal Nacional ADN e São Paulo), funcionando em segundo plano mesmo com a janela fechada na bandeja do Windows.
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#d0d0d0] pt-2.5">
                <button
                  type="button"
                  onClick={() => setIsNfseSchedulerModalOpen(false)}
                  className="vb-btn"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveNfseScheduler}
                  disabled={savingNfseScheduler}
                  className="vb-btn vb-btn-primary"
                >
                  <Save size={12} className={savingNfseScheduler ? "animate-spin" : ""} />
                  <span>{savingNfseScheduler ? "Gravando..." : "Gravar Agendamento"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. STATUSBAR CLASSICA CONT-AI COM INDICADORES FUNCIONAIS DE CAPS E NUM */}
      <div className="bg-[#f0f0f0] border-t border-[#a0a0a0] px-2 py-1 flex items-center justify-between text-[11px] text-[#333333] shadow-inner">
        {/* Seção Esquerda: Identidade & Conexão Portais */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 border-r border-[#c0c0c0] pr-3">
            <img src={logoImg} alt="CONT-AI" className="h-3.5 w-auto object-contain" />
            <span className="font-bold text-[#003366]">CONT-AI - Gestor de Movimento fiscal</span>
          </div>

          <div className="flex items-center gap-1.5 border-r border-[#c0c0c0] pr-3">
            <span className={`w-2 h-2 rounded-full ${syncingNacional || syncingSp ? "bg-amber-500 animate-pulse" : "bg-emerald-600"}`} />
            <span>NFS-e (ADN & SP): {syncingNacional || syncingSp ? "Sincronizando..." : "Conectado"}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 border-r border-[#c0c0c0] pr-3">
            <span>Notas de Serviço:</span>
            <strong>{filteredNotas.length}</strong>
            <span className="text-[#666666]">({notas.length} total)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 border-r border-[#c0c0c0] pr-3">
            <span>Total Exibido:</span>
            <strong className="text-emerald-800 font-mono">{formatBRL(totalFiltrado)}</strong>
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
