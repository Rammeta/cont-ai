import React, { useState, useEffect, useRef } from "react";
import { EmpresaSefaz } from "../types";
import {
  Zap,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  FileText,
  ShoppingBag,
  Truck,
  Landmark,
  Layers,
  DownloadCloud,
  Terminal,
  Check,
  Copy,
  Clock,
  ShieldCheck
} from "lucide-react";
import { syncAllCompanies, onSyncAllProgress } from "../utils/electronBridge";

interface SyncAllProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetCompany?: EmpresaSefaz | null;
  allCompanies: EmpresaSefaz[];
  onComplete?: () => void;
}

interface LogEntry {
  id: string;
  time: string;
  type: string;
  message: string;
}

export default function SyncAllProgressModal({
  isOpen,
  onClose,
  targetCompany,
  allCompanies,
  onComplete,
}: SyncAllProgressModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [currentStageName, setCurrentStageName] = useState<string>("NF-e Entradas (Mod. 55)");
  const [currentCompanyIndex, setCurrentCompanyIndex] = useState<number>(0);
  const [totalCompanies, setTotalCompanies] = useState<number>(1);
  const [currentCompanyName, setCurrentCompanyName] = useState<string>("");
  const [statusMessage, setStatusMessage] = useState<string>("Aguardando início...");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);

  const targetList = targetCompany ? [targetCompany] : allCompanies;
  const isSingleCompany = !!targetCompany;

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Listener para progresso do backend
  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = onSyncAllProgress((info: any) => {
      const now = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (info.stage !== undefined) {
        setCurrentStage(info.stage);
      }
      if (info.stageName) {
        setCurrentStageName(info.stageName);
      }
      if (info.index !== undefined) {
        setCurrentCompanyIndex(info.index);
      }
      if (info.total !== undefined) {
        setTotalCompanies(info.total);
      }
      if (info.companyName) {
        setCurrentCompanyName(info.companyName);
      }
      if (info.message) {
        setStatusMessage(info.message);
      }

      // Adiciona aos logs
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          time: now,
          type: info.type || "info",
          message: info.message || "",
        },
      ].slice(-150));

      if (info.type === "all_finished") {
        setIsFinished(true);
        setIsSyncing(false);
        isSyncingRef.current = false;
        if (info.summary || info.results) {
          setSummary(info.summary || info.results);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen]);

  // Iniciar sincronização ao abrir ou por botão
  const startSync = async () => {
    if (targetList.length === 0) {
      alert("Nenhuma empresa configurada para sincronização.");
      return;
    }

    setIsSyncing(true);
    isSyncingRef.current = true;
    setIsFinished(false);
    setHasStarted(true);
    setCurrentStage(1);
    setCurrentStageName("NF-e Entradas (Mod. 55)");
    setCurrentCompanyIndex(1);
    setTotalCompanies(targetList.length);
    setCurrentCompanyName(targetList[0]?.razaoSocial || "");
    setStatusMessage("Conectando aos WebServices SEFAZ e prefeituras...");
    setLogs([
      {
        id: "start-1",
        time: new Date().toLocaleTimeString(),
        type: "info",
        message: `Iniciando varredura unificada (${targetList.length} empresa${targetList.length > 1 ? "s" : ""}) nos 4 modelos fiscais...`,
      },
    ]);

    try {
      const res = await syncAllCompanies(targetList);
      if (!res.success) {
        setLogs((prev) => [
          ...prev,
          {
            id: "err-" + Date.now(),
            time: new Date().toLocaleTimeString(),
            type: "error",
            message: `Erro na execução: ${res.error || "Falha na sincronização"}`,
          },
        ]);
        setStatusMessage(`Falha: ${res.error || "Erro desconhecido"}`);
      } else if (res.results) {
        setSummary(res.results);
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: "err-catch-" + Date.now(),
          time: new Date().toLocaleTimeString(),
          type: "error",
          message: `Exceção: ${err.message}`,
        },
      ]);
      setStatusMessage(`Erro: ${err.message}`);
    } finally {
      setIsSyncing(false);
      isSyncingRef.current = false;
      setIsFinished(true);
    }
  };

  useEffect(() => {
    if (isOpen && !hasStarted && !isSyncingRef.current) {
      startSync();
    }
    if (!isOpen) {
      setHasStarted(false);
      setIsFinished(false);
      setLogs([]);
      setSummary(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCloseAndFinish = () => {
    if (isSyncing) {
      if (!confirm("A sincronização ainda está em andamento. Deseja fechar esta visualização? O processo continuará em segundo plano.")) {
        return;
      }
    }
    if (onComplete) {
      onComplete();
    }
    onClose();
  };

  const handleCopyLogs = () => {
    const text = logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const stages = [
    { num: 1, name: "NF-e Entradas", model: "Mod. 55", icon: DownloadCloud, color: "sky" },
    { num: 2, name: "NFC-e Vendas", model: "Mod. 65", icon: ShoppingBag, color: "purple" },
    { num: 3, name: "CT-e Fretes", model: "Mod. 57", icon: Truck, color: "amber" },
    { num: 4, name: "NFS-e Serviços", model: "ADN + SP", icon: Landmark, color: "emerald" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] text-[11px] text-[#000000] font-sans">
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
        `}</style>

        {/* TITLEBAR CLÁSSICA DO ERP */}
        <div className="bg-gradient-to-r from-[#003366] via-[#004b87] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244] shadow-xs">
          <div className="flex items-center gap-2">
            <RotateCw size={13} className={isSyncing ? "animate-spin" : ""} />
            <span className="font-bold tracking-wide text-[11px]">
              CONT-AI - Gestor de Movimento fiscal - [ Sincronização Unificada de Documentos ]
            </span>
          </div>
          <button
            onClick={handleCloseAndFinish}
            title="Fechar Janela"
            className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* CORPO DO MODAL */}
        <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {/* Groupbox: Status e Escopo */}
          <fieldset className="vb-groupbox bg-white">
            <legend className="vb-legend">Escopo da Varredura Fiscal</legend>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-[#003366] text-[12px]">
                  {isSingleCompany
                    ? `Empresa Específica: ${targetCompany?.razaoSocial} (${targetCompany?.cnpj})`
                    : `Varredura Multiemprsa: Todas as ${targetList.length} empresas cadastradas`}
                </span>
                <p className="text-[10px] text-[#555555]">
                  Captura sequencial incremental nos 4 modelos de documentos (NF-e 55, NFC-e 65, CT-e 57 e NFS-e).
                </p>
              </div>
              <span className="px-2 py-0.5 bg-[#eaf3ff] border border-[#a0c4ff] text-[#003366] font-bold text-[10px]">
                {targetList.length > 1 ? `Empresa ${currentCompanyIndex} de ${totalCompanies}` : "Empresa Única"}
              </span>
            </div>
          </fieldset>

          {/* Stepper dos 4 Modelos Fiscais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stages.map((st) => {
              const isPast = currentStage > st.num || (isFinished && !isSyncing);
              const isCurrent = currentStage === st.num && isSyncing;

              return (
                <div
                  key={st.num}
                  className={`p-2 border flex items-center gap-2 ${
                    isPast
                      ? "bg-[#eaf7ea] border-[#7bc97b] text-emerald-900"
                      : isCurrent
                      ? "bg-[#eaf3ff] border-[#005a9e] text-[#003366] font-bold"
                      : "bg-[#f5f5f5] border-[#d0d0d0] text-[#777777]"
                  }`}
                >
                  <div
                    className={`w-5 h-5 flex items-center justify-center font-bold text-[10px] border ${
                      isPast
                        ? "bg-emerald-700 text-white border-emerald-800"
                        : isCurrent
                        ? "bg-[#005a9e] text-white border-[#003366]"
                        : "bg-[#e0e0e0] text-[#555] border-[#b0b0b0]"
                    }`}
                  >
                    {isPast ? <Check size={12} /> : isCurrent ? <RotateCw size={11} className="animate-spin" /> : st.num}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold truncate">{st.name}</div>
                    <div className="text-[10px] opacity-75">{st.model}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de Progresso Clássica do Windows */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#003366] flex items-center gap-1.5">
                {isSyncing ? (
                  <>
                    <RotateCw size={11} className="animate-spin" />
                    <span>Etapa {currentStage}/4: {statusMessage}</span>
                  </>
                ) : isFinished ? (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-700" />
                    <span>Varredura Concluída com Sucesso!</span>
                  </>
                ) : (
                  <span>Pronto para iniciar</span>
                )}
              </span>
              <span className="font-mono text-[10px] text-[#555555]">
                {currentCompanyName}
              </span>
            </div>

            <div className="w-full bg-white h-4 border border-[#7a7a7a] p-[1px]">
              <div
                className={`h-full transition-all duration-200 ${
                  isFinished ? "bg-emerald-600" : "bg-[#005a9e]"
                }`}
                style={{
                  width: isFinished
                    ? "100%"
                    : `${Math.min(100, Math.max(5, ((currentStage - 1) / 4) * 100 + (currentCompanyIndex / totalCompanies) * 25))}%`,
                }}
              />
            </div>
          </div>

          {/* Console de Log em Tempo Real */}
          <div className="flex-1 flex flex-col border border-[#7a7a7a]">
            <div className="bg-[#e4e4e4] border-b border-[#b0b0b0] px-2 py-1 flex items-center justify-between">
              <span className="font-bold text-[11px] text-[#333333] flex items-center gap-1">
                <Terminal size={12} />
                <span>Console de Eventos e Comunicação SEFAZ</span>
              </span>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="vb-btn"
              >
                {copiedLogs ? <Check size={11} /> : <Copy size={11} />}
                <span>{copiedLogs ? "Copiado!" : "Copiar Logs"}</span>
              </button>
            </div>

            <div className="bg-[#1e1e1e] text-[#d4d4d4] font-mono text-[10px] p-2 h-44 overflow-y-auto flex flex-col gap-0.5">
              {logs.length === 0 ? (
                <span className="text-[#888888] italic">Aguardando início dos WebServices...</span>
              ) : (
                logs.map((log) => {
                  let color = "text-[#9cdcfe]";
                  if (log.type === "error" || log.type === "err") color = "text-rose-400 font-bold";
                  else if (log.type === "warn") color = "text-amber-300 font-bold";
                  else if (log.type === "success" || log.type === "download_success" || log.type === "all_finished")
                    color = "text-emerald-400 font-bold";

                  return (
                    <div key={log.id} className="leading-tight">
                      <span className="text-[#888888]">[{log.time}] </span>
                      <span className={color}>{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

          {/* Resumo de Conclusão */}
          {isFinished && summary && (
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend">Documentos Fiscais Baixados e Integrados</legend>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="border border-[#b0b0b0] bg-[#f9f9f9] p-1.5">
                  <span className="text-[10px] text-[#555] font-bold block uppercase">NF-e (Mod. 55)</span>
                  <span className="text-base font-bold text-[#003366] font-mono">
                    {summary?.nfe?.totalDownloaded ?? summary?.nfe?.downloaded ?? 0}
                  </span>
                </div>
                <div className="border border-[#b0b0b0] bg-[#f9f9f9] p-1.5">
                  <span className="text-[10px] text-[#555] font-bold block uppercase">NFC-e (Mod. 65)</span>
                  <span className="text-base font-bold text-[#003366] font-mono">
                    {summary?.nfce?.totalDownloaded ?? summary?.nfce?.downloaded ?? 0}
                  </span>
                </div>
                <div className="border border-[#b0b0b0] bg-[#f9f9f9] p-1.5">
                  <span className="text-[10px] text-[#555] font-bold block uppercase">CT-e (Mod. 57)</span>
                  <span className="text-base font-bold text-[#003366] font-mono">
                    {summary?.cte?.totalDownloaded ?? summary?.cte?.downloaded ?? 0}
                  </span>
                </div>
                <div className="border border-[#b0b0b0] bg-[#f9f9f9] p-1.5">
                  <span className="text-[10px] text-[#555] font-bold block uppercase">NFS-e (Serviços)</span>
                  <span className="text-base font-bold text-[#003366] font-mono">
                    {summary?.nfse?.totalDownloaded ?? summary?.nfse?.downloaded ?? 0}
                  </span>
                </div>
              </div>
            </fieldset>
          )}
        </div>

        {/* Rodapé Clássico */}
        <div className="bg-[#e4e4e4] border-t border-[#b0b0b0] px-3 py-1.5 flex items-center justify-between">
          <div className="text-[10px] text-[#555555] flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-[#003366]" />
            <span>Controle sequencial de NSU contra rejeição 656 (Consumo Indevido SEFAZ).</span>
          </div>

          <div className="flex items-center gap-2">
            {!isSyncing && isFinished ? (
              <button
                type="button"
                onClick={handleCloseAndFinish}
                className="vb-btn vb-btn-primary"
              >
                <Check size={12} />
                <span>Concluir e Fechar</span>
              </button>
            ) : !isSyncing ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="vb-btn"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={startSync}
                  className="vb-btn vb-btn-primary"
                >
                  <RotateCw size={12} />
                  <span>Iniciar Agora</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleCloseAndFinish}
                className="vb-btn"
              >
                Minimizar para Segundo Plano
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
