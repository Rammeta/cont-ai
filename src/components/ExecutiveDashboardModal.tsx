import React, { useState } from "react";
import {
  X,
  Printer,
  DownloadCloud,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Truck,
  Landmark,
  ShieldCheck,
  Building2,
  FileSpreadsheet,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { DashboardData } from "../utils/dashboardHtmlGenerator";
import logoImg from "../../assets/logo.png";

interface ExecutiveDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: DashboardData;
  onExportHtml: () => Promise<void>;
  exportingHtml: boolean;
}

const formatBRL = (val: number) => {
  return (val || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDoc = (doc?: string) => {
  if (!doc) return "";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 14) {
    return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (clean.length === 11) {
    return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return doc;
};

const formatCompactBRL = (val: number) => {
  if (!val || val === 0) return "R$ 0";
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (val >= 1_000) return `R$ ${(val / 1_000).toFixed(0)}k`;
  return `R$ ${Math.round(val)}`;
};

export default function ExecutiveDashboardModal({
  isOpen,
  onClose,
  data,
  onExportHtml,
  exportingHtml,
}: ExecutiveDashboardModalProps) {
  if (!isOpen) return null;

  const { empresa, periodo, resumo, evolucaoMensal, topParceiros } = data;

  const totalMovimentadoGeral =
    resumo.totalNfeCompras +
    resumo.totalNfceSaidas +
    resumo.totalCteFretes +
    resumo.totalNfseTomadas +
    resumo.totalNfsePrestadas;

  const totalEntradas = resumo.totalNfeCompras + resumo.totalNfseTomadas + resumo.totalCteFretes;
  const totalSaidas = resumo.totalNfceSaidas + resumo.totalNfsePrestadas;
  const saldoComercial = totalSaidas - totalEntradas;
  const isSuperavit = saldoComercial >= 0;

  // Donut chart calculations
  const slices = [
    { label: "NF-e Compras (55)", valor: resumo.totalNfeCompras, cor: "#0284c7" },
    { label: "NFC-e Vendas (65)", valor: resumo.totalNfceSaidas, cor: "#9333ea" },
    { label: "CT-e Fretes (57)", valor: resumo.totalCteFretes, cor: "#d97706" },
    { label: "NFS-e Tomadas", valor: resumo.totalNfseTomadas, cor: "#059669" },
    { label: "NFS-e Prestadas", valor: resumo.totalNfsePrestadas, cor: "#10b981" },
  ].filter((s) => s.valor > 0);

  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  // Monthly bar chart calculations
  const rawMax = Math.max(
    ...evolucaoMensal.map((m) => Math.max(m.nfe, m.nfce, m.nfseTomada + m.nfsePrestada, m.total)),
    1000
  );
  // Escala amigável para o topo do gráfico
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxMonthVal = Math.max(Math.ceil(rawMax / (magnitude / 2)) * (magnitude / 2), 1000);

  const topY = 25;
  const baselineY = 220;
  const chartHeight = baselineY - topY; // 195px
  const yAxisWidth = 72;
  const barWidth = 15;
  const groupSpacing = 82;
  const chartWidth = Math.max(evolucaoMensal.length * groupSpacing + yAxisWidth + 50, 560);

  const yTicks = [
    { val: maxMonthVal, y: topY },
    { val: maxMonthVal * 0.75, y: topY + chartHeight * 0.25 },
    { val: maxMonthVal * 0.50, y: topY + chartHeight * 0.50 },
    { val: maxMonthVal * 0.25, y: topY + chartHeight * 0.75 },
    { val: 0, y: baselineY },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 select-none animate-fade-in"
      id="executive_dashboard_overlay"
    >
      <div
        className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-[96vw] max-w-6xl max-h-[92vh] flex flex-col overflow-hidden text-[#000000] text-[11px] font-sans"
        id="executive_dashboard_container"
      >
        <style>{`
          .vb-btn {
            background: linear-gradient(180deg, #ffffff 0%, #ececec 50%, #e0e0e0 100%);
            border: 1px solid #707070;
            border-radius: 2px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 500;
            color: #000000;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
            white-space: nowrap;
          }
          .vb-btn:hover {
            background: linear-gradient(180deg, #f5f8fc 0%, #e1e9f5 50%, #d4e1f2 100%);
            border-color: #3c7fb1;
          }
          .vb-btn-primary {
            background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
            border: 1px solid #336699;
            font-weight: 600;
            color: #002244;
          }
          fieldset.vb-groupbox {
            border: 1px solid #b0b0b0;
            padding: 8px 10px;
            background-color: #f7f7f7;
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
          }
          legend.vb-legend {
            font-weight: 600;
            font-size: 11px;
            color: #003366;
            padding: 0 4px;
          }
          .datagrid-table {
            border-collapse: separate;
            border-spacing: 0;
            width: 100%;
            font-size: 11px;
          }
          .datagrid-table th {
            background: linear-gradient(180deg, #f8f8f8 0%, #e6e6e6 100%);
            border-right: 1px solid #b0b0b0;
            border-bottom: 1px solid #888888;
            padding: 3px 6px;
            text-align: left;
            font-weight: 600;
            color: #222222;
            white-space: nowrap;
          }
          .datagrid-table td {
            border-right: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
            padding: 3px 6px;
            white-space: nowrap;
          }
          .datagrid-table tr:hover td {
            background-color: #f0f7ff;
          }
        `}</style>

        {/* Barra de Título Clássica do Windows / ERP */}
        <div className="bg-gradient-to-r from-[#003366] via-[#004c8c] to-[#005a9e] text-white px-2.5 py-1.5 flex items-center justify-between text-xs select-none">
          <div className="flex items-center gap-2">
            <img
              src={logoImg}
              alt="CONT-AI"
              className="h-4 w-auto object-contain brightness-110 drop-shadow-xs"
            />
            <div className="flex items-center gap-1.5 font-bold">
              <span>CONT-AI - Painel Executivo Fiscal & Apresentação Gerencial</span>
              <span className="text-[10px] bg-white/20 px-1 py-0.2 rounded-xs text-white font-mono font-normal">
                v2.0
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
            title="Fechar Painel (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Barra de Subtítulo e Ferramentas Clássica */}
        <div className="px-3 py-1.5 border-b border-[#b5b5b5] bg-[#e8e8e8] flex flex-wrap items-center justify-between gap-2 sticky top-0 z-30 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-xs text-[#003366] font-bold">Empresa: {empresa.razaoSocial}</strong>
            <span className="text-[11px] text-[#555555]">
              (CNPJ: <strong className="font-mono">{formatDoc(empresa.cnpj)}</strong> — UF: <strong>{empresa.uf || "SP"}</strong>)
            </span>
            <span className="text-[10px] bg-white text-[#003366] border border-[#a8c8ea] px-2 py-0.5 rounded-xs font-semibold">
              Período: {periodo}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onExportHtml}
              disabled={exportingHtml}
              className="vb-btn vb-btn-primary"
              title="Salva um arquivo HTML independente para apresentações e abre no navegador"
            >
              <DownloadCloud size={13} className={exportingHtml ? "animate-spin" : ""} />
              <span>{exportingHtml ? "Gerando HTML..." : "Exportar Dashboard (.html)"}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="vb-btn"
              title="Imprimir visualização em folha A4 ou salvar como PDF"
            >
              <Printer size={13} />
              <span>Imprimir / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="vb-btn"
              title="Fechar Janela"
            >
              <span>Fechar</span>
            </button>
          </div>
        </div>

        {/* Conteúdo Rolável do Dashboard */}
        <div className="p-3 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {/* Grid de KPIs Executivos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2">
            {/* 1. Compras */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className="bg-gradient-to-r from-[#f0f4f8] to-[#e4ecf5] px-2 py-1 border-b border-[#c8d8e8] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#003366]">
                  Compras (NF-e 55)
                </span>
                <ShoppingBag size={12} className="text-[#0284c7]" />
              </div>
              <div className="p-2">
                <p className="text-sm font-bold font-mono text-[#002244]">{formatBRL(resumo.totalNfeCompras)}</p>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {resumo.qtdNfe} notas recebidas
                </span>
              </div>
            </div>

            {/* 2. Vendas */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className="bg-gradient-to-r from-[#f7f0fb] to-[#eedef7] px-2 py-1 border-b border-[#dfc5ed] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b21a8]">
                  Vendas (NFC-e 65)
                </span>
                <ShoppingBag size={12} className="text-[#9333ea]" />
              </div>
              <div className="p-2">
                <p className="text-sm font-bold font-mono text-[#6b21a8]">{formatBRL(resumo.totalNfceSaidas)}</p>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {resumo.qtdNfce} cupons emitidos
                </span>
              </div>
            </div>

            {/* 3. Fretes */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className="bg-gradient-to-r from-[#fffbf0] to-[#fcefd2] px-2 py-1 border-b border-[#ebd39e] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#b45309]">
                  Fretes (CT-e 57)
                </span>
                <Truck size={12} className="text-[#d97706]" />
              </div>
              <div className="p-2">
                <p className="text-sm font-bold font-mono text-[#b45309]">{formatBRL(resumo.totalCteFretes)}</p>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {resumo.qtdCte} conhecimentos
                </span>
              </div>
            </div>

            {/* 4. Serviços Tomados */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className="bg-gradient-to-r from-[#f0faf5] to-[#def5eb] px-2 py-1 border-b border-[#bde9d7] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#047857]">
                  Serviços Tomados
                </span>
                <Landmark size={12} className="text-[#059669]" />
              </div>
              <div className="p-2">
                <p className="text-sm font-bold font-mono text-[#047857]">{formatBRL(resumo.totalNfseTomadas)}</p>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {resumo.qtdNfseTomadas} NFS-e tomadas
                </span>
              </div>
            </div>

            {/* 5. Serviços Prestados */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className="bg-gradient-to-r from-[#f2f4fc] to-[#e1e5f8] px-2 py-1 border-b border-[#c8d0f1] flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#3730a3]">
                  Serviços Prestados
                </span>
                <Landmark size={12} className="text-[#4338ca]" />
              </div>
              <div className="p-2">
                <p className="text-sm font-bold font-mono text-[#3730a3]">{formatBRL(resumo.totalNfsePrestadas)}</p>
                <span className="text-[10px] text-[#666666] mt-0.5 block">
                  {resumo.qtdNfsePrestadas} NFS-e emitidas
                </span>
              </div>
            </div>

            {/* 6. Resultado Comercial */}
            <div className="bg-white border border-[#b0b0b0] shadow-2xs flex flex-col justify-between">
              <div className={`px-2 py-1 border-b flex items-center justify-between ${
                isSuperavit
                  ? "bg-gradient-to-r from-[#f0faf5] to-[#def5eb] border-[#bde9d7]"
                  : "bg-gradient-to-r from-[#fdf2f2] to-[#fde2e2] border-[#f8b4b4]"
              }`}>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSuperavit ? "text-[#047857]" : "text-[#b91c1c]"}`}>
                  Resultado Comercial
                </span>
                {isSuperavit ? (
                  <TrendingUp size={12} className="text-[#047857]" />
                ) : (
                  <TrendingDown size={12} className="text-[#b91c1c]" />
                )}
              </div>
              <div className="p-2">
                <p className={`text-sm font-bold font-mono ${isSuperavit ? "text-[#047857]" : "text-[#b91c1c]"}`}>
                  {formatBRL(saldoComercial)}
                </p>
                <span className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${isSuperavit ? "text-[#047857]" : "text-[#b91c1c]"}`}>
                  {isSuperavit ? "Superávit Comercial" : "Déficit Comercial"}
                </span>
              </div>
            </div>
          </div>

          {/* Gráficos Visuais */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Gráfico 1: Evolução Mensal em Barras (2 colunas) com Altura Ampliada e Eixo Y em R$ */}
            <fieldset className="vb-groupbox bg-white p-2 min-w-0 shadow-2xs lg:col-span-2 flex flex-col justify-between">
              <legend className="vb-legend flex items-center gap-1.5">
                <BarChart3 size={13} className="text-[#005a9e]" />
                Evolução Mensal do Movimento (Compras vs Vendas vs Serviços)
              </legend>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1 px-1">
                <span className="text-[11px] text-[#555555]">
                  Valores consolidados por competência cronológica oficial (MM/AAAA)
                </span>
                <div className="flex items-center gap-3 text-[10px] font-bold shrink-0">
                  <span className="flex items-center gap-1 text-[#0284c7]">
                    <span className="w-2.5 h-2.5 rounded-2xs bg-[#0284c7] inline-block border border-[#026aa2]" /> Compras
                  </span>
                  <span className="flex items-center gap-1 text-[#9333ea]">
                    <span className="w-2.5 h-2.5 rounded-2xs bg-[#9333ea] inline-block border border-[#7e22ce]" /> Vendas
                  </span>
                  <span className="flex items-center gap-1 text-[#059669]">
                    <span className="w-2.5 h-2.5 rounded-2xs bg-[#059669] inline-block border border-[#047857]" /> Serviços
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto w-full pt-1">
                <svg viewBox={`0 0 ${chartWidth} 275`} style={{ width: "100%", minWidth: "520px", height: "250px" }}>
                  {/* Linhas de Grade e Rótulos do Eixo Y */}
                  {yTicks.map((tick, i) => (
                    <g key={i}>
                      <line
                        x1={yAxisWidth}
                        y1={tick.y}
                        x2={chartWidth - 20}
                        y2={tick.y}
                        stroke={tick.val === 0 ? "#94a3b8" : "#f1f5f9"}
                        strokeDasharray={tick.val === 0 ? undefined : "3,3"}
                        strokeWidth={tick.val === 0 ? 1.5 : 1}
                      />
                      <text
                        x={yAxisWidth - 8}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        fontSize="10"
                        fill="#64748b"
                        fontWeight="600"
                      >
                        {formatCompactBRL(tick.val)}
                      </text>
                    </g>
                  ))}

                  {/* Barras e Rótulos das Competências */}
                  {evolucaoMensal.map((m, idx) => {
                    const xGroup = yAxisWidth + 18 + idx * groupSpacing;
                    const hNfe = maxMonthVal > 0 ? (m.nfe / maxMonthVal) * chartHeight : 0;
                    const hNfce = maxMonthVal > 0 ? (m.nfce / maxMonthVal) * chartHeight : 0;
                    const hNfse = maxMonthVal > 0 ? ((m.nfseTomada + m.nfsePrestada) / maxMonthVal) * chartHeight : 0;

                    const yNfe = baselineY - hNfe;
                    const yNfce = baselineY - hNfce;
                    const yNfse = baselineY - hNfse;

                    return (
                      <g key={m.competencia} className="transition-all hover:opacity-90">
                        {/* Barra Compras NF-e */}
                        <rect x={xGroup} y={yNfe} width={barWidth} height={Math.max(hNfe, 1)} rx={1} fill="#0284c7">
                          <title>{`Competência ${m.competencia} · Compras NF-e: ${formatBRL(m.nfe)}`}</title>
                        </rect>
                        {/* Barra Vendas NFC-e */}
                        <rect x={xGroup + barWidth + 3} y={yNfce} width={barWidth} height={Math.max(hNfce, 1)} rx={1} fill="#9333ea">
                          <title>{`Competência ${m.competencia} · Vendas NFC-e: ${formatBRL(m.nfce)}`}</title>
                        </rect>
                        {/* Barra Serviços NFS-e */}
                        <rect x={xGroup + (barWidth + 3) * 2} y={yNfse} width={barWidth} height={Math.max(hNfse, 1)} rx={1} fill="#059669">
                          <title>{`Competência ${m.competencia} · Serviços NFS-e: ${formatBRL(m.nfseTomada + m.nfsePrestada)}`}</title>
                        </rect>
                        {/* Rótulo da Competência Oficial MM/AAAA */}
                        <text
                          x={xGroup + 26}
                          y={baselineY + 22}
                          textAnchor="middle"
                          fontSize="11"
                          fill="#334155"
                          fontWeight="700"
                        >
                          {m.competencia}
                        </text>
                        {/* Sub-rótulo de Total do Mês */}
                        <text
                          x={xGroup + 26}
                          y={baselineY + 36}
                          textAnchor="middle"
                          fontSize="9"
                          fill="#64748b"
                          fontWeight="600"
                        >
                          {formatCompactBRL(m.total)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </fieldset>

            {/* Gráfico 2: Donut Chart de Composição (1 coluna) */}
            <fieldset className="vb-groupbox bg-white p-2 min-w-0 shadow-2xs flex flex-col justify-between">
              <legend className="vb-legend flex items-center gap-1.5">
                <PieIcon size={13} className="text-[#005a9e]" />
                Composição do Movimento Fiscal
              </legend>

              <div className="flex flex-col items-center justify-center gap-3 flex-1 py-1">
                <svg width="150" height="150" viewBox="0 0 180 180">
                  {slices.map((slice) => {
                    const pct = totalMovimentadoGeral > 0 ? slice.valor / totalMovimentadoGeral : 0;
                    const strokeDash = `${pct * circumference} ${circumference}`;
                    const strokeOffset = -accumulatedPercent * circumference;
                    accumulatedPercent += pct;
                    return (
                      <circle
                        key={slice.label}
                        cx="90"
                        cy="90"
                        r={radius}
                        fill="transparent"
                        stroke={slice.cor}
                        strokeWidth="24"
                        strokeDasharray={strokeDash}
                        strokeDashoffset={strokeOffset}
                        className="transition-all hover:stroke-width-[28]"
                      >
                        <title>{`${slice.label}: ${formatBRL(slice.valor)} (${(pct * 100).toFixed(1)}%)`}</title>
                      </circle>
                    );
                  })}
                  <text x="90" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#64748b">
                    Total Geral
                  </text>
                  <text x="90" y="102" textAnchor="middle" fontSize="11" fontWeight="800" fill="#003366">
                    {formatBRL(totalMovimentadoGeral).split(",")[0]}
                  </text>
                </svg>

                <div className="space-y-1 w-full text-xs px-2">
                  {slices.map((s) => (
                    <div key={s.label} className="flex items-center justify-between text-[#333333] font-semibold text-[11px] py-0.5 border-b border-[#f0f0f0] last:border-none">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-2xs border border-black/10" style={{ backgroundColor: s.cor }} />
                        {s.label}
                      </span>
                      <strong className="text-[#003366] font-mono">{formatBRL(s.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>
          </div>

          {/* Tabelas de Detalhamento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Tabela 1: Demonstrativo por Mês */}
            <fieldset className="vb-groupbox bg-white p-0 min-w-0 shadow-2xs flex flex-col overflow-hidden">
              <div className="bg-[#e4e4e4] border-b border-[#b5b5b5] px-2 py-1 flex items-center justify-between text-xs">
                <span className="font-bold text-[#003366] flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#005a9e]" />
                  Demonstrativo por Competência (Ordem Cronológica)
                </span>
                <span className="text-[#555555] text-[10px]">
                  {evolucaoMensal.length} competência(s)
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="datagrid-table w-full">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "90px" }}>Competência</th>
                      <th style={{ textAlign: "right", minWidth: "85px" }}>Compras (NF-e)</th>
                      <th style={{ textAlign: "right", minWidth: "85px" }}>Vendas (NFC-e)</th>
                      <th style={{ textAlign: "right", minWidth: "85px" }}>Serviços (NFS-e)</th>
                      <th style={{ textAlign: "right", minWidth: "95px" }}>Total Geral</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evolucaoMensal.map((m) => (
                      <tr key={m.competencia}>
                        <td className="font-bold text-[#003366]">{m.competencia}</td>
                        <td className="text-right font-mono">{formatBRL(m.nfe)}</td>
                        <td className="text-right font-mono text-[#7e22ce]">{formatBRL(m.nfce)}</td>
                        <td className="text-right font-mono text-[#047857]">
                          {formatBRL(m.nfseTomada + m.nfsePrestada)}
                        </td>
                        <td className="text-right font-mono font-bold text-[#003366]">{formatBRL(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>

            {/* Tabela 2: Top Fornecedores / Parceiros com % de Participação Capped */}
            <fieldset className="vb-groupbox bg-white p-0 min-w-0 shadow-2xs flex flex-col overflow-hidden">
              <div className="bg-[#e4e4e4] border-b border-[#b5b5b5] px-2 py-1 flex items-center justify-between text-xs">
                <span className="font-bold text-[#003366] flex items-center gap-1.5">
                  <Building2 size={13} className="text-[#005a9e]" />
                  Top Parceiros Comerciais (Fornecedores & Prestadores)
                </span>
                <span className="text-[#555555] text-[10px]">
                  Exibindo até 7 maiores
                </span>
              </div>
              <div className="overflow-x-auto flex-1">
                <table className="datagrid-table w-full">
                  <thead>
                    <tr>
                      <th style={{ width: "32px", textAlign: "center" }}>#</th>
                      <th style={{ minWidth: "180px" }}>Parceiro / Razão Social</th>
                      <th style={{ width: "45px", textAlign: "right" }}>Qtd</th>
                      <th style={{ textAlign: "right", minWidth: "95px" }}>Volume (R$)</th>
                      <th style={{ textAlign: "right", width: "110px" }}>% Participação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topParceiros.slice(0, 7).map((p, i) => (
                      <tr key={p.nome + p.cnpj}>
                        <td className="text-center font-bold text-[#777777]">{i + 1}º</td>
                        <td>
                          <div className="font-semibold text-[#111111] truncate max-w-[200px]" title={p.nome}>
                            {p.nome}
                          </div>
                          <span className="text-[10px] text-[#666666] font-mono block">
                            {formatDoc(p.cnpj)} · {p.papel}
                          </span>
                        </td>
                        <td className="text-right font-mono">{p.qtdNotas}</td>
                        <td className="text-right font-mono font-bold text-[#003366]">{formatBRL(p.valorTotal)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-2 bg-[#e5e5e5] border border-[#cccccc] overflow-hidden shrink-0">
                              <div
                                className="h-full bg-[#005a9e]"
                                style={{ width: `${Math.min(100, Math.max(0, p.percentual))}%` }}
                              />
                            </div>
                            <span className="text-[#333333] font-mono font-bold text-[10px] w-10 text-right">
                              {Math.min(100, Math.max(0, p.percentual)).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>

          {/* Indicador Discreto de Notas Canceladas (Expurgadas da Análise) */}
          {resumo.totalCanceladas > 0 && (
            <div className="p-2 bg-[#fffbe6] border border-[#ffe58f] text-xs text-[#874d00] flex items-center gap-2">
              <span className="font-bold">⚠️ Auditoria Fiscal:</span>
              <span>
                Identificadas <strong>{resumo.totalCanceladas}</strong> nota(s) com evento de cancelamento ou substituição no período, as quais foram expurgadas dos cálculos operacionais e gráficos.
              </span>
            </div>
          )}
        </div>

        {/* Rodapé Clássico do Modal */}
        <div className="px-3 py-1.5 bg-[#f0f0f0] border-t border-[#b5b5b5] flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-[#555555] text-[11px]">
            <span>CONT-AI ERP · Gestor de Movimento Fiscal</span>
            <span>·</span>
            <span>Ambiente Seguro DPAPI</span>
            <span>·</span>
            <span>Auditoria Contábil Ativa</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="vb-btn"
            title="Fechar Janela"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
}
