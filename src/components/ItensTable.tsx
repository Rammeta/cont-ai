import React, { useState } from "react";
import { ParsedItem, ItemConsumerOverridesMap, NcmRateRule } from "../types";
import {
  Search,
  Download,
  SlidersHorizontal,
  RotateCcw,
  Check,
  Plus,
  HelpCircle,
  X,
  Calculator,
  Layers,
} from "lucide-react";
import { formatBRL, formatNum, getRegimeLabel } from "../utils/calc";

interface ItensTableProps {
  itens: ParsedItem[];
  itemConsumerOverrides: ItemConsumerOverridesMap;
  onUpdateItemOverride: (itemConfigKey: string, value: string) => void;
  onExport: () => void;
  ncmRateRules: NcmRateRule[];
  onAddNcmRule: (rule: Omit<NcmRateRule, "id">) => void;
  onOpenNcmModal?: (prefill?: {
    ncm?: string;
    ufDest?: string;
    aliqInterna?: number;
    aliqFcp?: number;
    description?: string;
  }) => void;
}

export default function ItensTable({
  itens,
  itemConsumerOverrides,
  onUpdateItemOverride,
  onExport,
  ncmRateRules,
  onAddNcmRule,
  onOpenNcmModal,
}: ItensTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null);
  const [memoryModalItem, setMemoryModalItem] = useState<ParsedItem | null>(null);

  // Filtros Avançados
  const [cfopFilter, setCfopFilter] = useState("TODOS");
  const [ufRemFilter, setUfRemFilter] = useState("TODOS");
  const [ufDestFilter, setUfDestFilter] = useState("TODOS");
  const [modeFilter, setModeFilter] = useState("TODOS");
  const [cstFilter, setCstFilter] = useState("TODOS");
  const [ncmPrefixFilter, setNcmPrefixFilter] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Listas de filtros a partir dos dados carregados
  const uniqueCfops = Array.from(new Set(itens.map((i) => i.cfop).filter(Boolean))).sort();
  const uniqueUfsRem = Array.from(new Set(itens.map((i) => i.ufRem).filter(Boolean))).sort();
  const uniqueUfsDest = Array.from(new Set(itens.map((i) => i.ufDest).filter(Boolean))).sort();
  const uniqueModes = Array.from(new Set(itens.map((i) => i.modeLabel).filter(Boolean))).sort();
  const uniqueCsts = Array.from(new Set(itens.map((i) => i.ocst).filter(Boolean))).sort();

  const isFilteredActive =
    cfopFilter !== "TODOS" ||
    ufRemFilter !== "TODOS" ||
    ufDestFilter !== "TODOS" ||
    modeFilter !== "TODOS" ||
    cstFilter !== "TODOS" ||
    ncmPrefixFilter !== "" ||
    searchTerm !== "";

  const handleResetFilters = () => {
    setSearchTerm("");
    setCfopFilter("TODOS");
    setUfRemFilter("TODOS");
    setUfDestFilter("TODOS");
    setModeFilter("TODOS");
    setCstFilter("TODOS");
    setNcmPrefixFilter("");
  };

  const filtered = itens.filter((i) => {
    // 1. Termo de busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        i.nNF.toLowerCase().includes(term) ||
        i.cProd.toLowerCase().includes(term) ||
        i.xProd.toLowerCase().includes(term) ||
        i.cfop.toLowerCase().includes(term) ||
        i.ncm.toLowerCase().includes(term) ||
        i.memory.toLowerCase().includes(term) ||
        i.cnpjCpfRem.toLowerCase().includes(term) ||
        i.razaoRem.toLowerCase().includes(term) ||
        i.modeLabel.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    // 2. CFOP
    if (cfopFilter !== "TODOS" && i.cfop !== cfopFilter) {
      return false;
    }

    // 3. UF Remetente
    if (ufRemFilter !== "TODOS" && i.ufRem !== ufRemFilter) {
      return false;
    }

    // 4. UF Destino
    if (ufDestFilter !== "TODOS" && i.ufDest !== ufDestFilter) {
      return false;
    }

    // 5. Modo
    if (modeFilter !== "TODOS" && i.modeLabel !== modeFilter) {
      return false;
    }

    // 6. CST
    if (cstFilter !== "TODOS" && i.ocst !== cstFilter) {
      return false;
    }

    // 7. Prefixo NCM
    if (ncmPrefixFilter) {
      const prefixClean = ncmPrefixFilter.replace(/\D/g, "");
      if (prefixClean && !i.ncm.startsWith(prefixClean)) {
        return false;
      }
    }

    return true;
  });

  const getMatchingNcmRule = (item: ParsedItem) => {
    if (!ncmRateRules || ncmRateRules.length === 0 || !item.ncm) return null;
    const cleanItemNcm = String(item.ncm).replace(/\D/g, "");
    const matchingRules = ncmRateRules.filter((rule) => {
      const cleanRuleNcm = String(rule.ncm || "").replace(/\D/g, "");
      const ufMatch =
        !rule.ufDest ||
        rule.ufDest === "TODOS" ||
        rule.ufDest.toUpperCase() === String(item.ufDest || "").toUpperCase();
      const ncmMatch = cleanItemNcm.startsWith(cleanRuleNcm) && cleanRuleNcm.length > 0;
      return ufMatch && ncmMatch;
    });

    if (matchingRules.length > 0) {
      matchingRules.sort((a, b) => {
        const lenA = String(a.ncm || "").replace(/\D/g, "").length;
        const lenB = String(b.ncm || "").replace(/\D/g, "").length;
        if (lenA !== lenB) return lenB - lenA;
        const isSpecificA = a.ufDest && a.ufDest !== "TODOS";
        const isSpecificB = b.ufDest && b.ufDest !== "TODOS";
        if (isSpecificA && !isSpecificB) return -1;
        if (!isSpecificA && isSpecificB) return 1;
        return 0;
      });
      return matchingRules[0];
    }
    return null;
  };

  const selectedItem =
    itens.find((i) => `${i.arquivo}__${i.nNF}__${i.itemSeq}` === selectedItemKey) ||
    (filtered.length > 0 ? filtered[0] : null);

  const selectedItemOverride = selectedItem
    ? itemConsumerOverrides[selectedItem.itemConfigKey] || "auto"
    : "auto";

  const selectedItemMatchingRule = selectedItem ? getMatchingNcmRule(selectedItem) : null;

  return (
    <div className="flex flex-col flex-1 h-full gap-2 text-[11px]" id="panelItens">
      {/* 1. GroupBox de Filtros de Pesquisa e Classificação */}
      <fieldset className="vb-groupbox m-0">
        <legend className="vb-legend">Filtros da Relação Analítica de Itens</legend>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">Pesquisar:</span>
              <input
                type="text"
                id="filtroItens"
                placeholder="Código, descrição, NF-e, NCM..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="vb-input min-w-[210px]"
              />
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">CFOP:</span>
              <select
                value={cfopFilter}
                onChange={(e) => setCfopFilter(e.target.value)}
                className="vb-input font-semibold"
              >
                <option value="TODOS">Todos os CFOPs</option>
                {uniqueCfops.map((c) => (
                  <option key={`cfop_${c}`} value={c}>
                    CFOP {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">UF Origem:</span>
              <select
                value={ufRemFilter}
                onChange={(e) => setUfRemFilter(e.target.value)}
                className="vb-input font-semibold"
              >
                <option value="TODOS">Todas Origens</option>
                {uniqueUfsRem.map((uf) => (
                  <option key={`ufrem_${uf}`} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">UF Destino:</span>
              <select
                value={ufDestFilter}
                onChange={(e) => setUfDestFilter(e.target.value)}
                className="vb-input font-semibold"
              >
                <option value="TODOS">Todos Destinos</option>
                {uniqueUfsDest.map((uf) => (
                  <option key={`ufdest_${uf}`} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`vb-btn ${showAdvanced || isFilteredActive ? "vb-btn-primary" : ""}`}
            >
              <SlidersHorizontal size={11} />
              <span>{showAdvanced ? "Ocultar Filtros" : "Mais Filtros"}</span>
            </button>

            {isFilteredActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="vb-btn"
                title="Limpar todos os filtros"
              >
                <RotateCcw size={11} />
                <span>Limpar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#555555]">
              Mostrando <strong>{filtered.length}</strong> de <strong>{itens.length}</strong> item(ns)
            </span>
          </div>
        </div>

        {/* Filtros Avançados Expansíveis */}
        {showAdvanced && (
          <div className="mt-2 pt-2 border-t border-[#d8d8d8] grid grid-cols-1 sm:grid-cols-3 gap-2 text-[10px]">
            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">Enquadramento / Modo:</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value)}
                className="vb-input w-full"
              >
                <option value="TODOS">Todos os Enquadramentos</option>
                {uniqueModes.map((m) => (
                  <option key={`mode_${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">CST / CSOSN:</span>
              <select
                value={cstFilter}
                onChange={(e) => setCstFilter(e.target.value)}
                className="vb-input w-full"
              >
                <option value="TODOS">Todos os CSTs</option>
                {uniqueCsts.map((cst) => (
                  <option key={`cst_${cst}`} value={cst}>
                    {cst}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">NCM (Começa com):</span>
              <input
                type="text"
                placeholder="Ex: 8471"
                value={ncmPrefixFilter}
                onChange={(e) => setNcmPrefixFilter(e.target.value)}
                className="vb-input w-full"
              />
            </div>
          </div>
        )}
      </fieldset>

      {/* 2. GroupBox do Item Selecionado na Grid com Ações e Memória */}
      {selectedItem && (
        <fieldset className="vb-groupbox m-0">
          <legend className="vb-legend">Detalhes e Customizações do Item Selecionado</legend>
          <div className="flex flex-col gap-1.5 bg-[#ffffff] border border-[#d0d0d0] p-1.5">
            {/* Linha 1: Metadados do Produto */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeeeee] pb-1">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <span className="text-[10px] text-[#666666]">NF-e:</span>
                  <span className="font-bold text-[#003366] ml-1">
                    {selectedItem.nNF} (#{selectedItem.itemSeq})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666]">Produto:</span>
                  <span
                    className="font-bold text-[#222222] ml-1 truncate max-w-sm inline-block align-bottom"
                    title={selectedItem.xProd}
                  >
                    [{selectedItem.cProd}] {selectedItem.xProd}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666]">NCM:</span>
                  <span className="font-mono font-bold text-[#333333] ml-1">{selectedItem.ncm}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666]">CFOP:</span>
                  <span className="font-mono font-bold text-[#333333] ml-1">{selectedItem.cfop}</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666]">Rota:</span>
                  <span className="font-bold text-[#003366] ml-1">
                    {selectedItem.ufRem} ➔ {selectedItem.ufDest}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#666666]">Enquadramento:</span>
                  <span className="font-semibold text-[#885500] ml-1">
                    {selectedItem.modeLabel}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div>
                  <span className="text-[10px] text-[#666666]">Total a Recolher:</span>
                  <span className="font-mono font-bold text-[#003366] bg-[#e6f2ff] px-1.5 py-0.5 ml-1 border border-[#b3d7ff]">
                    {formatBRL(selectedItem.totalRecolher)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMemoryModalItem(selectedItem)}
                  className="vb-btn vb-btn-primary"
                  title="Abrir detalhes analíticos da fórmula de cálculo"
                >
                  <Calculator size={11} className="text-[#005a9e]" />
                  <span>Ver Memória Completa</span>
                </button>
              </div>
            </div>

            {/* Linha 2: Parâmetros Editáveis (Override e Regra NCM) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-[#333333]">Consumidor Final:</span>
                  <select
                    value={selectedItemOverride}
                    onChange={(e) =>
                      onUpdateItemOverride(selectedItem.itemConfigKey, e.target.value)
                    }
                    className="vb-input font-semibold"
                  >
                    <option value="auto">Automático ({selectedItem.consumerFinalSource})</option>
                    <option value="yes">Sim (Consumidor Final - DIFAL)</option>
                    <option value="no">Não (Revenda/Industrialização - Antecipação)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 border-l border-[#d0d0d0] pl-2">
                  <span className="font-semibold text-[#333333]">Regra Alíquota NCM:</span>
                  {selectedItemMatchingRule ? (
                    <div className="flex items-center gap-1">
                      <span
                        className="bg-[#eef5fc] border border-[#99bce8] text-[#003366] px-1.5 py-0.5 text-[10px] font-bold"
                        title={`Regra cadastrada para NCM ${selectedItemMatchingRule.ncm} e UF ${selectedItemMatchingRule.ufDest}`}
                      >
                        Regra Ativa: {formatNum(selectedItemMatchingRule.aliqInterna, 2)}% Interna
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenNcmModal?.({
                            ncm: selectedItem.ncm,
                            ufDest: selectedItem.ufDest || "TODOS",
                            aliqInterna: selectedItem.aliqInterna,
                            aliqFcp: selectedItem.aliqFcp || 0,
                            description: `[${selectedItem.cProd}] ${selectedItem.xProd} (NF-e ${selectedItem.nNF})`,
                          })
                        }
                        className="vb-btn text-[9px] py-0 px-1.5"
                        title="Abrir painel para alterar ou duplicar esta regra"
                      >
                        <Layers size={10} className="text-[#005a9e]" />
                        <span>Gerenciar Regra</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenNcmModal?.({
                          ncm: selectedItem.ncm,
                          ufDest: selectedItem.ufDest || "TODOS",
                          aliqInterna: selectedItem.aliqInterna,
                          aliqFcp: selectedItem.aliqFcp || 0,
                          description: `[${selectedItem.cProd}] ${selectedItem.xProd} (NF-e ${selectedItem.nNF})`,
                        })
                      }
                      className="vb-btn vb-btn-primary"
                      title={`Abrir painel de regras com NCM ${selectedItem.ncm} e produto preenchidos`}
                    >
                      <Plus size={11} className="text-[#107c41]" />
                      <span>Salvar Regra NCM {selectedItem.ncm} ({formatNum(selectedItem.aliqInterna, 2)}%)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Memória Resumida */}
              <div className="flex items-center gap-1 text-[10px] font-mono text-[#555555] bg-[#f9f9f9] border border-[#e0e0e0] px-2 py-0.5 truncate max-w-lg" title={selectedItem.memory}>
                <span className="font-semibold text-[#003366]">Fórmula:</span>
                <span className="truncate">{selectedItem.memoryShort || selectedItem.memory}</span>
              </div>
            </div>
          </div>
        </fieldset>
      )}

      {/* 3. DataGrid Clássica de Itens de Mercadorias */}
      <div className="border border-[#999999] bg-[#ffffff] flex-1 flex flex-col min-h-[320px] overflow-hidden">
        <div className="bg-[#f0f0f0] border-b border-[#c0c0c0] px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#003366]">
          <span>Relação Analítica de Mercadorias ({filtered.length} registro(s))</span>
          <span className="text-[10px] text-[#555555]">
            Clique em uma linha para selecionar | Botão [?] para ver a memória de cálculo
          </span>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="datagrid-table min-w-[3250px]" id="tabelaItens">
            <thead>
              <tr>
                <th style={{ width: "85px" }}>NF-e</th>
                <th style={{ width: "45px", textAlign: "center" }}>Seq</th>
                <th style={{ width: "95px" }}>Data Emissão</th>
                <th style={{ width: "135px", textAlign: "center" }}>Enquadramento</th>
                <th style={{ width: "155px" }}>Consumidor-Final?</th>
                <th style={{ width: "130px" }}>Regime Emitente</th>
                <th style={{ width: "50px", textAlign: "center" }}>UF Rem</th>
                <th style={{ width: "50px", textAlign: "center" }}>UF Dest</th>
                <th style={{ width: "105px" }}>Cód. Produto</th>
                <th style={{ minWidth: "260px" }}>Descrição do Produto / Serviço</th>
                <th style={{ width: "85px" }}>NCM/SH</th>
                <th style={{ width: "55px", textAlign: "center" }}>O/CST</th>
                <th style={{ width: "55px", textAlign: "center" }}>CFOP</th>
                <th style={{ width: "200px" }}>Descrição CFOP</th>
                <th style={{ width: "45px", textAlign: "center" }}>UN</th>
                <th style={{ width: "80px", textAlign: "right" }}>Qtd</th>
                <th style={{ width: "85px", textAlign: "right" }}>Val. Unit.</th>
                <th style={{ width: "95px", textAlign: "right" }}>V. Bruto Prod.</th>
                <th style={{ width: "75px", textAlign: "right" }}>Frete</th>
                <th style={{ width: "75px", textAlign: "right" }}>Desc.</th>
                <th style={{ width: "105px", textAlign: "right" }}>Op. Líquida s/IPI</th>
                <th style={{ width: "85px", textAlign: "right" }}>Valor IPI</th>
                <th style={{ width: "105px", textAlign: "right" }}>Base Origem</th>
                <th style={{ width: "105px", textAlign: "right" }}>Base Cálculo</th>
                <th style={{ width: "75px", textAlign: "right" }}>Alíq. Inter.</th>
                <th style={{ width: "130px", textAlign: "right" }}>Alíq. Interna</th>
                <th style={{ width: "80px", textAlign: "right" }}>Ref. Dif. (%)</th>
                <th style={{ width: "105px", textAlign: "right" }}>ICMS Origem Calc.</th>
                <th style={{ width: "95px", textAlign: "right" }}>DIFAL</th>
                <th style={{ width: "85px", textAlign: "right" }}>FCP Calc.</th>
                <th style={{ width: "115px", textAlign: "right" }}>Total Recolher</th>
                <th style={{ minWidth: "380px" }}>Memória Explicativa do Cálculo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={32} className="text-center py-8 text-[#888888] italic">
                    Nenhum item encontrado com os critérios de filtro informados.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const rowKey = `${item.arquivo}__${item.nNF}__${item.itemSeq}`;
                  const isSelected =
                    selectedItemKey === rowKey || (!selectedItemKey && idx === 0);
                  const itemOverride = itemConsumerOverrides[item.itemConfigKey] || "auto";
                  const matchingRule = getMatchingNcmRule(item);

                  return (
                    <tr
                      key={`${rowKey}__${idx}`}
                      onClick={() => setSelectedItemKey(rowKey)}
                      className={`cursor-pointer ${isSelected ? "selected" : ""}`}
                    >
                      <td className="font-mono font-bold text-[#003366]">{item.nNF}</td>
                      <td className="text-center font-mono">{item.itemSeq}</td>
                      <td>{item.dataEmissao}</td>
                      <td className="text-center">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                            item.mode === "antecipacao"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : item.mode === "difal_consumidor_final"
                              ? "bg-blue-100 text-blue-900 border border-blue-300"
                              : "bg-purple-100 text-purple-900 border border-purple-300"
                          }`}
                        >
                          {item.modeLabel}
                        </span>
                      </td>

                      {/* Consumidor-Final Override Interativo */}
                      <td onClick={(e) => e.stopPropagation()}>
                        <select
                          value={itemOverride}
                          onChange={(e) =>
                            onUpdateItemOverride(item.itemConfigKey, e.target.value)
                          }
                          className="vb-input w-full text-[10px] font-semibold"
                        >
                          <option value="auto">Auto ({item.consumerFinalSource})</option>
                          <option value="yes">Sim (Consumidor)</option>
                          <option value="no">Não (Revenda/Antec.)</option>
                        </select>
                      </td>

                      <td>{getRegimeLabel(item.regimeRemetAplicado)}</td>
                      <td className="text-center font-bold">{item.ufRem}</td>
                      <td className="text-center font-bold text-[#003366]">{item.ufDest}</td>
                      <td className="font-mono">{item.cProd}</td>
                      <td className="font-medium truncate max-w-xs" title={item.xProd}>
                        {item.xProd}
                      </td>
                      <td className="font-mono">{item.ncm}</td>
                      <td className="text-center font-mono">{item.ocst}</td>
                      <td className="text-center font-mono font-bold">{item.cfop}</td>
                      <td className="truncate max-w-xs text-[10px]" title={item.cfopDesc}>
                        {item.cfopDesc || "—"}
                      </td>
                      <td className="text-center">{item.unidade}</td>
                      <td className="text-right font-mono">{formatNum(item.quantidade, 4)}</td>
                      <td className="text-right font-mono">{formatBRL(item.vUnCom)}</td>
                      <td className="text-right font-mono">{formatBRL(item.vProd)}</td>
                      <td className="text-right font-mono">{formatBRL(item.vFreteItem)}</td>
                      <td className="text-right font-mono">{formatBRL(item.vDescItem)}</td>
                      <td className="text-right font-mono">{formatBRL(item.valorOperSemIPI)}</td>
                      <td className="text-right font-mono">{formatBRL(item.vIPIItem)}</td>
                      <td className="text-right font-mono font-semibold">
                        {formatBRL(item.baseOrigem)}
                      </td>
                      <td className="text-right font-mono font-bold">
                        {formatBRL(item.baseCalculo)}
                      </td>
                      <td className="text-right font-mono">{formatNum(item.aliqInter, 2)}%</td>

                      {/* Alíquota Interna com atalho para Regra NCM */}
                      <td className="text-right font-mono" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <span className="font-semibold">{formatNum(item.aliqInterna, 2)}%</span>
                          {matchingRule ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenNcmModal?.({
                                  ncm: item.ncm,
                                  ufDest: item.ufDest || "TODOS",
                                  aliqInterna: item.aliqInterna,
                                  aliqFcp: item.aliqFcp || 0,
                                  description: `[${item.cProd}] ${item.xProd} (NF-e ${item.nNF})`,
                                })
                              }
                              className="vb-btn py-0 px-1 text-[8.5px] font-bold text-[#003366] bg-[#eef5fc]"
                              title={`Regra Especial: NCM ${matchingRule.ncm} para ${matchingRule.ufDest}. Clique para abrir e gerenciar.`}
                            >
                              Salvo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenNcmModal?.({
                                  ncm: item.ncm,
                                  ufDest: item.ufDest || "TODOS",
                                  aliqInterna: item.aliqInterna,
                                  aliqFcp: item.aliqFcp || 0,
                                  description: `[${item.cProd}] ${item.xProd} (NF-e ${item.nNF})`,
                                })
                              }
                              className="vb-btn py-0 px-1 text-[8.5px]"
                              title={`Abrir painel para salvar alíquota de ${formatNum(item.aliqInterna, 2)}% para o NCM ${item.ncm}`}
                            >
                              + Regra
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="text-right font-mono">{formatNum(item.difalRate, 2)}%</td>
                      <td className="text-right font-mono">{formatBRL(item.icmsOrigemCalc)}</td>
                      <td className="text-right font-mono">{formatBRL(item.difalPuro)}</td>
                      <td className="text-right font-mono">{formatBRL(item.fcpCalc)}</td>
                      <td className="text-right font-mono font-bold text-[#003366] bg-[#eef5fd]">
                        {formatBRL(item.totalRecolher)}
                      </td>

                      {/* Memória de Cálculo Analítica com botão de detalhes */}
                      <td className="font-mono text-[10px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-1 max-w-[420px]">
                          <span className="truncate" title={item.memory}>
                            {item.memoryShort || item.memory}
                          </span>
                          <button
                            type="button"
                            onClick={() => setMemoryModalItem(item)}
                            className="vb-btn py-0 px-1 text-[9px] text-[#005a9e] shrink-0"
                            title="Visualizar fórmula matemática completa"
                          >
                            <HelpCircle size={10} />
                            <span>Ver</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Modal ERP Clássico de Detalhes da Memória de Cálculo */}
      {memoryModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 select-none">
          <div className="bg-[#f0f0f0] border border-[#707070] shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-[11px]">
            {/* Barra de Título Windows */}
            <div className="bg-gradient-to-r from-[#005a9e] to-[#004578] text-white px-3 py-1.5 flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5">
                <Calculator size={13} />
                <span>Memória de Cálculo Analítica - Item #{memoryModalItem.itemSeq} da NF-e {memoryModalItem.nNF}</span>
              </div>
              <button
                type="button"
                onClick={() => setMemoryModalItem(null)}
                className="hover:bg-[#aa2222] text-white px-1.5 py-0.5 text-xs font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-3 flex flex-col gap-2.5">
              <fieldset className="vb-groupbox m-0">
                <legend className="vb-legend">Identificação da Mercadoria</legend>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#666666] block">Descrição:</span>
                    <strong className="text-[#003366]">{memoryModalItem.xProd}</strong>
                  </div>
                  <div>
                    <span className="text-[#666666] block">Código / NCM / CFOP:</span>
                    <strong className="font-mono">
                      {memoryModalItem.cProd} | NCM {memoryModalItem.ncm} | CFOP {memoryModalItem.cfop}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#666666] block">Fornecedor (Emitente):</span>
                    <strong className="truncate block" title={memoryModalItem.razaoRem}>
                      {memoryModalItem.razaoRem} ({memoryModalItem.ufRem})
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#666666] block">Enquadramento Aplicado:</span>
                    <strong className="text-[#885500]">{memoryModalItem.modeLabel}</strong>
                  </div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox m-0">
                <legend className="vb-legend">Valores da Operação & Alíquotas</legend>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">Valor Líquido s/IPI</span>
                    <strong className="font-mono text-xs">{formatBRL(memoryModalItem.valorOperSemIPI)}</strong>
                  </div>
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">Base de Cálculo</span>
                    <strong className="font-mono text-xs">{formatBRL(memoryModalItem.baseCalculo)}</strong>
                  </div>
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">Alíq. Interestadual</span>
                    <strong className="font-mono text-xs">{formatNum(memoryModalItem.aliqInter, 2)}%</strong>
                  </div>
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">Alíq. Interna Destino</span>
                    <strong className="font-mono text-xs text-[#003366]">{formatNum(memoryModalItem.aliqInterna, 2)}%</strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mt-2">
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">ICMS Origem</span>
                    <strong className="font-mono text-xs">{formatBRL(memoryModalItem.icmsOrigemCalc)}</strong>
                  </div>
                  <div className="bg-white border border-[#c0c0c0] p-1.5">
                    <span className="text-[10px] text-[#666666] block">DIFAL Puro</span>
                    <strong className="font-mono text-xs">{formatBRL(memoryModalItem.difalPuro)}</strong>
                  </div>
                  <div className="bg-[#e6f2ff] border border-[#005a9e] p-1.5">
                    <span className="text-[10px] text-[#003366] font-bold block">Total a Recolher</span>
                    <strong className="font-mono text-sm text-[#003366]">{formatBRL(memoryModalItem.totalRecolher)}</strong>
                  </div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox m-0">
                <legend className="vb-legend">Fórmula e Memória Analítica Completa</legend>
                <div className="bg-white border border-[#7a7a7a] p-2.5 font-mono text-xs leading-relaxed text-[#001133] select-text break-words">
                  {memoryModalItem.memory}
                </div>
              </fieldset>
            </div>

            {/* Rodapé com botão de fechar */}
            <div className="bg-[#e0e0e0] border-t border-[#b0b0b0] px-3 py-2 flex justify-end">
              <button
                type="button"
                onClick={() => setMemoryModalItem(null)}
                className="vb-btn vb-btn-primary min-w-[80px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
