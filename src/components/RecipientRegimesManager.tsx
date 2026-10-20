import React, { useState } from "react";
import { DestinatarioUnico, RecipientRegimesMap, RegimeDestinatario } from "../types";
import { Building2, Search } from "lucide-react";
import { getRegimeLabel } from "../utils/calc";

interface RecipientRegimesManagerProps {
  destinatarios: DestinatarioUnico[];
  recipientRegimes: RecipientRegimesMap;
  onUpdateRegime: (cnpj: string, regime: RegimeDestinatario | "default") => void;
  onApplyGlobalToUnconfigured: () => void;
  globalRegime: RegimeDestinatario;
}

export default function RecipientRegimesManager({
  destinatarios,
  recipientRegimes,
  onUpdateRegime,
  onApplyGlobalToUnconfigured,
  globalRegime,
}: RecipientRegimesManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = destinatarios.filter(
    (d) =>
      d.cnpjCpfDest.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.razaoDest.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.ufDest.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const configuredCount = destinatarios.filter((d) => recipientRegimes[d.destinatarioKey]).length;

  return (
    <fieldset className="vb-groupbox">
      <legend className="vb-legend flex items-center gap-1.5">
        <Building2 size={13} />
        <span>Regime por Empresa Destinatária (Cliente / Adquirente)</span>
      </legend>

      <div className="flex flex-col gap-2 text-[11px]">
        {/* Barra Superior */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#ffffff] border border-[#c0c0c0] p-1.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#333333]">
              Clientes: <strong>{destinatarios.length}</strong> | Personalizados: <strong>{configuredCount}</strong>
            </span>
            <span className="text-[#888888]">|</span>
            <span className="text-[10px] text-[#555555]">
              Padrão geral: <strong className="text-[#003366]">{getRegimeLabel(globalRegime)}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              placeholder="Filtrar clientes por Razão / CNPJ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="vb-input min-w-[200px]"
            />

            {destinatarios.length > 0 && (
              <button
                type="button"
                onClick={onApplyGlobalToUnconfigured}
                className="vb-btn"
                title="Aplicar o regime geral padrão aos clientes sem configuração individual"
              >
                <span>Aplicar Geral aos Pendentes</span>
              </button>
            )}
          </div>
        </div>

        {/* DataGrid ERP de Clientes Destinatários */}
        <div className="border border-[#999999] bg-[#ffffff] max-h-56 overflow-auto">
          {destinatarios.length === 0 ? (
            <div className="p-4 text-center text-[#777777] italic text-[11px]">
              Nenhum destinatário identificado nas notas carregadas.
            </div>
          ) : (
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th style={{ width: "130px" }}>CNPJ / CPF</th>
                  <th>Razão Social do Cliente</th>
                  <th style={{ width: "45px", textAlign: "center" }}>UF</th>
                  <th style={{ width: "180px" }}>Regime no DIFAL</th>
                  <th style={{ width: "120px" }}>Origem Regra</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-[#888888]">
                      Nenhum cliente correspondente ao filtro de busca.
                    </td>
                  </tr>
                ) : (
                  filtered.map((d) => {
                    const configurado = recipientRegimes[d.destinatarioKey];
                    const ativo = configurado || globalRegime;
                    const origem = configurado ? "Individual" : "Geral Padrão";

                    return (
                      <tr key={d.destinatarioKey}>
                        <td className="font-mono font-semibold">{d.cnpjCpfDest}</td>
                        <td className="font-medium truncate max-w-xs" title={d.razaoDest}>
                          {d.razaoDest}
                        </td>
                        <td className="text-center font-bold text-[#003366]">{d.ufDest}</td>
                        <td>
                          <select
                            value={configurado || "default"}
                            onChange={(evt) =>
                              onUpdateRegime(
                                d.destinatarioKey,
                                evt.target.value as RegimeDestinatario | "default"
                              )
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
    </fieldset>
  );
}
