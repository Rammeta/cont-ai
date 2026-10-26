import React, { useState, useMemo } from "react";
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
  Info
} from "lucide-react";
import {
  TABELA_CORRELACAO_NBS,
  GRUPOS_ATIVIDADES,
  AtividadeNbsCorrelacao
} from "../data/tabelaCorrelacaoNbs";

interface NfseAtividadesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAtividade: (atividade: AtividadeNbsCorrelacao) => void;
  currentNbs?: string;
  currentItemLc116?: string;
}

export default function NfseAtividadesModal({
  isOpen,
  onClose,
  onSelectAtividade,
  currentNbs = "",
  currentItemLc116 = ""
}: NfseAtividadesModalProps) {
  const [termoBusca, setTermoBusca] = useState("");
  const [grupoFiltro, setGrupoFiltro] = useState<string>("TODOS");
  const [selectedAtividade, setSelectedAtividade] = useState<AtividadeNbsCorrelacao | null>(null);

  // Filtra as atividades
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

  const handleConfirmSelection = (atv: AtividadeNbsCorrelacao) => {
    onSelectAtividade(atv);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none p-2 sm:p-4 font-sans text-[11px]">
      <div className="w-full max-w-5xl bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl flex flex-col h-[90vh] max-h-[750px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        
        {/* Titlebar Clássico Windows / ERP */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-sky-300" />
            <span>CONT-AI - [ Tabela Oficial de Correlação: Atividades x NBS x LC 116 x IBS / CBS ]</span>
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

        {/* Subheader Informativo */}
        <div className="bg-[#e9f0f8] border-b border-[#b5c7de] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0 text-[#224466]">
          <div className="flex items-center gap-1.5">
            <Info size={13} className="text-[#005a9e]" />
            <span>
              Selecione a <strong>atividade do serviço prestado</strong> para preencher automaticamente o código <strong>NBS (9 dígitos)</strong>, 
              o <strong>Item da LC 116</strong> e os parâmetros da <strong>Reforma Tributária (IBS/CBS - cIndOp e cClassTrib)</strong>.
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#446688] font-semibold">
            {TABELA_CORRELACAO_NBS.length} atividades cadastradas
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
                placeholder="Buscar por nome da atividade, NBS, LC 116 (ex: 04.16, 17.01) ou CNAE..."
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
                className="vb-select max-w-[240px] text-[11px]"
              >
                <option value="TODOS">Todos os Grupos ({TABELA_CORRELACAO_NBS.length})</option>
                {GRUPOS_ATIVIDADES.map((g) => (
                  <option key={g.codigo} value={g.codigo}>
                    {g.codigo} - {g.nome} ({g.total})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contador de Resultados */}
          <div className="text-[10.5px] text-[#444444] font-medium">
            Exibindo <strong>{atividadesFiltradas.length}</strong> de {TABELA_CORRELACAO_NBS.length}
          </div>
        </div>

        {/* Grade / Tabela de Atividades */}
        <div className="flex-1 overflow-y-auto bg-white border-b border-[#b0b0b0]">
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
                      onDoubleClick={() => handleConfirmSelection(atv)}
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
                            handleConfirmSelection(atv);
                          }}
                          className="vb-btn vb-btn-primary py-0.5 px-2 flex items-center justify-center gap-1 w-full text-[10.5px]"
                        >
                          <Check size={11} className="text-emerald-700" />
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
        </div>

        {/* Rodapé com Detalhes da Seleção e Ações */}
        <div className="bg-[#f0f0f0] border-t border-[#b0b0b0] p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex-1 min-w-[280px]">
            {selectedAtividade ? (
              <div className="bg-white border border-[#b5c7de] p-1.5 rounded flex items-center justify-between gap-3 text-[10.5px]">
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

            <button
              type="button"
              disabled={!selectedAtividade}
              onClick={() => selectedAtividade && handleConfirmSelection(selectedAtividade)}
              className="vb-btn vb-btn-success px-4 py-1 font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={12} />
              <span>Confirmar Atividade Selecionada</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
