import React, { useState } from "react";
import { ParsedNota, AppConfig } from "../types";
import { X, Printer, Edit2, Check, FileText, Calendar, Building, Wallet, FileCheck, Layers } from "lucide-react";
import { formatBRL, formatNum, getRegimeLabel } from "../utils/calc";

interface ReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  notas: ParsedNota[];
  itensCount: number;
  totalRecolher: number;
  defaultCompanyName: string;
  config: AppConfig;
}

export default function ReportPrintModal({
  isOpen,
  onClose,
  notas,
  itensCount,
  totalRecolher,
  defaultCompanyName,
  config,
}: ReportPrintModalProps) {
  const [reportCompanyName, setReportCompanyName] = useState<string>(() => {
    return localStorage.getItem("difal_company_name_v2") || defaultCompanyName || "EMPRESA SOB AUDITORIA LTDA";
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(reportCompanyName);

  // Nome do auditor e anotações customizadas
  const [auditorName, setAuditorName] = useState(() => {
    return localStorage.getItem("difal_auditor_name") || "CONTROLLER TRIBUTÁRIO";
  });
  const [annotations, setAnnotations] = useState(() => {
    return localStorage.getItem("difal_report_annotations") || "";
  });

  const isIframe = typeof window !== "undefined" && window.self !== window.top;

  if (!isOpen) return null;

  const handleSaveName = () => {
    const finalName = tempName.trim() || defaultCompanyName || "EMPRESA SOB AUDITORIA LTDA";
    setReportCompanyName(finalName);
    localStorage.setItem("difal_company_name_v2", finalName);
    setIsEditingName(false);
  };

  const handleSaveAuditorAndNote = () => {
    localStorage.setItem("difal_auditor_name", auditorName);
    localStorage.setItem("difal_report_annotations", annotations);
  };

  const handlePrint = () => {
    handleSaveAuditorAndNote();
    window.print();
  };

  // Cálculos acumulados
  const totalDIFALPuro = notas.reduce((acc, n) => acc + (n.difalPuroTotal || 0), 0);
  const totalFCP = notas.reduce((acc, n) => acc + (n.fcpCalcTotal || 0), 0);
  const totalValorXML = notas.reduce((acc, n) => acc + (n.vNF || 0), 0);
  const totalOperSemIPI = notas.reduce((acc, n) => acc + (n.valorOperSemIPITotal || 0), 0);
  const totalIPITotal = notas.reduce((acc, n) => acc + (n.valorIPITotal || 0), 0);

  const currentDateStr = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 select-none overflow-y-auto">
      {/* Estilos para impressão limpa em A4 */}
      <style>{`
        @media print {
          html, body {
            background-color: white !important;
            color: black !important;
            font-size: 10px !important;
            overflow: visible !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-report-wrapper,
          #printable-report-wrapper * {
            visibility: visible !important;
          }
          #printable-report-wrapper {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            display: block !important;
          }
          .no-print, .no-print * {
            display: none !important;
            visibility: hidden !important;
          }
          table {
            width: 100% !important;
            table-layout: auto !important;
          }
          th, td {
            padding: 3px 2px !important;
            font-size: 8px !important;
          }
          .print-table-container {
            overflow: visible !important;
            display: block !important;
            width: 100% !important;
          }
          .print-truncate {
            max-width: 130px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          h3, h4, h5 {
            page-break-after: avoid !important;
          }
        }
      `}</style>

      {/* Caixa do Modal Clássico ERP */}
      <div
        id="printable-report-wrapper"
        className="bg-[#f0f0f0] border border-[#707070] shadow-2xl w-full max-w-5xl flex flex-col my-2 sm:my-6 overflow-hidden max-h-[92vh] text-[11px]"
      >
        {/* Barra de Título Windows */}
        <div className="no-print bg-gradient-to-r from-[#005a9e] to-[#004578] text-white px-3 py-1.5 flex items-center justify-between font-semibold shrink-0">
          <div className="flex items-center gap-1.5">
            <Printer size={13} />
            <span>Visualização do Relatório Fiscal - DIFAL & Antecipação Tributária</span>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-[#aa2222] text-white px-1.5 py-0.5 text-xs font-bold transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Barra de Ações Rápidas ERP */}
        <div className="no-print bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="vb-btn vb-btn-primary font-bold"
              title="Acionar diálogo de impressão do Windows / Salvar em PDF"
            >
              <Printer size={13} className="text-[#005a9e]" />
              <span>Imprimir Relatório (PDF)</span>
            </button>
            <span className="text-[10px] text-[#666666]">
              {notas.length} nota(s) inclusa(s) · {itensCount} item(ns) auditado(s)
            </span>
          </div>

          <button onClick={onClose} className="vb-btn">
            <span>Fechar</span>
          </button>
        </div>

        {/* Notificação para Modo Iframe */}
        {isIframe && (
          <div className="no-print bg-[#fff9e6] border-b border-[#e6c280] px-3 py-1.5 flex items-center gap-2 text-[#664400] text-[10px]">
            <span>💡</span>
            <span>
              <strong>Dica de Impressão:</strong> Se o navegador bloquear o diálogo direto nesta aba de desenvolvimento, abra o sistema em janela dedicada para impressão em folha A4 completa.
            </span>
          </div>
        )}

        {/* GroupBox de Parâmetros do Relatório (Empresa, Auditor, Anotações) */}
        <div className="no-print p-3 pb-0 shrink-0">
          <fieldset className="vb-groupbox m-0">
            <legend className="vb-legend">Parâmetros do Cabeçalho e Emissão do Relatório</legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {/* Razão Social / Empresa */}
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[#333333]">Nome da Empresa no Relatório:</span>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="vb-input flex-1 font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleSaveName}
                      className="vb-btn vb-btn-primary"
                    >
                      <Check size={11} />
                      <span>OK</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-white border border-[#7a7a7a] px-2 py-1">
                    <span className="font-bold text-[#003366] truncate max-w-[220px]" title={reportCompanyName}>
                      {reportCompanyName}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setTempName(reportCompanyName);
                        setIsEditingName(true);
                      }}
                      className="vb-btn py-0 px-1 text-[9px]"
                      title="Editar nome exibido"
                    >
                      <Edit2 size={10} />
                    </button>
                  </div>
                )}
              </div>

              {/* Auditor Responsável */}
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[#333333]">Auditor Responsável:</span>
                <input
                  type="text"
                  value={auditorName}
                  onChange={(e) => {
                    setAuditorName(e.target.value);
                    localStorage.setItem("difal_auditor_name", e.target.value);
                  }}
                  className="vb-input font-bold"
                  placeholder="Ex: Auditor Tributário"
                />
              </div>

              {/* Anotações Executivas */}
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[#333333]">Anotações do Auditor (Rodapé):</span>
                <input
                  type="text"
                  value={annotations}
                  onChange={(e) => {
                    setAnnotations(e.target.value);
                    localStorage.setItem("difal_report_annotations", e.target.value);
                  }}
                  className="vb-input"
                  placeholder="Ex: Operações sem pendências graves..."
                />
              </div>
            </div>
          </fieldset>
        </div>

        {/* Área de Visualização do Papel do Relatório */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#e5e5e5] custom-scrollbar print:p-0 print:bg-white print:overflow-visible">
          <div
            id="printable-report"
            className="bg-white border border-[#999999] p-6 shadow-sm max-w-4xl mx-auto print:border-none print:shadow-none print:p-0 text-black font-sans"
          >
            {/* Cabeçalho do Relatório */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#003366] text-white print:bg-transparent print:text-black print:border print:border-black">
                  <FileText size={24} />
                </div>
                <div>
                  <h1 className="text-base font-black uppercase tracking-tight text-[#002244] print:text-black">
                    Relatório Consolidado de Auditoria Fiscal
                  </h1>
                  <p className="text-[10px] text-[#555555] font-semibold uppercase print:text-black">
                    Demonstrativo Auxiliar do DIFAL / Antecipação Interestadual
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right text-[10px]">
                <p className="font-bold">Emissão: <span className="font-mono">{currentDateStr}</span></p>
                <p className="text-[#555555] print:text-black">Apuração Local Automatizada</p>
                <p className="font-mono text-[#888888] print:text-black text-[9px]">ID: AUD-{Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              </div>
            </div>

            {/* Metadados da Empresa Auditada */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#fbfbfb] border border-[#c0c0c0] p-3 mb-4 text-[10px] print:bg-white print:border-black">
              <div>
                <h4 className="font-bold text-[#003366] uppercase mb-1 flex items-center gap-1 print:text-black">
                  <Building size={11} /> Empresa Destinatária
                </h4>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-black">
                    {notas.length > 0 ? notas[0].razaoDest || reportCompanyName : reportCompanyName}
                  </p>
                  {notas.length > 0 ? (
                    <>
                      <p className="text-[#444444] print:text-black">
                        CNPJ: <strong className="font-mono">{notas[0].cnpjCpfDest || "—"}</strong>
                      </p>
                      <p className="text-[#444444] print:text-black">
                        UF Destinatária: <strong>{notas[0].ufDest || "—"}</strong>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[#444444] print:text-black">CNPJ: —</p>
                      <p className="text-[#444444] print:text-black">UF: —</p>
                    </>
                  )}
                  <p className="text-[#444444] print:text-black">
                    Regime Tributário:{" "}
                    <strong>
                      {notas.length > 0
                        ? notas[0].regimeDestAplicado === "simples"
                          ? "Simples Nacional"
                          : notas[0].regimeDestAplicado === "normal"
                          ? "Regime Normal"
                          : "Outro"
                        : config.regimeDest === "simples"
                        ? "Simples Nacional"
                        : "Regime Normal"}
                    </strong>
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-[#003366] uppercase mb-1 flex items-center gap-1 print:text-black">
                  <Calendar size={11} /> Escopo e Auditoria
                </h4>
                <div className="space-y-0.5 text-[#444444] print:text-black">
                  <p>
                    Documentos Fiscais: <strong>{notas.length} NF-e(s) interestaduais</strong>
                  </p>
                  <p>
                    Itens de Mercadoria Auditados: <strong>{itensCount} itens</strong>
                  </p>
                  <p>
                    Auditor / Responsável: <strong>{auditorName}</strong>
                  </p>
                  <p>
                    Observações Parâmetros: <strong>{config.obsLivre || "Nenhuma constante."}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Quadro de Totais Acumulados */}
            <div className="grid grid-cols-4 gap-2 mb-4 text-center">
              <div className="border border-[#c0c0c0] p-2 bg-[#f9f9f9] print:bg-white print:border-black">
                <span className="text-[9px] text-[#555555] uppercase font-bold print:text-black">Total Operações</span>
                <p className="text-xs font-bold font-mono mt-0.5">{formatBRL(totalValorXML)}</p>
              </div>
              <div className="border border-[#c0c0c0] p-2 bg-[#f9f9f9] print:bg-white print:border-black">
                <span className="text-[9px] text-[#555555] uppercase font-bold print:text-black">DIFAL Calculado</span>
                <p className="text-xs font-bold font-mono mt-0.5">{formatBRL(totalDIFALPuro)}</p>
              </div>
              <div className="border border-[#c0c0c0] p-2 bg-[#f9f9f9] print:bg-white print:border-black">
                <span className="text-[9px] text-[#555555] uppercase font-bold print:text-black">Adicional FCP</span>
                <p className="text-xs font-bold font-mono mt-0.5">{formatBRL(totalFCP)}</p>
              </div>
              <div className="border border-[#003366] p-2 bg-[#eaf3ff] text-[#002244] print:bg-white print:text-black print:border-black">
                <span className="text-[9px] uppercase font-black text-[#003366] print:text-black">Total a Recolher</span>
                <p className="text-sm font-black font-mono mt-0.5">{formatBRL(totalRecolher)}</p>
              </div>
            </div>

            {/* Parâmetros do Cálculo Aplicados */}
            <div className="border border-[#c0c0c0] p-2 bg-[#fafafa] text-[10px] text-[#444444] mb-4 print:bg-white print:border-black">
              <strong>Parâmetros Fiscais Aplicados:</strong> Cálculo Por Dentro:{" "}
              <strong>{config.calcPorDentro === "yes" ? "Sim (Base Dupla)" : "Não (Base Simples)"}</strong> ·{" "}
              Inclui IPI Consumidor: <strong>{config.includeIPI === "yes" ? "Sim" : "Não"}</strong> ·{" "}
              FCP Antecipação: <strong>{config.applyFcpAntecipacao === "yes" ? "Sim" : "Não"}</strong> ·{" "}
              Alíquota Interna Padrão: <strong>{config.aliqInterna}%</strong> · FCP Referência:{" "}
              <strong>{config.aliqFcp}%</strong>.
            </div>

            {/* Tabela Detalhada de Notas */}
            <div className="mb-4">
              <h3 className="text-[11px] font-bold text-[#003366] uppercase mb-1 pb-0.5 border-b border-[#999999] print:text-black">
                Relação Consolidada por Nota Fiscal
              </h3>
              <div className="print-table-container overflow-x-auto">
                <table className="w-full text-left border-collapse text-[9px] border border-[#999999]">
                  <thead>
                    <tr className="bg-[#f0f0f0] border-b border-[#999999] font-bold text-[#222222] print:bg-transparent print:text-black">
                      <th className="p-1 border-r border-[#d0d0d0]">NF-e</th>
                      <th className="p-1 border-r border-[#d0d0d0]">Data Emis.</th>
                      <th className="p-1 border-r border-[#d0d0d0]">Emitente</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-center">Origem</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-center">Enquadramento</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-right">Op. s/IPI</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-right">IPI</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-right">DIFAL</th>
                      <th className="p-1 border-r border-[#d0d0d0] text-right">FCP</th>
                      <th className="p-1 text-right font-bold text-black">Total Recolher</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notas.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-2 text-center text-[#888888] italic">
                          Nenhum documento fiscal processado.
                        </td>
                      </tr>
                    ) : (
                      notas.map((n, idx) => (
                        <tr key={`${n.nNF}_rep_${idx}`} className="border-b border-[#e5e5e5]">
                          <td className="p-1 font-mono font-bold border-r border-[#e5e5e5]">{n.nNF}</td>
                          <td className="p-1 whitespace-nowrap border-r border-[#e5e5e5]">{n.dataEmissao}</td>
                          <td className="p-1 truncate max-w-[170px] border-r border-[#e5e5e5]" title={n.razaoRem}>
                            {n.razaoRem}
                          </td>
                          <td className="p-1 text-center font-bold border-r border-[#e5e5e5]">{n.ufRem}</td>
                          <td className="p-1 text-center border-r border-[#e5e5e5]">{n.modeLabel}</td>
                          <td className="p-1 text-right font-mono border-r border-[#e5e5e5]">{formatBRL(n.valorOperSemIPITotal)}</td>
                          <td className="p-1 text-right font-mono border-r border-[#e5e5e5]">{formatBRL(n.valorIPITotal)}</td>
                          <td className="p-1 text-right font-mono border-r border-[#e5e5e5]">{formatBRL(n.difalPuroTotal)}</td>
                          <td className="p-1 text-right font-mono border-r border-[#e5e5e5]">{formatBRL(n.fcpCalcTotal)}</td>
                          <td className="p-1 text-right font-mono font-bold bg-[#fbfbfb]">{formatBRL(n.totalRecolher)}</td>
                        </tr>
                      ))
                    )}
                    {/* Linha de Totais Gerais */}
                    <tr className="bg-[#f0f0f0] font-bold text-[10px] border-t-2 border-[#999999] print:bg-transparent">
                      <td colSpan={5} className="p-1.5 text-right uppercase">Totais Acumulados:</td>
                      <td className="p-1.5 text-right font-mono">{formatBRL(totalOperSemIPI)}</td>
                      <td className="p-1.5 text-right font-mono">{formatBRL(totalIPITotal)}</td>
                      <td className="p-1.5 text-right font-mono">{formatBRL(totalDIFALPuro)}</td>
                      <td className="p-1.5 text-right font-mono">{formatBRL(totalFCP)}</td>
                      <td className="p-1.5 text-right font-mono font-black text-[#003366] print:text-black">{formatBRL(totalRecolher)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anotações do Auditor */}
            {annotations.trim().length > 0 && (
              <div className="mb-4 p-2.5 bg-[#fefefe] border border-[#b5b5b5] text-[10px] print:bg-white print:border-black">
                <strong className="block text-[#003366] print:text-black mb-0.5">Anotações do Diagnóstico Fiscal:</strong>
                <p className="text-[#333333] print:text-black leading-relaxed">{annotations}</p>
              </div>
            )}

            {/* Rodapé Legal / Disclaimer */}
            <div className="mt-6 text-[8.5px] text-[#777777] text-center border-t border-[#d0d0d0] pt-2 print:text-black">
              * Demonstrativo auxiliar gerado para fins de conciliação tributária preventiva e planejamento fiscal. Os valores devem ser confrontados com as guias oficiais de arrecadação (GNRE ou DARE-SP) em observância às normas da SEFAZ estadual.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
