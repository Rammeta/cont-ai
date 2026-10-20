import React, { useState } from "react";
import { NcmRateRule } from "../types";
import { Layers, Trash2, Plus, Search, AlertCircle, Download, Upload } from "lucide-react";
import { formatNum } from "../utils/calc";

interface NcmRatesManagerProps {
  ncmRateRules: NcmRateRule[];
  onAddRule: (rule: Omit<NcmRateRule, "id">) => void;
  onRemoveRule: (id: string) => void;
  onImportRules: (rules: NcmRateRule[]) => void;
}

const BRAZILIAN_STATES = [
  "TODOS",
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function NcmRatesManager({
  ncmRateRules,
  onAddRule,
  onRemoveRule,
  onImportRules,
}: NcmRatesManagerProps) {
  const [ncmInput, setNcmInput] = useState("");
  const [ufInput, setUfInput] = useState("TODOS");
  const [aliqInternaInput, setAliqInternaInput] = useState("18,00");
  const [aliqFcpInput, setAliqFcpInput] = useState("0,00");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleExportRules = () => {
    if (ncmRateRules.length === 0) {
      setFormError("Nenhuma regra cadastrada para exportar.");
      return;
    }
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(ncmRateRules, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `regras_ncm_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFormError(null);
    } catch (err) {
      setFormError("Erro ao gerar o arquivo de exportação.");
    }
  };

  const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || "");
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          onImportRules(parsed);
          setFormError(null);
        } else {
          setFormError("Formato de arquivo JSON inválido.");
        }
      } catch (err) {
        setFormError("Falha ao analisar o arquivo JSON importado.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const cleanDigits = (val: string) => val.replace(/\D/g, "");

  const parsePercentInput = (val: string): number => {
    const clean = val.replace("%", "").replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(clean);
    return isNaN(n) ? 0 : n;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNcm = cleanDigits(ncmInput);
    if (!cleanNcm) {
      setFormError("Informe um código ou prefixo de NCM válido (apenas números).");
      return;
    }

    if (cleanNcm.length < 2) {
      setFormError("O NCM deve ter pelo menos 2 dígitos fiscais.");
      return;
    }

    const aliqInterna = parsePercentInput(aliqInternaInput);
    const aliqFcp = parsePercentInput(aliqFcpInput);

    const duplicate = ncmRateRules.find(
      (rule) =>
        cleanDigits(rule.ncm) === cleanNcm &&
        rule.ufDest.toUpperCase() === ufInput.toUpperCase()
    );

    if (duplicate) {
      setFormError(`Já existe uma regra cadastrada para o NCM ${cleanNcm} e Destino: ${ufInput}.`);
      return;
    }

    onAddRule({
      ncm: cleanNcm,
      ufDest: ufInput,
      aliqInterna,
      aliqFcp,
      description: descriptionInput.trim(),
    });

    setNcmInput("");
    setDescriptionInput("");
    setAliqInternaInput("18,00");
    setAliqFcpInput("0,00");
    setFormError(null);
  };

  const filteredRules = ncmRateRules.filter((rule) => {
    const search = searchTerm.toLowerCase();
    return (
      rule.ncm.includes(search) ||
      rule.ufDest.toLowerCase().includes(search) ||
      (rule.description || "").toLowerCase().includes(search)
    );
  });

  return (
    <fieldset className="vb-groupbox">
      <legend className="vb-legend flex items-center gap-1.5">
        <Layers size={13} />
        <span>Exceções de Alíquotas por NCM e UF Destino ({ncmRateRules.length} cadastradas)</span>
      </legend>

      <div className="flex flex-col gap-2.5 text-[11px]">
        {/* Formulário Compacto de Cadastro ERP */}
        <form onSubmit={handleSubmit} className="bg-[#ffffff] border border-[#c0c0c0] p-2 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#003366] text-xs flex items-center gap-1">
              <Plus size={13} />
              <span>Cadastrar Nova Alíquota Especial de NCM</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleExportRules}
                className="vb-btn"
                title="Exportar backup em JSON"
              >
                <Download size={11} />
                <span>Exportar JSON</span>
              </button>

              <label className="vb-btn cursor-pointer" title="Importar regras de arquivo JSON">
                <Upload size={11} />
                <span>Importar JSON</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportRules}
                />
              </label>
            </div>
          </div>

          {formError && (
            <div className="bg-[#fdeeed] border border-[#e8a399] text-[#8a1f11] p-1.5 flex items-center gap-1.5 text-[11px]">
              <AlertCircle size={13} className="shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 items-end">
            <div>
              <label className="font-semibold text-[#333333] block mb-0.5">
                NCM ou Prefixo *:
              </label>
              <input
                type="text"
                value={ncmInput}
                onChange={(e) => setNcmInput(e.target.value)}
                placeholder="Ex: 39269090"
                className="vb-input w-full font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-[#333333] block mb-0.5">
                UF Destino:
              </label>
              <select
                value={ufInput}
                onChange={(e) => setUfInput(e.target.value)}
                className="vb-input w-full font-semibold"
              >
                {BRAZILIAN_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf === "TODOS" ? "TODOS (Geral)" : uf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-[#333333] block mb-0.5">
                Alíq. Interna (%):
              </label>
              <input
                type="text"
                value={aliqInternaInput}
                onChange={(e) => setAliqInternaInput(e.target.value)}
                placeholder="18,00"
                className="vb-input w-full text-center font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-[#333333] block mb-0.5">
                Alíq. FCP (%):
              </label>
              <input
                type="text"
                value={aliqFcpInput}
                onChange={(e) => setAliqFcpInput(e.target.value)}
                placeholder="0,00"
                className="vb-input w-full text-center font-mono font-bold"
              />
            </div>

            <div>
              <button
                type="submit"
                className="vb-btn vb-btn-primary w-full justify-center h-[24px]"
              >
                <Plus size={12} />
                <span>Adicionar Regra</span>
              </button>
            </div>
          </div>

          <div>
            <label className="font-semibold text-[#333333] block mb-0.5">
              Descrição / Fundamento Legal da Regra:
            </label>
            <input
              type="text"
              value={descriptionInput}
              onChange={(e) => setDescriptionInput(e.target.value)}
              placeholder="Ex: Artigo 54 do RICMS/SP - Alíquota reduzida de 12%"
              className="vb-input w-full"
            />
          </div>
        </form>

        {/* Barra de Pesquisa e Tabela de Regras */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#333333]">
              Regras vigentes ({filteredRules.length} de {ncmRateRules.length}):
            </span>
            <input
              type="text"
              placeholder="Pesquisar NCM, UF ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="vb-input w-64"
            />
          </div>

          <div className="border border-[#999999] bg-[#ffffff] max-h-52 overflow-auto">
            {ncmRateRules.length === 0 ? (
              <div className="p-4 text-center text-[#777777] italic text-[11px]">
                Nenhuma regra especial por NCM cadastrada. O cálculo utilizará a alíquota padrão da empresa.
              </div>
            ) : (
              <table className="datagrid-table">
                <thead>
                  <tr>
                    <th style={{ width: "100px" }}>NCM</th>
                    <th style={{ width: "70px", textAlign: "center" }}>UF Dest.</th>
                    <th style={{ width: "95px", textAlign: "right" }}>Alíq. Interna</th>
                    <th style={{ width: "80px", textAlign: "right" }}>Alíq. FCP</th>
                    <th>Descrição / Fundamento</th>
                    <th style={{ width: "50px", textAlign: "center" }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-4 text-[#888888]">
                        Nenhuma regra correspondente ao filtro.
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="font-mono font-bold text-[#003366]">{rule.ncm}</td>
                        <td className="text-center font-bold">{rule.ufDest}</td>
                        <td className="text-right font-mono font-bold text-[#107c41]">
                          {formatNum(rule.aliqInterna)}%
                        </td>
                        <td className="text-right font-mono">{formatNum(rule.aliqFcp)}%</td>
                        <td className="truncate max-w-xs" title={rule.description}>
                          {rule.description || "—"}
                        </td>
                        <td className="text-center">
                          <button
                            type="button"
                            onClick={() => onRemoveRule(rule.id)}
                            className="vb-btn vb-btn-danger py-0 px-1 text-[10px]"
                            title="Remover regra"
                          >
                            <Trash2 size={10} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </fieldset>
  );
}
