import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, X, Check, Search, Sparkles } from "lucide-react";
import { ComboboxOption } from "../data/tabelaCorrelacaoNbs";

interface NfseComboboxFieldProps {
  label: string;
  value: string;
  onChange: (val: string, option?: ComboboxOption) => void;
  options: ComboboxOption[];
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  helpButton?: React.ReactNode;
  recommendedCodes?: string[];
  align?: "left" | "right";
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  title?: string;
  panelWidth?: string;
}

export const NfseComboboxField: React.FC<NfseComboboxFieldProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = "Selecione ou digite...",
  maxLength,
  required = false,
  helpButton,
  recommendedCodes = [],
  align = "left",
  disabled = false,
  className = "min-w-0",
  inputClassName = "",
  title,
  panelWidth = "min-w-[340px] max-w-[420px]",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fecha o painel suspenso ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Encontra a opção atualmente selecionada
  const selectedOption = useMemo(() => {
    const cleanVal = (value || "").trim().toLowerCase();
    if (!cleanVal) return null;
    return options.find(
      (o) => o.code.toLowerCase() === cleanVal || o.code.replace(/\D/g, "") === cleanVal.replace(/\D/g, "")
    ) || null;
  }, [options, value]);

  // Filtra as opções de acordo com o termo de busca digitado
  const filteredOptions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return options;
    const qDigits = q.replace(/\D/g, "");

    return options.filter((opt) => {
      const codeMatch = opt.code.toLowerCase().includes(q) || (qDigits && opt.code.replace(/\D/g, "").includes(qDigits));
      const labelMatch = opt.label.toLowerCase().includes(q);
      const descMatch = opt.desc ? opt.desc.toLowerCase().includes(q) : false;
      const groupMatch = opt.group ? opt.group.toLowerCase().includes(q) : false;
      return codeMatch || labelMatch || descMatch || groupMatch;
    });
  }, [options, searchTerm]);

  // Separa em Recomendadas vs Outras quando há recommendedCodes
  const { recomendadas, outras } = useMemo(() => {
    if (!recommendedCodes || recommendedCodes.length === 0) {
      return { recomendadas: [], outras: filteredOptions };
    }
    const cleanRec = new Set(recommendedCodes.map((c) => c.replace(/\D/g, "")));
    const recList: ComboboxOption[] = [];
    const outrasList: ComboboxOption[] = [];

    for (const opt of filteredOptions) {
      const optClean = opt.code.replace(/\D/g, "");
      if (cleanRec.has(optClean)) {
        recList.push(opt);
      } else {
        outrasList.push(opt);
      }
    }
    return { recomendadas: recList, outras: outrasList };
  }, [filteredOptions, recommendedCodes]);

  const handleSelect = (opt: ComboboxOption) => {
    onChange(opt.code, opt);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    setSearchTerm(newVal);
    if (!isOpen) setIsOpen(true);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearchTerm("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Label e Botão de Ajuda */}
      <div className="flex items-center justify-between mb-0.5 min-w-0">
        <label className="font-semibold text-[#333333] truncate text-[11px]">
          {label} {required && <span className="text-red-600">*</span>}
        </label>
        {helpButton && <div className="shrink-0">{helpButton}</div>}
      </div>

      {/* Caixa de Entrada com Botões Integrados */}
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          maxLength={maxLength}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (!disabled) {
              setSearchTerm(value);
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          title={title || selectedOption ? `${selectedOption?.code} - ${selectedOption?.desc || selectedOption?.label}` : ""}
          className={`vb-input w-full pr-14 font-mono font-bold text-[11px] ${
            isOpen ? "border-[#005a9e] ring-1 ring-[#005a9e]/20" : ""
          } ${inputClassName}`}
        />

        {/* Botão Limpar */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
            title="Limpar campo"
          >
            <X size={11} />
          </button>
        )}

        {/* Botão Abrir/Fechar Painel Suspenso */}
        <button
          type="button"
          onClick={() => {
            if (!disabled) {
              setIsOpen((prev) => !prev);
              if (!isOpen) {
                setSearchTerm(value);
                inputRef.current?.focus();
              }
            }
          }}
          disabled={disabled}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-[#005a9e] hover:text-[#002244] p-1 rounded cursor-pointer transition-transform"
          title="Abrir lista de opções disponíveis"
        >
          <ChevronDown size={13} className={`transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dica da Descrição do Código Selecionado */}
      {selectedOption && (
        <div className="text-[9.5px] text-[#555555] truncate mt-0.5 italic leading-tight" title={selectedOption.desc || selectedOption.label}>
          {selectedOption.desc || selectedOption.label}
        </div>
      )}

      {/* PAINEL SUSPENSO FLUTUANTE */}
      {isOpen && !disabled && (
        <div
          className={`absolute ${align === "right" ? "right-0" : "left-0"} top-full mt-1 z-50 ${panelWidth} bg-white border-2 border-[#005a9e] shadow-2xl rounded-sm text-[11px] font-sans animate-in fade-in zoom-in-95 duration-100 flex flex-col`}
          style={{ maxHeight: "300px" }}
        >
          {/* Barra de Busca no Topo do Painel */}
          <div className="p-1.5 border-b border-[#d0d0d0] bg-[#f0f4f9] flex items-center gap-1.5 shrink-0">
            <Search size={12} className="text-[#005a9e] shrink-0" />
            <input
              type="text"
              placeholder="Filtrar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-[10.5px] px-1.5 py-0.5 border border-[#b0b0b0] bg-white rounded-xs focus:outline-none focus:border-[#005a9e]"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Lista de Opções */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {/* Seção 1: Recomendadas (se houver) */}
            {recomendadas.length > 0 && (
              <div className="bg-amber-50/50">
                <div className="px-2 py-1 text-[9.5px] font-bold text-amber-900 bg-amber-100/70 border-b border-amber-200 flex items-center gap-1 sticky top-0">
                  <Sparkles size={10} className="text-amber-600" />
                  <span>Recomendadas para a Atividade Selecionada ({recomendadas.length}):</span>
                </div>
                {recomendadas.map((opt) => {
                  const isSelected = (value || "").trim().toLowerCase() === opt.code.toLowerCase();
                  return (
                    <div
                      key={`rec_${opt.code}`}
                      onClick={() => handleSelect(opt)}
                      className={`px-2 py-1.5 cursor-pointer transition-colors flex items-start justify-between gap-1.5 ${
                        isSelected ? "bg-[#dbeafe] font-bold text-[#003366]" : "hover:bg-amber-100/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-[11px] text-[#003366]">{opt.code}</strong>
                          {opt.badge && (
                            <span className="text-[9px] px-1 rounded bg-amber-200/80 text-amber-900 font-normal">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.desc && (
                          <div className="text-[10px] text-slate-700 leading-tight line-clamp-2 mt-0.5">
                            {opt.desc}
                          </div>
                        )}
                      </div>
                      {isSelected && <Check size={12} className="text-emerald-700 shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Seção 2: Todas as Opções / Outras */}
            {outras.length > 0 ? (
              <div>
                {recomendadas.length > 0 && (
                  <div className="px-2 py-1 text-[9.5px] font-bold text-slate-700 bg-slate-100 border-b border-slate-200 sticky top-0">
                    Todas as Outras Opções Disponíveis ({outras.length}):
                  </div>
                )}
                {outras.map((opt) => {
                  const isSelected = (value || "").trim().toLowerCase() === opt.code.toLowerCase();
                  return (
                    <div
                      key={opt.code}
                      onClick={() => handleSelect(opt)}
                      className={`px-2 py-1.5 cursor-pointer transition-colors flex items-start justify-between gap-1.5 ${
                        isSelected ? "bg-[#dbeafe] font-bold text-[#003366]" : "hover:bg-[#e8f0fe]"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <strong className="font-mono text-[11px] text-[#003366]">{opt.code}</strong>
                          {opt.badge && (
                            <span className="text-[9px] px-1 rounded bg-slate-100 text-slate-600 font-normal border border-slate-200">
                              {opt.badge}
                            </span>
                          )}
                          {opt.group && (
                            <span className="text-[8.5px] text-slate-400 truncate max-w-[140px]">
                              • {opt.group}
                            </span>
                          )}
                        </div>
                        {opt.desc ? (
                          <div className="text-[10px] text-slate-600 leading-tight line-clamp-2 mt-0.5">
                            {opt.desc}
                          </div>
                        ) : opt.label !== opt.code ? (
                          <div className="text-[10px] text-slate-600 leading-tight line-clamp-2 mt-0.5">
                            {opt.label}
                          </div>
                        ) : null}
                      </div>
                      {isSelected && <Check size={12} className="text-emerald-700 shrink-0 mt-0.5" />}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Se nenhuma opção combinou */}
            {filteredOptions.length === 0 && (
              <div className="p-3 text-center text-slate-500 text-[10.5px]">
                <div>Nenhuma opção encontrada para &ldquo;{searchTerm}&rdquo;.</div>
                <div className="text-[9.5px] text-[#005a9e] mt-1">
                  Você pode manter o valor digitado ou selecionar outra opção.
                </div>
              </div>
            )}
          </div>

          {/* Rodapé do Painel com Contagem e Dica */}
          <div className="bg-[#f5f5f5] px-2 py-1 border-t border-[#d8d8d8] text-[9.5px] text-[#666666] flex items-center justify-between shrink-0">
            <span>{filteredOptions.length} opções disponíveis</span>
            <span>Esc para fechar</span>
          </div>
        </div>
      )}
    </div>
  );
};
export default NfseComboboxField;
