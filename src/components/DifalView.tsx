import React, { useState, useEffect } from "react";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import {
  EmpresaSefaz,
  ParsedNota,
  ParsedItem,
  AppConfig,
  EmitterRegimesMap,
  RecipientRegimesMap,
  ItemConsumerOverridesMap,
  NcmRateRule,
  EmitenteUnico,
  DestinatarioUnico,
  RegimeRemetente,
  RegimeDestinatario,
} from "../types";
import {
  Calculator,
  FileText,
  Layers,
  Settings,
  ShieldCheck,
  Building2,
  Printer,
  FileSpreadsheet,
  RotateCcw,
  RefreshCw,
  FolderOpen,
  Calendar,
  Wallet,
  Clock,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import { formatBRL } from "../utils/calc";
import {
  syncCompanySefaz,
  listCompanyXmls,
  listAvailableMonths,
  readXmlsContent,
  getCompanySefazState,
  onSyncProgress,
  openCompanyFolder,
} from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";
import ConfigSection from "./ConfigSection";
import Dropzone from "./Dropzone";
import EmitterRegimesManager from "./EmitterRegimesManager";
import RecipientRegimesManager from "./RecipientRegimesManager";
import NcmRatesManager from "./NcmRatesManager";
import NcmRatesModal from "./NcmRatesModal";
import NotasTable from "./NotasTable";
import ItensTable from "./ItensTable";

export interface DifalViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNotify: (text: string, type?: "success" | "error") => void;
  onNavigateHub?: () => void;
  onNavigateCaptacao?: () => void;

  // Dados
  notas: ParsedNota[];
  itens: ParsedItem[];
  internalIgnoredCount: number;
  detectedCompanyName: string;
  totalPayable: number;
  predominantMode: string;
  cfopMap: Map<string, string>;
  cfopFileName?: string;

  // Configurações & Regimes
  config: AppConfig;
  onChangeConfig: (updated: Partial<AppConfig>) => void;
  emitterRegimes: EmitterRegimesMap;
  onUpdateEmitterRegime: (cnpj: string, regime: RegimeRemetente | "default") => void;
  onApplyGlobalToUnconfiguredEmitters: () => void;
  recipientRegimes: RecipientRegimesMap;
  onUpdateRecipientRegime: (cnpj: string, regime: RegimeDestinatario | "default") => void;
  onApplyGlobalToUnconfiguredRecipients: () => void;
  itemConsumerOverrides: ItemConsumerOverridesMap;
  onUpdateItemOverride: (itemConfigKey: string, value: string) => void;
  ncmRateRules: NcmRateRule[];
  onAddNcmRule: (rule: Omit<NcmRateRule, "id">) => void;
  onUpdateNcmRule?: (rule: NcmRateRule) => void;
  onRemoveNcmRule: (id: string) => void;
  onImportNcmRules: (rules: NcmRateRule[]) => void;

  // Ações de importação, exportação e limpeza
  onLoadXmlContents: (xmls: Array<{ name: string; content: string }>, company: EmpresaSefaz) => void;
  onXMLsLoaded: (files: FileList | File[]) => void;
  onCFOPLoaded: (file: File) => void;
  onClear: () => void;
  onExportNotas: () => void;
  onExportItens: () => void;
  onOpenReport: () => void;
  auditStatusSummary: string;
  uniqueEmitters: EmitenteUnico[];
  uniqueRecipients: DestinatarioUnico[];
  activeTab?: "config" | "notas" | "itens";
  onTabChange?: (tab: "config" | "notas" | "itens") => void;
}

