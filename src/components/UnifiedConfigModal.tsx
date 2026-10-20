import React, { useState, useEffect } from "react";
import { EmpresaSefaz, RegimeDestinatario, ModelSchedulersMap } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import { formatDateBr } from "../utils/certUtils";
import {
  Building2,
  X,
  Plus,
  Trash2,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  FolderOpen,
  Search,
  UploadCloud,
  FileKey,
  Layers,
  ShoppingBag,
  Landmark,
  FileText,
  Clock,
  Folder,
  Settings,
  Play,
  RotateCw,
  Truck,
  Check,
  Save,
  HelpCircle,
  RotateCcw,
  RefreshCcw,
  Database,
  DownloadCloud
} from "lucide-react";
import {
  selectCertFile,
  testCert,
  listNetworkCerts,
  NetworkCertItem,
  getAppSettings,
  selectStorageFolder,
  openStorageFolder,
  saveModelSchedulersSettings,
  saveSchedulerSettings,
  saveNfseSchedulerSettings,
  syncAllCompanies,
  onSyncAllProgress,
  AppSettings,
  getAutoStart,
  setAutoStart,
  resetAllModelsNsu,
  exportDiagnostics
} from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";
import logoImg from "../../assets/logo.png";

interface UnifiedConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSefaz[];
  onSaveEmpresas: (empresas: EmpresaSefaz[]) => void;
  activeEmpresaId: string | null;
  onSelectEmpresa: (id: string) => void;
  initialTab?: "empresas" | "schedulers" | "storage";
  onRefreshXmls?: () => void;
}

