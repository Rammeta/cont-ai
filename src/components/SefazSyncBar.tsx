import React, { useState, useEffect } from "react";
import { EmpresaSefaz, SefazSyncStatus } from "../types";
import { Building2, RefreshCw, DownloadCloud, Calendar, Settings, ShieldCheck, AlertCircle, CheckCircle2, ChevronDown, Clock } from "lucide-react";
import { syncCompanySefaz, listCompanyXmls, listAvailableMonths, onSyncProgress, readXmlsContent, getCompanySefazState } from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";

interface SefazSyncBarProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onOpenCompanyModal: (tab?: "empresas" | "schedulers" | "storage") => void;
  onLoadXmlContents: (xmls: Array<{ name: string; content: string }>, company: EmpresaSefaz) => void;
  loadedXmlCount: number;
}

export default function SefazSyncBar({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onOpenCompanyModal,
  onLoadXmlContents,
  loadedXmlCount,
}: SefazSyncBarProps) {
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [syncStatus, setSyncStatus] = useState<SefazSyncStatus>({
    syncing: false,
    message: "",
  });
  const [nsuState, setNsuState] = useState<{ ultNSU?: string; maxNSU?: string; blockedUntil?: string | null } | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Carrega estado de NSU e cooldown da SEFAZ para a empresa ativa
  const loadCompanyState = async () => {
    if (!activeEmpresa) {
      setNsuState(null);
      setCooldownRemaining(0);
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
    } catch (_) {}
  };

  useEffect(() => {
    loadCompanyState();
  }, [activeEmpresa, syncStatus.syncing]);

  // Contador regressivo do cooldown
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

  // Atualiza lista de meses disponíveis quando a empresa ativa muda
  useEffect(() => {
    if (activeEmpresa) {
      listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial).then((months) => {
        setAvailableMonths(months);
        if (months.length > 0 && selectedMonth === "all") {
          // pode manter "all" ou selecionar o mais recente
        }
      });
    } else {
      setAvailableMonths([]);
    }
  }, [activeEmpresa, syncStatus.syncing]);

  // Listener para progresso da sincronização
  useEffect(() => {
    const unsubscribe = onSyncProgress((info) => {
      setSyncStatus((prev) => ({
        ...prev,
        message: info.message || prev.message,
      }));
    });
    return unsubscribe;
  }, []);

  const handleSync = async () => {
    if (!activeEmpresa) {
      alert("Selecione ou cadastre uma empresa primeiro.");
      return;
    }
    if (!activeEmpresa.certPath && activeEmpresa.certStore !== "windows" && !activeEmpresa.certThumbprint) {
      alert("A empresa selecionada não possui certificado vinculado (arquivo .pfx ou Windows).");
      return;
    }

    setSyncStatus({
      syncing: true,
      message: "Iniciando comunicação com a SEFAZ...",
    });

    try {
      const res = await syncCompanySefaz(activeEmpresa);
      if (res.success) {
        setSyncStatus({
          syncing: false,
          message: `Sincronização concluída! ${res.result.totalBaixadas} nova(s) nota(s) baixada(s).`,
          totalBaixadas: res.result.totalBaixadas,
          totalManifestadas: res.result.totalManifestadas,
        });

        // Carrega automaticamente os XMLs para o cálculo do DIFAL!
        await handleLoadXmls();
      } else {
        setSyncStatus({
          syncing: false,
          message: "",
          error: res.error || "Erro desconhecido ao sincronizar com a SEFAZ.",
        });
      }
    } catch (err: any) {
      setSyncStatus({
        syncing: false,
        message: "",
        error: err.message,
      });
    }
  };

  const handleLoadXmls = async () => {
    if (!activeEmpresa) return;
    const filterMonth = selectedMonth === "all" ? undefined : selectedMonth;
    const xmls = await listCompanyXmls(activeEmpresa.cnpj, filterMonth, activeEmpresa.razaoSocial);
    // Filtra estritamente NF-e Modelo 55 para carga no motor de cálculo do DIFAL
    const nfeOnly = xmls.filter((x: any) => {
      if (x.modelo && x.modelo !== "55") return false;
      if (x.name && x.name.toLowerCase().endsWith("-cte.xml")) return false;
      if (x.chNFe && x.chNFe.length === 44 && x.chNFe.substring(20, 22) === "57") return false;
      return true;
    });

    if (nfeOnly.length === 0) {
      alert("Nenhum XML de NF-e encontrado para o período selecionado. Clique em 'Sincronizar SEFAZ' para buscar as notas.");
      return;
    }

    const xmlsWithContent = await readXmlsContent(nfeOnly.map((x: any) => x.fullPath));
    onLoadXmlContents(xmlsWithContent, activeEmpresa);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md p-4 flex flex-col gap-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Lado Esquerdo: Empresa Ativa */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <div className="p-2.5 bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl shrink-0">
            <Building2 size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
                Empresa Ativa (DIFAL / SEFAZ):
              </span>
              <CertificateBadge
                certInfo={activeEmpresa?.certInfo}
                onClick={() => onOpenCompanyModal("empresas")}
              />
              {nsuState?.ultNSU && (
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-slate-800 text-slate-300 border border-slate-700"
                  title={`Ponteiro NSU SEFAZ: ${nsuState.ultNSU} de ${nsuState.maxNSU || "0"}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                  NSU: {Number(nsuState.ultNSU)} / {Number(nsuState.maxNSU || 0)}
                </span>
              )}
              {cooldownRemaining > 0 && (
                <span
                  className="text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                  title={`Repouso preventivo SEFAZ (Rejeição 656 / NT 2014.002) ativo até ${new Date(nsuState?.blockedUntil || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                >
                  <Clock size={11} className="text-amber-400" />
                  <span>Repouso SEFAZ: {Math.floor(cooldownRemaining / 60)}m {String(cooldownRemaining % 60).padStart(2, "0")}s</span>
                </span>
              )}
            </div>

            {empresas.length > 0 ? (
              <div className="relative mt-1 max-w-full">
                <select
                  value={activeEmpresa?.id || ""}
                  onChange={(e) => onSelectEmpresa(e.target.value)}
                  className="bg-slate-800 border border-slate-700 hover:border-slate-600 text-white text-xs font-bold rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none w-full sm:w-auto sm:min-w-[240px] max-w-full"
                >
                  {empresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.razaoSocial} ({e.cnpj})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            ) : (
              <span className="text-xs text-amber-400 font-semibold block mt-0.5">
                Nenhuma empresa cadastrada. Clique ao lado para cadastrar.
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenCompanyModal}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            title="Cadastrar ou editar empresas e certificados"
          >
            <Settings size={14} />
            Gerenciar Empresas
          </button>
        </div>

        {/* Lado Direito: Período e Botões de Ação */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
          {/* Seletor de Mês */}
          {activeEmpresa && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
              <Calendar size={14} className="text-slate-400" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-800 text-white">Todos os Meses</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-800 text-white">
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Botão Carregar Notas Salvas */}
          {activeEmpresa && (
            <button
              type="button"
              onClick={handleLoadXmls}
              disabled={syncStatus.syncing}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="Carregar notas fiscais já baixadas no motor de cálculo"
            >
              <DownloadCloud size={15} className="text-blue-400" />
              Carregar no DIFAL
            </button>
          )}

          {/* Botão Sincronizar com SEFAZ */}
          {activeEmpresa && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncStatus.syncing || cooldownRemaining > 0}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                cooldownRemaining > 0
                  ? `Repouso preventivo SEFAZ ativo (${Math.ceil(cooldownRemaining / 60)} min restantes). Evita Rejeição 656.`
                  : "Consultar novas notas fiscais na SEFAZ"
              }
            >
              <RefreshCw size={15} className={syncStatus.syncing ? "animate-spin" : ""} />
              {syncStatus.syncing
                ? "Sincronizando SEFAZ..."
                : cooldownRemaining > 0
                ? "Repouso SEFAZ"
                : "Sincronizar SEFAZ"}
            </button>
          )}
        </div>
      </div>

      {/* Barra de Status e Notificações da Sincronização */}
      {syncStatus.syncing && (
        <div className="bg-blue-950/60 border border-blue-800/80 rounded-xl px-4 py-2 text-xs text-blue-200 flex items-center gap-2 animate-pulse">
          <RefreshCw size={14} className="animate-spin text-blue-400 shrink-0" />
          <span>{syncStatus.message || "Consultando WebService Nacional da SEFAZ..."}</span>
        </div>
      )}

      {syncStatus.error && (
        <div className="bg-rose-950/70 border border-rose-800 rounded-xl px-4 py-2 text-xs text-rose-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span>{syncStatus.error}</span>
          </div>
          <button
            onClick={() => setSyncStatus((prev) => ({ ...prev, error: undefined }))}
            className="text-rose-400 hover:text-white font-bold text-[10px]"
          >
            Fechar
          </button>
        </div>
      )}

      {syncStatus.message && !syncStatus.syncing && (
        <div className="bg-emerald-950/60 border border-emerald-800/80 rounded-xl px-4 py-2 text-xs text-emerald-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus((prev) => ({ ...prev, message: "" }))}
            className="text-emerald-400 hover:text-white font-bold text-[10px]"
          >
            Fechar
          </button>
        </div>
      )}
    </div>
  );
}
