import React, { useState, useEffect } from "react";
import {
  Plus,
  Copy,
  Trash2,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  FileText,
  Sliders,
  DollarSign,
  ShieldCheck,
  Building2,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { NfseModeloNota } from "../types";
import NfseAtividadesModal from "./NfseAtividadesModal";
import {
  AtividadeNbsCorrelacao,
  TABELA_CORRELACAO_NBS,
  OPCOES_CTRIB_NAC,
  OPCOES_NBS,
  OPCOES_CTRIB_MUN,
  OPCOES_CINDOP,
  OPCOES_CCLASSTRIB,
  ComboboxOption
} from "../data/tabelaCorrelacaoNbs";
import { NfseComboboxField } from "./NfseComboboxField";

interface NfsePadroesManagerProps {
  modelos: NfseModeloNota[];
  onSaveModelos: (modelos: NfseModeloNota[]) => void;
  onNotify?: (text: string, type: "success" | "error") => void;
  initialSelectedId?: string | null;
  onSelectAndApply?: (modelo: NfseModeloNota) => void;
  onClose?: () => void;
  isModal?: boolean;
}

const CST_PIS_COFINS_OPTIONS = [
  { value: "(não informado)", label: "(não informado)" },
  { value: "01", label: "01 - Operação Tributável com Alíquota Básica" },
  { value: "02", label: "02 - Operação Tributável com Alíquota Diferenciada" },
  { value: "03", label: "03 - Operação Tributável com Alíquota por Unidade de Medida" },
  { value: "04", label: "04 - Operação Tributável Monofásica - Revenda a Alíquota Zero" },
  { value: "05", label: "05 - Operação Tributável por Substituição Tributária" },
  { value: "06", label: "06 - Operação Tributável a Alíquota Zero" },
  { value: "07", label: "07 - Operação Isenta da Contribuição" },
  { value: "08", label: "08 - Operação sem Incidência da Contribuição" },
  { value: "09", label: "09 - Operação com Suspensão da Contribuição" },
  { value: "49", label: "49 - Outras Operações de Saída" },
  { value: "99", label: "99 - Outras Operações" },
];

const TRIB_ISSQN_OPTIONS = [
  "1 - Operação tributável",
  "2 - Exportação de serviço",
  "3 - Não Incidência",
  "4 - Imunidade",
  "5 - Isenção",
];

const TP_RET_ISSQN_OPTIONS = [
  "1 - Não retido",
  "2 - Retido pelo tomador",
  "3 - Retido pelo intermediário",
];

export default function NfsePadroesManager({
  modelos,
  onSaveModelos,
  onNotify,
  initialSelectedId,
  onSelectAndApply,
  onClose,
  isModal = false,
}: NfsePadroesManagerProps) {
  // Estado de seleção e busca na lista da esquerda
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || (modelos.length > 0 ? modelos[0].id : "novo")
  );
  const [searchFilter, setSearchFilter] = useState("");

  // Formulário do Painel da Direita (Ajuste do Padrão / Novo Padrão)
  const [nome, setNome] = useState("");
  const [cTribNac, setCTribNac] = useState("");
  const [cNBS, setCNBS] = useState("");
  const [cTribMun, setCTribMun] = useState("000");
  const [descricao, setDescricao] = useState("");
  const [temDesconto, setTemDesconto] = useState(false);
  const [pedeInfoComplementares, setPedeInfoComplementares] = useState(false);
  const [tribISSQN, setTribISSQN] = useState("1 - Operação tributável");
  const [tpRetISSQN, setTpRetISSQN] = useState("1 - Não retido");
  const [aliquotaIss, setAliquotaIss] = useState("5,00");
  const [cLocPrestacao, setLocPrestacao] = useState("No endereço do prestador");
  const [cLocPrestacaoOutroMun, setLocPrestacaoOutroMun] = useState("");
  const [vRetCP, setVRetCP] = useState("");
  const [cstPisCofins, setCstPisCofins] = useState("(não informado)");
  const [temIbsCbs, setTemIbsCbs] = useState(true);
  const [cIndOp, setCIndOp] = useState("010101");
  const [cClassTrib, setCClassTrib] = useState("000001");
  const [isAtividadesModalOpen, setIsAtividadesModalOpen] = useState(false);

  const handleSelectAtividade = (atv: AtividadeNbsCorrelacao) => {
    setCNBS(atv.nbsCodigo);
    setTemIbsCbs(true);
    if (atv.cIndOp) setCIndOp(atv.cIndOp);
    if (atv.cClassTrib) setCClassTrib(atv.cClassTrib);

    const rawLc = atv.itemLc116.replace(/\D/g, "");
    if (rawLc && rawLc.length <= 4) {
      setCTribNac(rawLc.padEnd(6, "0"));
    }

    if (!descricao.trim()) {
      setDescricao(`PRESTAÇÃO DE SERVIÇOS: ${atv.descricaoNbs.toUpperCase()}.`);
    }
    if (!nome.trim() || nome === "Novo Padrão") {
      setNome(atv.descricaoNbs);
    }
    if (onNotify) {
      onNotify(`Atividade "${atv.descricaoNbs}" aplicada! NBS ${atv.nbs} e parâmetros IBS/CBS configurados.`, "success");
    }
  };

  const nbsRecomendadas = React.useMemo(() => {
    if (!cTribNac.trim()) return [];
    const rawLc = cTribNac.replace(/\D/g, "");
    const matchingAtividades = TABELA_CORRELACAO_NBS.filter((item) => {
      const itemRaw = (item.itemLc116 || "").replace(/\D/g, "");
      return itemRaw && rawLc.startsWith(itemRaw);
    });

    const setRec = new Set<string>();
    for (const atv of matchingAtividades) {
      if (atv.nbsCodigo) setRec.add(atv.nbsCodigo);
      if (atv.todasNbsItem) {
        atv.todasNbsItem.forEach((n) => setRec.add(n.replace(/\D/g, "")));
      }
    }
    return Array.from(setRec);
  }, [cTribNac]);

  // Carrega os dados no formulário ao mudar o item selecionado
  useEffect(() => {
    if (selectedId === "novo") {
      setNome("");
      setCTribNac("");
      setCNBS("");
      setCTribMun("000");
      setDescricao("");
      setTemDesconto(false);
      setPedeInfoComplementares(false);
      setTribISSQN("1 - Operação tributável");
      setTpRetISSQN("1 - Não retido");
      setAliquotaIss("5,00");
      setLocPrestacao("No endereço do prestador");
      setLocPrestacaoOutroMun("");
      setVRetCP("");
      setCstPisCofins("(não informado)");
      setTemIbsCbs(true);
      setCIndOp("010101");
      setCClassTrib("000001");
    } else {
      const mod = modelos.find((m) => m.id === selectedId);
      if (mod) {
        setNome(mod.nome || "");
        setCTribNac(mod.cTribNac || "");
        setCNBS(mod.cNBS || "");
        setCTribMun(mod.cTribMun || "000");
        setDescricao(mod.descricao || "");
        setTemDesconto(!!mod.temDesconto);
        setPedeInfoComplementares(!!mod.pedeInfoComplementares);
        setTribISSQN(mod.tribISSQN || "1 - Operação tributável");
        setTpRetISSQN(mod.tpRetISSQN || "1 - Não retido");
        setAliquotaIss(mod.aliquotaIss || "5,00");
        setLocPrestacao(mod.cLocPrestacao || "No endereço do prestador");
        setLocPrestacaoOutroMun(mod.cLocPrestacaoOutroMun || "");
        setVRetCP(mod.vRetCP || "");
        setCstPisCofins(mod.cstPisCofins || "(não informado)");
        setTemIbsCbs(mod.temIbsCbs !== false);
        setCIndOp(mod.cIndOp || "010101");
        setCClassTrib(mod.cClassTrib || "000001");
      }
    }
  }, [selectedId, modelos]);

  // Lista filtrada
  const filteredModelos = modelos.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      m.nome.toLowerCase().includes(q) ||
      (m.cTribNac && m.cTribNac.toLowerCase().includes(q)) ||
      (m.cNBS && m.cNBS.toLowerCase().includes(q)) ||
      (m.descricao && m.descricao.toLowerCase().includes(q))
    );
  });

  const isEditingExisting = selectedId !== "novo";
  const activeModelo = modelos.find((m) => m.id === selectedId);

  // Ação: Iniciar Novo Padrão
  const handleStartNew = () => {
    setSelectedId("novo");
  };

  // Ação: Salvar Padrão (cria ou atualiza)
  const handleSave = () => {
    if (!nome.trim()) {
      if (onNotify) onNotify("Informe o Nome do padrão de emissão.", "error");
      else alert("Informe o Nome do padrão de emissão.");
      return;
    }

    const payload: NfseModeloNota = {
      id: isEditingExisting ? selectedId : "padrao_" + Date.now(),
      nome: nome.trim(),
      cTribNac: cTribNac.trim(),
      cNBS: cNBS.trim(),
      cTribMun: cTribMun.trim() || "000",
      descricao: descricao.trim(),
      temDesconto,
      pedeInfoComplementares,
      tribISSQN,
      tpRetISSQN,
      aliquotaIss: aliquotaIss.trim() || "5,00",
      cLocPrestacao,
      cLocPrestacaoOutroMun: cLocPrestacao === "Outro município" ? cLocPrestacaoOutroMun.trim() : undefined,
      vRetCP: vRetCP.trim(),
      cstPisCofins,
      temIbsCbs,
      cIndOp: temIbsCbs ? cIndOp.trim() : undefined,
      cClassTrib: temIbsCbs ? cClassTrib.trim() : undefined,
    };

    let updatedList: NfseModeloNota[];
    if (isEditingExisting) {
      updatedList = modelos.map((m) => (m.id === selectedId ? payload : m));
      if (onNotify) onNotify(`Padrão "${payload.nome}" atualizado com sucesso!`, "success");
    } else {
      updatedList = [...modelos, payload];
      setSelectedId(payload.id);
      if (onNotify) onNotify(`Novo padrão "${payload.nome}" cadastrado com sucesso!`, "success");
    }

    onSaveModelos(updatedList);
  };

  // Ação: Duplicar Padrão
  const handleDuplicate = () => {
    if (!nome.trim()) return;
    const newId = "padrao_" + Date.now();
    const duplicatedPayload: NfseModeloNota = {
      id: newId,
      nome: `${nome.trim()} (Cópia)`,
      cTribNac: cTribNac.trim(),
      cNBS: cNBS.trim(),
      cTribMun: cTribMun.trim() || "000",
      descricao: descricao.trim(),
      temDesconto,
      pedeInfoComplementares,
      tribISSQN,
      tpRetISSQN,
      aliquotaIss: aliquotaIss.trim() || "5,00",
      cLocPrestacao,
      cLocPrestacaoOutroMun: cLocPrestacao === "Outro município" ? cLocPrestacaoOutroMun.trim() : undefined,
      vRetCP: vRetCP.trim(),
      cstPisCofins,
      temIbsCbs,
      cIndOp: temIbsCbs ? cIndOp.trim() : undefined,
      cClassTrib: temIbsCbs ? cClassTrib.trim() : undefined,
    };

    const updatedList = [...modelos, duplicatedPayload];
    onSaveModelos(updatedList);
    setSelectedId(newId);
    if (onNotify) onNotify(`Padrão duplicado como "${duplicatedPayload.nome}"!`, "success");
  };

  // Ação: Remover Padrão
  const handleRemove = (idToRemove?: string) => {
    const targetId = idToRemove || selectedId;
    if (targetId === "novo") {
      handleStartNew();
      return;
    }
    const targetMod = modelos.find((m) => m.id === targetId);
    if (!targetMod) return;

    if (!window.confirm(`Deseja realmente excluir o padrão de emissão "${targetMod.nome}"?`)) {
      return;
    }

    const updatedList = modelos.filter((m) => m.id !== targetId);
    onSaveModelos(updatedList);
    if (onNotify) onNotify(`Padrão "${targetMod.nome}" excluído.`, "success");

    if (updatedList.length > 0) {
      setSelectedId(updatedList[0].id);
    } else {
      setSelectedId("novo");
    }
  };

  return (
    <div className={`flex flex-col h-full bg-[#f0f0f0] text-[11px] select-none ${isModal ? "p-0" : ""}`}>
      {/* Sub-Header de Orientação */}
      <div className="bg-[#e6f0fa] border-b border-[#b8d4f6] px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag size={13} className="text-[#005a9e]" />
          <span className="font-bold text-[#003366]">Gerenciamento de Padrões de Emissão (NFS-e)</span>
          <span className="text-[#666666] text-[10px]">
            — Selecione um padrão à esquerda para visualizar/ajustar ou crie novos modelos para agilizar a emissão diária.
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[#666666] hover:text-red-700 font-bold px-1.5 py-0.5 rounded hover:bg-white"
          >
            ✕ Fechar
          </button>
        )}
      </div>

      {/* Main Split Layout: Esquerda (Lista de Padrões) | Direita (Painel de Ajuste) */}
      <div className="flex-1 flex overflow-hidden min-h-[460px]">
        {/* ======================================================== */}
        {/* COLUNA ESQUERDA: LISTA DE PADRÕES EXISTENTES             */}
        {/* ======================================================== */}
        <aside className="w-80 shrink-0 border-r border-[#b0b0b0] bg-[#fafafa] flex flex-col justify-between">
          {/* Top Bar da Lista: Título e Botão "+ Novo Padrão" */}
          <div className="p-2 border-b border-[#d0d0d0] bg-[#f0f0f0] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#333333] flex items-center gap-1">
                <span>Padrões Cadastrados</span>
                <span className="bg-[#003366] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {modelos.length}
                </span>
              </span>

              <button
                type="button"
                onClick={handleStartNew}
                className={`vb-btn font-bold flex items-center gap-1 ${
                  selectedId === "novo" ? "bg-[#dbeafe] border-[#005a9e] text-[#003366]" : "text-[#003366]"
                }`}
                title="Cadastrar novo padrão de emissão"
              >
                <Plus size={12} className="text-emerald-700" />
                <span>+ Novo Padrão</span>
              </button>
            </div>

            {/* Input de Busca / Filtro Rápido */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome ou código..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="vb-input w-full pl-6 text-[10px]"
              />
              <Search size={11} className="absolute left-1.5 top-1.5 text-[#888888]" />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter("")}
                  className="absolute right-1.5 top-1 text-[#888888] hover:text-black font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Lista com Rolagem dos Padrões */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {/* Opção Rápida de "+ Criar Novo Padrão" se selecionado */}
            {selectedId === "novo" && (
              <div className="p-2 bg-[#dbeafe] border-2 border-[#005a9e] rounded shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 animate-pulse" />
                <div className="flex-1">
                  <div className="font-bold text-[#003366] text-[11px]">Novo Padrão de Emissão</div>
                  <div className="text-[10px] text-[#555555]">Preencha o formulário ao lado para salvar</div>
                </div>
              </div>
            )}

            {filteredModelos.length > 0 ? (
              filteredModelos.map((m) => {
                const isSelected = selectedId === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className={`p-2 border rounded cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#dbeafe] border-[#005a9e] shadow-sm text-[#003366]"
                        : "bg-white border-[#d0d0d0] hover:bg-[#f0f4f9] text-[#222222]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-bold text-[11px] leading-tight line-clamp-2">
                        {m.nome}
                      </div>
                      {isSelected && (
                        <ChevronRight size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      )}
                    </div>

                    {/* Linha de Badges de Códigos Fiscais */}
                    <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                      {m.cTribNac && (
                        <span className="font-mono bg-[#e0ecf8] text-[#003366] px-1 py-0.2 rounded border border-[#b8d4f6]">
                          Trib: {m.cTribNac}
                        </span>
                      )}
                      {m.cNBS && (
                        <span className="font-mono text-[#666666] bg-[#f0f0f0] px-1 py-0.2 rounded">
                          NBS: {m.cNBS}
                        </span>
                      )}
                      {m.temIbsCbs && (
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                          IBS/CBS
                        </span>
                      )}
                    </div>

                    {/* Descrição resumida */}
                    {m.descricao && (
                      <div className="text-[10px] text-[#666666] truncate mt-1 italic">
                        {m.descricao}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-[#777777] italic text-[10px]">
                {searchFilter ? "Nenhum padrão encontrado para a busca." : "Nenhum padrão cadastrado. Clique acima em '+ Novo Padrão' para começar."}
              </div>
            )}
          </div>

          {/* Rodapé da Coluna Esquerda: Ações Rápidas (Duplicar e Excluir) */}
          <div className="p-1.5 border-t border-[#d0d0d0] bg-[#e8e8e8] flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handleDuplicate}
              disabled={!isEditingExisting}
              className="vb-btn flex-1 justify-center disabled:opacity-40"
              title="Duplica as configurações do padrão selecionado"
            >
              <Copy size={11} />
              <span>Duplicar</span>
            </button>
            <button
              type="button"
              onClick={() => handleRemove()}
              disabled={!isEditingExisting}
              className="vb-btn text-red-700 hover:text-red-800 disabled:opacity-40"
              title="Exclui o padrão selecionado"
            >
              <Trash2 size={11} />
              <span>Excluir</span>
            </button>
          </div>
        </aside>

        {/* ======================================================== */}
        {/* COLUNA DIREITA: PAINEL DE AJUSTE / NOVO PADRÃO DE EMISSÃO */}
        {/* ======================================================== */}
        <main className="flex-1 overflow-y-auto p-3 flex flex-col justify-between bg-[#f4f4f4]">
          <div className="flex flex-col gap-2.5">
            {/* Barra de Título do Painel de Ajuste com Ações */}
            <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                {isEditingExisting ? (
                  <Settings size={16} className="text-[#005a9e]" />
                ) : (
                  <FileText size={16} className="text-[#005a9e]" />
                )}
                <div>
                  <h2 className="font-bold text-[#003366] text-[12px] flex items-center gap-1.5">
                    <span>
                      {isEditingExisting
                        ? `Ajuste do Padrão de Emissão: "${activeModelo?.nome}"`
                        : "Novo Padrão de Emissão (Modelo Pré-definido)"}
                    </span>
                  </h2>
                  <span className="text-[10px] text-[#666666]">
                    Configure as informações fiscais para preenchimento automático na emissão da DPS.
                  </span>
                </div>
              </div>

              {/* Botões Superiores de Ação Rápida */}
              <div className="flex items-center gap-1.5">
                {isEditingExisting && onSelectAndApply && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeModelo) onSelectAndApply(activeModelo);
                    }}
                    className="vb-btn bg-[#e6f4ea] border-emerald-600 text-emerald-800 font-bold"
                    title="Usa este modelo imediatamente na tela de Emissão"
                  >
                    <ExternalLink size={11} />
                    <span>Usar na Emissão</span>
                  </button>
                )}

                {isEditingExisting && (
                  <button
                    type="button"
                    onClick={handleDuplicate}
                    className="vb-btn"
                    title="Duplicar este padrão"
                  >
                    <Copy size={11} />
                    <span>Duplicar Modelo</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="vb-btn bg-[#005a9e] border-[#004578] text-white font-bold hover:bg-[#004578]"
                >
                  <Save size={12} className="text-white" />
                  <span>Salvar Padrão</span>
                </button>
              </div>
            </div>

            {/* SEÇÃO 1: Identificação & Descritivo dos Serviços */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <FileText size={11} />
                <span>1. Identificação do Padrão & Descritivo Geral dos Serviços</span>
              </legend>

              <div className="flex flex-col gap-2 p-1">
                <div>
                  <label className="block font-bold text-[#003366] mb-0.5">
                    Nome do Padrão de Emissão: *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Honorários Mensais de TI, Consultoria Fiscal, Manutenção de Equipamentos..."
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="vb-input w-full font-bold text-[11px]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Descrição Detalhada Padrão dos Serviços Prestados:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Discriminação padrão que será inserida automaticamente no corpo da nota fiscal..."
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="vb-input w-full font-mono text-[11px] leading-relaxed resize-y"
                  />
                </div>

                {/* Opções na Nota (Checkboxes) */}
                <div className="flex items-center gap-4 pt-0.5 bg-[#f9f9f9] border border-[#e0e0e0] p-1.5 rounded">
                  <span className="font-bold text-[#555555] text-[10px]">Comportamento na Emissão:</span>
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#333333]">
                    <input
                      type="checkbox"
                      checked={temDesconto}
                      onChange={(e) => setTemDesconto(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span>Permitir campo de desconto na nota</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#333333]">
                    <input
                      type="checkbox"
                      checked={pedeInfoComplementares}
                      onChange={(e) => setPedeInfoComplementares(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span>Exigir informações complementares do tomador</span>
                  </label>
                </div>
              </div>
            </fieldset>

            {/* SEÇÃO 2: Códigos Fiscais & Classificação Nacional */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <Tag size={11} />
                <span>2. Classificação Fiscal & Códigos Oficiais (Nacional e Municipal)</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1">
                <NfseComboboxField
                  label="cTribNac (Cód. Trib. Nacional):"
                  value={cTribNac}
                  onChange={(val) => {
                    setCTribNac(val);
                    const found = TABELA_CORRELACAO_NBS.find((item) => {
                      const raw = (item.itemLc116 || "").replace(/\D/g, "");
                      return val.replace(/\D/g, "").startsWith(raw);
                    });
                    if (found) {
                      if (!cNBS.trim() && found.nbsCodigo) setCNBS(found.nbsCodigo);
                      if (found.cIndOp) setCIndOp(found.cIndOp);
                      if (found.cClassTrib) setCClassTrib(found.cClassTrib);
                    }
                  }}
                  options={OPCOES_CTRIB_NAC}
                  placeholder="6 dígitos (ex: 010701)"
                  maxLength={6}
                  helpButton={
                    <button
                      type="button"
                      onClick={() => setIsAtividadesModalOpen(true)}
                      className="text-[10px] text-[#005a9e] hover:underline font-bold flex items-center gap-0.5"
                      title="Consultar Tabela Completa de Atividades"
                    >
                      Tabela
                    </button>
                  }
                />

                <NfseComboboxField
                  label="cNBS (Nomenclatura NBS):"
                  value={cNBS}
                  onChange={(val) => setCNBS(val)}
                  options={OPCOES_NBS}
                  recommendedCodes={nbsRecomendadas}
                  placeholder="9 dígitos (ex: 1.1502.10.00)"
                  maxLength={9}
                  helpButton={
                    <button
                      type="button"
                      onClick={() => setIsAtividadesModalOpen(true)}
                      className="text-[10px] text-[#005a9e] hover:underline font-bold flex items-center gap-0.5"
                      title="Consultar Tabela NBS Oficial"
                    >
                      Ver Tabela
                    </button>
                  }
                />

                <NfseComboboxField
                  label="cTribMun (Cód. Municipal):"
                  value={cTribMun}
                  onChange={(val) => setCTribMun(val)}
                  options={OPCOES_CTRIB_MUN}
                  placeholder="000"
                  maxLength={4}
                  panelWidth="min-w-[280px]"
                />
              </div>
            </fieldset>

            {/* SEÇÃO 3: Regras de ISSQN & Local de Prestação */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <DollarSign size={11} />
                <span>3. Regras de Tributação do ISSQN & Local da Prestação</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1">
                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Tributação do ISSQN (tribISSQN):
                  </label>
                  <select
                    value={tribISSQN}
                    onChange={(e) => setTribISSQN(e.target.value)}
                    className="vb-select w-full font-medium"
                  >
                    {TRIB_ISSQN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Retenção do ISSQN (tpRetISSQN):
                  </label>
                  <select
                    value={tpRetISSQN}
                    onChange={(e) => setTpRetISSQN(e.target.value)}
                    className="vb-select w-full font-medium"
                  >
                    {TP_RET_ISSQN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Alíquota Padrão do ISS (%):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="5,00"
                      value={aliquotaIss}
                      onChange={(e) => setAliquotaIss(e.target.value)}
                      className="vb-input w-28 font-mono text-center font-bold"
                    />
                    <span className="text-[#666666] text-[10px]">
                      (Preenchida automaticamente na emissão, podendo ser alterada)
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Local da Prestação (cLocPrestacao):
                  </label>
                  <div className="flex items-center gap-3 mt-1">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="cLocPrestacao_radio"
                        checked={cLocPrestacao === "No endereço do prestador"}
                        onChange={() => setLocPrestacao("No endereço do prestador")}
                      />
                      <span>No endereço do prestador</span>
                    </label>

                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="cLocPrestacao_radio"
                        checked={cLocPrestacao === "Outro município"}
                        onChange={() => setLocPrestacao("Outro município")}
                      />
                      <span>Outro município</span>
                    </label>
                  </div>

                  {cLocPrestacao === "Outro município" && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        type="text"
                        maxLength={7}
                        placeholder="Código IBGE do município (7 dígitos)"
                        value={cLocPrestacaoOutroMun}
                        onChange={(e) => setLocPrestacaoOutroMun(e.target.value)}
                        className="vb-input w-48 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>
            </fieldset>

            {/* SEÇÃO 4: Retenções Federais & PIS/COFINS */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <Sliders size={11} />
                <span>4. Retenções Federais & Situação Tributária (PIS / COFINS / INSS)</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1">
                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    vRetCP (%) — Retenção Contribuição Previdenciária (INSS):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="0,00"
                      value={vRetCP}
                      onChange={(e) => setVRetCP(e.target.value)}
                      className="vb-input w-28 font-mono text-right"
                    />
                    <span className="text-[#666666] text-[10px]">
                      Percentual de retenção para tomadores quando aplicável.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    CST PIS/COFINS (Situação Tributária):
                  </label>
                  <select
                    value={cstPisCofins}
                    onChange={(e) => setCstPisCofins(e.target.value)}
                    className="vb-select w-full"
                  >
                    {CST_PIS_COFINS_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {/* SEÇÃO 5: Reforma Tributária (IBS / CBS - NT 004) */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <ShieldCheck size={11} />
                <span>5. Reforma Tributária (IBS / CBS - Nota Técnica NT 004)</span>
              </legend>

              <div className="p-1 flex flex-col gap-2">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-[#333333]">
                    Habilitar identificadores da Reforma Tributária (IBS/CBS):
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="temIbsCbs_mgr"
                      checked={temIbsCbs}
                      onChange={() => setTemIbsCbs(true)}
                    />
                    <span className="text-emerald-700">Sim</span>
                  </label>

                  <label className="flex items-center gap-1 cursor-pointer font-bold">
                    <input
                      type="radio"
                      name="temIbsCbs_mgr"
                      checked={!temIbsCbs}
                      onChange={() => setTemIbsCbs(false)}
                    />
                    <span className="text-[#666666]">Não</span>
                  </label>
                </div>

                {temIbsCbs && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t border-[#f0f0f0]">
                    <NfseComboboxField
                      label="cIndOp (Indicador de Operação):"
                      value={cIndOp}
                      onChange={(val) => setCIndOp(val)}
                      options={OPCOES_CINDOP}
                      placeholder="100301"
                      maxLength={6}
                      panelWidth="min-w-[340px] max-w-[440px]"
                    />

                    <NfseComboboxField
                      label="cClassTrib (Classificação Tributária):"
                      value={cClassTrib}
                      onChange={(val) => setCClassTrib(val)}
                      options={OPCOES_CCLASSTRIB}
                      placeholder="000001"
                      maxLength={6}
                      panelWidth="min-w-[340px] max-w-[440px]"
                    />
                  </div>
                )}
              </div>
            </fieldset>
          </div>

          {/* Rodapé do Formulário: Botões de Ação Definitivos */}
          <div className="mt-3 pt-2 border-t border-[#d0d0d0] bg-[#e8e8e8] p-2 flex items-center justify-between">
            <div className="text-[10px] text-[#666666] flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-700" />
              <span>
                {isEditingExisting
                  ? `Editando padrão "${activeModelo?.nome}". As alterações afetam as novas emissões.`
                  : "Criando um novo padrão de emissão. Clique em Salvar para disponibilizá-lo."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartNew}
                className="vb-btn"
                title="Limpa o formulário para um novo cadastro"
              >
                <RotateCcw size={11} />
                <span>Novo Padrão</span>
              </button>

              {isEditingExisting && (
                <button
                  type="button"
                  onClick={handleDuplicate}
                  className="vb-btn"
                  title="Duplica o padrão atual"
                >
                  <Copy size={11} />
                  <span>Duplicar</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSave}
                className="vb-btn bg-[#005a9e] border-[#004578] text-white font-bold hover:bg-[#004578] px-4"
              >
                <Save size={12} className="text-white" />
                <span>Salvar Padrão de Emissão</span>
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Modal de Busca na Tabela Oficial de Atividades & NBS */}
      <NfseAtividadesModal
        isOpen={isAtividadesModalOpen}
        onClose={() => setIsAtividadesModalOpen(false)}
        onSelectAtividade={handleSelectAtividade}
        currentNbs={cNBS}
      />
    </div>
  );
}