export default function UnifiedConfigModal({
  isOpen,
  onClose,
  empresas,
  onSaveEmpresas,
  activeEmpresaId,
  onSelectEmpresa,
  initialTab = "empresas",
  onRefreshXmls,
}: UnifiedConfigModalProps) {
  const [activeTab, setActiveTab] = useState<"empresas" | "schedulers" | "storage">(initialTab);

  // Sincronizar activeTab se initialTab mudar ao abrir
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadSettingsData();
    }
  }, [isOpen, initialTab]);

  // -------------------------------------------------------------
  // ESTADOS DA ABA DE EMPRESAS
  // -------------------------------------------------------------
  const [editingCompany, setEditingCompany] = useState<Partial<EmpresaSefaz> | null>(null);
  const [companyListSearch, setCompanyListSearch] = useState("");
  const [testingStatus, setTestingStatus] = useState<{
    loading: boolean;
    success?: boolean;
    info?: any;
    error?: string;
  }>({ loading: false });

  const [isDragging, setIsDragging] = useState(false);
  const [networkCerts, setNetworkCerts] = useState<NetworkCertItem[]>([]);
  const [loadingNetworkCerts, setLoadingNetworkCerts] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [networkSearchTerm, setNetworkSearchTerm] = useState("");
  const [networkCertDir, setNetworkCertDir] = useState("");

  // -------------------------------------------------------------
  // ESTADOS DA ABA DE AGENDADORES & ARMAZENAMENTO
  // -------------------------------------------------------------
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  const [schedulers, setSchedulers] = useState<ModelSchedulersMap>({
    nfe: { enabled: false, time: "08:00" },
    nfce: { enabled: false, time: "18:30" },
    cte: { enabled: false, time: "08:30" },
    nfse: { enabled: false, time: "09:00" },
  });
  const [savingSchedulers, setSavingSchedulers] = useState(false);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  // Sincronização Geral
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncAllProgress, setSyncAllProgress] = useState<{
    currentIndex: number;
    total: number;
    currentCompany: string;
    stage?: number;
    stageName?: string;
    message: string;
    logs: Array<{ id: string; time: string; type: string; message: string }>;
    summary?: any;
  }>({
    currentIndex: 0,
    total: empresas.length,
    currentCompany: "",
    message: "",
    logs: [],
  });

  // Estados do Modal Mestre de Reinício de NSU (Todos os Modelos)
  const [isResetAllModalOpen, setIsResetAllModalOpen] = useState(false);
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [resetScope, setResetScope] = useState<"single" | "all">("single");
  const [resetSelectedCompanyId, setResetSelectedCompanyId] = useState<string>(activeEmpresaId || (empresas[0]?.id || ""));
  const [resetClearFiles, setResetClearFiles] = useState(false);
  const [resetClearManifestations, setResetClearManifestations] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Estado para exportação de diagnóstico de suporte
  const [exportingDiagnostics, setExportingDiagnostics] = useState(false);

  const handleExportDiagnostics = async () => {
    setExportingDiagnostics(true);
    try {
      const activeEmpresa = empresas.find((e) => e.id === activeEmpresaId) || null;
      const res = await exportDiagnostics(activeEmpresa);
      if (res.canceled) return;
      if (res.success) {
        setSavedSuccessMsg("Relatório de diagnóstico do sistema exportado com sucesso!");
        setTimeout(() => setSavedSuccessMsg(null), 5000);
      } else {
        alert(res.error || "Erro ao exportar diagnóstico.");
      }
    } catch (err: any) {
      alert(`Falha ao exportar diagnóstico: ${err.message}`);
    } finally {
      setExportingDiagnostics(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onSyncAllProgress((info: any) => {
      const now = new Date().toLocaleTimeString();
      setSyncAllProgress((prev) => {
        const newLogs = [
          ...prev.logs,
          {
            id: Math.random().toString(),
            time: now,
            type: info.type || "info",
            message: info.message || "",
          },
        ].slice(-40);

        let currentComp = prev.currentCompany;
        let cIdx = prev.currentIndex;
        if (info.companyName) currentComp = info.companyName;
        if (info.index) cIdx = info.index;

        return {
          ...prev,
          currentIndex: cIdx,
          total: info.total || prev.total,
          currentCompany: currentComp,
          stage: info.stage !== undefined ? info.stage : prev.stage,
          stageName: info.stageName || prev.stageName,
          message: info.message || prev.message,
          logs: newLogs,
          summary: info.type === "all_finished" && (info.summary || info.results) ? (info.summary || info.results) : prev.summary,
        };
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadSettingsData = async () => {
    setLoadingSettings(true);
    try {
      const data = await getAppSettings();
      if (data) {
        setSettings(data);
        if (data.modelSchedulers) {
          setSchedulers({
            nfe: data.modelSchedulers.nfe || { enabled: false, time: "08:00" },
            nfce: data.modelSchedulers.nfce || { enabled: false, time: "18:30" },
            cte: data.modelSchedulers.cte || { enabled: false, time: "08:30" },
            nfse: data.modelSchedulers.nfse || { enabled: false, time: "09:00" },
          });
        } else {
          // Herda legado se existir
          setSchedulers({
            nfe: data.scheduler ? { enabled: data.scheduler.enabled, time: data.scheduler.time } : { enabled: false, time: "08:00" },
            nfce: { enabled: false, time: "18:30" },
            cte: { enabled: false, time: "08:30" },
            nfse: data.nfseScheduler ? { enabled: data.nfseScheduler.enabled, time: data.nfseScheduler.time } : { enabled: false, time: "09:00" },
          });
        }
      }
      const isAuto = await getAutoStart();
      setAutoStartEnabled(isAuto);
    } catch (e) {
      console.error("Erro ao carregar configurações:", e);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleToggleAutoStart = async (checked: boolean) => {
    setAutoStartEnabled(checked);
    await setAutoStart(checked);
    setSavedSuccessMsg(checked ? "Inicialização com o Windows ativada!" : "Inicialização com o Windows desativada.");
    setTimeout(() => setSavedSuccessMsg(null), 3000);
  };

  const handleSelectFolder = async () => {
    try {
      const res = await selectStorageFolder();
      if (res.success && res.customStorageDir) {
        setSettings((prev) => (prev ? { ...prev, customStorageDir: res.customStorageDir! } : null));
        setSavedSuccessMsg("Pasta de armazenamento atualizada com sucesso!");
        setTimeout(() => setSavedSuccessMsg(null), 4000);
        if (onRefreshXmls) onRefreshXmls();
      }
    } catch (e: any) {
      alert("Erro ao alterar pasta: " + e.message);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openStorageFolder();
    } catch (e: any) {
      alert("Erro ao abrir pasta: " + e.message);
    }
  };

  const updateSchedulerField = (
    model: keyof ModelSchedulersMap,
    patch: Partial<{ enabled: boolean; time: string }>
  ) => {
    setSchedulers((prev) => {
      const next: ModelSchedulersMap = {
        ...prev,
        [model]: {
          ...prev[model],
          ...patch,
        },
      };
      saveModelSchedulersSettings(next)
        .then((res) => {
          if (res.success && onRefreshXmls) {
            onRefreshXmls();
          }
        })
        .catch(() => {});
      return next;
    });
  };

  const handleSaveModelSchedulers = async () => {
    setSavingSchedulers(true);
    try {
      const res = await saveModelSchedulersSettings(schedulers);
      if (res.success) {
        setSavedSuccessMsg("Horários e agendadores por modelo salvos com sucesso!");
        setTimeout(() => setSavedSuccessMsg(null), 4000);
        if (onRefreshXmls) onRefreshXmls();
      } else {
        alert("Erro ao salvar: " + (res.error || "Desconhecido"));
      }
    } catch (e: any) {
      alert("Erro ao salvar agendadores: " + e.message);
    } finally {
      setSavingSchedulers(false);
    }
  };

  const handleStartSyncAll = async () => {
    if (empresas.length === 0) {
      alert("Cadastre pelo menos uma empresa antes de executar a sincronização.");
      return;
    }

    setIsSyncingAll(true);
    setSyncAllProgress({
      currentIndex: 0,
      total: empresas.length,
      currentCompany: "Iniciando varredura geral...",
      message: "Conectando aos WebServices...",
      logs: [{
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        type: "info",
        message: `Iniciando varredura sincronizada para ${empresas.length} empresa(s)...`
      }],
      summary: undefined
    });

    try {
      const res = await syncAllCompanies(empresas);
      if (!res.success) {
        alert("Erro na sincronização em lote: " + (res.error || "Falha"));
      } else {
        if (onRefreshXmls) onRefreshXmls();
      }
    } catch (e: any) {
      alert("Erro ao disparar sincronização geral: " + e.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleConfirmResetAllModels = async () => {
    setIsResettingAll(true);
    setResetSuccessMessage(null);
    try {
      if (resetScope === "single") {
        const targetComp = empresas.find((e) => e.id === resetSelectedCompanyId);
        if (!targetComp) throw new Error("Selecione uma empresa válida.");
        const res = await resetAllModelsNsu({
          scope: "single",
          cnpj: targetComp.cnpj,
          razaoSocial: targetComp.razaoSocial,
          clearFiles: resetClearFiles,
          clearManifestations: resetClearManifestations,
        });
        if (res.success) {
          setResetSuccessMessage(`NSUs de todos os modelos reiniciados com sucesso para ${targetComp.razaoSocial}!`);
        } else {
          throw new Error(res.error || "Erro ao reiniciar NSUs.");
        }
      } else {
        const res = await resetAllModelsNsu({
          scope: "all",
          companies: empresas,
          clearFiles: resetClearFiles,
          clearManifestations: resetClearManifestations,
        });
        if (res.success) {
          setResetSuccessMessage(`NSUs reiniciados com sucesso para TODAS as ${empresas.length} empresas cadastradas!`);
        } else {
          throw new Error(res.error || "Erro ao reiniciar NSUs.");
        }
      }
      if (onRefreshXmls) onRefreshXmls();
      setTimeout(() => {
        setIsResettingAll(false);
        setIsResetAllModalOpen(false);
        setResetSuccessMessage(null);
      }, 2000);
    } catch (err: any) {
      alert(`Erro ao reiniciar NSUs: ${err.message}`);
      setIsResettingAll(false);
    }
  };

  // -------------------------------------------------------------
  // MÉTODOS DE CADASTRO/EDIÇÃO DE EMPRESAS
  // -------------------------------------------------------------
  const handleStartNew = () => {
    setEditingCompany({
      id: "emp_" + Date.now(),
      razaoSocial: "",
      cnpj: "",
      uf: "SP",
      regime: "simples",
      certPath: "",
      password: "",
      ambiente: 1,
      modelosHabilitados: {
        nfe: true,
        nfce: false,
        cte: true,
        nfse: true,
      },
    });
    setTestingStatus({ loading: false });
  };

  const handleToggleModel = (empId: string, model: 'nfe' | 'nfce' | 'cte' | 'nfse') => {
    const updated = empresas.map((e) => {
      if (e.id !== empId) return e;
      const current = e.modelosHabilitados || { nfe: true, nfce: false, cte: true, nfse: true };
      const currentVal = current[model] !== false;
      return {
        ...e,
        modelosHabilitados: {
          ...current,
          [model]: !currentVal,
        },
      };
    });
    onSaveEmpresas(updated);
  };

  const autoDetectAndTestCert = async (certPath: string, password: string) => {
    if (!certPath) return;
    setTestingStatus({ loading: true });
    try {
      const res = await testCert(certPath, password);
      if (res.success && res.info) {
        setTestingStatus({ loading: false, success: true, info: res.info });
        const cleanSubject = res.info.subject ? res.info.subject.split(":")[0].trim() : "";
        const cleanCnpj = res.info.extractedCnpj || "";
        setEditingCompany((prev) => {
          if (!prev) return null;
          const currentName = prev.razaoSocial || "";
          const isNumericOrCnpj = !currentName || currentName.replace(/\D/g, "") === (prev.cnpj || "").replace(/\D/g, "");
          return {
            ...prev,
            certPath,
            password,
            razaoSocial: isNumericOrCnpj && cleanSubject ? cleanSubject : currentName,
            cnpj: cleanCnpj || prev.cnpj,
            certInfo: {
              subject: res.info.subject,
              issuer: res.info.issuer,
              validTo: res.info.validTo ? new Date(res.info.validTo).toISOString() : "",
              daysRemaining: res.info.daysRemaining,
              isExpired: res.info.isExpired,
            },
          };
        });
      } else {
        setTestingStatus({ loading: false, success: false, error: res.error || "Certificado inválido ou senha incorreta." });
      }
    } catch (e: any) {
      setTestingStatus({ loading: false, success: false, error: e.message });
    }
  };

  const handleSelectCert = async () => {
    const filePath = await selectCertFile(editingCompany?.certPath);
    if (filePath) {
      setEditingCompany((prev) => (prev ? { ...prev, certPath: filePath } : null));
      if (editingCompany?.password) {
        autoDetectAndTestCert(filePath, editingCompany.password);
      }
    }
  };

  const handleOpenNetworkModal = async () => {
    setIsNetworkModalOpen(true);
    setLoadingNetworkCerts(true);
    try {
      const res = await listNetworkCerts();
      if (res.success && res.certs) {
        setNetworkCerts(res.certs);
        setNetworkCertDir(res.dir || "");
      } else {
        alert("Erro ao buscar certificados na rede: " + (res.error || "Nenhum diretório encontrado"));
      }
    } catch (e: any) {
      alert("Erro ao conectar no servidor de rede: " + e.message);
    } finally {
      setLoadingNetworkCerts(false);
    }
  };

  const handleSelectNetworkCert = (cert: NetworkCertItem) => {
    setEditingCompany((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        certPath: cert.fullPath,
        password: cert.extractedPassword || prev.password || "",
      };
    });
    setIsNetworkModalOpen(false);
    if (cert.extractedPassword || editingCompany?.password) {
      autoDetectAndTestCert(cert.fullPath, cert.extractedPassword || editingCompany?.password || "");
    }
  };

  const handleTestCert = async () => {
    if (!editingCompany?.certPath) {
      alert("Selecione um arquivo de certificado (.pfx ou .p12)");
      return;
    }
    setTestingStatus({ loading: true });
    try {
      const res = await testCert(editingCompany.certPath, editingCompany.password || "");
      if (res.success) {
        setTestingStatus({ loading: false, success: true, info: res.info });
      } else {
        setTestingStatus({ loading: false, success: false, error: res.error });
      }
    } catch (e: any) {
      setTestingStatus({ loading: false, success: false, error: e.message });
    }
  };

  const handleSaveCompany = () => {
    if (!editingCompany?.razaoSocial || !editingCompany?.cnpj || !editingCompany?.certPath) {
      alert("Por favor, preencha a Razão Social, CNPJ e selecione o Certificado Digital A1.");
      return;
    }

    const cleanCnpj = editingCompany.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      alert("O CNPJ deve conter exatamente 14 dígitos.");
      return;
    }

    const companyToSave: EmpresaSefaz = {
      id: editingCompany.id || "emp_" + Date.now(),
      razaoSocial: editingCompany.razaoSocial.trim(),
      cnpj: cleanCnpj,
      uf: (editingCompany.uf || "SP").toUpperCase(),
      regime: (editingCompany.regime as RegimeDestinatario) || "simples",
      certPath: editingCompany.certPath,
      password: editingCompany.password || "",
      ambiente: Number(editingCompany.ambiente) || 1,
      modelosHabilitados: {
        nfe: editingCompany.modelosHabilitados?.nfe !== false,
        nfce: editingCompany.modelosHabilitados?.nfce === true,
        cte: editingCompany.modelosHabilitados?.cte !== false,
        nfse: editingCompany.modelosHabilitados?.nfse !== false,
      },
      certInfo: testingStatus.info
        ? {
            subject: testingStatus.info.subject,
            issuer: testingStatus.info.issuer,
            validTo: testingStatus.info.validTo ? new Date(testingStatus.info.validTo).toISOString() : "",
            daysRemaining: testingStatus.info.daysRemaining,
            isExpired: testingStatus.info.isExpired,
          }
        : editingCompany.certInfo,
    };

    const exists = empresas.some((e) => e.id === companyToSave.id);
    let updated: EmpresaSefaz[];
    if (exists) {
      updated = empresas.map((e) => (e.id === companyToSave.id ? companyToSave : e));
    } else {
      updated = [...empresas, companyToSave];
    }

    onSaveEmpresas(updated);
    if (!activeEmpresaId || activeEmpresaId === companyToSave.id) {
      onSelectEmpresa(companyToSave.id);
    }
    setEditingCompany(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Deseja realmente remover a empresa "${name}" do sistema?`)) {
      const updated = empresas.filter((e) => e.id !== id);
      onSaveEmpresas(updated);
      if (activeEmpresaId === id) {
        onSelectEmpresa(updated.length > 0 ? updated[0].id : "");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 select-none">
      <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-[96vw] max-w-5xl flex flex-col max-h-[92vh] text-[11px] text-[#000000] font-sans overflow-hidden">
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
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
          }
          legend.vb-legend {
            font-weight: 600;
            font-size: 11px;
            color: #003366;
            padding: 0 4px;
          }
          .datagrid-table {
            border-collapse: separate;
            border-spacing: 0;
            width: 100%;
            font-size: 11px;
          }
          .datagrid-table th {
            background: linear-gradient(180deg, #f8f8f8 0%, #e6e6e6 100%);
            border-right: 1px solid #b0b0b0;
            border-bottom: 1px solid #888888;
            padding: 3px 6px;
            text-align: left;
            font-weight: 600;
            color: #222222;
            white-space: nowrap;
          }
          .datagrid-table td {
            border-right: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
            padding: 3px 6px;
            white-space: nowrap;
          }
          .datagrid-table tr:hover td {
            background-color: #f0f7ff;
          }
        `}</style>

        {/* 1. TITLEBAR CLÁSSICA CONT-AI (WINFORMS BLUE GRADIENT) */}
        <div className="bg-gradient-to-r from-[#003366] via-[#004b87] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244] shadow-xs select-none">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="CONT-AI Logo" className="h-4 w-auto object-contain brightness-110 drop-shadow-xs" />
            <span className="font-bold tracking-wide text-[11px] drop-shadow-xs">
              CONT-AI - Gestor de Movimento fiscal v2.0 - [ Central de Configurações, Empresas e Agendadores ]
            </span>
          </div>
          <button
            onClick={onClose}
            title="Fechar Janela de Configurações"
            className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 2. BARRA DE ABAS CLÁSSICA (TAB CONTROL WINFORMS) */}
        <div className="bg-[#e4e4e4] border-b border-[#b0b0b0] px-2 pt-1 flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab("empresas")}
            className={`px-3 py-1.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "empresas"
                ? "bg-[#f0f0f0] text-[#003366] border-t-2 border-t-[#005a9e] border-x border-[#b0b0b0] -mb-px z-10"
                : "text-[#444444] hover:bg-[#d8d8d8] border border-transparent"
            }`}
          >
            <Building2 size={13} />
            <span>Empresas & Certificados A1</span>
            <span className="px-1 py-0.1 bg-[#d0d0d0] text-[#222222] rounded text-[9px] font-mono">
              {empresas.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("schedulers")}
            className={`px-3 py-1.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "schedulers"
                ? "bg-[#f0f0f0] text-[#003366] border-t-2 border-t-[#005a9e] border-x border-[#b0b0b0] -mb-px z-10"
                : "text-[#444444] hover:bg-[#d8d8d8] border border-transparent"
            }`}
          >
            <Clock size={13} />
            <span>Agendadores por Modelo</span>
            {(schedulers.nfe.enabled || schedulers.nfce.enabled || schedulers.cte.enabled || schedulers.nfse.enabled) && (
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("storage")}
            className={`px-3 py-1.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "storage"
                ? "bg-[#f0f0f0] text-[#003366] border-t-2 border-t-[#005a9e] border-x border-[#b0b0b0] -mb-px z-10"
                : "text-[#444444] hover:bg-[#d8d8d8] border border-transparent"
            }`}
          >
            <Folder size={13} />
            <span>Armazenamento & Diretórios</span>
          </button>
        </div>

        {/* Mensagem de Feedback de Sucesso */}
        {savedSuccessMsg && (
          <div className="mx-3 mt-2 p-1.5 bg-[#eaf7ea] border border-[#7bc97b] text-emerald-900 text-[11px] font-bold flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Conteúdo Principal do Modal */}
        <div className="p-3 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 flex flex-col gap-3 min-w-0 w-full">
          {/* ========================================================================= */}
          {/* ABA 1: EMPRESAS & CERTIFICADOS                                            */}
          {/* ========================================================================= */}
          {activeTab === "empresas" && (
            <div className="flex flex-col gap-2">
              {editingCompany ? (
                /* Formulário de Cadastro/Edição de Empresa Clássico ERP */
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend flex items-center gap-1.5">
                    <KeyRound size={12} className="text-[#003366]" />
                    <span>{empresas.some((e) => e.id === editingCompany.id) ? "Editar Empresa Cadastrada" : "Nova Empresa Cadastrada"}</span>
                  </legend>

                  <div className="flex flex-col gap-3">
                    {/* Grupo 1: Dados Cadastrais */}
                    <fieldset className="vb-groupbox bg-white">
                      <legend className="vb-legend">Dados Cadastrais da Empresa</legend>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                            Razão Social / Nome da Empresa *
                          </label>
                          <input
                            type="text"
                            value={editingCompany.razaoSocial || ""}
                            onChange={(e) => setEditingCompany({ ...editingCompany, razaoSocial: e.target.value })}
                            placeholder="Ex: EMPRESA EXEMPLO COMERCIO LTDA"
                            className="vb-input w-full uppercase"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                            CNPJ (14 dígitos) *
                          </label>
                          <input
                            type="text"
                            value={editingCompany.cnpj || ""}
                            onChange={(e) => setEditingCompany({ ...editingCompany, cnpj: e.target.value.replace(/\D/g, "") })}
                            placeholder="Ex: 00000000000191"
                            maxLength={14}
                            className="vb-input w-full font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                            UF (Estado) *
                          </label>
                          <input
                            type="text"
                            value={editingCompany.uf || "SP"}
                            onChange={(e) => setEditingCompany({ ...editingCompany, uf: e.target.value.toUpperCase() })}
                            placeholder="SP"
                            maxLength={2}
                            className="vb-input w-full uppercase text-center"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                            Regime Tributário *
                          </label>
                          <select
                            value={editingCompany.regime || "simples"}
                            onChange={(e) => setEditingCompany({ ...editingCompany, regime: e.target.value as any })}
                            className="vb-input w-full"
                          >
                            <option value="simples">Simples Nacional (ME / EPP)</option>
                            <option value="normal">Regime Normal (Lucro Presumido / Lucro Real)</option>
                            <option value="outro">Outros Regimes</option>
                          </select>
                        </div>
                      </div>
                    </fieldset>

                    {/* Grupo 2: Certificado Digital A1 */}
                    <fieldset className="vb-groupbox bg-white">
                      <legend className="vb-legend">Certificado Digital A1 (.pfx ou .p12)</legend>
                      <div className="flex flex-col gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-0.5">
                            <label className="block text-[10px] font-bold text-[#333333]">
                              Arquivo do Certificado Digital A1 *
                            </label>
                            <button
                              type="button"
                              onClick={handleOpenNetworkModal}
                              className="text-[10px] text-[#003366] hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Search size={11} />
                              <span>Localizar na Rede (Servidor)</span>
                            </button>
                          </div>

                          <div
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragging(false);
                              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                const file = e.dataTransfer.files[0];
                                const ext = file.name.split(".").pop()?.toLowerCase();
                                if (ext === "pfx" || ext === "p12") {
                                  const filePath = (file as any).path || file.name;
                                  setEditingCompany((prev) => (prev ? { ...prev, certPath: filePath } : null));
                                  if (editingCompany?.password) {
                                    autoDetectAndTestCert(filePath, editingCompany.password);
                                  }
                                } else {
                                  alert("Selecione um arquivo de certificado válido (.pfx ou .p12)");
                                }
                              }
                            }}
                            className={`flex items-center gap-1.5 p-1 border ${
                              isDragging ? "border-[#005a9e] bg-[#e6f2ff]" : "border-[#7a7a7a] bg-white"
                            }`}
                          >
                            <input
                              type="text"
                              value={editingCompany.certPath || ""}
                              readOnly
                              placeholder="Clique em 'Selecionar Arquivo' ou arraste o certificado A1 aqui..."
                              className="flex-1 bg-transparent text-[11px] font-mono text-[#000000] outline-none px-1"
                            />
                            <button
                              type="button"
                              onClick={handleSelectCert}
                              className="vb-btn"
                            >
                              <FolderOpen size={12} />
                              <span>Selecionar Arquivo</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
                          <div>
                            <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                              Senha do Certificado Digital A1
                            </label>
                            <input
                              type="password"
                              value={editingCompany.password || ""}
                              onChange={(e) => {
                                const pwd = e.target.value;
                                setEditingCompany({ ...editingCompany, password: pwd });
                                if (editingCompany?.certPath && pwd.length >= 2) {
                                  autoDetectAndTestCert(editingCompany.certPath, pwd);
                                }
                              }}
                              placeholder="Digite a senha do certificado..."
                              className="vb-input w-full font-mono"
                            />
                          </div>

                          <div>
                            <button
                              type="button"
                              onClick={handleTestCert}
                              disabled={testingStatus.loading || !editingCompany.certPath}
                              className="vb-btn vb-btn-primary w-full justify-center"
                            >
                              {testingStatus.loading ? (
                                <>
                                  <RotateCw size={12} className="animate-spin" />
                                  <span>Testando Certificado...</span>
                                </>
                              ) : (
                                <>
                                  <ShieldCheck size={12} />
                                  <span>Testar e Validar Certificado A1</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Status de Teste do Certificado */}
                        {testingStatus.success && testingStatus.info && (
                          <div className="p-2 bg-[#eaf7ea] border border-[#7bc97b] text-emerald-900 text-[11px] flex items-center gap-2">
                            <CheckCircle2 size={15} className="text-emerald-700 shrink-0" />
                            <div>
                              <strong>Certificado A1 Válido e Operacional!</strong> Titular: <strong>{testingStatus.info.subject}</strong> | Validade:{" "}
                              <strong>{formatDateBr(testingStatus.info.validTo)}</strong> ({testingStatus.info.daysRemaining} dias restantes)
                            </div>
                          </div>
                        )}

                        {testingStatus.error && (
                          <div className="p-2 bg-[#fdeaea] border border-[#e57373] text-rose-900 text-[11px] flex items-center gap-2">
                            <AlertTriangle size={15} className="text-rose-700 shrink-0" />
                            <div>
                              <strong>Falha na validação do certificado:</strong> {testingStatus.error}
                            </div>
                          </div>
                        )}
                      </div>
                    </fieldset>

                    {/* Grupo 3: Modelos Habilitados */}
                    <fieldset className="vb-groupbox bg-white">
                      <legend className="vb-legend">Modelos Fiscais Habilitados para Consulta Automática</legend>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <label className="flex items-center gap-2 p-1.5 border border-[#cccccc] hover:bg-[#f0f0f0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCompany.modelosHabilitados?.nfe !== false}
                            onChange={(e) =>
                              setEditingCompany({
                                ...editingCompany,
                                modelosHabilitados: {
                                  ...editingCompany.modelosHabilitados,
                                  nfe: e.target.checked,
                                },
                              })
                            }
                            className="accent-[#003366]"
                          />
                          <div>
                            <div className="font-bold text-[11px] flex items-center gap-1">
                              <FileText size={12} className="text-emerald-700" />
                              <span>NF-e (Mod. 55)</span>
                            </div>
                            <div className="text-[10px] text-[#666666]">Entradas Fornecedores</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 p-1.5 border border-[#cccccc] hover:bg-[#f0f0f0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCompany.modelosHabilitados?.nfce === true}
                            onChange={(e) =>
                              setEditingCompany({
                                ...editingCompany,
                                modelosHabilitados: {
                                  ...editingCompany.modelosHabilitados,
                                  nfce: e.target.checked,
                                },
                              })
                            }
                            className="accent-[#003366]"
                          />
                          <div>
                            <div className="font-bold text-[11px] flex items-center gap-1">
                              <ShoppingBag size={12} className="text-blue-700" />
                              <span>NFC-e (Mod. 65)</span>
                            </div>
                            <div className="text-[10px] text-[#666666]">Saídas Consumidor</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 p-1.5 border border-[#cccccc] hover:bg-[#f0f0f0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCompany.modelosHabilitados?.cte !== false}
                            onChange={(e) =>
                              setEditingCompany({
                                ...editingCompany,
                                modelosHabilitados: {
                                  ...editingCompany.modelosHabilitados,
                                  cte: e.target.checked,
                                },
                              })
                            }
                            className="accent-[#003366]"
                          />
                          <div>
                            <div className="font-bold text-[11px] flex items-center gap-1">
                              <Truck size={12} className="text-amber-700" />
                              <span>CT-e (Mod. 57)</span>
                            </div>
                            <div className="text-[10px] text-[#666666]">Conhecimentos Frete</div>
                          </div>
                        </label>

                        <label className="flex items-center gap-2 p-1.5 border border-[#cccccc] hover:bg-[#f0f0f0] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingCompany.modelosHabilitados?.nfse !== false}
                            onChange={(e) =>
                              setEditingCompany({
                                ...editingCompany,
                                modelosHabilitados: {
                                  ...editingCompany.modelosHabilitados,
                                  nfse: e.target.checked,
                                },
                              })
                            }
                            className="accent-[#003366]"
                          />
                          <div>
                            <div className="font-bold text-[11px] flex items-center gap-1">
                              <Landmark size={12} className="text-indigo-700" />
                              <span>NFS-e (Serviços)</span>
                            </div>
                            <div className="text-[10px] text-[#666666]">Nacional & São Paulo</div>
                          </div>
                        </label>
                      </div>
                    </fieldset>

                    {/* Botões do Formulário */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#d0d0d0]">
                      <button
                        type="button"
                        onClick={() => setEditingCompany(null)}
                        className="vb-btn"
                      >
                        Voltar à Lista
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveCompany}
                        className="vb-btn vb-btn-primary"
                      >
                        <Save size={12} />
                        <span>Gravar Empresa</span>
                      </button>
                    </div>
                  </div>
                </fieldset>
              ) : (
                /* Lista de Empresas Cadastradas (Datagrid Clássico ERP) */
                <fieldset className="vb-groupbox min-w-0 w-full">
                  <legend className="vb-legend">Cadastro de Empresas e Contribuintes</legend>
                  
                  {/* Barra de Ações Superior - Padrão ERP Clássico */}
                  <div className="bg-[#e4e4e4] border border-[#b8b8b8] px-2.5 py-1.5 mb-2 flex items-center justify-between gap-2 shadow-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleStartNew}
                        className="vb-btn vb-btn-primary font-bold shadow-xs flex items-center gap-1.5"
                      >
                        <Plus size={13} className="text-[#003366]" />
                        <span>Cadastrar Nova Empresa</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleStartSyncAll}
                        disabled={isSyncingAll}
                        className="vb-btn flex items-center gap-1.5"
                        title="Executar sincronização para todas as empresas"
                      >
                        <RotateCw size={12} className={isSyncingAll ? "animate-spin text-[#003366]" : "text-[#003366]"} />
                        <span>Sincronizar Todas</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center">
                        <Search size={12} className="absolute left-2 text-[#666666] pointer-events-none" />
                        <input
                          type="text"
                          value={companyListSearch}
                          onChange={(e) => setCompanyListSearch(e.target.value)}
                          placeholder="Pesquisar empresa ou CNPJ..."
                          className="vb-input !pl-6 w-56 text-[11px]"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#444444]">
                        <Building2 size={13} className="text-[#003366]" />
                        <span>
                          Total: <strong className="text-[#003366] font-bold">{empresas.length}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {empresas.length === 0 ? (
                    <div className="p-8 border border-dashed border-[#b0b0b0] bg-white text-center flex flex-col items-center gap-2">
                      <Building2 size={28} className="text-[#888888]" />
                      <div className="font-bold text-[12px] text-[#333333]">Nenhuma empresa cadastrada no sistema</div>
                      <p className="text-[11px] text-[#666666] max-w-md">
                        Cadastre a primeira empresa e vincule o Certificado Digital A1 para consultar automaticamente NF-e, NFC-e, CT-e e NFS-e.
                      </p>
                      <button type="button" onClick={handleStartNew} className="vb-btn vb-btn-primary mt-1">
                        <Plus size={12} />
                        <span>Cadastrar Empresa Agora</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-[#999999] bg-white overflow-x-auto max-h-[380px] overflow-y-auto w-full min-w-0 custom-scrollbar">
                      <table className="datagrid-table w-full">
                        <thead>
                          <tr>
                            <th className="w-14 text-center">Ativa</th>
                            <th className="min-w-[180px]">Razão Social (A-Z)</th>
                            <th className="w-28">CNPJ</th>
                            <th className="w-10 text-center">UF</th>
                            <th className="w-24">Regime</th>
                            <th className="w-52">Certificado A1 / Validade</th>
                            <th className="w-40 text-center">Modelos Habilitados</th>
                            <th className="w-24 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...empresas]
                            .sort((a, b) =>
                              (a.razaoSocial || "").localeCompare(b.razaoSocial || "", "pt-BR", {
                                sensitivity: "base",
                                numeric: true,
                              })
                            )
                            .filter((emp) => {
                              const q = companyListSearch.trim().toLowerCase();
                              if (!q) return true;
                              const qDigits = q.replace(/\D/g, "");
                              const razao = (emp.razaoSocial || "").toLowerCase();
                              const cnpj = (emp.cnpj || "").toLowerCase();
                              return (
                                razao.includes(q) ||
                                cnpj.includes(q) ||
                                (qDigits.length > 0 && cnpj.replace(/\D/g, "").includes(qDigits))
                              );
                            })
                            .map((emp) => {
                            const isActive = emp.id === activeEmpresaId;
                            return (
                              <tr key={emp.id} className={isActive ? "bg-[#eaf3ff]" : ""}>
                                <td className="text-center font-bold">
                                  {isActive ? (
                                    <span className="px-1.5 py-0.2 bg-[#003366] text-white text-[9px] rounded-xs font-mono">
                                      ATIVA
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => onSelectEmpresa(emp.id)}
                                      className="text-[10px] text-blue-700 hover:underline cursor-pointer font-bold"
                                    >
                                      Ativar
                                    </button>
                                  )}
                                </td>
                                <td className="font-bold text-[#003366] max-w-[200px] truncate" title={emp.razaoSocial}>{emp.razaoSocial}</td>
                                <td className="font-mono">{emp.cnpj}</td>
                                <td className="text-center font-bold">{emp.uf}</td>
                                <td>{emp.regime === "simples" ? "Simples Nac." : emp.regime === "normal" ? "Regime Normal" : "Outros"}</td>
                                <td>
                                  {emp.certInfo ? (
                                    <span className="flex items-center gap-1.5">
                                      <CertificateBadge certInfo={emp.certInfo} compact />
                                      <span className="text-[10px] text-[#666666]">Até {formatDateBr(emp.certInfo.validTo)}</span>
                                    </span>
                                  ) : (
                                    <span className="text-[#888888] italic">Não testado</span>
                                  )}
                                </td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModel(emp.id, "nfe")}
                                      title="Alternar NF-e (55)"
                                      className={`px-1 py-0.2 text-[9px] font-bold border cursor-pointer ${
                                        emp.modelosHabilitados?.nfe !== false
                                          ? "bg-emerald-100 text-emerald-800 border-emerald-400"
                                          : "bg-slate-100 text-slate-400 border-slate-300 line-through opacity-60"
                                      }`}
                                    >
                                      NFE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModel(emp.id, "nfce")}
                                      title="Alternar NFC-e (65)"
                                      className={`px-1 py-0.2 text-[9px] font-bold border cursor-pointer ${
                                        emp.modelosHabilitados?.nfce === true
                                          ? "bg-blue-100 text-blue-800 border-blue-400"
                                          : "bg-slate-100 text-slate-400 border-slate-300 line-through opacity-60"
                                      }`}
                                    >
                                      NFCE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModel(emp.id, "cte")}
                                      title="Alternar CT-e (57)"
                                      className={`px-1 py-0.2 text-[9px] font-bold border cursor-pointer ${
                                        emp.modelosHabilitados?.cte !== false
                                          ? "bg-amber-100 text-amber-800 border-amber-400"
                                          : "bg-slate-100 text-slate-400 border-slate-300 line-through opacity-60"
                                      }`}
                                    >
                                      CTE
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleModel(emp.id, "nfse")}
                                      title="Alternar NFS-e (Serviços)"
                                      className={`px-1 py-0.2 text-[9px] font-bold border cursor-pointer ${
                                        emp.modelosHabilitados?.nfse !== false
                                          ? "bg-indigo-100 text-indigo-800 border-indigo-400"
                                          : "bg-slate-100 text-slate-400 border-slate-300 line-through opacity-60"
                                      }`}
                                    >
                                      NFSE
                                    </button>
                                  </div>
                                </td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCompany(emp);
                                        setTestingStatus({ loading: false });
                                      }}
                                      className="vb-btn"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(emp.id, emp.razaoSocial)}
                                      className="vb-btn vb-btn-danger"
                                      title="Remover Empresa"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </fieldset>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: AGENDADORES POR MODELO                                             */}
          {/* ========================================================================= */}
          {activeTab === "schedulers" && (
            <div className="flex flex-col gap-2">
              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Configurações de Varredura Automática Diária</legend>
                <p className="text-[11px] text-[#444444] mb-2.5">
                  Defina o horário diário de consulta para cada modelo fiscal habilitado. O sistema executará as buscas silenciosamente em segundo plano.
                </p>

                {/* Grid dos 4 Agendadores de Modelo em Caixas Clássicas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-2.5">
                  {/* NF-e 55 */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={schedulers.nfe.enabled}
                        onChange={(e) => updateSchedulerField("nfe", { enabled: e.target.checked })}
                        className="accent-[#003366]"
                      />
                      <span className="font-bold">NF-e (Modelo 55) - Entradas & Fornecedores</span>
                    </legend>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[#555555]">Horário de Execução Diária:</span>
                      <input
                        type="time"
                        value={schedulers.nfe.time}
                        onChange={(e) => updateSchedulerField("nfe", { time: e.target.value })}
                        className="vb-input font-bold"
                      />
                    </div>
                  </fieldset>

                  {/* NFC-e 65 */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={schedulers.nfce.enabled}
                        onChange={(e) => updateSchedulerField("nfce", { enabled: e.target.checked })}
                        className="accent-[#003366]"
                      />
                      <span className="font-bold">NFC-e (Modelo 65) - Vendas ao Consumidor Final</span>
                    </legend>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[#555555]">Horário de Execução Diária:</span>
                      <input
                        type="time"
                        value={schedulers.nfce.time}
                        onChange={(e) => updateSchedulerField("nfce", { time: e.target.value })}
                        className="vb-input font-bold"
                      />
                    </div>
                  </fieldset>

                  {/* CT-e 57 */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={schedulers.cte.enabled}
                        onChange={(e) => updateSchedulerField("cte", { enabled: e.target.checked })}
                        className="accent-[#003366]"
                      />
                      <span className="font-bold">CT-e (Modelo 57) - Fretes & Transportes</span>
                    </legend>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[#555555]">Horário de Execução Diária:</span>
                      <input
                        type="time"
                        value={schedulers.cte.time}
                        onChange={(e) => updateSchedulerField("cte", { time: e.target.value })}
                        className="vb-input font-bold"
                      />
                    </div>
                  </fieldset>

                  {/* NFS-e */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={schedulers.nfse.enabled}
                        onChange={(e) => updateSchedulerField("nfse", { enabled: e.target.checked })}
                        className="accent-[#003366]"
                      />
                      <span className="font-bold">NFS-e (Notas de Serviços) - Nacional & SP</span>
                    </legend>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-[#555555]">Horário de Execução Diária:</span>
                      <input
                        type="time"
                        value={schedulers.nfse.time}
                        onChange={(e) => updateSchedulerField("nfse", { time: e.target.value })}
                        className="vb-input font-bold"
                      />
                    </div>
                  </fieldset>
                </div>

                {/* Inicialização com Windows e Botão de Salvar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-2 bg-[#eaeaea] border border-[#c0c0c0]">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-[11px]">
                    <input
                      type="checkbox"
                      checked={autoStartEnabled}
                      onChange={(e) => handleToggleAutoStart(e.target.checked)}
                      className="accent-[#003366]"
                    />
                    <span>Inicializar automaticamente com o Windows (Execução em segundo plano)</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveModelSchedulers}
                    disabled={savingSchedulers}
                    className="vb-btn vb-btn-primary"
                  >
                    {savingSchedulers ? <RotateCw size={12} className="animate-spin" /> : <Save size={12} />}
                    <span>Salvar Configuração de Horários</span>
                  </button>
                </div>
              </fieldset>

              {/* Sincronização Geral Imediata */}
              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Varredura Multiemprsa Imediata</legend>
                <p className="text-[11px] text-[#444444] mb-2">
                  Executa a consulta sequencial de documentos para todas as {empresas.length} empresas cadastradas (NF-e, NFC-e, CT-e e NFS-e).
                </p>

                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleStartSyncAll}
                    disabled={isSyncingAll}
                    className="vb-btn vb-btn-primary"
                  >
                    {isSyncingAll ? (
                      <>
                        <RotateCw size={12} className="animate-spin" />
                        <span>Sincronizando {syncAllProgress.stage ? `[Etapa ${syncAllProgress.stage}/4] ` : ''}({syncAllProgress.currentIndex}/{syncAllProgress.total})...</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} className="text-emerald-700" />
                        <span>Sincronizar Todas as Empresas Agora</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsResetAllModalOpen(true)}
                    className="vb-btn"
                    title="Reiniciar ponteiros NSU em caso de necessidade de busca histórica"
                  >
                    <RotateCcw size={12} className="text-amber-700" />
                    <span>Reiniciar Ponteiros NSU</span>
                  </button>
                </div>

                {/* Console de Log em Tempo Real */}
                {syncAllProgress.logs.length > 0 && (
                  <div className="bg-[#1e1e1e] text-[#d4d4d4] border border-[#555555] p-2 font-mono text-[10px] h-32 overflow-y-auto break-all">
                    {syncAllProgress.logs.map((log) => (
                      <div key={log.id} className="leading-tight">
                        <span className="text-[#888888]">[{log.time}] </span>
                        <span
                          className={
                            log.type === "error"
                              ? "text-rose-400 font-bold"
                              : log.type === "success" || log.type === "all_finished"
                              ? "text-emerald-400 font-bold"
                              : "text-[#9cdcfe]"
                          }
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: ARMAZENAMENTO & DIRETÓRIOS                                         */}
          {/* ========================================================================= */}
          {activeTab === "storage" && (
            <div className="flex flex-col gap-2">
              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Diretório de Armazenamento Local de Arquivos</legend>
                <p className="text-[11px] text-[#444444] mb-2">
                  Local físico em disco onde os arquivos XML e PDFs de todas as notas fiscais são salvos, estruturados por empresa e ano/mês.
                </p>

                <div className="mb-2">
                  <label className="block text-[10px] font-bold text-[#333333] mb-0.5">Caminho Atual no Sistema:</label>
                  <input
                    type="text"
                    readOnly
                    value={settings?.customStorageDir || "Padrão do Sistema (AppData Local)"}
                    className="vb-input w-full font-mono font-bold bg-[#fafafa] select-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectFolder}
                    className="vb-btn vb-btn-primary"
                  >
                    <FolderOpen size={12} />
                    <span>Alterar Pasta de Armazenamento</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenFolder}
                    className="vb-btn"
                  >
                    <Folder size={12} />
                    <span>Abrir no Windows Explorer</span>
                  </button>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Recuperação de Histórico & Reinício de Ponteiros NSU</legend>
                <p className="text-[11px] text-[#444444] mb-2">
                  Em caso de migração de servidor, formatação da máquina ou exclusão acidental de arquivos locais, reinicie os ponteiros NSU (marco zero) para forçar o reenvio de todos os documentos fiscais pela SEFAZ.
                </p>
                <button
                  type="button"
                  onClick={() => setIsResetAllModalOpen(true)}
                  className="vb-btn"
                >
                  <RotateCcw size={12} className="text-amber-700" />
                  <span>Reiniciar NSUs de Todos os Modelos</span>
                </button>
              </fieldset>

              <fieldset className="vb-groupbox">
                <legend className="vb-legend">Diagnóstico do Sistema & Suporte Técnico</legend>
                <p className="text-[11px] text-[#444444] mb-2">
                  Gere um relatório técnico contendo informações de ambiente, caminhos de diretório, integridade dos certificados e logs operacionais para anexar em chamados de suporte.
                </p>
                <button
                  type="button"
                  onClick={handleExportDiagnostics}
                  disabled={exportingDiagnostics}
                  className="vb-btn"
                >
                  <DownloadCloud size={12} className={exportingDiagnostics ? "animate-spin" : ""} />
                  <span>{exportingDiagnostics ? "Gerando Relatório..." : "Exportar Diagnóstico Técnico (.txt)"}</span>
                </button>
              </fieldset>
            </div>
          )}
        </div>

        {/* Rodapé Clássico da Janela */}
        <div className="bg-[#e4e4e4] border-t border-[#b0b0b0] px-3 py-1.5 flex items-center justify-between select-none">
          <div className="text-[10px] text-[#444444] flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[#003366]" />
            <span>Certificados criptografados em nível local via Windows DPAPI/AES. Nenhuma chave trafega para a nuvem.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="vb-btn"
          >
            Fechar Janela
          </button>
        </div>
      </div>

      {/* Modal Secundário: Busca de Certificados na Rede */}
      {isNetworkModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 select-none">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] text-[11px] font-sans">
            <div className="bg-gradient-to-r from-[#003366] via-[#004b87] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <div className="flex items-center gap-1.5">
                <FileKey size={13} />
                <span className="font-bold text-[11px]">Certificados A1 Encontrados no Servidor de Rede</span>
              </div>
              <button
                onClick={() => setIsNetworkModalOpen(false)}
                className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-2 border-b border-[#b0b0b0] bg-[#eaeaea]">
              <input
                type="text"
                value={networkSearchTerm}
                onChange={(e) => setNetworkSearchTerm(e.target.value)}
                placeholder="Filtrar por nome do arquivo ou pasta..."
                className="vb-input w-full"
              />
            </div>

            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-1 bg-white">
              {loadingNetworkCerts ? (
                <div className="p-6 text-center text-[#555555] text-[11px] flex items-center justify-center gap-2">
                  <RotateCw size={14} className="animate-spin text-[#003366]" />
                  <span>Buscando certificados no diretório de rede...</span>
                </div>
              ) : networkCerts.length === 0 ? (
                <div className="p-6 text-center text-[#888888] text-[11px]">
                  Nenhum certificado A1 (.pfx/.p12) localizado na pasta de rede informada.
                </div>
              ) : (
                networkCerts
                  .filter((c) =>
                    c.name.toLowerCase().includes(networkSearchTerm.toLowerCase()) ||
                    c.dir.toLowerCase().includes(networkSearchTerm.toLowerCase())
                  )
                  .map((cert, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectNetworkCert(cert)}
                      className="p-1.5 border border-[#cccccc] hover:border-[#005a9e] hover:bg-[#f0f7ff] cursor-pointer flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileKey size={14} className="text-[#003366] shrink-0" />
                        <div className="truncate">
                          <div className="font-bold text-[#000000] truncate">{cert.name}</div>
                          <div className="text-[10px] text-[#666666] truncate font-mono">{cert.dir}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="vb-btn vb-btn-primary shrink-0"
                      >
                        Usar
                      </button>
                    </div>
                  ))
              )}
            </div>

            <div className="bg-[#e4e4e4] border-t border-[#b0b0b0] px-3 py-1.5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNetworkModalOpen(false)}
                className="vb-btn"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Mestre: Reiniciar NSU de Todos os Modelos */}
      {isResetAllModalOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/70 p-4 select-none">
          <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-full max-w-lg flex flex-col text-[11px] font-sans">
            {/* Cabeçalho */}
            <div className="bg-gradient-to-r from-[#003366] via-[#004b87] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244]">
              <div className="flex items-center gap-1.5">
                <RotateCcw size={13} />
                <span className="font-bold text-[11px]">Reiniciar NSU de Todos os Modelos</span>
              </div>
              <button
                type="button"
                onClick={() => !isResettingAll && setIsResetAllModalOpen(false)}
                disabled={isResettingAll}
                className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-3 flex flex-col gap-2">
              {resetSuccessMessage ? (
                <div className="p-3 bg-[#eaf7ea] border border-[#7bc97b] text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                  <div className="font-bold">{resetSuccessMessage}</div>
                </div>
              ) : (
                <>
                  <div className="p-2 bg-white border border-[#b0b0b0] text-[11px] text-[#333333] leading-relaxed">
                    Esta ação zera os ponteiros de busca para o marco inicial:
                    <strong className="text-[#000000]"> NSU 0</strong> na NF-e, CT-e e NFS-e, e histórico de <strong className="text-[#000000]">90 dias</strong> na NFC-e. Na próxima sincronização, a SEFAZ reenviará todos os documentos do período.
                  </div>

                  {/* Seleção do Escopo */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend">Escopo do Reinício</legend>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="resetScope"
                          value="single"
                          checked={resetScope === "single"}
                          onChange={() => setResetScope("single")}
                          disabled={isResettingAll}
                          className="mt-0.5 accent-[#003366]"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-[#000000]">Apenas para uma empresa específica:</span>
                          {resetScope === "single" && (
                            <div className="mt-1">
                              <EmpresaSearchSelect
                                empresas={empresas}
                                value={resetSelectedCompanyId}
                                onChange={setResetSelectedCompanyId}
                                disabled={isResettingAll}
                                className="w-full"
                              />
                            </div>
                          )}
                        </div>
                      </label>

                      <label className="flex items-start gap-2 cursor-pointer mt-1">
                        <input
                          type="radio"
                          name="resetScope"
                          value="all"
                          checked={resetScope === "all"}
                          onChange={() => setResetScope("all")}
                          disabled={isResettingAll}
                          className="mt-0.5 accent-[#003366]"
                        />
                        <div>
                          <span className="font-bold text-[#000000]">
                            Para TODAS as {empresas.length} empresas cadastradas
                          </span>
                          <span className="text-[10px] text-[#666666] block">
                            Reinicia os ponteiros de todas as empresas registradas simultaneamente.
                          </span>
                        </div>
                      </label>
                    </div>
                  </fieldset>

                  {/* Modelos abrangidos */}
                  <div className="p-1.5 bg-[#eaeaea] border border-[#b0b0b0] grid grid-cols-2 gap-1 text-[10px] font-semibold text-[#333333]">
                    <div className="flex items-center gap-1">
                      <Check size={11} className="text-emerald-700" />
                      <span>NF-e (Mod. 55) &rarr; NSU 0</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check size={11} className="text-blue-700" />
                      <span>NFC-e (Mod. 65) &rarr; 90 dias</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check size={11} className="text-amber-700" />
                      <span>CT-e (Mod. 57) &rarr; NSU 0</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Check size={11} className="text-indigo-700" />
                      <span>NFS-e (Serviços) &rarr; NSU 0</span>
                    </div>
                  </div>

                  {/* Opções de Limpeza */}
                  <fieldset className="vb-groupbox bg-white">
                    <legend className="vb-legend">Opções Adicionais</legend>
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resetClearFiles}
                          onChange={(e) => setResetClearFiles(e.target.checked)}
                          disabled={isResettingAll}
                          className="accent-[#003366]"
                        />
                        <span>Limpar arquivos locais existentes (regravar 100% limpo da SEFAZ)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={resetClearManifestations}
                          onChange={(e) => setResetClearManifestations(e.target.checked)}
                          disabled={isResettingAll}
                          className="accent-[#003366]"
                        />
                        <span>Limpar cache de manifestações NF-e (permitir re-manifestação)</span>
                      </label>
                    </div>
                  </fieldset>
                </>
              )}
            </div>

            {/* Rodapé com botões de ação */}
            <div className="bg-[#e4e4e4] border-t border-[#b0b0b0] px-3 py-1.5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetAllModalOpen(false)}
                disabled={isResettingAll}
                className="vb-btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmResetAllModels}
                disabled={isResettingAll || !!resetSuccessMessage}
                className="vb-btn vb-btn-danger"
              >
                {isResettingAll ? (
                  <>
                    <RotateCw size={12} className="animate-spin" />
                    <span>Reiniciando NSUs...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw size={12} />
                    <span>Confirmar Reinício dos NSUs</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
