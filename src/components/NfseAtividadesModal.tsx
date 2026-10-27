import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Layers,
  Tag,
  Check,
  FileText,
  Building2,
  X,
  Filter,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Info,
  ListFilter,
  Hash
} from "lucide-react";
import {
  TABELA_CORRELACAO_NBS,
  GRUPOS_ATIVIDADES,
  AtividadeNbsCorrelacao,
  TABELA_SERVICOS_PORTAL_NACIONAL,
  ServicoPortalNacional
} from "../data/tabelaCorrelacaoNbs";

interface NfseAtividadesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAtividade: (atividade: AtividadeNbsCorrelacao) => void;
  onSelectServicoNacional?: (servico: ServicoPortalNacional) => void;
  currentNbs?: string;
  currentItemLc116?: string;
  currentCodNac?: string;
  initialTab?: "nacional" | "nbs";
}

export default function NfseAtividadesModal({
  isOpen,
  onClose,
  onSelectAtividade,
  onSelectServicoNacional,
  currentNbs = "",
  currentItemLc116 = "",
  currentCodNac = "",
  initialTab = "nacional"
}: NfseAtividadesModalProps) {
  const [activeTab, setActiveTab] = useState<"nacional" | "nbs">(initialTab);
  const [termoBusca, setTermoBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("TODOS");

  const [selectedAtividade, setSelectedAtividade] = useState<AtividadeNbsCorrelacao | null>(null);
  const [selectedServicoNac, setSelectedServicoNac] = useState<ServicoPortalNacional | null>(null);

  // Sincroniza a aba ativa quando a modal é aberta
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setTermoBusca("");
      setGrupoFiltro("TODOS");
      setSelectedAtividade(null);
      setSelectedServicoNac(null);
    }
  }, [isOpen, initialTab]);

  // Lista única de grupos da Tabela Nacional de Serviços (335 itens)
  const gruposNacional = useMemo(() => {
    const map = new Map<string, { codigo: string; nome: string; total: number }>();
    for (const item of TABELA_SERVICOS_PORTAL_NACIONAL) {
      const g = item.grupo;
      if (!map.has(g)) {
        map.set(g, {
          codigo: g,
          nome: item.grupoDescricao,
          total: 1
        });
      } else {
        map.get(g)!.total++;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.codigo.localeCompare(b.codigo));
  }, []);

  // Filtra os serviços do Portal Nacional (6 dígitos)
  const servicosNacionalFiltrados = useMemo(() => {
    return TABELA_SERVICOS_PORTAL_NACIONAL.filter((item) => {
      if (grupoFiltro !== "TODOS" && item.grupo !== grupoFiltro) {
        return false;
      }
      if (!termoBusca.trim()) return true;

      const q = termoBusca.toLowerCase().trim();
      const qDigits = q.replace(/\D/g, "");

      const matchCodigo = item.codigo.includes(q) || (qDigits && item.codigo.includes(qDigits));
      const matchDesc = item.descricao.toLowerCase().includes(q);
      const matchLc = item.itemLc116.includes(q) || (qDigits && item.itemLc116.replace(/\D/g, "").includes(qDigits));
      const matchGrupo = item.grupoDescricao.toLowerCase().includes(q);

      return matchCodigo || matchDesc || matchLc || matchGrupo;
    });
  }, [termoBusca, grupoFiltro]);

  // Filtra as atividades correlacionadas (NBS 9 dígitos x IBS/CBS)
  const atividadesFiltradas = useMemo(() => {
    return TABELA_CORRELACAO_NBS.filter((item) => {
      if (grupoFiltro !== "TODOS" && item.grupo !== grupoFiltro) {
        return false;
      }
      if (!termoBusca.trim()) return true;

      const q = termoBusca.toLowerCase().trim();
      const matchDesc = item.descricaoNbs.toLowerCase().includes(q);
      const matchNbs = item.nbs.toLowerCase().includes(q) || item.nbsCodigo.includes(q);
      const matchLc116 = item.itemLc116.toLowerCase().includes(q);
      const matchCnae = item.cnaePrincipal.toLowerCase().includes(q) || item.todosCnaes.some(c => c.toLowerCase().includes(q));
      const matchClass = item.classificacaoIbsCbs.toLowerCase().includes(q);
      const matchGrupo = item.grupoDescricao.toLowerCase().includes(q);

      return matchDesc || matchNbs || matchLc116 || matchCnae || matchClass || matchGrupo;
    });
  }, [termoBusca, grupoFiltro]);

  if (!isOpen) return null;

  const handleConfirmServicoNacional = (s: ServicoPortalNacional) => {
    if (onSelectServicoNacional) {
      onSelectServicoNacional(s);
    } else {
      // Fallback: se não tiver handler específico, busca correlação compatível
      const rawLc = s.itemLc116.replace(/\D/g, "");
      const found = TABELA_CORRELACAO_NBS.find(item => (item.itemLc116 || "").replace(/\D/g, "") === rawLc);
      if (found) {
        onSelectAtividade(found);
      }
    }
    onClose();
  };

  const handleConfirmAtividade = (atv: AtividadeNbsCorrelacao) => {
    onSelectAtividade(atv);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none p-2 sm:p-4 font-sans text-[11px]">
      <div className="w-full max-w-5xl bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl flex flex-col h-[90vh] max-h-[760px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        
        {/* Titlebar Clássico Windows / ERP */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-sky-300" />
            <span>CONT-AI - [ Catálogo Oficial de Serviços: Portal Nacional NFS-e & Correlação NBS / IBS / CBS ]</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-red-300 font-bold px-1.5 cursor-pointer text-[13px]"
            title="Fechar janela (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Barra de Abas ERP */}
        <div className="bg-[#e4ebf5] border-b border-[#b5c7de] px-2 pt-1.5 flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab("nacional");
              setGrupoFiltro("TODOS");
              setTermoBusca("");
            }}
            className={`px-3 py-1 text-[11px] font-bold border-t border-x rounded-t transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "nacional"
                ? "bg-[#ffffff] text-[#003366] border-[#003366] border-b-transparent shadow-xs"
                : "bg-[#d8e2ee] text-[#555555] border-[#b5c7de] hover:bg-[#e8f0f8]"
            }`}
          >
            <Hash size={12} className={activeTab === "nacional" ? "text-[#005a9e]" : "text-[#777777]"} />
            <span>Serviços do Portal Nacional (6 Dígitos)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === "nacional" ? "bg-blue-100 text-[#003366]" : "bg-gray-200 text-[#666666]"
            }`}>
              {TABELA_SERVICOS_PORTAL_NACIONAL.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("nbs");
              setGrupoFiltro("TODOS");
              setTermoBusca("");
            }}
            className={`px-3 py-1 text-[11px] font-bold border-t border-x rounded-t transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "nbs"
                ? "bg-[#ffffff] text-[#003366] border-[#003366] border-b-transparent shadow-xs"
                : "bg-[#d8e2ee] text-[#555555] border-[#b5c7de] hover:bg-[#e8f0f8]"
            }`}
          >
            <Layers size={12} className={activeTab === "nbs" ? "text-[#005a9e]" : "text-[#777777]"} />
            <span>Correlação Atividades x NBS (9 Dígitos) x IBS/CBS</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
              activeTab === "nbs" ? "bg-blue-100 text-[#003366]" : "bg-gray-200 text-[#666666]"
            }`}>
              {TABELA_CORRELACAO_NBS.length}
            </span>
          </button>
        </div>

        {/* Subheader Informativo Dinâmico */}
        <div className="bg-[#f0f6fc] border-b border-[#b5c7de] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 text-[#224466]">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-[#005a9e] shrink-0" />
            {activeTab === "nacional" ? (
              <span>
                Lista oficial com <strong>todos os 335 serviços cadastrados no Ambiente de Dados Nacional (ADN / SEFIN)</strong>.
                Selecione o código de <strong>6 dígitos (cTribNac)</strong> para emissão oficial sem rejeição de schema.
              </span>
            ) : (
              <span>
                Tabela de correlação cruzada com <strong>Nomenclatura NBS (9 dígitos)</strong>, 
                <strong>Item da LC 116</strong> e parâmetros oficiais da <strong>Reforma Tributária (IBS/CBS - NT 004)</strong>.
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[#446688] font-semibold">
            {activeTab === "nacional"
              ? `${TABELA_SERVICOS_PORTAL_NACIONAL.length} códigos de 6 dígitos disponíveis`
              : `${TABELA_CORRELACAO_NBS.length} correlações cadastradas`}
          </div>
        </div>

        {/* Barra de Busca e Filtros */}
        <div className="bg-[#f7f7f7] border-b border-[#b0b0b0] p-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Campo de Pesquisa Geral */}
            <div className="relative flex-1 min-w-[220px]">
              <input
                type="text"
                autoFocus
                placeholder={
                  activeTab === "nacional"
                    ? "Buscar por código (ex: 010101, 1701), descrição do serviço ou LC 116 (ex: 1.01)..."
                    : "Buscar por nome da atividade, NBS, LC 116 (ex: 04.16, 17.01) ou CNAE..."
                }
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="vb-input w-full pl-7 pr-6 py-1 text-[11px]"
              />
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666666]" />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#888888] hover:text-[#333333]"
                  title="Limpar busca"
                >
                  <X size={11} />
                </button>
              )}
            </div>

            {/* Filtro por Categoria / Grupo da LC 116 */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#555555] font-semibold whitespace-nowrap">Grupo LC 116:</span>
              <select
                value={grupoFiltro}
                onChange={(e) => setGrupoFiltro(e.target.value)}
                className="vb-select max-w-[260px] text-[11px]"
              >
                {activeTab === "nacional" ? (
                  <>
                    <option value="TODOS">Todos os Grupos ({TABELA_SERVICOS_PORTAL_NACIONAL.length})</option>
                    {gruposNacional.map((g) => (
                      <option key={g.codigo} value={g.codigo}>
                        {g.codigo} - {g.nome} ({g.total})
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="TODOS">Todos os Grupos ({TABELA_CORRELACAO_NBS.length})</option>
                    {GRUPOS_ATIVIDADES.map((g) => (
                      <option key={g.codigo} value={g.codigo}>
                        {g.codigo} - {g.nome} ({g.total})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Contador de Resultados */}
          <div className="text-[10.5px] text-[#444444] font-medium">
            Exibindo <strong>{activeTab === "nacional" ? servicosNacionalFiltrados.length : atividadesFiltradas.length}</strong> de{" "}
            {activeTab === "nacional" ? TABELA_SERVICOS_PORTAL_NACIONAL.length : TABELA_CORRELACAO_NBS.length}
          </div>
        </div>

        {/* Grade / Tabela Dinâmica por Aba */}
        <div className="flex-1 overflow-y-auto bg-white border-b border-[#b0b0b0]">
          {activeTab === "nacional" ? (
            /* TABELA 1: SERVIÇOS DO PORTAL NACIONAL (6 DÍGITOS) */
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#e4ebf5] border-b border-[#b5c7de] text-[#003366] sticky top-0 z-10 shadow-xs">
                  <th className="px-2.5 py-1.5 font-bold w-24 text-center">cTribNac (6 Dígitos)</th>
                  <th className="px-2.5 py-1.5 font-bold w-20 text-center">LC 116</th>
                  <th className="px-2.5 py-1.5 font-bold w-48">Grupo LC 116</th>
                  <th className="px-2.5 py-1.5 font-bold">Descrição Oficial do Serviço</th>
                  <th className="px-2.5 py-1.5 font-bold w-28 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {servicosNacionalFiltrados.length > 0 ? (
                  servicosNacionalFiltrados.map((item) => {
                    const isCurrent = currentCodNac && (currentCodNac.replace(/\D/g, "") === item.codigo);
                    const isSelected = selectedServicoNac?.codigo === item.codigo;

                    return (
                      <tr
                        key={item.codigo}
                        onClick={() => setSelectedServicoNac(item)}
                        onDoubleClick={() => handleConfirmServicoNacional(item)}
                        className={`border-b border-[#e5e5e5] cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#dbeafe] hover:bg-[#cbe2fe]"
                            : isCurrent
                            ? "bg-[#ecfdf5] hover:bg-[#d1fae5]"
                            : "hover:bg-[#f5f8fc]"
                        }`}
                      >
                        {/* Código Nacional (6 dígitos) */}
                        <td className="px-2.5 py-1.5 text-center">
                          <span className="font-mono font-bold text-[#003366] bg-[#eef3f9] px-2 py-0.5 rounded border border-[#ccddee] text-[11.5px]">
                            {item.codigo}
                          </span>
                        </td>

                        {/* Item LC 116 */}
                        <td className="px-2.5 py-1.5 text-center">
                          <span className="font-mono text-[#555555] font-semibold">
                            {item.itemLc116}
                          </span>
                        </td>

                        {/* Grupo */}
                        <td className="px-2.5 py-1.5 text-[#444444]">
                          <span className="text-[10px] text-[#666666] font-medium block">
                            {item.grupo} - {item.grupoDescricao}
                          </span>
                        </td>

                        {/* Descrição */}
                        <td className="px-2.5 py-1.5">
                          <div className="font-semibold text-[#111111] leading-snug">
                            {item.descricao}
                          </div>
                        </td>

                        {/* Botão Selecionar */}
                        <td className="px-2.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmServicoNacional(item);
                            }}
                            className="vb-btn vb-btn-primary py-0.5 px-2 flex items-center justify-center gap-1 w-full text-[10.5px]"
                          >
                            <Check size={11} className="text-white" />
                            <span>Selecionar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#777777]">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Search size={22} className="text-[#aaaaaa]" />
                        <span className="font-semibold">Nenhum serviço nacional encontrado com "{termoBusca}".</span>
                        <span className="text-[10px] text-[#888888]">Tente buscar por termos mais genéricos como "software", "consulta", "obra", "transporte" ou pelo código de 6 dígitos.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* TABELA 2: CORRELAÇÃO ATIVIDADES X NBS X IBS/CBS */
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-[#e4ebf5] border-b border-[#b5c7de] text-[#003366] sticky top-0 z-10 shadow-xs">
                  <th className="px-2.5 py-1.5 font-bold w-20 text-center">LC 116</th>
                  <th className="px-2.5 py-1.5 font-bold w-32">NBS (Código)</th>
                  <th className="px-2.5 py-1.5 font-bold">Atividade / Descrição do Serviço</th>
                  <th className="px-2.5 py-1.5 font-bold w-28 text-center">CNAE Principal</th>
                  <th className="px-2.5 py-1.5 font-bold w-52">Reforma Tributária (IBS/CBS)</th>
                  <th className="px-2.5 py-1.5 font-bold w-28 text-center">Ação</th>
                </tr>
              </thead>
              <tbody>
                {atividadesFiltradas.length > 0 ? (
                  atividadesFiltradas.map((atv) => {
                    const isCurrent =
                      (currentNbs && (currentNbs.replace(/\D/g, "") === atv.nbsCodigo)) ||
                      (currentItemLc116 && currentItemLc116 === atv.itemLc116 && !currentNbs);
                    const isSelectedInModal = selectedAtividade?.id === atv.id;

                    return (
                      <tr
                        key={atv.id}
                        onClick={() => setSelectedAtividade(atv)}
                        onDoubleClick={() => handleConfirmAtividade(atv)}
                        className={`border-b border-[#e5e5e5] cursor-pointer transition-colors ${
                          isSelectedInModal
                            ? "bg-[#dbeafe] hover:bg-[#cbe2fe]"
                            : isCurrent
                            ? "bg-[#ecfdf5] hover:bg-[#d1fae5]"
                            : "hover:bg-[#f5f8fc]"
                        }`}
                      >
                        {/* Item LC 116 */}
                        <td className="px-2.5 py-1.5 text-center">
                          <span className="font-mono font-bold text-[#003366] bg-[#eef3f9] px-1.5 py-0.5 rounded border border-[#ccddee]">
                            {atv.itemLc116}
                          </span>
                        </td>

                        {/* NBS Formatado e Código Puro */}
                        <td className="px-2.5 py-1.5">
                          <div className="font-mono font-bold text-[#111111]">{atv.nbs}</div>
                          <div className="font-mono text-[9.5px] text-[#666666]">
                            Cód: {atv.nbsCodigo}
                          </div>
                        </td>

                        {/* Descrição da Atividade */}
                        <td className="px-2.5 py-1.5">
                          <div className="font-bold text-[#222222] leading-snug">
                            {atv.descricaoNbs}
                          </div>
                          <div className="text-[10px] text-[#555555] flex items-center gap-1 mt-0.5">
                            <span className="text-[#888888]">{atv.grupoDescricao}</span>
                          </div>
                        </td>

                        {/* CNAE Principal */}
                        <td className="px-2.5 py-1.5 text-center">
                          <span className="font-mono text-[10px] bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded border border-slate-300 font-semibold">
                            {atv.cnaePrincipal}
                          </span>
                        </td>

                        {/* Parâmetros da Reforma Tributária (NT 004) */}
                        <td className="px-2.5 py-1.5">
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="font-mono font-bold text-blue-900 bg-blue-50 px-1 py-0.2 rounded border border-blue-200" title="Indicador de Operação (cIndOp)">
                              Op: {atv.cIndOp}
                            </span>
                            <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200" title="Classificação Tributária IBS/CBS (cClassTrib)">
                              Class: {atv.cClassTrib}
                            </span>
                          </div>
                          <div className="text-[9.5px] text-[#555555] truncate max-w-xs mt-0.5" title={atv.classificacaoIbsCbs}>
                            {atv.classificacaoIbsCbs}
                          </div>
                        </td>

                        {/* Botão Selecionar */}
                        <td className="px-2.5 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConfirmAtividade(atv);
                            }}
                            className="vb-btn vb-btn-primary py-0.5 px-2 flex items-center justify-center gap-1 w-full text-[10.5px]"
                          >
                            <Check size={11} className="text-white" />
                            <span>Selecionar</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-[#777777]">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Search size={22} className="text-[#aaaaaa]" />
                        <span className="font-semibold">Nenhuma atividade encontrada com o termo "{termoBusca}".</span>
                        <span className="text-[10px] text-[#888888]">Tente buscar por termos mais genéricos como "médico", "software", "construção" ou "limpeza".</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Rodapé de Ações e Detalhes da Seleção */}
        <div className="bg-[#f0f0f0] border-t border-[#b0b0b0] p-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex-1 min-w-[280px]">
            {activeTab === "nacional" ? (
              selectedServicoNac ? (
                <div className="flex flex-col gap-0.5 text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#003366] font-mono bg-[#eef3f9] px-2 py-0.5 rounded border border-[#ccddee]">
                      cTribNac: {selectedServicoNac.codigo}
                    </span>
                    <span className="font-mono text-[#555555]">
                      LC {selectedServicoNac.itemLc116}
                    </span>
                    <span className="text-[#333333] font-semibold truncate max-w-md">
                      {selectedServicoNac.descricao}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-[#666666]">
                    Grupo: {selectedServicoNac.grupo} - {selectedServicoNac.grupoDescricao}
                  </div>
                </div>
              ) : (
                <div className="text-[#666666] text-[10.5px] italic flex items-center gap-1">
                  <span>Dica: Dê duplo clique em qualquer linha para selecionar imediatamente o serviço de 6 dígitos.</span>
                </div>
              )
            ) : (
              selectedAtividade ? (
                <div className="flex flex-col gap-0.5 text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#003366] font-mono bg-[#eef3f9] px-1.5 py-0.5 rounded border border-[#ccddee]">
                      LC {selectedAtividade.itemLc116}
                    </span>
                    <span className="font-mono font-bold text-emerald-800">
                      NBS: {selectedAtividade.nbs}
                    </span>
                    <span className="text-[#333333] font-semibold truncate max-w-md">
                      {selectedAtividade.descricaoNbs}
                    </span>
                  </div>
                  <div className="text-[9.5px] text-[#666666] font-mono">
                    cIndOp: {selectedAtividade.cIndOp} | cClassTrib: {selectedAtividade.cClassTrib}
                  </div>
                </div>
              ) : (
                <div className="text-[#666666] text-[10.5px] italic flex items-center gap-1">
                  <span>Dica: Dê duplo clique em qualquer linha para selecionar imediatamente.</span>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="vb-btn px-3 py-1 text-[11px]"
            >
              Cancelar
            </button>

            {activeTab === "nacional" ? (
              <button
                type="button"
                disabled={!selectedServicoNac}
                onClick={() => selectedServicoNac && handleConfirmServicoNacional(selectedServicoNac)}
                className="vb-btn vb-btn-success px-4 py-1 font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={12} />
                <span>Confirmar Serviço (6 Dígitos)</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!selectedAtividade}
                onClick={() => selectedAtividade && handleConfirmAtividade(selectedAtividade)}
                className="vb-btn vb-btn-success px-4 py-1 font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={12} />
                <span>Confirmar Atividade Selecionada</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
