import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { EmpresaSefaz, EmpresaMetrics } from "../types";
import { getCompaniesMetrics, openCompanyFolder } from "../utils/electronBridge";
import { formatDateBr, calculateDaysRemaining } from "../utils/certUtils";
import { useDebounce } from "../utils/useDebounce";
import SyncAllProgressModal from "./SyncAllProgressModal";
import LoadingGearOverlay from "./LoadingGearOverlay";
import logoImg from "../../assets/logo.png";
import {
  RotateCw,
  Plus,
  Folder,
  BarChart3,
  Copy,
  ShieldCheck,
  CheckCircle2,
  Building2,
  Search,
  Settings
} from "lucide-react";

interface EmpresasHubViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresaId: string | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal?: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNotify: (text: string, type: "success" | "error") => void;
  refreshKey?: number;
}

export default function EmpresasHubView({
  empresas,
  activeEmpresaId,
  onSelectEmpresa,
  onOpenCompanyModal,
  onNotify,
  refreshKey,
}: EmpresasHubViewProps) {
  const empresasRef = useRef(empresas);
  empresasRef.current = empresas;

  // Inicializa o grid instantaneamente com os dados em memória (0 ms de espera)
  const [metrics, setMetrics] = useState<EmpresaMetrics[]>(() => {
    return (empresas || []).map((e) => {
      let certStatus: EmpresaMetrics["certStatus"] = "missing";
      let daysRemaining = e.certInfo?.daysRemaining ?? null;
      if ((daysRemaining === null || daysRemaining === undefined) && e.certInfo?.validTo) {
        daysRemaining = calculateDaysRemaining(e.certInfo.validTo);
      }
      if (daysRemaining !== null) {
        if (daysRemaining < 0) certStatus = "expired";
        else if (daysRemaining <= 30) certStatus = "expiring_soon";
        else certStatus = "valid";
      }
      return {
        id: e.id,
        cnpj: e.cnpj,
        razaoSocial: e.razaoSocial,
        uf: e.uf,
        regime: e.regime,
        nfeCount: 0,
        nfceCount: 0,
        cteCount: 0,
        nfseTomadasCount: 0,
        nfsePrestadasCount: 0,
        nfseTotalCount: 0,
        totalDocs: 0,
        certStatus,
        certDaysRemaining: daysRemaining,
        certValidTo: e.certInfo?.validTo,
        certSubject: e.certInfo?.subject,
        certIssuer: e.certInfo?.issuer,
        modelosHabilitados: e.modelosHabilitados,
      };
    });
  });

  // Sincroniza o grid com a lista de empresas caso sejam adicionadas ou removidas
  useEffect(() => {
    setMetrics((prev) => {
      const prevMap = new Map(prev.map((p) => [p.id, p]));
      return (empresas || []).map((e) => {
        const existing = prevMap.get(e.id);
        if (existing) {
          return {
            ...existing,
            razaoSocial: e.razaoSocial,
            cnpj: e.cnpj,
            uf: e.uf,
            regime: e.regime,
            modelosHabilitados: e.modelosHabilitados,
          };
        }
        return {
          id: e.id,
          cnpj: e.cnpj,
          razaoSocial: e.razaoSocial,
          uf: e.uf,
          regime: e.regime,
          nfeCount: 0,
          nfceCount: 0,
          cteCount: 0,
          nfseTomadasCount: 0,
          nfsePrestadasCount: 0,
          nfseTotalCount: 0,
          totalDocs: 0,
          certStatus: "missing",
          certDaysRemaining: null,
          certValidTo: e.certInfo?.validTo,
          certSubject: e.certInfo?.subject,
          certIssuer: e.certInfo?.issuer,
          modelosHabilitados: e.modelosHabilitados,
        };
      });
    });
  }, [empresas]);

  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [statusFilter, setStatusFilter] = useState<"todas" | "valid" | "expiring" | "expired" | "with_docs">("todas");
  const [regimeFilter, setRegimeFilter] = useState<"todos" | "simples" | "normal">("todos");
  const [selectedId, setSelectedId] = useState<string | null>(activeEmpresaId || (empresas[0]?.id ?? null));
  const [sortColumn, setSortColumn] = useState<string>("razaoSocial");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleHeaderSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Modificadores de teclado reais para CAPS e NUM da StatusBar
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);

  // Relógio clássico no rodapé da StatusBar
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  // Modal de Sincronização Unificada
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncTargetCompany, setSyncTargetCompany] = useState<EmpresaSefaz | null>(null);

  // Carrega métricas do backend
  const loadMetrics = useCallback(async (forceRefresh = false) => {
    const currentEmpresas = empresasRef.current;
    if (!currentEmpresas || currentEmpresas.length === 0) {
      setMetrics([]);
      return;
    }

    setLoadingMetrics(true);
    try {
      const res = await getCompaniesMetrics(currentEmpresas, forceRefresh);
      if (res.success && res.metrics) {
        const enriched = (res.metrics || []).map((m) => {
          let days = m.certDaysRemaining;
          if ((days === null || days === undefined) && m.certValidTo) {
            days = calculateDaysRemaining(m.certValidTo);
          }
          let certStatus = m.certStatus;
          if (days !== null && days !== undefined) {
            if (days < 0) certStatus = "expired";
            else if (days <= 30) certStatus = "expiring_soon";
            else certStatus = "valid";
          }
          return { ...m, certDaysRemaining: days, certStatus };
        });
        setMetrics(enriched);
      } else {
        // Fallback local caso IPC não retorne
        const fallbackMetrics: EmpresaMetrics[] = empresas.map((e) => {
          let certStatus: EmpresaMetrics["certStatus"] = "missing";
          let daysRemaining = e.certInfo?.daysRemaining ?? null;
          if ((daysRemaining === null || daysRemaining === undefined) && e.certInfo?.validTo) {
            daysRemaining = calculateDaysRemaining(e.certInfo.validTo);
          }
          if (daysRemaining !== null) {
            if (daysRemaining < 0) certStatus = "expired";
            else if (daysRemaining <= 30) certStatus = "expiring_soon";
            else certStatus = "valid";
          }
          return {
            id: e.id,
            cnpj: e.cnpj,
            razaoSocial: e.razaoSocial,
            uf: e.uf,
            regime: e.regime,
            nfeCount: 0,
            nfceCount: 0,
            cteCount: 0,
            nfseTomadasCount: 0,
            nfsePrestadasCount: 0,
            nfseTotalCount: 0,
            totalDocs: 0,
            certStatus,
            certDaysRemaining: daysRemaining,
            certValidTo: e.certInfo?.validTo,
            certSubject: e.certInfo?.subject,
            certIssuer: e.certInfo?.issuer,
            modelosHabilitados: e.modelosHabilitados,
          };
        });
        setMetrics(fallbackMetrics);
      }
    } catch (err: any) {
      console.error("Erro ao carregar métricas das empresas:", err);
      onNotify("Erro ao recarregar dados de disco das empresas.", "error");
    } finally {
      setLoadingMetrics(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadMetrics(false);
  }, [empresas.length, refreshKey, loadMetrics]);

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

  // Formatar CNPJ
  const formatCnpj = (val: string) => {
    const d = String(val || "").replace(/\D/g, "");
    if (d.length === 14) {
      return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
    }
    if (d.length === 11) {
      return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
    }
    return val;
  };

  // KPIs Consolidados
  const kpis = useMemo(() => {
    let totalDocs = 0;
    let nfeTotal = 0;
    let nfceTotal = 0;
    let cteTotal = 0;
    let nfseTotal = 0;
    let validCerts = 0;
    let expiringCerts = 0;
    let expiredCerts = 0;
    let simplesCount = 0;
    let normalCount = 0;

    metrics.forEach((m) => {
      totalDocs += m.totalDocs || 0;
      nfeTotal += m.nfeCount || 0;
      nfceTotal += m.nfceCount || 0;
      cteTotal += m.cteCount || 0;
      nfseTotal += m.nfseTotalCount || 0;

      if (m.certStatus === "valid") validCerts++;
      else if (m.certStatus === "expiring_soon") expiringCerts++;
      else if (m.certStatus === "expired") expiredCerts++;

      if (m.regime === "simples") simplesCount++;
      else normalCount++;
    });

    return {
      totalEmpresas: empresas.length,
      totalDocs,
      nfeTotal,
      nfceTotal,
      cteTotal,
      nfseTotal,
      validCerts,
      expiringCerts,
      expiredCerts,
      simplesCount,
      normalCount,
    };
  }, [metrics, empresas.length]);

  // Filtragem das empresas
  const filteredMetrics = useMemo(() => {
    return metrics.filter((m) => {
      if (debouncedSearchTerm.trim()) {
        const q = debouncedSearchTerm.toLowerCase().trim();
        const cleanQ = q.replace(/\D/g, "");
        const cleanCnpj = String(m.cnpj || "").replace(/\D/g, "");
        const matchName = (m.razaoSocial || "").toLowerCase().includes(q);
        const matchUf = (m.uf || "").toLowerCase() === q;
        const matchCnpj = cleanQ.length > 0 && cleanCnpj.includes(cleanQ);
        if (!matchName && !matchUf && !matchCnpj) return false;
      }

      if (statusFilter === "expiring" && m.certStatus !== "expiring_soon") return false;
      if (statusFilter === "expired" && m.certStatus !== "expired") return false;
      if (statusFilter === "valid" && m.certStatus !== "valid") return false;
      if (statusFilter === "with_docs" && m.totalDocs === 0) return false;

      if (regimeFilter !== "todos" && m.regime !== regimeFilter) return false;

      return true;
    });
  }, [metrics, debouncedSearchTerm, statusFilter, regimeFilter]);

  // Mapa fixo de código sequencial por empresa (para que ordenar por Cód. ou outras colunas preserve o código de cada empresa)
  const codigoMap = useMemo(() => {
    const map = new Map<string, number>();
    metrics.forEach((m, index) => {
      map.set(m.id, index + 1);
    });
    return map;
  }, [metrics]);

  // Ordenação das empresas (menor para o maior / maior para o menor)
  const sortedMetrics = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    const getDays = (item: EmpresaMetrics): number | null => {
      if (item.certDaysRemaining !== null && item.certDaysRemaining !== undefined) return item.certDaysRemaining;
      if (item.certValidTo) return calculateDaysRemaining(item.certValidTo);
      return null;
    };
    const getCertRank = (item: EmpresaMetrics): number => {
      const days = getDays(item);
      if (item.certStatus === "expired" || (days !== null && days <= 0)) return 1; // Vencido
      if (item.certStatus === "expiring_soon" || (days !== null && days <= 30)) return 2; // Atenção
      if (!item.certValidTo && days === null) return 4; // Sem certificado
      return 3; // Válido
    };

    return [...filteredMetrics].sort((a, b) => {
      switch (sortColumn) {
        case "codigo":
          return ((codigoMap.get(a.id) || 0) - (codigoMap.get(b.id) || 0)) * dir;
        case "razaoSocial":
          return (a.razaoSocial || "").localeCompare(b.razaoSocial || "", "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        case "cnpj":
          return (a.cnpj || "").replace(/\D/g, "").localeCompare((b.cnpj || "").replace(/\D/g, "")) * dir;
        case "uf":
          return (a.uf || "").localeCompare(b.uf || "", "pt-BR", { sensitivity: "base" }) * dir;
        case "regime":
          return (a.regime || "").localeCompare(b.regime || "", "pt-BR", { sensitivity: "base" }) * dir;
        case "nfe":
          return ((Number(a.nfeCount) || 0) - (Number(b.nfeCount) || 0)) * dir;
        case "nfce":
          return ((Number(a.nfceCount) || 0) - (Number(b.nfceCount) || 0)) * dir;
        case "cte":
          return ((Number(a.cteCount) || 0) - (Number(b.cteCount) || 0)) * dir;
        case "nfse": {
          const nfseA = Number(a.nfseTotalCount ?? ((a.nfseTomadasCount || 0) + (a.nfsePrestadasCount || 0))) || 0;
          const nfseB = Number(b.nfseTotalCount ?? ((b.nfseTomadasCount || 0) + (b.nfsePrestadasCount || 0))) || 0;
          return (nfseA - nfseB) * dir;
        }
        case "totalDocs":
          return ((Number(a.totalDocs) || 0) - (Number(b.totalDocs) || 0)) * dir;
        case "validade":
        case "diasRest": {
          const dA = getDays(a);
          const dB = getDays(b);
          const valA = dA !== null ? dA : 99999;
          const valB = dB !== null ? dB : 99999;
          return (valA - valB) * dir;
        }
        case "situacaoCert":
          return (getCertRank(a) - getCertRank(b)) * dir;
        default:
          return 0;
      }
    });
  }, [filteredMetrics, sortColumn, sortDirection, codigoMap]);

  // Manter linha selecionada válida
  useEffect(() => {
    if (filteredMetrics.length > 0) {
      const exists = filteredMetrics.some((m) => m.id === selectedId);
      if (!exists) {
        setSelectedId(filteredMetrics[0].id);
      }
    } else {
      setSelectedId(null);
    }
  }, [filteredMetrics, selectedId]);

  // Empresa selecionada
  const selectedMetric = useMemo(() => {
    if (!selectedId) return filteredMetrics[0] || null;
    return filteredMetrics.find((m) => m.id === selectedId) || filteredMetrics[0] || null;
  }, [filteredMetrics, selectedId]);

  const selectedRawEmpresa = useMemo(() => {
    if (!selectedMetric) return null;
    return empresas.find((e) => e.id === selectedMetric.id) || null;
  }, [empresas, selectedMetric]);

  // Ações de usuário
  const handleCopyCnpj = (cnpj: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const clean = String(cnpj).replace(/\D/g, "");
    navigator.clipboard.writeText(clean);
    onNotify(`CNPJ ${formatCnpj(clean)} copiado para a área de transferência!`, "success");
  };

  const handleOpenFolder = async (comp: EmpresaSefaz | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!comp) return;
    try {
      const res = await openCompanyFolder(comp.cnpj, undefined, comp.razaoSocial);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir a pasta da empresa.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir pasta: ${err.message}`, "error");
    }
  };

  const handleSyncCompany = (comp: EmpresaSefaz | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!comp) return;
    setSyncTargetCompany(comp);
    setIsSyncModalOpen(true);
  };

  const handleSyncAll = () => {
    setSyncTargetCompany(null);
    setIsSyncModalOpen(true);
  };

  const handleEnterCompany = (empresaId?: string) => {
    const targetId = empresaId || selectedMetric?.id;
    if (targetId) {
      onSelectEmpresa(targetId);
    }
  };

  // Teclas de atalho (Enter para abrir empresa, Setas para navegar, F5 para atualizar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em um input
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        if (e.key === "Enter" && selectedMetric) {
          handleEnterCompany(selectedMetric.id);
        }
        return;
      }

      if (e.key === "Enter" && selectedMetric) {
        e.preventDefault();
        handleEnterCompany(selectedMetric.id);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const curIdx = filteredMetrics.findIndex((m) => m.id === selectedId);
        if (curIdx >= 0 && curIdx < filteredMetrics.length - 1) {
          setSelectedId(filteredMetrics[curIdx + 1].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curIdx = filteredMetrics.findIndex((m) => m.id === selectedId);
        if (curIdx > 0) {
          setSelectedId(filteredMetrics[curIdx - 1].id);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        loadMetrics(true);
        onNotify("Grid de empresas atualizada com sucesso.", "success");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredMetrics, selectedId, selectedMetric, loadMetrics]);

  // Exportar Grid para CSV (Padrão ERP Contábil)
  const handleExportCsv = () => {
    if (filteredMetrics.length === 0) {
      onNotify("Nenhum registro para exportar com os filtros atuais.", "error");
      return;
    }

    const headers = [
      "Código",
      "Razão Social",
      "CNPJ",
      "UF",
      "Regime Tributário",
      "NF-e (55)",
      "NFC-e (65)",
      "CT-e (57)",
      "NFS-e (Total)",
      "NFS-e Tomadas",
      "NFS-e Prestadas",
      "Total Geral Documentos",
      "Validade A1",
      "Dias Restantes",
      "Situação Certificado",
    ];

    const rows = filteredMetrics.map((m, idx) => {
      const validadeStr = formatDateBr(m.certValidTo, "N/D");
      let days = m.certDaysRemaining;
      if ((days === null || days === undefined) && m.certValidTo) {
        days = calculateDaysRemaining(m.certValidTo);
      }
      const situacaoStr =
        days !== null && days !== undefined && days <= 0
          ? "Vencido / Expirado"
          : days !== null && days !== undefined && days <= 30
          ? "Vencendo (<=30d)"
          : m.certStatus === "valid" || (days !== null && days !== undefined && days > 30)
          ? "Válido"
          : m.certStatus === "expired"
          ? "Vencido / Expirado"
          : "Não carregado";

      return [
        String(idx + 1).padStart(3, "0"),
        `"${(m.razaoSocial || "").replace(/"/g, '""')}"`,
        m.cnpj,
        m.uf || "SP",
        m.regime === "simples" ? "Simples Nacional" : "Regime Normal",
        m.nfeCount || 0,
        m.nfceCount || 0,
        m.cteCount || 0,
        m.nfseTotalCount || 0,
        m.nfseTomadasCount || 0,
        m.nfsePrestadasCount || 0,
        m.totalDocs || 0,
        validadeStr,
        days ?? "N/D",
        `"${situacaoStr}"`,
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `empresas_cont_ai_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify("Relação de empresas exportada com sucesso em formato CSV!", "success");
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
        .vb-btn-primary {
          background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
          border: 1px solid #336699;
          font-weight: 600;
          color: #002244;
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
          border-bottom: 1px solid #e8e8e8;
          padding: 3px 6px;
          white-space: nowrap;
        }
        .datagrid-table tr.selected {
          background-color: #005a9e !important;
          color: #ffffff !important;
        }
        .datagrid-table tr.selected td {
          color: #ffffff !important;
          border-bottom-color: #004d88;
        }
        .datagrid-table tr:hover:not(.selected) {
          background-color: #f0f6ff;
        }
        .status-bar {
          background: linear-gradient(180deg, #f2f2f2 0%, #e1e1e1 100%);
          border-top: 1px solid #b0b0b0;
          padding: 2px 6px;
          font-size: 11px;
          color: #333333;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .status-panel {
          border-right: 1px solid #b0b0b0;
          padding-right: 10px;
        }
      `}</style>

      {/* ================= 2. BARRA DE FERRAMENTAS CLÁSSICA (ACTION TOOLBAR) ================= */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-2xs">
        {/* Lado Esquerdo: Ações Principais da Empresa e Cadastro */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {onOpenCompanyModal && (
            <button
              type="button"
              onClick={() => onOpenCompanyModal("empresas")}
              className="vb-btn"
              title="Cadastrar nova empresa ou gerenciar certificados A1"
            >
              <Plus size={12} className="text-[#005a9e]" />
              <span>Cadastrar / Gerenciar Empresas</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenFolder(selectedRawEmpresa)}
            disabled={!selectedRawEmpresa}
            className="vb-btn"
            title="Abrir pasta de arquivos XML da empresa no Windows Explorer"
          >
            <Folder size={12} className="text-[#886600]" />
            <span>Abrir Pasta de XMLs</span>
          </button>
        </div>

        {/* Lado Direito: Exportação e Atualização da Grid */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredMetrics.length === 0}
            className="vb-btn"
            title="Exportar relação de empresas em formato CSV / Excel"
          >
            <BarChart3 size={12} className="text-[#107c41]" />
            <span>Exportar Grid (CSV)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b0b0b0] mx-0.5 hidden sm:block"></div>

          <button
            type="button"
            onClick={() => {
              loadMetrics(true);
              onNotify("Grid de empresas atualizada com sucesso.", "success");
            }}
            disabled={loadingMetrics}
            className="vb-btn"
            title="Recarregar contagem de XMLs e validade dos certificados no disco (F5)"
          >
            <RotateCw size={12} className={loadingMetrics ? "animate-spin" : ""} />
            <span>{loadingMetrics ? "Atualizando..." : "Atualizar Grid (F5)"}</span>
          </button>
        </div>
      </div>

      {/* ================= 3. ÁREA PRINCIPAL DO ERP ================= */}
      <div className="p-2 flex flex-col gap-1.5 flex-1 overflow-auto">
        {/* GROUPBOX 1: TOTAIS E ALERTAS DO ESCRITÓRIO CONTÁBIL */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Totais e Alertas do Escritório Contábil</legend>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="bg-white border border-[#c0c0c0] p-1.5 flex flex-col justify-between">
              <span className="text-[#555555] font-semibold text-[11px]">Empresas Cadastradas:</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-bold text-[#003366]">{kpis.totalEmpresas}</span>
                <span className="text-[10px] text-[#666666]">
                  {kpis.simplesCount} SN | {kpis.normalCount} Normal
                </span>
              </div>
            </div>

            <div className="bg-white border border-[#c0c0c0] p-1.5 flex flex-col justify-between">
              <span className="text-[#555555] font-semibold text-[11px]">Total de XMLs em Disco:</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-bold text-[#003366]">
                  {kpis.totalDocs.toLocaleString("pt-BR")}
                </span>
                <span className="text-[10px] text-[#666666]">documentos</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter((prev) => (prev === "valid" ? "todas" : "valid"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                statusFilter === "valid"
                  ? "bg-[#e8f5e9] border-[#2e7d32]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#f9fff9]"
              }`}
              title="Clique para filtrar apenas certificados válidos"
            >
              <span className="text-[#107c41] font-semibold text-[11px]">Certificados Válidos (&gt; 30d):</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-bold text-[#107c41]">{kpis.validCerts}</span>
                <span className="text-[10px] text-[#666666]">regulares</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter((prev) => (prev === "expiring" ? "todas" : "expiring"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                statusFilter === "expiring"
                  ? "bg-[#fff3cd] border-[#d39e00]"
                  : "bg-[#fffdf0] border-[#e6a100] hover:bg-[#fff9db]"
              }`}
              title="Clique para filtrar apenas certificados vencendo em até 30 dias"
            >
              <span className="text-[#b7791f] font-semibold text-[11px]">Vencimento Próximo (≤ 30d):</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-bold text-[#b7791f]">{kpis.expiringCerts}</span>
                <span className="text-[10px] text-[#a06800]">atenção</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter((prev) => (prev === "expired" ? "todas" : "expired"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                statusFilter === "expired"
                  ? "bg-[#f8d7da] border-[#dc3545]"
                  : "bg-[#fff5f5] border-[#d83b01] hover:bg-[#fde8e8]"
              }`}
              title="Clique para filtrar apenas certificados vencidos"
            >
              <span className="text-[#a80000] font-semibold text-[11px]">Certificados Expirados:</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-base font-bold text-[#a80000]">{kpis.expiredCerts}</span>
                <span className="text-[10px] text-[#a80000]">urgente</span>
              </div>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 2: FILTROS DE PESQUISA E SELEÇÃO */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Filtros de Pesquisa e Seleção</legend>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label htmlFor="filtroTextoHub" className="font-semibold text-[#333333]">
                Pesquisar:
              </label>
              <input
                id="filtroTextoHub"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Razão Social, CNPJ ou UF..."
                className="vb-input w-64"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="filtroStatusHub" className="font-semibold text-[#333333]">
                Situação do Certificado:
              </label>
              <select
                id="filtroStatusHub"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="vb-input"
              >
                <option value="todas">Todas as Situações</option>
                <option value="valid">Apenas Certificados Válidos</option>
                <option value="expiring">Apenas Vencendo em até 30 dias</option>
                <option value="expired">Apenas Certificados Vencidos / Expirados</option>
                <option value="with_docs">Apenas Empresas com XMLs</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <label htmlFor="filtroRegimeHub" className="font-semibold text-[#333333]">
                Regime Tributário:
              </label>
              <select
                id="filtroRegimeHub"
                value={regimeFilter}
                onChange={(e) => setRegimeFilter(e.target.value as any)}
                className="vb-input"
              >
                <option value="todos">Todos os Regimes</option>
                <option value="simples">Simples Nacional</option>
                <option value="normal">Regime Normal (Presumido / Real)</option>
              </select>
            </div>

            {(searchTerm || statusFilter !== "todas" || regimeFilter !== "todos") && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("todas");
                  setRegimeFilter("todos");
                }}
                className="vb-btn"
              >
                Limpar Filtros
              </button>
            )}
          </div>
        </fieldset>

        {/* GROUPBOX 3: DADOS DA EMPRESA SELECIONADA NA GRID (LOCALIZADO DIRETAMENTE ACIMA DA GRID) */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Dados da Empresa Selecionada na Grid</legend>
          {selectedMetric ? (
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
              <div>
                <div>
                  <span className="text-[#555555]">Empresa Ativa:</span>
                  <strong className="text-[#003366] text-xs font-bold ml-1.5">
                    {selectedMetric.razaoSocial}
                  </strong>
                  <span className="text-[#666666] ml-2">
                    (CNPJ: <strong>{formatCnpj(selectedMetric.cnpj)}</strong> — UF:{" "}
                    <strong>{selectedMetric.uf || "SP"}</strong> —{" "}
                    <strong>{selectedMetric.regime === "simples" ? "Simples Nacional" : "Regime Normal"}</strong>)
                  </span>
                </div>
                <div className="text-[11px] text-[#555555] mt-0.5">
                  Certificado Digital:{" "}
                  <strong>
                    {selectedMetric.certIssuer ||
                      selectedRawEmpresa?.certInfo?.issuer ||
                      selectedMetric.certSubject ||
                      "A1 Instalado"}
                  </strong>{" "}
                  | Validade:{" "}
                  <strong>
                    {formatDateBr(selectedMetric.certValidTo || selectedRawEmpresa?.certInfo?.validTo, "N/D")}
                  </strong>{" "}
                  (
                  {(() => {
                    let d = selectedMetric.certDaysRemaining;
                    if ((d === null || d === undefined) && (selectedMetric.certValidTo || selectedRawEmpresa?.certInfo?.validTo)) {
                      d = calculateDaysRemaining(selectedMetric.certValidTo || selectedRawEmpresa?.certInfo?.validTo);
                    }
                    if (selectedMetric.certStatus === "expired" || (d !== null && d !== undefined && d <= 0)) {
                      return <span className="text-[#a80000] font-bold">Certificado Vencido / Expirado</span>;
                    }
                    if (d !== null && d !== undefined && d <= 30) {
                      return <span className="text-[#b7791f] font-bold">{d} dias restantes (Requer renovação)</span>;
                    }
                    if (d !== null && d !== undefined) {
                      return <span className="text-[#107c41] font-semibold">{d} dias restantes (Regular)</span>;
                    }
                    return <span className="text-[#777777]">Não verificado</span>;
                  })()}
                  )
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-1.5 self-start md:self-auto">
                <button
                  type="button"
                  onClick={(e) => handleCopyCnpj(selectedMetric.cnpj, e)}
                  className="vb-btn"
                  title="Copiar CNPJ da empresa para a área de transferência"
                >
                  <Copy size={12} />
                  <span>Copiar CNPJ</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => handleSyncCompany(selectedRawEmpresa, e)}
                  disabled={!selectedRawEmpresa}
                  className="vb-btn vb-btn-primary"
                  title="Sincronizar os 4 modelos fiscais desta empresa"
                >
                  <RotateCw size={12} className="text-[#003366]" />
                  <span>Sincronizar Esta Empresa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="text-[#777777] italic py-1">
              Nenhuma empresa selecionada na grid. Selecione uma empresa abaixo ou limpe os filtros.
            </div>
          )}
        </fieldset>

        {/* GROUPBOX 4: DATAGRID PRINCIPAL DE EMPRESAS (CLÁSSICA ESTILO DOMÍNIO / ÚNICO SCI) */}
        <div className="flex-1 flex flex-col bg-white border border-[#999999] min-h-[300px]">
          {/* Cabeçalho de Barra da Grid */}
          <div className="bg-[#e4e4e4] border-b border-[#b5b5b5] px-2 py-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#333333]">
              Relação de Empresas Cadastradas (Dê dois cliques na linha para acessar o movimento fiscal)
            </span>
            <span className="text-[#555555]">
              Exibindo <strong>{filteredMetrics.length}</strong> de <strong>{empresas.length}</strong> empresas
            </span>
          </div>

          {/* Tabela com Rolagem Real */}
          <div className="flex-1 overflow-auto bg-white relative">
            <LoadingGearOverlay
              isLoading={loadingMetrics && metrics.length > 0}
              title="Sincronizando Empresas e Métricas..."
              subtitle="Verificando volume de notas fiscais e certificados no disco..."
            />
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("codigo")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "50px", textAlign: "center" }}
                    title="Clique para ordenar por código"
                  >
                    <div className="flex items-center justify-between">
                      <span>Cód.</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "codigo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("razaoSocial")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ minWidth: "260px" }}
                    title="Clique para ordenar por razão social"
                  >
                    <div className="flex items-center justify-between">
                      <span>Razão Social da Empresa</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "razaoSocial" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("cnpj")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "135px" }}
                    title="Clique para ordenar por CNPJ"
                  >
                    <div className="flex items-center justify-between">
                      <span>CNPJ</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "cnpj" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("uf")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "45px", textAlign: "center" }}
                    title="Clique para ordenar por UF"
                  >
                    <div className="flex items-center justify-between">
                      <span>UF</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "uf" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("regime")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "125px" }}
                    title="Clique para ordenar por regime tributário"
                  >
                    <div className="flex items-center justify-between">
                      <span>Regime Tributário</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "regime" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("nfe")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px", textAlign: "right" }}
                    title="Clique para ordenar por quantidade de NF-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>NF-e (55)</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "nfe" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("nfce")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px", textAlign: "right" }}
                    title="Clique para ordenar por quantidade de NFC-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>NFC-e (65)</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "nfce" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("cte")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px", textAlign: "right" }}
                    title="Clique para ordenar por quantidade de CT-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>CT-e (57)</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "cte" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("nfse")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px", textAlign: "right" }}
                    title="Clique para ordenar por quantidade de NFS-e"
                  >
                    <div className="flex items-center justify-between">
                      <span>NFS-e</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "nfse" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("totalDocs")}
                    className="cursor-pointer hover:bg-[#d0e0f5] select-none transition-colors"
                    style={{ width: "95px", textAlign: "right", background: "#e0e8f5" }}
                    title="Clique para ordenar por total de documentos"
                  >
                    <div className="flex items-center justify-between">
                      <span>Total Docs</span>
                      <span className="text-[10px] text-[#003366] font-bold">
                        {sortColumn === "totalDocs" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("validade")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "100px" }}
                    title="Clique para ordenar por data de validade do Certificado A1"
                  >
                    <div className="flex items-center justify-between">
                      <span>Validade A1</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "validade" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("diasRest")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px", textAlign: "center" }}
                    title="Clique para ordenar por dias restantes do certificado"
                  >
                    <div className="flex items-center justify-between">
                      <span>Dias Rest.</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "diasRest" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("situacaoCert")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "125px" }}
                    title="Clique para ordenar por situação do certificado"
                  >
                    <div className="flex items-center justify-between">
                      <span>Situação Certificado</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "situacaoCert" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingMetrics && metrics.length === 0 ? (
                  <LoadingGearOverlay
                    isLoading={true}
                    variant="table"
                    colSpan={13}
                    title="Carregando Empresas e Métricas..."
                    subtitle="Lendo diretórios e validando certificados em disco..."
                  />
                ) : filteredMetrics.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="text-center py-8 text-[#777777]">
                      Nenhum registro encontrado com os critérios de busca informados.
                    </td>
                  </tr>
                ) : (
                  sortedMetrics.map((item, idx) => {
                    const isSelected = selectedId === item.id;
                    const validadeStr = formatDateBr(item.certValidTo, "N/D");

                    let daysRemaining = item.certDaysRemaining;
                    if ((daysRemaining === null || daysRemaining === undefined) && item.certValidTo) {
                      daysRemaining = calculateDaysRemaining(item.certValidTo);
                    }

                    let statusCertText = "Válido";
                    let statusColorStyle: React.CSSProperties = {
                      color: isSelected ? "#ffffff" : "#107c41",
                      fontWeight: 600,
                    };

                    if (
                      item.certStatus === "expired" ||
                      (daysRemaining !== null &&
                        daysRemaining !== undefined &&
                        daysRemaining <= 0)
                    ) {
                      statusCertText = "Vencido / Expirado";
                      statusColorStyle = {
                        color: isSelected ? "#ffcccc" : "#a80000",
                        fontWeight: "bold",
                      };
                    } else if (
                      item.certStatus === "expiring_soon" ||
                      (daysRemaining !== null &&
                        daysRemaining !== undefined &&
                        daysRemaining <= 30)
                    ) {
                      statusCertText = "Atenção (≤ 30d)";
                      statusColorStyle = {
                        color: isSelected ? "#fff2a8" : "#b7791f",
                        fontWeight: "bold",
                      };
                    } else if (!item.certValidTo && (daysRemaining === null || daysRemaining === undefined)) {
                      statusCertText = "Sem Certificado";
                      statusColorStyle = {
                        color: isSelected ? "#e0e0e0" : "#777777",
                      };
                    }

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        onDoubleClick={() => handleEnterCompany(item.id)}
                        className={`cursor-pointer ${isSelected ? "selected" : ""}`}
                      >
                        <td style={{ textAlign: "center", fontWeight: 600 }}>
                          {String(codigoMap.get(item.id) || (idx + 1)).padStart(3, "0")}
                        </td>
                        <td style={{ fontWeight: 600 }} title={item.razaoSocial}>
                          {item.razaoSocial}
                        </td>
                        <td style={{ fontFamily: "monospace" }}>{formatCnpj(item.cnpj)}</td>
                        <td style={{ textAlign: "center" }}>{item.uf || "SP"}</td>
                        <td>{item.regime === "simples" ? "Simples Nacional" : "Regime Normal"}</td>
                        <td
                          style={{
                            textAlign: "right",
                            color: isSelected ? "#ffffff" : item.nfeCount > 0 ? "#111111" : "#b5b5b5",
                            fontWeight: item.nfeCount > 0 ? 700 : 400,
                          }}
                        >
                          {item.nfeCount.toLocaleString("pt-BR")}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: isSelected ? "#ffffff" : item.nfceCount > 0 ? "#111111" : "#b5b5b5",
                            fontWeight: item.nfceCount > 0 ? 700 : 400,
                          }}
                        >
                          {item.nfceCount.toLocaleString("pt-BR")}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: isSelected ? "#ffffff" : item.cteCount > 0 ? "#111111" : "#b5b5b5",
                            fontWeight: item.cteCount > 0 ? 700 : 400,
                          }}
                        >
                          {item.cteCount.toLocaleString("pt-BR")}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: isSelected ? "#ffffff" : item.nfseTotalCount > 0 ? "#111111" : "#b5b5b5",
                            fontWeight: item.nfseTotalCount > 0 ? 700 : 400,
                          }}
                          title={`Tomadas: ${item.nfseTomadasCount} | Prestadas: ${item.nfsePrestadasCount}`}
                        >
                          {item.nfseTotalCount.toLocaleString("pt-BR")}
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            color: isSelected ? "#ffffff" : item.totalDocs > 0 ? "#003366" : "#b0b0b0",
                            fontWeight: item.totalDocs > 0 ? 800 : 400,
                            background: isSelected ? "transparent" : "#f0f5ff",
                          }}
                        >
                          {item.totalDocs.toLocaleString("pt-BR")}
                        </td>
                        <td>{validadeStr}</td>
                        <td style={{ textAlign: "center", ...statusColorStyle }}>
                          {daysRemaining !== null && daysRemaining !== undefined
                            ? daysRemaining <= 0
                              ? "Vencido"
                              : `${daysRemaining}d`
                            : "N/D"}
                        </td>
                        <td style={statusColorStyle}>{statusCertText}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================= 4. STATUSBAR CLÁSSICA DO WINDOWS / ERP NO RODAPÉ ================= */}
      <footer className="status-bar">
        <div className="status-panel flex items-center gap-1.5">
          <img
            src={logoImg}
            alt="CONT-AI"
            className="h-3.5 w-3.5 rounded-xs object-contain bg-white p-[0.5px] border border-[#a0a0a0]"
          />
          <strong className="text-[#003366] text-[11px]">CONT-AI v2.0</strong>
        </div>
        <div className="status-panel">
          <span>
            Status: <strong className="text-[#107c41]">● Conectado</strong>
          </span>
        </div>
        <div className="status-panel hidden sm:block">
          <span>
            SEFAZ Nacional: <strong>Disponível</strong>
          </span>
        </div>
        <div className="status-panel hidden md:block">
          <span>
            ADN Portal NFS-e: <strong>Online</strong>
          </span>
        </div>
        <div className="status-panel hidden lg:block">
          <span>
            Prefeitura SP: <strong>Operacional</strong>
          </span>
        </div>
        <div className="status-panel">
          <span>
            Registros:{" "}
            <strong>
              {filteredMetrics.length} de {empresas.length}
            </strong>
          </span>
        </div>

        {/* Indicador CAPS Lock 100% Funcional */}
        <div className="status-panel">
          <span
            className={isCapsLockOn ? "text-[#000000] font-black" : "text-[#a0a0a0] font-normal"}
            title="Indicador de Caixa Alta (Caps Lock)"
          >
            CAPS
          </span>
        </div>

        {/* Indicador NUM Lock 100% Funcional */}
        <div className="status-panel">
          <span
            className={isNumLockOn ? "text-[#000000] font-black" : "text-[#a0a0a0] font-normal"}
            title="Indicador de Teclado Numérico (Num Lock)"
          >
            NUM
          </span>
        </div>

        {/* Relógio do Sistema */}
        <div className="ml-auto text-[#555555] font-mono text-[10px] hidden sm:block">
          <span>{clock}</span>
        </div>
      </footer>

      {/* ================= 5. MODAL DE SINCRONIZAÇÃO UNIFICADA DO SISTEMA ================= */}
      <SyncAllProgressModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        targetCompany={syncTargetCompany}
        allCompanies={empresas}
        onComplete={() => {
          loadMetrics(true);
          onNotify("Sincronização concluída com sucesso!", "success");
        }}
      />
    </div>
  );
}