export default function DifalView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onOpenCompanyModal,
  onNotify,
  onNavigateHub,
  onNavigateCaptacao,
  notas,
  itens,
  internalIgnoredCount,
  detectedCompanyName,
  totalPayable,
  predominantMode,
  cfopMap,
  cfopFileName,
  config,
  onChangeConfig,
  emitterRegimes,
  onUpdateEmitterRegime,
  onApplyGlobalToUnconfiguredEmitters,
  recipientRegimes,
  onUpdateRecipientRegime,
  onApplyGlobalToUnconfiguredRecipients,
  itemConsumerOverrides,
  onUpdateItemOverride,
  ncmRateRules,
  onAddNcmRule,
  onUpdateNcmRule,
  onRemoveNcmRule,
  onImportNcmRules,
  onLoadXmlContents,
  onXMLsLoaded,
  onCFOPLoaded,
  onClear,
  onExportNotas,
  onExportItens,
  onOpenReport,
  auditStatusSummary,
  uniqueEmitters,
  uniqueRecipients,
  activeTab: controlledActiveTab,
  onTabChange,
}: DifalViewProps) {
  // Controle de abas ERP (suporta controlado ou não controlado)
  const [internalActiveTab, setInternalActiveTab] = useState<"config" | "notas" | "itens">(() =>
    notas.length > 0 ? "notas" : "config"
  );
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : internalActiveTab;
  const setActiveTab = (tab: "config" | "notas" | "itens") => {
    if (onTabChange) onTabChange(tab);
    setInternalActiveTab(tab);
  };

  // Estado do Modal Flutuante de Regras de NCM
  const [isNcmModalOpen, setIsNcmModalOpen] = useState(false);
  const [ncmModalPrefill, setNcmModalPrefill] = useState<{
    ncm?: string;
    ufDest?: string;
    aliqInterna?: number;
    aliqFcp?: number;
    description?: string;
  } | null>(null);

  // Estados de SEFAZ e sincronização
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const [nsuState, setNsuState] = useState<{ ultNSU?: string; maxNSU?: string; blockedUntil?: string | null } | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Status Bar clássico
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  // Atualização do relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitoramento de CAPS LOCK e NUM LOCK
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

  // Carrega estado de NSU e meses disponíveis
  const loadCompanyState = async () => {
    if (!activeEmpresa) {
      setNsuState(null);
      setCooldownRemaining(0);
      setAvailableMonths([]);
      return;
    }
    try {
      const res = await getCompanySefazState(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      if (res && res.success && res.state) {
        setNsuState(res.state);
        if (res.state.blockedUntil) {
          const diff = Math.max(0, Math.ceil((new Date(res.state.blockedUntil).getTime() - Date.now()) / 1000));
          setCooldownRemaining(diff);
        } else {
          setCooldownRemaining(0);
        }
      }
      const months = await listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial);
      setAvailableMonths(months || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadCompanyState();
  }, [activeEmpresa, syncing]);

  // Contador de cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Listener para progresso SEFAZ
  useEffect(() => {
    const unsubscribe = onSyncProgress((info) => {
      if (info?.message) {
        setSyncMessage(info.message);
      }
    });
    return unsubscribe;
  }, []);

  // Carregar XMLs do mês selecionado a partir do repositório local
  const handleLoadMonthXmls = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa ativa.", "error");
      return;
    }
    try {
      const filterMonth = selectedMonth === "all" ? undefined : selectedMonth;
      const xmls = await listCompanyXmls(activeEmpresa.cnpj, filterMonth, activeEmpresa.razaoSocial);
      const nfeOnly = (xmls || []).filter((x: any) => {
        if (x.modelo && x.modelo !== "55") return false;
        if (x.name && x.name.toLowerCase().endsWith("-cte.xml")) return false;
        if (x.chNFe && x.chNFe.length === 44 && x.chNFe.substring(20, 22) === "57") return false;
        return true;
      });

      if (nfeOnly.length === 0) {
        onNotify("Nenhum XML de NF-e encontrado para o período selecionado no repositório local.", "error");
        return;
      }

      const paths = nfeOnly.map((x: any) => x.fullPath).filter(Boolean);
      const xmlsWithContent = await readXmlsContent(paths);
      if (xmlsWithContent && xmlsWithContent.length > 0) {
        onLoadXmlContents(xmlsWithContent, activeEmpresa);
        setActiveTab("notas");
      } else {
        onNotify("Falha ao ler o conteúdo dos arquivos XMLs.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao carregar XMLs: ${err.message}`, "error");
    }
  };

  // Sincronização completa com a SEFAZ e recálculo automático
  const handleSyncSefazAndCalculate = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa ativa.", "error");
      return;
    }
    if (!activeEmpresa.certPath && activeEmpresa.certStore !== "windows" && !activeEmpresa.certThumbprint) {
      onNotify("A empresa selecionada não possui arquivo de certificado A1 vinculado (arquivo .pfx ou Windows).", "error");
      return;
    }

    setSyncing(true);
    setSyncMessage("Consultando WebService da SEFAZ Nacional...");
    try {
      const res = await syncCompanySefaz(activeEmpresa);
      if (res && res.success) {
        onNotify(
          `Sincronização SEFAZ concluída! ${res.result?.totalBaixadas || 0} nova(s) nota(s) baixada(s).`,
          "success"
        );
        // Carrega automaticamente os XMLs para a apuração
        await handleLoadMonthXmls();
      } else {
        onNotify(res?.error || "Erro ao consultar a SEFAZ.", "error");
      }
    } catch (err: any) {
      onNotify(`Falha na sincronização: ${err.message}`, "error");
    } finally {
      setSyncing(false);
      setSyncMessage("");
      loadCompanyState();
    }
  };

  // Abrir pasta no Explorer
  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await openCompanyFolder(activeEmpresa.cnpj, undefined, activeEmpresa.razaoSocial);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir a pasta de arquivos.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir pasta: ${err.message}`, "error");
    }
  };

  // Formatação de cooldown
  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[#f0f0f0] select-none text-[11px] text-[#000000] font-sans overflow-hidden">
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
        .erp-tab-btn {
          border-top: 1px solid #b0b0b0;
          border-left: 1px solid #b0b0b0;
          border-right: 1px solid #b0b0b0;
          border-bottom: 1px solid #b0b0b0;
          border-top-left-radius: 3px;
          border-top-right-radius: 3px;
          padding: 4px 14px;
          font-size: 11px;
          font-weight: 600;
          color: #444444;
          background: #e4e4e4;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .erp-tab-btn:hover {
          background: #ececec;
          color: #003366;
        }
        .erp-tab-btn.active {
          background: #f7f7f7;
          border-bottom: 1px solid #f7f7f7;
          color: #003366;
          font-weight: bold;
          margin-bottom: -1px;
          box-shadow: 0 -2px 0 #005a9e inset;
        }
        .status-bar-classic {
          background: #e0e0e0;
          border-top: 1px solid #b0b0b0;
          padding: 3px 8px;
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
          white-space: nowrap;
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
          background-color: #005a9e !important;
          color: #ffffff !important;
          border-bottom-color: #004d88;
        }
        .datagrid-table tr.selected td span,
        .datagrid-table tr.selected td strong,
        .datagrid-table tr.selected td div {
          color: #ffffff !important;
        }
        .datagrid-table tr:hover:not(.selected) td {
          background-color: #f0f6ff;
        }
      `}</style>

      {/* 1. BARRA DE FERRAMENTAS CLÁSSICA (TOOLBAR ERP - LINHA ÚNICA ORGANIZADA POR FUNÇÃO) */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-2xs">
        {/* Grupo Esquerdo: Captação, Carregamento e Regras de Cálculo */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleSyncSefazAndCalculate}
            disabled={syncing || !activeEmpresa}
            className="vb-btn vb-btn-primary"
            title="Sincronizar SEFAZ e calcular DIFAL automaticamente das notas interestaduais"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin text-[#003366]" : "text-[#003366]"} />
            <span>{syncing ? "Sincronizando SEFAZ..." : "⚡ Sincronizar e Calcular DIFAL"}</span>
          </button>

          <button
            type="button"
            onClick={handleLoadMonthXmls}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Carregar notas interestaduais da competência selecionada a partir dos arquivos já salvos em disco"
          >
            <FolderOpen size={13} className="text-[#005a9e]" />
            <span>Carregar XMLs Salvos</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              setNcmModalPrefill(null);
              setIsNcmModalOpen(true);
            }}
            className="vb-btn font-semibold text-[#003366]"
            title="Abrir painel de regras e exceções por NCM (Alíquotas Internas e FCP)"
          >
            <Layers size={13} className="text-[#005a9e]" />
            <span>Regras de NCM ({ncmRateRules.length})</span>
          </button>

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta de armazenamento local de XMLs no Windows Explorer"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta</span>
          </button>

          {cooldownRemaining > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-400 animate-pulse"
              title="Repouso preventivo SEFAZ ativo"
            >
              <Clock size={11} className="text-amber-700" />
              <span>Repouso SEFAZ: {formatCooldown(cooldownRemaining)}</span>
            </span>
          )}
        </div>

        {/* Grupo Direito: Relatório Executivo, Exportações CSV e Limpeza */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onOpenReport}
            disabled={notas.length === 0}
            className="vb-btn font-semibold text-[#003366]"
            title="Visualizar e Imprimir Relatório Executivo de DIFAL / Antecipação Tributária"
          >
            <Printer size={13} className="text-[#005a9e]" />
            <span>Relatório / Impressão</span>
          </button>

          <button
            type="button"
            onClick={onExportNotas}
            disabled={notas.length === 0}
            className="vb-btn"
            title="Exportar planilha consolidada de notas fiscais no formato CSV"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Notas CSV</span>
          </button>

          <button
            type="button"
            onClick={onExportItens}
            disabled={itens.length === 0}
            className="vb-btn"
            title="Exportar planilha analítica de itens de mercadorias no formato CSV"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Itens CSV</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Deseja realmente limpar as notas e itens carregados na tela de apuração?")) {
                onClear();
                setActiveTab("config");
              }
            }}
            disabled={notas.length === 0}
            className="vb-btn"
            title="Limpar memória e reiniciar a apuração"
          >
            <RotateCcw size={13} className="text-[#aa4400]" />
            <span>Limpar Dados</span>
          </button>
        </div>
      </div>

      {/* Notificação de Sincronização Ativa */}
      {syncing && (
        <div className="bg-[#eef5fc] border-b border-[#99bce8] px-3 py-1 flex items-center gap-2 text-[#003366] text-[11px] animate-pulse">
          <RefreshCw size={12} className="animate-spin text-[#003366]" />
          <span className="font-semibold">{syncMessage || "Consultando WebService SEFAZ e processando notas..."}</span>
        </div>
      )}

      {/* 2. ÁREA CENTRAL DE CONTEÚDO */}
      <div className="p-2 flex flex-col gap-2 flex-1 overflow-auto">
        {/* GROUPBOX 1: EMPRESA ATIVA, STATUS SEFAZ & PARÂMETROS FISCAIS */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Building2 size={13} />
            <span>Empresa sob Diagnóstico & Parâmetros Fiscais da Apuração</span>
          </legend>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2.5">
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

              <div className="flex items-center gap-1.5 text-[10px] text-[#555555]">
                <span>UF Dest.:</span>
                <strong className="text-[#003366] bg-white border border-[#c0c0c0] px-1.5 py-0.5 font-bold">
                  {activeEmpresa?.uf || "SP"}
                </strong>
                <span>| Regime:</span>
                <strong className="text-[#003366] bg-white border border-[#c0c0c0] px-1.5 py-0.5 font-bold">
                  {activeEmpresa?.regime === "simples" ? "Simples Nacional" : "Regime Normal"}
                </strong>
              </div>

              {nsuState && (
                <div
                  className="flex items-center gap-1 bg-[#ffffff] border border-[#c0c0c0] px-2 py-0.5 text-[10px] font-mono"
                  title={`Ponteiro NSU SEFAZ: ${nsuState.ultNSU} de ${nsuState.maxNSU || "0"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]" />
                  <span>
                    NSU: <strong>{Number(nsuState.ultNSU || 0)}</strong> / {Number(nsuState.maxNSU || 0)}
                  </span>
                </div>
              )}
            </div>

            {/* Seletor de Competência Salva */}
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-[#333333]">Competência:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="vb-input min-w-[135px] font-semibold"
              >
                <option value="all">Todas as Competências</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    Competência: {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Banner Compacto do Filtro Fiscal Interestadual */}
          <div className="mt-1.5 px-2.5 py-1 bg-[#eaf3ff] border border-[#b3d7ff] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-[#005a9e] shrink-0" />
              <span className="font-bold text-[#003366] uppercase text-[10px]">
                Filtro Interestadual Ativo:
              </span>
              <span className="text-[#002244] font-medium">
                Processando <strong>{notas.length}</strong> nota(s) interestadual(is) de fora do estado (<strong>{activeEmpresa?.uf || "SP"}</strong>).
                {internalIgnoredCount > 0 && (
                  <span className="text-[#555555] ml-1 font-normal">
                    ({internalIgnoredCount} interna(s) de {activeEmpresa?.uf || "SP"} ignorada(s)).
                  </span>
                )}
              </span>
            </div>

            <div className="text-[10px] font-semibold text-[#005a9e] bg-white border border-[#b3d7ff] px-2 py-0.5">
              Auditada: <strong>{notas.length > 0 ? detectedCompanyName : activeEmpresa?.razaoSocial || "—"}</strong>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 2: INDICADORES DO CÁLCULO & TOTAL A RECOLHER */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend flex items-center gap-1.5">
            <Calculator size={13} />
            <span>Indicadores do Cálculo Fiscal & Total a Recolher</span>
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {/* 1. XMLs Processados */}
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#003366] font-semibold text-[10px] uppercase">
                <span>XMLs Processados</span>
                <FileCheck size={13} className="text-[#005a9e]" />
              </div>
              <div className="mt-1">
                <span className="text-base font-bold text-[#003366] block">{notas.length}</span>
                <span className="text-[10px] text-[#777777] block">NF-e Interestaduais</span>
              </div>
            </div>

            {/* 2. Itens Conciliados */}
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#003366] font-semibold text-[10px] uppercase">
                <span>Itens Conciliados</span>
                <Layers size={13} className="text-[#005a9e]" />
              </div>
              <div className="mt-1">
                <span className="text-base font-bold text-[#003366] block">{itens.length}</span>
                <span className="text-[10px] text-[#777777] block">Linhas de Mercadorias</span>
              </div>
            </div>

            {/* 3. Dicionário CFOP */}
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#003366] font-semibold text-[10px] uppercase">
                <span>Dicionário CFOP</span>
                <HelpCircle size={13} className="text-[#664400]" />
              </div>
              <div className="mt-1">
                <span className="text-base font-bold text-[#664400] block">{cfopMap.size}</span>
                <span className="text-[10px] text-[#777777] block truncate" title={cfopFileName || "Regras de CFOP Ativas"}>
                  {cfopFileName || "Regras Ativas"}
                </span>
              </div>
            </div>

            {/* 4. Enquadramento Predominante */}
            <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#003366] font-semibold text-[10px] uppercase">
                <span>Enquadramento Predominante</span>
                <Settings size={13} className="text-[#005a9e]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-bold text-[#333333] block truncate" title={predominantMode}>
                  {predominantMode || "Não identificado"}
                </span>
                <span className="text-[10px] text-[#777777] block">Regra Prevalente Geral</span>
              </div>
            </div>

            {/* 5. Total a Recolher (DIFAL + FCP) */}
            <div className="bg-[#e6f2ff] border border-[#005a9e] p-2 flex flex-col justify-between shadow-2xs">
              <div className="flex items-center justify-between text-[#003366] font-black text-[10px] uppercase">
                <span>Total a Recolher</span>
                <Wallet size={14} className="text-[#003366]" />
              </div>
              <div className="mt-1">
                <span className="text-sm font-black text-[#003366] font-mono block">
                  {formatBRL(totalPayable)}
                </span>
                <span className="text-[10px] text-[#005a9e] font-semibold block">
                  DIFAL + FCP Calculados
                </span>
              </div>
            </div>
          </div>
        </fieldset>

        {/* 3. SELETOR DE ABAS NO PADRÃO WINDOWS ERP */}
        <div className="flex items-center gap-1 border-b border-[#b0b0b0] mt-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`erp-tab-btn ${activeTab === "config" ? "active" : ""}`}
          >
            <Settings size={13} className={activeTab === "config" ? "text-[#003366]" : "text-[#666666]"} />
            <span>Configurações e Parâmetros Fiscais</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("notas")}
            className={`erp-tab-btn ${activeTab === "notas" ? "active" : ""}`}
          >
            <FileText size={13} className={activeTab === "notas" ? "text-[#003366]" : "text-[#666666]"} />
            <span>Consolidado por Notas ({notas.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("itens")}
            className={`erp-tab-btn ${activeTab === "itens" ? "active" : ""}`}
          >
            <Layers size={13} className={activeTab === "itens" ? "text-[#003366]" : "text-[#666666]"} />
            <span>Auditoria Analítica de Itens ({itens.length})</span>
          </button>
        </div>

        {/* 4. CONTEÚDO DAS ABAS */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          {activeTab === "config" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              {/* Coluna Esquerda: Parâmetros Fiscais, Regimes e NCMs */}
              <div className="lg:col-span-8 flex flex-col gap-3">
                <ConfigSection
                  config={config}
                  onChange={onChangeConfig}
                  summaryText={auditStatusSummary}
                />

                <EmitterRegimesManager
                  emitentes={uniqueEmitters}
                  emitterRegimes={emitterRegimes}
                  onUpdateRegime={onUpdateEmitterRegime}
                  onApplyGlobalToUnconfigured={onApplyGlobalToUnconfiguredEmitters}
                  globalRegime={config.regimeRemet}
                  onNotify={onNotify}
                />

                <RecipientRegimesManager
                  destinatarios={uniqueRecipients}
                  recipientRegimes={recipientRegimes}
                  onUpdateRegime={onUpdateRecipientRegime}
                  onApplyGlobalToUnconfigured={onApplyGlobalToUnconfiguredRecipients}
                  globalRegime={config.regimeDest}
                />

                <fieldset className="vb-groupbox">
                  <legend className="vb-legend flex items-center gap-1.5">
                    <Layers size={13} />
                    <span>Exceções de Alíquotas por NCM e UF Destino</span>
                  </legend>
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ffffff] border border-[#c0c0c0] p-2">
                    <div>
                      <span className="font-semibold text-[#003366] block">
                        Regras Especiais de NCM ({ncmRateRules.length} regra(s) cadastrada(s))
                      </span>
                      <span className="text-[10px] text-[#666666]">
                        Alíquotas internas e FCP customizados sobrepõem as alíquotas gerais da empresa.
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setNcmModalPrefill(null);
                        setIsNcmModalOpen(true);
                      }}
                      className="vb-btn vb-btn-primary"
                      title="Abrir painel completo de regras de NCM"
                    >
                      <Layers size={12} />
                      <span>Gerenciar Regras de NCM</span>
                    </button>
                  </div>
                </fieldset>
              </div>

              {/* Coluna Direita: Upload Manual e Critérios Legais */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend">Upload Manual de Documentos Fiscais</legend>
                  <Dropzone
                    onXMLsLoaded={onXMLsLoaded}
                    onCFOPLoaded={onCFOPLoaded}
                    onClear={onClear}
                    hasFiles={notas.length > 0}
                    cfopCount={cfopMap.size}
                  />
                </fieldset>

                <fieldset className="vb-groupbox">
                  <legend className="vb-legend">Critérios de Incidência Legal</legend>
                  <div className="text-xs text-[#333333] leading-relaxed flex flex-col gap-2">
                    <p className="font-semibold text-[#003366]">
                      Regras tributárias aplicadas na apuração:
                    </p>
                    <ul className="list-disc pl-4 space-y-1 text-[#444444]">
                      <li>
                        <strong>Antecipação Tributária</strong>: Aplica-se quando o destinatário <strong>não</strong> é
                        consumidor final (destinado à revenda/industrialização). Base de cálculo corresponde ao valor
                        líquido da operação sem IPI.
                      </li>
                      <li>
                        <strong>DIFAL Consumidor Final</strong>: Aplica-se caso o destinatário <strong>seja</strong> consumidor
                        final. A base inclui tributos incidentes e pode aplicar cálculo por dentro e alíquota de FCP.
                      </li>
                    </ul>
                    <p className="text-[10px] text-[#666666] italic mt-1">
                      * Todos os cálculos são auditáveis linha a linha na aba de Auditoria de Itens.
                    </p>
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {activeTab === "notas" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {notas.length === 0 ? (
                <fieldset className="vb-groupbox flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <FileText size={36} className="text-[#999999] mb-2" />
                  <span className="font-bold text-sm text-[#333333]">
                    Nenhuma nota fiscal interestadual carregada para o cálculo.
                  </span>
                  <p className="text-xs text-[#666666] max-w-md mt-1">
                    Clique em <strong>"⚡ Sincronizar e Calcular DIFAL"</strong> na barra superior, selecione um mês de
                    competência salvo ou importe arquivos XMLs na aba de configurações.
                  </p>
                </fieldset>
              ) : (
                <NotasTable notas={notas} onExport={onExportNotas} />
              )}
            </div>
          )}

          {activeTab === "itens" && (
            <div className="flex-1 min-h-0 flex flex-col">
              {itens.length === 0 ? (
                <fieldset className="vb-groupbox flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Layers size={36} className="text-[#999999] mb-2" />
                  <span className="font-bold text-sm text-[#333333]">
                    Nenhum item de mercadoria disponível para auditoria.
                  </span>
                  <p className="text-xs text-[#666666] max-w-md mt-1">
                    Carregue notas fiscais para visualizar a memória analítica de cálculo de cada produto.
                  </p>
                </fieldset>
              ) : (
                <ItensTable
                  itens={itens}
                  itemConsumerOverrides={itemConsumerOverrides}
                  onUpdateItemOverride={onUpdateItemOverride}
                  onExport={onExportItens}
                  ncmRateRules={ncmRateRules}
                  onAddNcmRule={onAddNcmRule}
                  onOpenNcmModal={(prefill) => {
                    setNcmModalPrefill(prefill || null);
                    setIsNcmModalOpen(true);
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal Flutuante de Regras de NCM */}
      <NcmRatesModal
        isOpen={isNcmModalOpen}
        onClose={() => {
          setIsNcmModalOpen(false);
          setNcmModalPrefill(null);
        }}
        ncmRateRules={ncmRateRules}
        onAddRule={onAddNcmRule}
        onUpdateRule={onUpdateNcmRule}
        onRemoveRule={onRemoveNcmRule}
        onImportRules={onImportNcmRules}
        initialPrefill={ncmModalPrefill}
      />

      {/* 5. BARRA DE STATUS INFERIOR (PADRÃO ERP CLÁSSICO) */}
      <div className="status-bar-classic">
        <div className="status-panel">
          Empresa: <strong>{activeEmpresa?.razaoSocial || "Nenhuma Selecionada"}</strong>
        </div>
        <div className="status-panel">
          Notas Interestaduais: <strong>{notas.length}</strong>
        </div>
        <div className="status-panel">
          Itens Auditados: <strong>{itens.length}</strong>
        </div>
        <div className="status-panel">
          Total a Recolher: <strong>{formatBRL(totalPayable)}</strong>
        </div>
        <div className="status-panel font-mono text-[10px]">
          CAPS: <strong>{isCapsLockOn ? "LIGADO" : "DESLIGADO"}</strong>
        </div>
        <div className="status-panel font-mono text-[10px]">
          NUM: <strong>{isNumLockOn ? "LIGADO" : "DESLIGADO"}</strong>
        </div>
        <div className="ml-auto flex items-center gap-1 font-mono text-[10px] text-[#555555]">
          <Clock size={11} />
          <span>{clock}</span>
        </div>
      </div>
    </div>
  );
}
