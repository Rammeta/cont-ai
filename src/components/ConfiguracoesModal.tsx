import React, { useState, useEffect } from "react";
import { EmpresaSefaz } from "../types";
import {
  Folder,
  Clock,
  Settings,
  X,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Play,
  RotateCw,
  Layers,
  FileText,
  Save,
  Check,
  Info,
  Calendar,
  Landmark
} from "lucide-react";
import {
  getAppSettings,
  selectStorageFolder,
  openStorageFolder,
  saveSchedulerSettings,
  saveNfseSchedulerSettings,
  syncAllCompanies,
  onSyncAllProgress,
  AppSettings,
  getAutoStart,
  setAutoStart
} from "../utils/electronBridge";

interface ConfiguracoesModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSefaz[];
  onRefreshXmls?: () => void;
}

export default function ConfiguracoesModal({
  isOpen,
  onClose,
  empresas,
  onRefreshXmls,
}: ConfiguracoesModalProps) {
  const [activeTab, setActiveTab] = useState<"storage" | "scheduler">("storage");

  // Estado das configurações
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savedSuccessMsg, setSavedSuccessMsg] = useState<string | null>(null);

  // Estado do formulário de agendamento SEFAZ
  const [schedulerEnabled, setSchedulerEnabled] = useState(false);
  const [schedulerTime, setSchedulerTime] = useState("08:00");
  const [savingScheduler, setSavingScheduler] = useState(false);

  // Estado do formulário de agendamento NFS-e
  const [nfseSchedulerEnabled, setNfseSchedulerEnabled] = useState(false);
  const [nfseSchedulerTime, setNfseSchedulerTime] = useState("18:00");
  const [savingNfseScheduler, setSavingNfseScheduler] = useState(false);

  const [autoStartEnabled, setAutoStartEnabled] = useState(false);

  // Estado da Sincronização Geral
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

  useEffect(() => {
    if (isOpen) {
      loadCurrentSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    // Escuta eventos de progresso da sincronização de todas as empresas
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
        ].slice(-40); // Mantém os últimos 40 logs

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

  const loadCurrentSettings = async () => {
    setLoadingSettings(true);
    try {
      const data = await getAppSettings();
      if (data) {
        setSettings(data);
        setSchedulerEnabled(data.scheduler?.enabled ?? false);
        setSchedulerTime(data.scheduler?.time || "08:00");
        setNfseSchedulerEnabled(data.nfseScheduler?.enabled ?? false);
        setNfseSchedulerTime(data.nfseScheduler?.time || "18:00");
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

  const handleSaveScheduler = async () => {
    setSavingScheduler(true);
    try {
      const res = await saveSchedulerSettings({
        enabled: schedulerEnabled,
        time: schedulerTime,
      });
      if (res.success) {
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                scheduler: {
                  ...prev.scheduler,
                  enabled: schedulerEnabled,
                  time: schedulerTime,
                },
              }
            : null
        );
        setSavedSuccessMsg("Configurações do agendador SEFAZ salvas com sucesso!");
        setTimeout(() => setSavedSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      alert("Erro ao salvar agendamento: " + e.message);
    } finally {
      setSavingScheduler(false);
    }
  };

  const handleSaveNfseScheduler = async () => {
    setSavingNfseScheduler(true);
    try {
      const res = await saveNfseSchedulerSettings({
        enabled: nfseSchedulerEnabled,
        time: nfseSchedulerTime,
      });
      if (res.success) {
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                nfseScheduler: {
                  ...prev.nfseScheduler,
                  enabled: nfseSchedulerEnabled,
                  time: nfseSchedulerTime,
                },
              }
            : null
        );
        setSavedSuccessMsg("Configurações do agendador NFS-e salvas com sucesso!");
        setTimeout(() => setSavedSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      alert("Erro ao salvar agendamento de NFS-e: " + e.message);
    } finally {
      setSavingNfseScheduler(false);
    }
  };

  const handleStartSyncAll = async () => {
    if (empresas.length === 0) {
      alert("Nenhuma empresa cadastrada para sincronizar.");
      return;
    }

    if (
      !confirm(
        `Deseja iniciar a sincronização geral de todas as ${empresas.length} empresas cadastradas?\n\nO processo será executado sequencialmente com pausas de segurança anti-bloqueio entre cada empresa.`
      )
    ) {
      return;
    }

    setIsSyncingAll(true);
    setSyncAllProgress({
      currentIndex: 0,
      total: empresas.length,
      currentCompany: empresas[0]?.razaoSocial || empresas[0]?.cnpj,
      message: "Iniciando varredura geral...",
      logs: [
        {
          id: "start",
          time: new Date().toLocaleTimeString(),
          type: "info",
          message: `Iniciando consulta para ${empresas.length} empresas sequencialmente...`,
        },
      ],
      summary: undefined,
    });

    try {
      const res = await syncAllCompanies(empresas);
      if (res.results) {
        setSyncAllProgress((prev) => ({
          ...prev,
          summary: res.results,
          message: "Varredura geral concluída!",
        }));
      }
      if (onRefreshXmls) onRefreshXmls();
    } catch (e: any) {
      alert("Erro na sincronização geral: " + e.message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-100 flex items-center gap-2">
                Configurações & Agendamento
              </h2>
              <p className="text-xs text-slate-400">
                Personalize o local de salvamento das notas e configure rotinas automáticas de busca
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap sm:flex-nowrap border-b border-slate-800 bg-slate-950/40 px-3 sm:px-6 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab("storage")}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 font-semibold text-xs sm:text-sm border-b-2 transition-colors ${
              activeTab === "storage"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Folder className="w-4 h-4" />
            Pasta de Armazenamento & Estrutura
          </button>
          <button
            onClick={() => setActiveTab("scheduler")}
            className={`flex items-center gap-2 py-3 px-3 sm:px-4 font-semibold text-xs sm:text-sm border-b-2 transition-colors ${
              activeTab === "scheduler"
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700"
            }`}
          >
            <Clock className="w-4 h-4" />
            Agendamento & Busca Geral
            {schedulerEnabled && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Ativo
              </span>
            )}
          </button>
        </div>

        {/* Notificação de Sucesso */}
        {savedSuccessMsg && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedSuccessMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* TAB 1: PASTA DE ARMAZENAMENTO */}
          {activeTab === "storage" && (
            <div className="space-y-6">
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-blue-400" />
                      Pasta Raiz de Salvamento
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Local onde todos os XMLs e DANFEs (PDFs) são organizados. Você pode selecionar qualquer pasta em seu computador ou em um servidor de rede.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-300 font-mono break-all select-all">
                    {settings?.customStorageDir || "Carregando..."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={handleSelectFolder}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <Folder className="w-3.5 h-3.5" />
                    Alterar Pasta de Salvamento...
                  </button>
                  <button
                    onClick={handleOpenFolder}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-2 transition-colors border border-slate-700"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                    Abrir no Windows Explorer
                  </button>
                </div>
              </div>

              {/* Pré-visualização da Estrutura de Pastas Hierárquica */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-slate-200 text-sm font-semibold">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Estrutura Automática de Pastas
                </div>
                <p className="text-xs text-slate-400">
                  Cada nova nota baixada é separada rigorosamente conforme as regras contábeis e fiscais:
                </p>

                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 font-mono text-xs text-slate-300 space-y-1 overflow-x-auto">
                  <div className="text-blue-400 font-bold">[Pasta Selecionada]</div>
                  <div className="pl-4 text-emerald-300 font-semibold">
                    └── NOME DA EMPRESA (CNPJ)
                  </div>
                  <div className="pl-8 text-amber-300 font-semibold">
                    └── 2026 <span className="text-slate-500 font-normal">(Ano de Emissão)</span>
                  </div>
                  <div className="pl-12 text-purple-300 font-semibold">
                    └── 09 - Setembro <span className="text-slate-500 font-normal">(Competência)</span>
                  </div>
                  <div className="pl-16 text-cyan-300">
                    ├── <span className="font-bold">DE FORA DO ESTADO</span>{" "}
                    <span className="text-slate-500 text-[11px]">(Interestadual - DIFAL / Antecipação)</span>
                  </div>
                  <div className="pl-20 text-slate-400">
                    ├── 352609...-nfe.xml
                  </div>
                  <div className="pl-20 text-slate-400">
                    └── 352609...-danfe.pdf
                  </div>
                  <div className="pl-16 text-emerald-400">
                    └── <span className="font-bold">DENTRO DO ESTADO</span>{" "}
                    <span className="text-slate-500 text-[11px]">(Interna Estadual)</span>
                  </div>
                  <div className="pl-20 text-slate-400">
                    ├── 352609...-nfe.xml
                  </div>
                  <div className="pl-20 text-slate-400">
                    └── 352609...-danfe.pdf
                  </div>
                </div>

                <div className="flex items-center gap-2 text-slate-400 text-xs mt-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <Info className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>
                    O sistema mantém cópias retrocompatíveis de suas notas anteriores. Nenhuma nota é perdida ao alterar a pasta ou consultar novos períodos.
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AGENDAMENTO & SINCRONIZAÇÃO GERAL */}
          {activeTab === "scheduler" && (
            <div className="space-y-6">
              {/* Card de Configuração do Timer */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-400" />
                      Agendador Diário de Busca Geral
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Executa a busca de notas de todas as empresas cadastradas em um horário específico diariamente
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={schedulerEnabled}
                      onChange={(e) => setSchedulerEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Horário Diário da Varredura
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={schedulerTime}
                        disabled={!schedulerEnabled}
                        onChange={(e) => setSchedulerTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                      />
                      <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      onClick={handleSaveScheduler}
                      disabled={savingScheduler}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm h-[38px]"
                    >
                      {savingScheduler ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Salvar Horário Agendado
                    </button>
                  </div>
                </div>

                {/* Switch de Iniciar com o Windows */}
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-slate-200 block">
                      Iniciar com o Windows (Segundo Plano)
                    </label>
                    <span className="text-[11px] text-slate-400 block">
                      Inicia o aplicativo automaticamente minimizado na bandeja do sistema ao ligar o computador.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={autoStartEnabled}
                      onChange={(e) => handleToggleAutoStart(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {schedulerEnabled && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Varredura ativa: executará automaticamente às <strong>{schedulerTime}</strong> (o aplicativo continuará operando em segundo plano na bandeja do sistema mesmo ao fechar a janela).
                    </span>
                  </div>
                )}
              </div>

              {/* Card de Configuração do Agendador NFS-e */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Landmark className="w-4 h-4 text-emerald-400" />
                      Agendador Diário de NFS-e (Serviços)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Executa a captação de notas de serviço (Portal Nacional ADN e São Paulo) em um horário fixo diariamente
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={nfseSchedulerEnabled}
                      onChange={(e) => setNfseSchedulerEnabled(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Horário Diário da Captação de NFS-e
                    </label>
                    <div className="relative">
                      <input
                        type="time"
                        value={nfseSchedulerTime}
                        disabled={!nfseSchedulerEnabled}
                        onChange={(e) => setNfseSchedulerTime(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                      />
                      <Clock className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      onClick={handleSaveNfseScheduler}
                      disabled={savingNfseScheduler}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm h-[38px] cursor-pointer"
                    >
                      {savingNfseScheduler ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Salvar Horário NFS-e
                    </button>
                  </div>
                </div>

                {nfseSchedulerEnabled && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Captação de NFS-e ativa: executará automaticamente às <strong>{nfseSchedulerTime}</strong> diariamente.
                    </span>
                  </div>
                )}
              </div>

              {/* Regras Anti-Bloqueio da SEFAZ */}
              <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-2.5">
                <h4 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Proteção e Regras Anti-Bloqueio SEFAZ Ativas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-400">
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-1">
                      1. Execução Sequencial
                    </span>
                    As empresas são consultadas uma de cada vez, nunca em paralelo.
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-1">
                      2. Pausa Preventiva (10s)
                    </span>
                    Intervalo de repouso entre empresas para evitar sobrecarga de IP.
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                    <span className="font-semibold text-slate-200 block mb-1">
                      3. Respeito ao Cooldown
                    </span>
                    Se uma empresa estiver em repouso de 1h (cStat 137 ou 656), ela é pulada com segurança.
                  </div>
                </div>
              </div>

              {/* Botão de Disparo Manual de Todas as Empresas */}
              <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <Play className="w-4 h-4 text-emerald-400" />
                      Varredura Geral Manual ({empresas.length} Empresas Cadastradas)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Inicie a busca sequencial de todas as empresas cadastradas nos 4 modelos fiscais (NF-e, NFC-e, CT-e e NFS-e)
                    </p>
                  </div>
                  <button
                    onClick={handleStartSyncAll}
                    disabled={isSyncingAll || empresas.length === 0}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-md active:scale-95 shrink-0"
                  >
                    {isSyncingAll ? (
                      <>
                        <RotateCw className="w-4 h-4 animate-spin" />
                        Sincronizando {syncAllProgress.stage ? `[Etapa ${syncAllProgress.stage}/4 - ${syncAllProgress.stageName || ''}] ` : ''}({syncAllProgress.currentIndex}/{syncAllProgress.total})...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        Sincronizar Todas Agora
                      </>
                    )}
                  </button>
                </div>

                {/* Barra de Progresso e Logs da Varredura */}
                {(isSyncingAll || syncAllProgress.logs.length > 0) && (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-300">
                        <span className="font-medium">
                          {isSyncingAll ? (
                            <>
                              Processando: {syncAllProgress.stage ? <span className="text-emerald-400 font-semibold">[Etapa {syncAllProgress.stage}/4 - {syncAllProgress.stageName}] </span> : null}<strong className="text-blue-400">{syncAllProgress.currentCompany || "Iniciando"}</strong> (Empresa {syncAllProgress.currentIndex} de {syncAllProgress.total})
                            </>
                          ) : (
                            <span className="text-emerald-400 font-semibold">Varredura finalizada</span>
                          )}
                        </span>
                        <span className="font-mono text-slate-400">
                          {syncAllProgress.total > 0
                            ? `${Math.round((syncAllProgress.currentIndex / syncAllProgress.total) * 100)}%`
                            : "0%"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      </div>
                    </div>

                    {/* Console de Logs */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1 select-text">
                      {syncAllProgress.logs.map((log) => (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2 ${
                            log.type === "company_error"
                              ? "text-rose-400"
                              : log.type === "company_skipped"
                              ? "text-amber-400"
                              : log.type === "company_done"
                              ? "text-emerald-400 font-semibold"
                              : "text-slate-400"
                          }`}
                        >
                          <span className="text-slate-600 shrink-0">[{log.time}]</span>
                          <span>{log.message}</span>
                        </div>
                      ))}
                    </div>

                    {/* Resumo quando finalizado */}
                    {syncAllProgress.summary && syncAllProgress.summary.length > 0 && (
                      <div className="mt-3 border border-slate-700/80 rounded-xl overflow-hidden text-xs">
                        <div className="bg-slate-800/80 px-3 py-2 font-semibold text-slate-200 flex justify-between">
                          <span>Resumo da Varredura</span>
                          <span>{syncAllProgress.summary.length} empresas processadas</span>
                        </div>
                        <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto">
                          {syncAllProgress.summary.map((item, idx) => (
                            <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-900/50">
                              <div>
                    {syncAllProgress.summary && syncAllProgress.summary.length > 0 && (
                      <div className="mt-3 border border-slate-700/80 rounded-xl overflow-hidden text-xs">
                        <div className="bg-slate-800/80 px-3 py-2 font-semibold text-slate-200 flex justify-between">
                          <span>Resumo da Varredura</span>
                          <span>{syncAllProgress.summary.length} empresas processadas</span>
                        </div>
                        <div className="divide-y divide-slate-800 max-h-40 overflow-y-auto">
                          {syncAllProgress.summary.map((item, idx) => (
                            <div key={idx} className="p-2.5 flex items-center justify-between bg-slate-900/50">
                              <div>
                                <span className="font-semibold text-slate-200 block">
                                  {item.razaoSocial || item.cnpj}
                                </span>
                                <span className="text-[11px] text-slate-400 font-mono">
                                  {item.cnpj}
                                </span>
                              </div>
                              <div className="text-right">
                                {item.isCooldown ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 font-semibold">
                                    Em Repouso (Pulada)
                                  </span>
                                ) : item.success ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-semibold">
                                    +{item.totalBaixadas || 0} baixadas
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 font-semibold">
                                    Falha
                                  </span>
                                )}
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors border border-slate-700"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}










