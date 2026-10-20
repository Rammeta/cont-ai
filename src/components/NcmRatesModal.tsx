import React, { useState, useEffect, useRef } from "react";
import { NcmRateRule } from "../types";
import {
  Layers,
  Trash2,
  Plus,
  Search,
  AlertCircle,
  Download,
  Upload,
  Edit2,
  Copy,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { formatNum } from "../utils/calc";

interface NcmRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  ncmRateRules: NcmRateRule[];
  onAddRule: (rule: Omit<NcmRateRule, "id">) => void;
  onUpdateRule?: (rule: NcmRateRule) => void;
  onRemoveRule: (id: string) => void;
  onImportRules: (rules: NcmRateRule[]) => void;
  initialPrefill?: {
    ncm?: string;
    ufDest?: string;
    aliqInterna?: number;
    aliqFcp?: number;
    description?: string;
  } | null;
}

const BRAZILIAN_STATES = [
  "TODOS",
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

export default function NcmRatesModal({
  isOpen,
  onClose,
  ncmRateRules,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
  onImportRules,
  initialPrefill,
}: NcmRatesModalProps) {
  const [ncmInput, setNcmInput] = useState("");
  const [ufInput, setUfInput] = useState("TODOS");
  const [aliqInternaInput, setAliqInternaInput] = useState("18,00");
  const [aliqFcpInput, setAliqFcpInput] = useState("0,00");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const ncmInputRef = useRef<HTMLInputElement>(null);

  // Inicialização com prefill quando o modal abre
  useEffect(() => {
    if (!isOpen) return;

    if (initialPrefill) {
      const cleanNcm = String(initialPrefill.ncm || "").replace(/\D/g, "");
      const uf = initialPrefill.ufDest || "TODOS";

      // Verifica se já existe uma regra para este NCM e UF
      const existing = ncmRateRules.find(
        (r) =>
          String(r.ncm).replace(/\D/g, "") === cleanNcm &&
          (r.ufDest.toUpperCase() === uf.toUpperCase() || r.ufDest === "TODOS")
      );

      if (existing) {
        // Carrega em modo de edição
        setEditingRuleId(existing.id);
        setNcmInput(existing.ncm);
        setUfInput(existing.ufDest);
        setAliqInternaInput(formatNum(existing.aliqInterna, 2));
        setAliqFcpInput(formatNum(existing.aliqFcp || 0, 2));
        setDescriptionInput(existing.description || initialPrefill.description || "");
        setInfoMessage(`Regra existente localizada para o NCM ${existing.ncm} (${existing.ufDest}). Pronta para alteração.`);
      } else {
        // Carrega para nova adição com campos preenchidos
        setEditingRuleId(null);
        setNcmInput(cleanNcm);
        setUfInput(uf);
        setAliqInternaInput(
          initialPrefill.aliqInterna !== undefined
            ? formatNum(initialPrefill.aliqInterna, 2)
            : "18,00"
        );
        setAliqFcpInput(
          initialPrefill.aliqFcp !== undefined
            ? formatNum(initialPrefill.aliqFcp, 2)
            : "0,00"
        );
        setDescriptionInput(initialPrefill.description || "");
        setInfoMessage(`Dados do produto selecionado preenchidos. Clique em "Adicionar Regra" para salvar.`);
      }
    } else {
      // Aberto sem prefill específico
      resetForm();
    }
  }, [isOpen, initialPrefill]);

  if (!isOpen) return null;

  const resetForm = () => {
    setNcmInput("");
    setUfInput("TODOS");
    setAliqInternaInput("18,00");
    setAliqFcpInput("0,00");
    setDescriptionInput("");
    setEditingRuleId(null);
    setFormError(null);
    setInfoMessage(null);
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
      setFormError("Informe um código ou prefixo de NCM válido (somente números).");
      return;
    }

    if (cleanNcm.length < 2) {
      setFormError("O NCM deve ter pelo menos 2 dígitos fiscais.");
      return;
    }

    const aliqInterna = parsePercentInput(aliqInternaInput);
    const aliqFcp = parsePercentInput(aliqFcpInput);

    // Se estiver editando regra existente
    if (editingRuleId) {
      const duplicate = ncmRateRules.find(
        (r) =>
          r.id !== editingRuleId &&
          cleanDigits(r.ncm) === cleanNcm &&
          r.ufDest.toUpperCase() === ufInput.toUpperCase()
      );
      if (duplicate) {
        setFormError(`Já existe outra regra cadastrada para o NCM ${cleanNcm} e Destino: ${ufInput}.`);
        return;
      }

      if (onUpdateRule) {
        onUpdateRule({
          id: editingRuleId,
          ncm: cleanNcm,
          ufDest: ufInput,
          aliqInterna,
          aliqFcp,
          description: descriptionInput.trim(),
        });
      } else {
        // Fallback: remove e adiciona
        onRemoveRule(editingRuleId);
        onAddRule({
          ncm: cleanNcm,
          ufDest: ufInput,
          aliqInterna,
          aliqFcp,
          description: descriptionInput.trim(),
        });
      }

      setInfoMessage(`Regra para o NCM ${cleanNcm} alterada com sucesso!`);
      resetForm();
      return;
    }

    // Se for uma nova regra
    const duplicate = ncmRateRules.find(
      (rule) =>
        cleanDigits(rule.ncm) === cleanNcm &&
        rule.ufDest.toUpperCase() === ufInput.toUpperCase()
    );

    if (duplicate) {
      setFormError(`Já existe uma regra cadastrada para o NCM ${cleanNcm} e Destino: ${ufInput}. Clique em "Editar" na grade abaixo se deseja alterá-la.`);
      return;
    }

    onAddRule({
      ncm: cleanNcm,
      ufDest: ufInput,
      aliqInterna,
      aliqFcp,
      description: descriptionInput.trim(),
    });

    setInfoMessage(`Regra para o NCM ${cleanNcm} adicionada com sucesso!`);
    resetForm();
  };

  // Carrega uma regra existente para edição
  const handleEditRule = (rule: NcmRateRule) => {
    setEditingRuleId(rule.id);
    setNcmInput(rule.ncm);
    setUfInput(rule.ufDest);
    setAliqInternaInput(formatNum(rule.aliqInterna, 2));
    setAliqFcpInput(formatNum(rule.aliqFcp || 0, 2));
    setDescriptionInput(rule.description || "");
    setFormError(null);
    setInfoMessage(`Editando regra do NCM ${rule.ncm}. Altere os campos e clique em "Salvar Alterações".`);
    if (ncmInputRef.current) {
      ncmInputRef.current.focus();
    }
  };

  // Duplica os parâmetros de uma regra existente para cadastrar um novo NCM
  const handleDuplicateRule = (rule: NcmRateRule) => {
    setEditingRuleId(null);
    setNcmInput("");
    setUfInput(rule.ufDest);
    setAliqInternaInput(formatNum(rule.aliqInterna, 2));
    setAliqFcpInput(formatNum(rule.aliqFcp || 0, 2));
    setDescriptionInput(rule.description ? `${rule.description} (Cópia)` : "");
    setFormError(null);
    setInfoMessage(`Parâmetros clonados da regra de ${rule.ufDest} (${rule.aliqInterna}%). Digite o novo NCM no campo abaixo.`);
    if (ncmInputRef.current) {
      ncmInputRef.current.focus();
    }
  };

  const handleExportRules = () => {
    if (ncmRateRules.length === 0) {
      setFormError("Nenhuma regra cadastrada para exportar.");
      return;
    }
    try {
      const dataStr =
        "data:text/json;charset=utf-8," +
        encodeURIComponent(JSON.stringify(ncmRateRules, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute(
        "download",
        `regras_ncm_${new Date().toISOString().slice(0, 10)}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setFormError(null);
      setInfoMessage("Arquivo de backup de regras gerado com sucesso.");
    } catch (_) {
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
          setInfoMessage("Regras importadas com sucesso.");
        } else {
          setFormError("Formato de arquivo JSON inválido.");
        }
      } catch (_) {
        setFormError("Falha ao analisar o arquivo JSON importado.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 select-none overflow-y-auto">
      <div className="bg-[#f0f0f0] border border-[#707070] shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden text-[11px] max-h-[92vh]">
        {/* Barra de Título Windows ERP */}
        <div className="bg-gradient-to-r from-[#005a9e] to-[#004578] text-white px-3 py-1.5 flex items-center justify-between font-semibold shrink-0">
          <div className="flex items-center gap-1.5">
            <Layers size={13} />
            <span>Gerenciador de Regras e Exceções por NCM (Alíquotas Internas & FCP)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-[#aa2222] text-white px-1.5 py-0.5 text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Barra Superior de Ações e Informações */}
        <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#333333]">
              Regras vigentes: <strong>{ncmRateRules.length}</strong>
            </span>
            <span className="text-[#888888]">|</span>
            <span className="text-[10px] text-[#555555]">
              As regras de NCM sobrepõem a alíquota padrão da empresa nos cálculos de DIFAL e Antecipação
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportRules}
              className="vb-btn"
              title="Exportar backup em JSON"
            >
              <Download size={11} className="text-[#107c41]" />
              <span>Exportar JSON</span>
            </button>

            <label className="vb-btn cursor-pointer" title="Importar regras de arquivo JSON">
              <Upload size={11} className="text-[#005a9e]" />
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

        {/* Notificações e Mensagens */}
        {formError && (
          <div className="bg-[#fdeeed] border-b border-[#e8a399] text-[#8a1f11] px-3 py-1 flex items-center gap-1.5 text-[11px] shrink-0">
            <AlertCircle size={13} className="shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {infoMessage && !formError && (
          <div className="bg-[#eaf3ff] border-b border-[#b3d7ff] text-[#003366] px-3 py-1 flex items-center gap-1.5 text-[11px] shrink-0">
            <Sparkles size={12} className="shrink-0 text-[#005a9e]" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Corpo do Painel: Formulário e Grade de Regras */}
        <div className="p-3 flex flex-col gap-3 flex-1 overflow-y-auto">
          {/* 1. Formulário de Cadastro / Edição / Duplicação */}
          <fieldset className="vb-groupbox m-0">
            <legend className="vb-legend flex items-center gap-1">
              {editingRuleId ? <Edit2 size={12} /> : <Plus size={12} />}
              <span>
                {editingRuleId
                  ? "Alterar Regra Cadastrada"
                  : "Cadastrar Nova Regra ou Exceção de NCM"}
              </span>
            </legend>

            <form onSubmit={handleSubmit} className="flex flex-col gap-2 bg-white border border-[#c0c0c0] p-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-2 items-end">
                {/* NCM */}
                <div className="md:col-span-2">
                  <label className="font-semibold text-[#333333] block mb-0.5">
                    NCM ou Prefixo *:
                  </label>
                  <input
                    ref={ncmInputRef}
                    type="text"
                    value={ncmInput}
                    onChange={(e) => setNcmInput(e.target.value)}
                    placeholder="Ex: 84713012 ou 8471"
                    className="vb-input w-full font-mono font-bold"
                  />
                </div>

                {/* UF Destino */}
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

                {/* Alíquota Interna */}
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

                {/* Alíquota FCP */}
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

                {/* Botões do Formulário */}
                <div className="flex items-center gap-1">
                  <button
                    type="submit"
                    className="vb-btn vb-btn-primary w-full justify-center h-[24px]"
                  >
                    {editingRuleId ? (
                      <>
                        <Check size={12} />
                        <span>Salvar</span>
                      </>
                    ) : (
                      <>
                        <Plus size={12} />
                        <span>Adicionar</span>
                      </>
                    )}
                  </button>

                  {editingRuleId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="vb-btn h-[24px]"
                      title="Cancelar edição e voltar para novo cadastro"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Descrição / Fundamento Legal */}
              <div>
                <label className="font-semibold text-[#333333] block mb-0.5">
                  Descrição do Produto / Fundamento Legal da Regra:
                </label>
                <input
                  type="text"
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Ex: Artigo 54 RICMS/SP - Alíquota reduzida de 12% ou Nome do Produto"
                  className="vb-input w-full"
                />
              </div>
            </form>
          </fieldset>

          {/* 2. Grade de Regras Vigentes com Busca, Edição e Duplicação */}
          <div className="border border-[#999999] bg-[#ffffff] flex flex-col flex-1 min-h-[220px] overflow-hidden">
            <div className="bg-[#f0f0f0] border-b border-[#c0c0c0] px-2 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#003366]">
              <span>Relação de Regras Vigentes ({filteredRules.length} de {ncmRateRules.length})</span>
              <div className="flex items-center gap-1">
                <Search size={11} className="text-[#666666]" />
                <input
                  type="text"
                  placeholder="Pesquisar por NCM, UF ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="vb-input w-64 text-[10px]"
                />
              </div>
            </div>

            <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="datagrid-table w-full">
                <thead>
                  <tr>
                    <th style={{ width: "110px" }}>NCM / Prefixo</th>
                    <th style={{ width: "75px", textAlign: "center" }}>UF Dest.</th>
                    <th style={{ width: "100px", textAlign: "right" }}>Alíq. Interna</th>
                    <th style={{ width: "85px", textAlign: "right" }}>Alíq. FCP</th>
                    <th>Descrição / Produto / Fundamento</th>
                    <th style={{ width: "135px", textAlign: "center" }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#888888] italic">
                        {ncmRateRules.length === 0
                          ? "Nenhuma regra especial por NCM cadastrada. O cálculo utilizará as alíquotas padrões."
                          : "Nenhuma regra correspondente aos termos pesquisados."}
                      </td>
                    </tr>
                  ) : (
                    filteredRules.map((rule) => {
                      const isBeingEdited = editingRuleId === rule.id;
                      return (
                        <tr
                          key={rule.id}
                          className={isBeingEdited ? "bg-[#fff8e6] font-semibold" : ""}
                        >
                          <td className="font-mono font-bold text-[#003366]">{rule.ncm}</td>
                          <td className="text-center font-bold">{rule.ufDest}</td>
                          <td className="text-right font-mono font-bold text-[#107c41]">
                            {formatNum(rule.aliqInterna, 2)}%
                          </td>
                          <td className="text-right font-mono">{formatNum(rule.aliqFcp || 0, 2)}%</td>
                          <td className="truncate max-w-sm" title={rule.description}>
                            {rule.description || "—"}
                          </td>
                          <td className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditRule(rule)}
                                className="vb-btn py-0 px-1 text-[9px]"
                                title="Editar esta regra"
                              >
                                <Edit2 size={10} className="text-[#005a9e]" />
                                <span>Alterar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDuplicateRule(rule)}
                                className="vb-btn py-0 px-1 text-[9px]"
                                title="Duplicar parâmetros para outro NCM"
                              >
                                <Copy size={10} className="text-[#664400]" />
                                <span>Duplicar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Deseja remover a regra do NCM ${rule.ncm} para ${rule.ufDest}?`)) {
                                    onRemoveRule(rule.id);
                                    if (editingRuleId === rule.id) resetForm();
                                  }
                                }}
                                className="vb-btn vb-btn-danger py-0 px-1 text-[9px]"
                                title="Excluir regra"
                              >
                                <Trash2 size={10} />
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
        </div>

        {/* Rodapé Clássico */}
        <div className="bg-[#e0e0e0] border-t border-[#b0b0b0] px-3 py-2 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-[#555555]">
            💡 <strong>Dica:</strong> Para aplicar uma alíquota reduzida a vários NCMs da mesma família, clique em <strong>Duplicar</strong> e apenas preencha o novo código.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="vb-btn vb-btn-primary min-w-[80px]"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
