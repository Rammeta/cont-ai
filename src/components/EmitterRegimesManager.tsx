import React, { useState, useEffect, useMemo } from "react";
import { EmitenteUnico, EmitterRegimesMap, RegimeRemetente, CnpjConsultaResult } from "../types";
import {
  Building2,
  Search,
  Settings,
  HelpCircle,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  X,
  Info,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import { getRegimeLabel } from "../utils/calc";
import {
  consultarCnpj,
  consultarCnpjsLote,
  obterCnpjCache,
  onCnpjConsultaProgress,
} from "../utils/electronBridge";

interface EmitterRegimesManagerProps {
  emitentes: EmitenteUnico[];
  emitterRegimes: EmitterRegimesMap;
  onUpdateRegime: (cnpj: string, regime: RegimeRemetente | "default") => void;
  onApplyGlobalToUnconfigured: () => void;
  globalRegime: RegimeRemetente;
  onNotify?: (text: string, type: "success" | "error") => void;
}

export default function EmitterRegimesManager({
  emitentes,
  emitterRegimes,
  onUpdateRegime,
  onApplyGlobalToUnconfigured,
  globalRegime,
  onNotify,
}: EmitterRegimesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [cnpjDataMap, setCnpjDataMap] = useState<Record<string, CnpjConsultaResult>>({});
  const [consultandoIndiv, setConsultandoIndiv] = useState<Record<string, boolean>>({});
  const [consultandoLote, setConsultandoLote] = useState(false);
  const [loteProgresso, setLoteProgresso] = useState<{
    current: number;
    total: number;
    cnpj: string;
    razao?: string;
  } | null>(null);
  const [selectedCnpjModal, setSelectedCnpjModal] = useState<CnpjConsultaResult | null>(null);

  useEffect(() => {
    obterCnpjCache().then((cache) => {
      if (cache) {
        setCnpjDataMap(cache);
      }
    });
  }, []);

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

  const filtered = emitentes.filter(
    (e) =>
      e.cnpjCpfRem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.razaoRem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.ufRem.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const configuredCount = emitentes.filter((e) => emitterRegimes[e.emitenteKey]).length;

  const pendingCnpjs = useMemo(() => {
    const set = new Set<string>();
    for (const e of emitentes) {
      const clean = (e.cnpjCpfRem || e.emitenteKey || "").replace(/\D/g, "");
      if (
        clean.length === 14 &&
        (!cnpjDataMap[clean] || !cnpjDataMap[clean].sucesso || !cnpjDataMap[clean].consultado_portal_rfb)
      ) {
        set.add(clean);
      }
    }
    return Array.from(set);
  }, [emitentes, cnpjDataMap]);

  const allCnpjs = useMemo(() => {
    const set = new Set<string>();
    for (const e of emitentes) {
      const clean = (e.cnpjCpfRem || e.emitenteKey || "").replace(/\D/g, "");
      if (clean.length === 14) set.add(clean);
    }
    return Array.from(set);
  }, [emitentes]);

  const handleConsultarIndividual = async (cnpjRaw: string, emitenteKey?: string, forceRefresh: boolean = false) => {
    const clean = String(cnpjRaw || emitenteKey || "").replace(/\D/g, "");
    if (clean.length !== 14) return;
    setConsultandoIndiv((prev) => ({ ...prev, [clean]: true }));
    try {
      const res = await consultarCnpj(clean, forceRefresh);
      setCnpjDataMap((prev) => ({ ...prev, [clean]: res }));
      if (selectedCnpjModal && selectedCnpjModal.cnpj.replace(/\D/g, "") === clean && res.sucesso) {
        setSelectedCnpjModal(res);
      }
      if (res && res.sucesso && typeof res.opcao_simples_raw === "boolean") {
        const targetRegime: RegimeRemetente = res.opcao_simples_raw ? "simples" : "normal";
        const targetEmitente = emitentes.find(
          (e) => (e.cnpjCpfRem || e.emitenteKey || "").replace(/\D/g, "") === clean
        );
        const keyToUpdate = emitenteKey || targetEmitente?.emitenteKey || clean;
        onUpdateRegime(keyToUpdate, targetRegime);
        if (onNotify) {
          onNotify(
            `Status RFB de ${res.razao_social || clean}: ${res.opcao_simples}. Regime configurado para ${
              targetRegime === "simples" ? "Simples Nacional" : "Regime Normal"
            }!`,
            "success"
          );
        }
      } else if (onNotify) {
        onNotify(
          res?.erro ||
            "Instabilidade no Portal do Simples Nacional da Receita Federal. Não foi possível verificar o enquadramento oficial no momento.",
          "error"
        );
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Instabilidade no Portal da Receita Federal: ${err.message}`, "error");
    } finally {
      setConsultandoIndiv((prev) => ({ ...prev, [clean]: false }));
    }
  };

  const handleConsultarLote = async (forceRefresh: boolean = false) => {
    const targetList = forceRefresh ? allCnpjs : pendingCnpjs;
    if (targetList.length === 0) {
      if (onNotify) onNotify("Todos os emitentes já foram consultados no Portal do Simples Nacional!", "success");
      return;
    }
    setConsultandoLote(true);
    setLoteProgresso({ current: 0, total: targetList.length, cnpj: "" });

    try {
      const results = await consultarCnpjsLote(targetList, forceRefresh);
      setCnpjDataMap((prev) => ({ ...prev, ...results }));
      let updatedCount = 0;
      let instavelCount = 0;
      for (const e of emitentes) {
        const clean = (e.cnpjCpfRem || e.emitenteKey || "").replace(/\D/g, "");
        const res = results[clean];
        if (res && res.sucesso && typeof res.opcao_simples_raw === "boolean") {
          const targetRegime: RegimeRemetente = res.opcao_simples_raw ? "simples" : "normal";
          onUpdateRegime(e.emitenteKey, targetRegime);
          updatedCount++;
        } else if (res && !res.sucesso) {
          instavelCount++;
        }
      }
      if (onNotify) {
        if (instavelCount > 0) {
          onNotify(
            `Consulta concluída: ${updatedCount} emitente(s) atualizados com sucesso. ${instavelCount} emitente(s) apresentaram instabilidade no Portal da Receita Federal (tente novamente mais tarde).`,
            updatedCount > 0 ? "success" : "error"
          );
        } else {
          onNotify(
            `Consulta no Portal RFB concluída com sucesso para todos os ${updatedCount} emitente(s)!`,
            "success"
          );
        }
      }
    } catch (err: any) {
      if (onNotify) onNotify(`Instabilidade na consulta ao Portal da Receita Federal: ${err.message}`, "error");
    } finally {
      setConsultandoLote(false);
      setLoteProgresso(null);
    }
  };

  const renderSimplesBadge = (cnpjRaw: string, emitenteKey: string) => {
    const clean = String(cnpjRaw || emitenteKey || "").replace(/\D/g, "");
    if (!clean || clean.length !== 14) {
      return <span className="text-[#888888] text-[10px]">-</span>;
    }

    const info = cnpjDataMap[clean];
    const isConsultando = consultandoIndiv[clean];

    if (isConsultando) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#f0f0f0] text-[#003366] animate-pulse border border-[#c0c0c0]">
          <RefreshCw size={9} className="animate-spin text-[#005a9e]" />
          Portal RFB...
        </span>
      );
    }

    if (info && info.sucesso && info.consultado_portal_rfb) {
      if (info.opcao_simples_raw) {
        return (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedCnpjModal(info)}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200 cursor-pointer"
              title="Clique para ver detalhes do Simples Nacional na RFB"
            >
              <CheckCircle2 size={10} className="text-emerald-700" />
              <span>Simples Nac.</span>
            </button>
            <button
              type="button"
              onClick={() => handleConsultarIndividual(clean, emitenteKey, true)}
              className="p-0.5 text-[#555555] hover:text-[#000000]"
              title="Reconsultar agora no Portal RFB"
            >
              <RefreshCw size={9} />
            </button>
          </div>
        );
      } else {
        return (
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSelectedCnpjModal(info)}
              className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-100 text-blue-900 border border-blue-300 hover:bg-blue-200 cursor-pointer"
              title="Clique para ver detalhes cadastrais na RFB"
            >
              <Building2 size={10} className="text-blue-700" />
              <span>Regime Normal</span>
            </button>
            <button
              type="button"
              onClick={() => handleConsultarIndividual(clean, emitenteKey, true)}
              className="p-0.5 text-[#555555] hover:text-[#000000]"
              title="Reconsultar agora no Portal RFB"
            >
              <RefreshCw size={9} />
            </button>
          </div>
        );
      }
    }

    if (info && !info.sucesso) {
      return (
        <div className="inline-flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-900 border border-amber-300"
            title={info.erro || "Instabilidade no Portal da Receita Federal. Tente novamente mais tarde."}
          >
            <AlertCircle size={9} className="text-amber-700" />
            <span>Portal Instável</span>
          </span>
          <button
            type="button"
            onClick={() => handleConsultarIndividual(clean, emitenteKey, true)}
            className="p-0.5 text-[#555555] hover:text-[#000000]"
            title="Tentar consultar novamente na RFB"
          >
            <RefreshCw size={9} />
          </button>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => handleConsultarIndividual(clean, emitenteKey)}
        className="vb-btn py-0 px-1.5 text-[9px]"
        title="Consultar opção pelo Simples Nacional direto no Portal da Receita Federal"
      >
        <Search size={9} className="text-[#005a9e]" />
        <span>Consultar RFB</span>
      </button>
    );
  };

  return (
    <fieldset className="vb-groupbox">
      <legend className="vb-legend flex items-center gap-1.5">
        <Building2 size={13} />
        <span>Regime por Fornecedor Emitente (Configuração Individual / Portal RFB)</span>
      </legend>

      <div className="flex flex-col gap-2 text-[11px]">
        {/* Barra Superior com Pesquisa e Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ffffff] border border-[#c0c0c0] p-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#333333]">
              Emitentes: <strong>{emitentes.length}</strong> | Personalizados: <strong>{configuredCount}</strong>
            </span>
            <span className="text-[#888888]">|</span>
            <span className="text-[10px] text-[#555555]">
              Padrão geral: <strong className="text-[#003366]">{getRegimeLabel(globalRegime)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              placeholder="Pesquisar emitente por Razão / CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="vb-input min-w-[200px]"
            />

            {emitentes.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handleConsultarLote(pendingCnpjs.length === 0)}
                  disabled={consultandoLote}
                  className="vb-btn vb-btn-primary"
                  title="Consulta em lote direta no Portal do Simples Nacional (RFB)"
                >
                  <RefreshCw size={11} className={consultandoLote ? "animate-spin text-[#003366]" : "text-[#003366]"} />
                  <span>
                    {consultandoLote
                      ? `Portal RFB (${loteProgresso ? `${loteProgresso.current}/${loteProgresso.total}` : "..."})`
                      : pendingCnpjs.length > 0
                      ? `Consultar SN (${pendingCnpjs.length} pendentes)`
                      : "Reconsultar SN"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onApplyGlobalToUnconfigured}
                  className="vb-btn"
                  title="Aplicar o regime geral padrão aos emitentes sem configuração individual"
                >
                  <span>Aplicar Geral aos Pendentes</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabela de Emitentes no formato DataGrid ERP */}
        <div className="border border-[#999999] bg-[#ffffff] max-h-64 overflow-auto">
          {emitentes.length === 0 ? (
            <div className="p-4 text-center text-[#777777] italic text-[11px]">
              Nenhum fornecedor emitente identificado. Carregue arquivos XML para listar os parceiros.
            </div>
          ) : (
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th style={{ width: "130px" }}>CNPJ / CPF</th>
                  <th>Razão Social do Emitente</th>
                  <th style={{ width: "45px", textAlign: "center" }}>UF</th>
                  <th style={{ width: "135px", textAlign: "center" }}>Status Simples Nac.</th>
                  <th style={{ width: "170px" }}>Regime no DIFAL</th>
                  <th style={{ width: "120px" }}>Origem Regra</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-[#888888]">
                      Nenhum emitente correspondente ao filtro de busca.
                    </td>
                  </tr>
                ) : (
                  filtered.map((e) => {
                    const configurado = emitterRegimes[e.emitenteKey];
                    const ativo = configurado || globalRegime;
                    const origem = configurado ? "Individual" : "Geral Padrão";

                    return (
                      <tr key={e.emitenteKey}>
                        <td className="font-mono font-semibold">{e.cnpjCpfRem}</td>
                        <td className="font-medium truncate max-w-xs" title={e.razaoRem}>
                          {e.razaoRem}
                        </td>
                        <td className="text-center font-bold text-[#003366]">{e.ufRem}</td>
                        <td className="text-center">{renderSimplesBadge(e.cnpjCpfRem, e.emitenteKey)}</td>
                        <td>
                          <select
                            value={configurado || "default"}
                            onChange={(evt) =>
                              onUpdateRegime(e.emitenteKey, evt.target.value as RegimeRemetente | "default")
                            }
                            className="vb-input w-full py-0 text-[10px] font-semibold"
                          >
                            <option value="default">Padrão Geral ({getRegimeLabel(globalRegime)})</option>
                            <option value="simples">Simples Nacional</option>
                            <option value="normal">Regime Normal</option>
                          </select>
                        </td>
                        <td>
                          <span
                            className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                              configurado
                                ? "bg-blue-100 text-blue-900 border border-blue-300"
                                : "bg-gray-100 text-gray-700 border border-gray-300"
                            }`}
                          >
                            {origem}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Emitente (Portal RFB) */}
      {selectedCnpjModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#f0f0f0] border-2 border-[#707070] shadow-2xl max-w-lg w-full p-0">
            <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-[#005a9e]" />
                <span className="font-bold text-xs text-[#003366]">
                  {selectedCnpjModal.razao_social || "Dados Cadastrais RFB"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCnpjModal(null)}
                className="vb-btn py-0 px-1 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-3 flex flex-col gap-2 text-[11px] max-h-[75vh] overflow-y-auto">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Situação no Portal do Simples Nacional (RFB)</legend>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#555555]">CNPJ:</span>
                    <strong className="font-mono">{selectedCnpjModal.cnpj_formatado || selectedCnpjModal.cnpj}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#555555]">Opção pelo Simples Nacional:</span>
                    <strong className={selectedCnpjModal.opcao_simples_raw ? "text-[#107c41]" : "text-[#005a9e]"}>
                      {selectedCnpjModal.opcao_simples}
                    </strong>
                  </div>
                  {selectedCnpjModal.opcao_simei_raw && (
                    <div className="flex items-center justify-between text-[#885500]">
                      <span>Enquadramento SIMEI (MEI):</span>
                      <strong>{selectedCnpjModal.opcao_simei}</strong>
                    </div>
                  )}
                  {selectedCnpjModal.data_consulta_portal && (
                    <div className="text-[10px] text-[#777777] border-t border-[#e0e0e0] pt-1 mt-1">
                      Consultado diretamente na Receita Federal em: {selectedCnpjModal.data_consulta_portal}
                    </div>
                  )}
                </div>
              </fieldset>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedCnpjModal(null)}
                  className="vb-btn font-semibold"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </fieldset>
  );
}
