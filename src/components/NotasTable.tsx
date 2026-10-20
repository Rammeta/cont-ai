import React, { useState } from "react";
import { ParsedNota } from "../types";
import { Search, Download, FileText, SlidersHorizontal, RotateCcw, Calendar, Check, Copy } from "lucide-react";
import { formatBRL, getRegimeLabel } from "../utils/calc";
import { openDanfePdf } from "../utils/electronBridge";

interface NotasTableProps {
  notas: ParsedNota[];
  onExport: () => void;
}

function getCompetenciaFromNota(n: ParsedNota): string {
  if (n.dataEmissaoRaw && n.dataEmissaoRaw.length >= 7) {
    return n.dataEmissaoRaw.substring(0, 7);
  }
  if (n.dataEmissao && n.dataEmissao.includes("/")) {
    const parts = n.dataEmissao.split("/");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}`;
    }
  }
  return "";
}

export default function NotasTable({ notas, onExport }: NotasTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedNotaKey, setSelectedNotaKey] = useState<string | null>(null);

  const handleOpenDanfe = async (n: ParsedNota) => {
    const chNFeMatch = n.arquivo.match(/(\d{44})/);
    const chNFe = chNFeMatch ? chNFeMatch[1] : "";
    if (!chNFe) {
      alert("Chave de 44 dígitos da NF-e não encontrada no nome do arquivo.");
      return;
    }
    const cleanCnpj = (n.cnpjCpfDest || "").replace(/\D/g, "");
    const res = await openDanfePdf(cleanCnpj, chNFe);
    if (!res.success) {
      alert(res.error || "Não foi possível abrir o PDF do DANFE.");
    }
  };

  const [competenciaFilter, setCompetenciaFilter] = useState("TODOS");
  const [dataInicioFilter, setDataInicioFilter] = useState("");
  const [dataFimFilter, setDataFimFilter] = useState("");
  const [ufRemFilter, setUfRemFilter] = useState("TODOS");
  const [ufDestFilter, setUfDestFilter] = useState("TODOS");
  const [modeFilter, setModeFilter] = useState("TODOS");
  const [regimeFilter, setRegimeFilter] = useState("TODOS");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const uniqueCompetencias = Array.from(new Set(notas.map((n) => getCompetenciaFromNota(n)).filter(Boolean))).sort().reverse();
  const uniqueUfsRem = Array.from(new Set(notas.map((n) => n.ufRem).filter(Boolean))).sort();
  const uniqueUfsDest = Array.from(new Set(notas.map((n) => n.ufDest).filter(Boolean))).sort();
  const uniqueModes = Array.from(new Set(notas.map((n) => n.modeLabel).filter(Boolean))).sort();
  const uniqueRegimes = Array.from(new Set(notas.map((n) => getRegimeLabel(n.regimeRemetAplicado).trim()).filter(Boolean))).sort();

  const isFilteredActive =
    competenciaFilter !== "TODOS" ||
    dataInicioFilter !== "" ||
    dataFimFilter !== "" ||
    ufRemFilter !== "TODOS" ||
    ufDestFilter !== "TODOS" ||
    modeFilter !== "TODOS" ||
    regimeFilter !== "TODOS" ||
    searchTerm !== "";

  const handleResetFilters = () => {
    setSearchTerm("");
    setCompetenciaFilter("TODOS");
    setDataInicioFilter("");
    setDataFimFilter("");
    setUfRemFilter("TODOS");
    setUfDestFilter("TODOS");
    setModeFilter("TODOS");
    setRegimeFilter("TODOS");
  };

  const filtered = notas.filter((n) => {
    if (competenciaFilter !== "TODOS") {
      const comp = getCompetenciaFromNota(n);
      if (comp !== competenciaFilter) return false;
    }

    if (dataInicioFilter || dataFimFilter) {
      let dateIso = "";
      if (n.dataEmissaoRaw && n.dataEmissaoRaw.length >= 10) {
        dateIso = n.dataEmissaoRaw.substring(0, 10);
      } else if (n.dataEmissao && n.dataEmissao.includes("/")) {
        const parts = n.dataEmissao.split("/");
        if (parts.length === 3) {
          dateIso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      if (dateIso) {
        if (dataInicioFilter && dateIso < dataInicioFilter) return false;
        if (dataFimFilter && dateIso > dataFimFilter) return false;
      }
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        n.nNF.toLowerCase().includes(term) ||
        n.razaoRem.toLowerCase().includes(term) ||
        n.razaoDest.toLowerCase().includes(term) ||
        n.cnpjCpfRem.toLowerCase().includes(term) ||
        n.cnpjCpfDest.toLowerCase().includes(term) ||
        n.ufRem.toLowerCase().includes(term) ||
        n.ufDest.toLowerCase().includes(term) ||
        n.modeLabel.toLowerCase().includes(term) ||
        n.fundamento.toLowerCase().includes(term);
      if (!matchesSearch) return false;
    }

    if (ufRemFilter !== "TODOS" && n.ufRem !== ufRemFilter) return false;
    if (ufDestFilter !== "TODOS" && n.ufDest !== ufDestFilter) return false;
    if (modeFilter !== "TODOS" && n.modeLabel !== modeFilter) return false;
    if (regimeFilter !== "TODOS" && getRegimeLabel(n.regimeRemetAplicado).trim() !== regimeFilter) return false;

    return true;
  });

  const selectedNota = notas.find((n) => `${n.arquivo}__${n.nNF}` === selectedNotaKey) || (filtered.length > 0 ? filtered[0] : null);

  return (
    <div className="flex flex-col flex-1 h-full gap-2 text-[11px]">
      {/* 1. GroupBox de Filtros de Pesquisa e Competência */}
      <fieldset className="vb-groupbox m-0">
        <legend className="vb-legend">Filtros da Relação de Notas Interestaduais</legend>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">Competência:</span>
              <select
                value={competenciaFilter}
                onChange={(e) => setCompetenciaFilter(e.target.value)}
                className="vb-input font-semibold"
              >
                <option value="TODOS">Todas as Competências</option>
                {uniqueCompetencias.map((comp) => (
                  <option key={`comp_${comp}`} value={comp}>
                    {comp}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <span className="font-semibold text-[#333333]">Período:</span>
              <span className="text-[10px] text-[#666666]">De:</span>
              <input
                type="date"
                value={dataInicioFilter}
                onChange={(e) => setDataInicioFilter(e.target.value)}
                className="vb-input py-0.5 text-xs"
              />
              <span className="text-[10px] text-[#666666]">Até:</span>
              <input
                type="date"
                value={dataFimFilter}
                onChange={(e) => setDataFimFilter(e.target.value)}
                className="vb-input py-0.5 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 border-l border-[#d0d0d0] pl-2">
              <span className="font-semibold text-[#333333]">Pesquisar:</span>
              <input
                type="text"
                placeholder="Número NF, emitente, CNPJ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="vb-input min-w-[200px]"
              />
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
              Mostrando <strong>{filtered.length}</strong> de <strong>{notas.length}</strong> nota(s)
            </span>
          </div>
        </div>

        {/* Filtros Avançados Expansíveis */}
        {showAdvanced && (
          <div className="mt-2 pt-2 border-t border-[#d8d8d8] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">UF Origem (Remetente):</span>
              <select
                value={ufRemFilter}
                onChange={(e) => setUfRemFilter(e.target.value)}
                className="vb-input w-full"
              >
                <option value="TODOS">Todas as Origens</option>
                {uniqueUfsRem.map((uf) => (
                  <option key={`ufrem_${uf}`} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">UF Destino:</span>
              <select
                value={ufDestFilter}
                onChange={(e) => setUfDestFilter(e.target.value)}
                className="vb-input w-full"
              >
                <option value="TODOS">Todos os Destinos</option>
                {uniqueUfsDest.map((uf) => (
                  <option key={`ufdest_${uf}`} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="font-semibold text-[#333333] block mb-0.5">Tipo Enquadramento / Modo:</span>
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
              <span className="font-semibold text-[#333333] block mb-0.5">Regime Remetente:</span>
              <select
                value={regimeFilter}
                onChange={(e) => setRegimeFilter(e.target.value)}
                className="vb-input w-full"
              >
                <option value="TODOS">Todos os Regimes</option>
                {uniqueRegimes.map((r) => (
                  <option key={`reg_${r}`} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </fieldset>

      {/* 2. GroupBox da Nota Selecionada com Ações Rápidas */}
      {selectedNota && (
        <fieldset className="vb-groupbox m-0">
          <legend className="vb-legend">Detalhes da Nota Selecionada na Grid</legend>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ffffff] border border-[#d0d0d0] p-1.5">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <span className="text-[10px] text-[#666666]">Número:</span>
                <span className="font-bold text-[#003366] ml-1">NF-e {selectedNota.nNF}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666]">Emissão:</span>
                <span className="font-semibold ml-1">{selectedNota.dataEmissao}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666]">Emitente:</span>
                <span className="font-bold text-[#222222] ml-1 truncate max-w-xs inline-block align-bottom" title={selectedNota.razaoRem}>
                  {selectedNota.razaoRem}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666]">Rota:</span>
                <span className="font-bold text-[#003366] ml-1">
                  {selectedNota.ufRem} ➔ {selectedNota.ufDest}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666]">Enquadramento:</span>
                <span className="font-semibold text-[#885500] ml-1">
                  {selectedNota.modeLabel}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#666666]">Total a Recolher:</span>
                <span className="font-mono font-bold text-[#003366] bg-[#e6f2ff] px-1.5 py-0.5 ml-1 border border-[#b3d7ff]">
                  {formatBRL(selectedNota.totalRecolher)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenDanfe(selectedNota)}
                className="vb-btn vb-btn-primary"
                title="Abrir DANFE PDF oficial do documento"
              >
                <FileText size={12} className="text-[#aa2222]" />
                <span>➔ Abrir DANFE (PDF)</span>
              </button>
            </div>
          </div>
        </fieldset>
      )}

      {/* 3. DataGrid Clássica de Notas Fiscais */}
      <div className="border border-[#999999] bg-[#ffffff] flex-1 flex flex-col min-h-[320px] overflow-hidden">
        <div className="bg-[#f0f0f0] border-b border-[#c0c0c0] px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-[#003366]">
          <span>Consolidado Fiscal por Nota ({filtered.length} registro(s))</span>
          <span className="text-[10px] text-[#555555]">
            Clique em uma linha para selecionar | Duplo clique para abrir DANFE
          </span>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="datagrid-table min-w-[2100px]" id="tabelaNotas">
            <thead>
              <tr>
                <th style={{ width: "95px" }}>NF-e</th>
                <th style={{ width: "125px" }}>Data Emissão</th>
                <th style={{ width: "50px", textAlign: "center" }}>UF Rem</th>
                <th style={{ width: "50px", textAlign: "center" }}>UF Dest</th>
                <th style={{ width: "70px", textAlign: "center" }}>indFinal</th>
                <th style={{ width: "150px", textAlign: "center" }}>Enquadramento</th>
                <th style={{ width: "130px" }}>CNPJ Emitente</th>
                <th>Razão Social Emitente</th>
                <th style={{ width: "120px" }}>Regime Emitente</th>
                <th style={{ width: "130px" }}>CNPJ Destinatário</th>
                <th>Razão Social Destinatário</th>
                <th style={{ width: "110px", textAlign: "right" }}>Val. Op. s/IPI</th>
                <th style={{ width: "95px", textAlign: "right" }}>Valor IPI</th>
                <th style={{ width: "115px", textAlign: "right" }}>Base Origem</th>
                <th style={{ width: "115px", textAlign: "right" }}>Base Calc.</th>
                <th style={{ width: "110px", textAlign: "right" }}>ICMS Origem</th>
                <th style={{ width: "105px", textAlign: "right" }}>DIFAL</th>
                <th style={{ width: "95px", textAlign: "right" }}>FCP</th>
                <th style={{ width: "120px", textAlign: "right" }}>Total Recolher</th>
                <th style={{ width: "115px", textAlign: "right" }}>Total NF-e</th>
                <th style={{ width: "240px" }}>Fundamento Legal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={21} className="text-center py-8 text-[#888888] italic">
                    Nenhuma nota fiscal encontrada com os critérios informados.
                  </td>
                </tr>
              ) : (
                filtered.map((n, idx) => {
                  const rowKey = `${n.arquivo}__${n.nNF}`;
                  const isSelected = (selectedNotaKey === rowKey) || (!selectedNotaKey && idx === 0);

                  return (
                    <tr
                      key={`${rowKey}__${idx}`}
                      onClick={() => setSelectedNotaKey(rowKey)}
                      onDoubleClick={() => handleOpenDanfe(n)}
                      className={`cursor-pointer ${isSelected ? "selected" : ""}`}
                    >
                      <td className="font-mono font-bold text-[#003366]">{n.nNF}</td>
                      <td>{n.dataEmissao}</td>
                      <td className="text-center font-bold">{n.ufRem}</td>
                      <td className="text-center font-bold text-[#003366]">{n.ufDest}</td>
                      <td className="text-center font-mono">{n.indFinal}</td>
                      <td className="text-center">
                        <span
                          className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                            n.mode === "antecipacao"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : n.mode === "difal_consumidor_final"
                              ? "bg-blue-100 text-blue-900 border border-blue-300"
                              : "bg-purple-100 text-purple-900 border border-purple-300"
                          }`}
                        >
                          {n.modeLabel}
                        </span>
                      </td>
                      <td className="font-mono">{n.cnpjCpfRem}</td>
                      <td className="font-medium truncate max-w-xs" title={n.razaoRem}>
                        {n.razaoRem}
                      </td>
                      <td>{getRegimeLabel(n.regimeRemetAplicado)}</td>
                      <td className="font-mono">{n.cnpjCpfDest}</td>
                      <td className="truncate max-w-xs" title={n.razaoDest}>
                        {n.razaoDest}
                      </td>
                      <td className="text-right font-mono">{formatBRL(n.valorOperSemIPITotal)}</td>
                      <td className="text-right font-mono">{formatBRL(n.valorIPITotal)}</td>
                      <td className="text-right font-mono font-semibold">{formatBRL(n.baseOrigemTotal)}</td>
                      <td className="text-right font-mono font-bold">{formatBRL(n.baseCalculoTotal)}</td>
                      <td className="text-right font-mono">{formatBRL(n.icmsOrigemCalcTotal)}</td>
                      <td className="text-right font-mono">{formatBRL(n.difalPuroTotal)}</td>
                      <td className="text-right font-mono">{formatBRL(n.fcpCalcTotal)}</td>
                      <td className="text-right font-mono font-bold text-[#003366] bg-[#eef5fd]">
                        {formatBRL(n.totalRecolher)}
                      </td>
                      <td className="text-right font-mono">{formatBRL(n.vNF)}</td>
                      <td className="truncate max-w-xs text-[10px]" title={n.fundamento}>
                        {n.fundamento}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
