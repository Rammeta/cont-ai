import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";
import { EmpresaSefaz } from "../types";

interface EmpresaSearchSelectProps {
  empresas: EmpresaSefaz[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  disabled?: boolean;
}

export const EmpresaSearchSelect: React.FC<EmpresaSearchSelectProps> = ({
  empresas,
  value,
  onChange,
  className = "w-[320px] max-w-[340px]",
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Always sort companies alphabetically (A -> Z) by Razão Social
  const sortedEmpresas = useMemo(() => {
    return [...empresas].sort((a, b) =>
      (a.razaoSocial || "").localeCompare(b.razaoSocial || "", "pt-BR", {
        sensitivity: "base",
        numeric: true,
      })
    );
  }, [empresas]);

  const selectedEmpresa = useMemo(
    () => sortedEmpresas.find((e) => e.id === value) || sortedEmpresas[0] || null,
    [sortedEmpresas, value]
  );

  // Filter sorted companies by Razão Social, CNPJ (with or without punctuation), or UF
  const filteredEmpresas = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return sortedEmpresas;
    const qDigits = q.replace(/\D/g, "");
    return sortedEmpresas.filter((emp) => {
      const razao = (emp.razaoSocial || "").toLowerCase();
      const cnpj = (emp.cnpj || "").toLowerCase();
      const cnpjDigits = cnpj.replace(/\D/g, "");
      const uf = (emp.uf || "SP").toLowerCase();
      return (
        razao.includes(q) ||
        cnpj.includes(q) ||
        (qDigits.length > 0 && cnpjDigits.includes(qDigits)) ||
        uf === q
      );
    });
  }, [sortedEmpresas, searchTerm]);

  // Close dropdown when clicking outside
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

  // Reset highlighted index when filter changes or dropdown opens
  useEffect(() => {
    if (!isOpen) return;
    const currentIdx = filteredEmpresas.findIndex((e) => e.id === value);
    setHighlightedIndex(currentIdx >= 0 ? currentIdx : 0);
  }, [isOpen, searchTerm, filteredEmpresas, value]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const itemEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    if (itemEl) {
      itemEl.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, isOpen]);

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredEmpresas.length > 0 ? (prev + 1) % filteredEmpresas.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        filteredEmpresas.length > 0
          ? (prev - 1 + filteredEmpresas.length) % filteredEmpresas.length
          : 0
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredEmpresas[highlightedIndex];
      if (target) {
        handleSelect(target.id);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setSearchTerm("");
    }
  };

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {!isOpen ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpen}
          onKeyDown={handleKeyDown}
          title={
            selectedEmpresa
              ? `${selectedEmpresa.razaoSocial} (${selectedEmpresa.cnpj}) - UF: ${selectedEmpresa.uf || "SP"} — Clique para pesquisar ou trocar de empresa`
              : "Clique para pesquisar e selecionar uma empresa"
          }
          className="vb-input w-full flex items-center justify-between gap-1.5 text-left font-semibold text-[#003366] bg-white hover:border-[#005a9e] cursor-pointer"
        >
          <span className="flex items-center gap-1.5 min-w-0 flex-1">
            <Search size={11} className="text-[#555555] shrink-0" />
            <span className="truncate">
              {selectedEmpresa
                ? `${selectedEmpresa.razaoSocial} (${selectedEmpresa.cnpj}) - UF: ${selectedEmpresa.uf || "SP"}`
                : "Selecione uma empresa..."}
            </span>
          </span>
          <ChevronDown size={12} className="text-[#444444] shrink-0" />
        </button>
      ) : (
        <div className="vb-input w-full flex items-center gap-1 bg-white border-[#005a9e] ring-1 ring-[#005a9e]">
          <Search size={11} className="text-[#005a9e] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pesquisar empresa por nome ou CNPJ..."
            className="w-full bg-transparent outline-none text-[11px] font-semibold text-[#003366] placeholder:text-[#777777] placeholder:font-normal"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                inputRef.current?.focus();
              }}
              className="text-[#666666] hover:text-[#000000] cursor-pointer shrink-0"
              title="Limpar filtro"
            >
              <X size={11} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm("");
              }}
              className="text-[#444444] hover:text-[#000000] cursor-pointer shrink-0"
              title="Fechar lista"
            >
              <ChevronDown size={12} className="rotate-180" />
            </button>
          )}
        </div>
      )}

      {isOpen && (
        <div className="absolute left-0 top-full mt-0.5 w-[430px] max-w-[90vw] bg-white border border-[#555555] shadow-lg z-50 flex flex-col">
          <div className="bg-[#ececec] border-b border-[#c0c0c0] px-2 py-0.5 flex items-center justify-between text-[10px] text-[#444444]">
            <span>Ordem Alfabética (A-Z)</span>
            <span>
              {filteredEmpresas.length} de {sortedEmpresas.length} empresa(s)
            </span>
          </div>
          <div
            ref={listRef}
            className="max-h-[260px] overflow-y-auto divide-y divide-[#efefef]"
          >
            {filteredEmpresas.length === 0 ? (
              <div className="px-3 py-3 text-center text-[11px] text-[#666666]">
                Nenhuma empresa encontrada para &ldquo;{searchTerm}&rdquo;.
              </div>
            ) : (
              filteredEmpresas.map((emp, idx) => {
                const isSelected = emp.id === value;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={emp.id}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before selection
                      handleSelect(emp.id);
                    }}
                    className={`px-2 py-1.5 flex items-center justify-between gap-2 cursor-pointer text-[11px] ${
                      isHighlighted
                        ? "bg-[#005a9e] text-white"
                        : isSelected
                        ? "bg-[#eaf3ff] text-[#003366] font-bold"
                        : "text-[#111111] hover:bg-[#f0f6ff]"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Check
                        size={11}
                        className={`shrink-0 ${
                          isSelected
                            ? isHighlighted
                              ? "text-white opacity-100"
                              : "text-[#005a9e] opacity-100"
                            : "opacity-0"
                        }`}
                      />
                      <span className="truncate font-semibold">{emp.razaoSocial}</span>
                    </div>
                    <span
                      className={`font-mono text-[10px] shrink-0 ${
                        isHighlighted ? "text-[#dbe8f8]" : "text-[#555555]"
                      }`}
                    >
                      {emp.cnpj} • {emp.uf || "SP"}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
