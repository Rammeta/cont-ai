/**
 * Gerador de Relatório e Dashboard Executivo em HTML Autocontido
 * Padrão CONT-AI - Gestor de Movimento Fiscal (Visual Desktop ERP / WinForms)
 */

export interface DashboardData {
  empresa: {
    razaoSocial: string;
    cnpj: string;
    uf: string;
  };
  periodo: string;
  resumo: {
    totalNfeCompras: number;
    qtdNfe: number;
    difalTotal: number;
    totalNfceSaidas: number;
    qtdNfce: number;
    totalCteFretes: number;
    qtdCte: number;
    totalNfseTomadas: number;
    qtdNfseTomadas: number;
    retencoesTomadas: number;
    totalNfsePrestadas: number;
    qtdNfsePrestadas: number;
    totalCanceladas: number;
    totalTributosRecolher: number;
    totalGeralDocumentos: number;
  };
  evolucaoMensal: Array<{
    competencia: string;
    nfe: number;
    nfce: number;
    cte: number;
    nfseTomada: number;
    nfsePrestada: number;
    retencoes: number;
    total: number;
    qtd: number;
  }>;
  topParceiros: Array<{
    nome: string;
    cnpj: string;
    papel: string;
    qtdNotas: number;
    valorTotal: number;
    percentual: number;
  }>;
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

export function generateExecutiveDashboardHtml(data: DashboardData): string {
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

  // Gerar dados para o Donut Chart SVG
  const slices = [
    { label: "NF-e Compras (55)", valor: resumo.totalNfeCompras, cor: "#0284c7" },
    { label: "NFC-e Vendas (65)", valor: resumo.totalNfceSaidas, cor: "#9333ea" },
    { label: "CT-e Fretes (57)", valor: resumo.totalCteFretes, cor: "#d97706" },
    { label: "NFS-e Tomadas", valor: resumo.totalNfseTomadas, cor: "#059669" },
    { label: "NFS-e Prestadas", valor: resumo.totalNfsePrestadas, cor: "#10b981" },
  ].filter((s) => s.valor > 0);

  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const donutSegmentsSvg = slices
    .map((slice) => {
      const pct = totalMovimentadoGeral > 0 ? slice.valor / totalMovimentadoGeral : 0;
      const strokeDash = `${pct * circumference} ${circumference}`;
      const strokeOffset = -accumulatedPercent * circumference;
      accumulatedPercent += pct;
      return `<circle cx="90" cy="90" r="${radius}" fill="transparent" stroke="${slice.cor}" stroke-width="24" stroke-dasharray="${strokeDash}" stroke-dashoffset="${strokeOffset}"><title>${slice.label}: ${formatBRL(slice.valor)} (${(pct * 100).toFixed(1)}%)</title></circle>`;
    })
    .join("");

  // Gerar dados para o Bar Chart SVG de Evolução Mensal com Escala Y em R$
  const rawMax = Math.max(
    ...evolucaoMensal.map((m) => Math.max(m.nfe, m.nfce, m.nfseTomada + m.nfsePrestada, m.total)),
    1000
  );
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

  const yAxisSvg = yTicks
    .map(
      (tick) => `
      <g>
        <line x1="${yAxisWidth}" y1="${tick.y}" x2="${chartWidth - 20}" y2="${tick.y}" stroke="${tick.val === 0 ? "#94a3b8" : "#e5e5e5"}" ${tick.val === 0 ? "" : 'stroke-dasharray="3,3"'} stroke-width="${tick.val === 0 ? "1.5" : "1"}" />
        <text x="${yAxisWidth - 8}" y="${tick.y + 3.5}" text-anchor="end" font-size="10" fill="#64748b" font-weight="600">${formatCompactBRL(tick.val)}</text>
      </g>
    `
    )
    .join("");

  const monthlyBarsSvg = evolucaoMensal
    .map((m, idx) => {
      const xGroup = yAxisWidth + 18 + idx * groupSpacing;
      const hNfe = maxMonthVal > 0 ? (m.nfe / maxMonthVal) * chartHeight : 0;
      const hNfce = maxMonthVal > 0 ? (m.nfce / maxMonthVal) * chartHeight : 0;
      const hNfse = maxMonthVal > 0 ? ((m.nfseTomada + m.nfsePrestada) / maxMonthVal) * chartHeight : 0;

      const yNfe = baselineY - hNfe;
      const yNfce = baselineY - hNfce;
      const yNfse = baselineY - hNfse;

      return `
        <g>
          <!-- Barra Compras NF-e -->
          <rect x="${xGroup}" y="${yNfe}" width="${barWidth}" height="${Math.max(hNfe, 1)}" rx="1" fill="#0284c7">
            <title>Competência ${m.competencia} - Compras NF-e: ${formatBRL(m.nfe)}</title>
          </rect>
          <!-- Barra Vendas NFC-e -->
          <rect x="${xGroup + barWidth + 3}" y="${yNfce}" width="${barWidth}" height="${Math.max(hNfce, 1)}" rx="1" fill="#9333ea">
            <title>Competência ${m.competencia} - Vendas NFC-e: ${formatBRL(m.nfce)}</title>
          </rect>
          <!-- Barra Serviços NFS-e -->
          <rect x="${xGroup + (barWidth + 3) * 2}" y="${yNfse}" width="${barWidth}" height="${Math.max(hNfse, 1)}" rx="1" fill="#059669">
            <title>Competência ${m.competencia} - Serviços (Tom/Prest): ${formatBRL(m.nfseTomada + m.nfsePrestada)}</title>
          </rect>
          <!-- Label Eixo X Competência MM/AAAA -->
          <text x="${xGroup + 26}" y="${baselineY + 22}" text-anchor="middle" font-size="11" fill="#334155" font-weight="700">${m.competencia}</text>
          <!-- Sub-label Total do Mês -->
          <text x="${xGroup + 26}" y="${baselineY + 36}" text-anchor="middle" font-size="9" fill="#64748b" font-weight="600">${formatCompactBRL(m.total)}</text>
        </g>
      `;
    })
    .join("");

  const nowFormatted = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CONT-AI · Dashboard Executivo Fiscal — ${empresa.razaoSocial}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #e8e8e8;
      color: #222222;
      padding: 10px;
      line-height: 1.4;
      font-size: 11px;
    }

    .erp-window {
      max-width: 1320px;
      margin: 0 auto;
      background: #f0f0f0;
      border: 1px solid #777777;
      box-shadow: 0 4px 12px rgba(0,0,0,0.18);
      display: flex;
      flex-direction: column;
    }

    /* Barra Superior Clássica WinForms */
    .erp-titlebar {
      background: linear-gradient(180deg, #003366 0%, #001f3f 100%);
      color: #ffffff;
      padding: 5px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #001122;
    }

    .titlebar-left {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.02em;
    }

    .titlebar-app {
      color: #ffffff;
    }

    .titlebar-sub {
      color: #99c2ff;
      font-weight: normal;
    }

    /* Barra de Subtítulo e Ferramentas */
    .erp-toolbar {
      background: #e8e8e8;
      border-bottom: 1px solid #b5b5b5;
      padding: 6px 8px;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .company-details {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 11px;
    }

    .company-details strong {
      color: #003366;
    }

    .badge-periodo {
      background: #ffffff;
      color: #003366;
      border: 1px solid #a8c8ea;
      padding: 1px 6px;
      border-radius: 2px;
      font-weight: 600;
      font-size: 10px;
    }

    .vb-btn {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      background: linear-gradient(180deg, #f0f0f0 0%, #e0e0e0 100%);
      border: 1px solid #999999;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #111111;
      text-decoration: none;
      box-shadow: 0 1px 0 rgba(255,255,255,0.7) inset;
    }

    .vb-btn:hover {
      background: linear-gradient(180deg, #e8e8e8 0%, #d5d5d5 100%);
      border-color: #777777;
    }

    .vb-btn-primary {
      background: linear-gradient(180deg, #e6f2ff 0%, #cce5ff 100%);
      border-color: #005a9e;
      color: #003366;
      font-weight: bold;
    }

    .vb-btn-primary:hover {
      background: linear-gradient(180deg, #d8ecff 0%, #bddcff 100%);
    }

    /* Conteúdo Principal */
    .erp-content {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #fbfbfb;
    }

    /* Groupbox Clássico */
    .vb-groupbox {
      border: 1px solid #999999;
      padding: 6px 8px 8px 8px;
      background: #ffffff;
      margin: 0;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }

    .vb-legend {
      font-size: 11px;
      font-weight: bold;
      color: #003366;
      padding: 0 4px;
      margin-left: 4px;
    }

    /* Grid de KPIs */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 6px;
    }

    @media (max-width: 1024px) {
      .kpi-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 640px) {
      .kpi-grid {
        grid-template-columns: 1fr;
      }
    }

    .kpi-card {
      background: #ffffff;
      border: 1px solid #b0b0b0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 1px 1px rgba(0,0,0,0.04);
    }

    .kpi-card-header {
      padding: 3px 6px;
      border-bottom: 1px solid #e0e0e0;
      background: linear-gradient(180deg, #f0f4f8 0%, #e2ebf5 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .kpi-card-header.superavit {
      background: linear-gradient(180deg, #f0faf5 0%, #def5eb 100%);
      border-bottom-color: #bde9d7;
    }

    .kpi-card-header.deficit {
      background: linear-gradient(180deg, #fdf2f2 0%, #fde2e2 100%);
      border-bottom-color: #f8b4b4;
    }

    .kpi-card-title {
      font-size: 10px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      color: #003366;
    }

    .kpi-card-title.superavit { color: #047857; }
    .kpi-card-title.deficit { color: #b91c1c; }

    .kpi-card-body {
      padding: 6px 8px;
    }

    .kpi-card-value {
      font-size: 14px;
      font-weight: bold;
      font-family: Consolas, "Courier New", monospace;
      color: #111111;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kpi-card-value.blue { color: #003366; }
    .kpi-card-value.purple { color: #6b21a8; }
    .kpi-card-value.amber { color: #b45309; }
    .kpi-card-value.emerald { color: #047857; }
    .kpi-card-value.teal { color: #0f766e; }
    .kpi-card-value.superavit { color: #047857; }
    .kpi-card-value.deficit { color: #b91c1c; }

    .kpi-card-sub {
      font-size: 10px;
      color: #666666;
      margin-top: 2px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Gráficos Visuais */
    .charts-row {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 6px;
    }

    @media (max-width: 960px) {
      .charts-row {
        grid-template-columns: 1fr;
      }
    }

    .chart-legend-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
      padding: 0 4px;
      font-size: 10px;
    }

    .chart-colors {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: bold;
    }

    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }

    .legend-chip-box {
      width: 9px;
      height: 9px;
      display: inline-block;
      border: 1px solid rgba(0,0,0,0.15);
    }

    .donut-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 4px 0;
    }

    .donut-list {
      width: 100%;
      padding: 0 6px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .donut-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      padding: 2px 0;
      border-bottom: 1px solid #f0f0f0;
      color: #333333;
      font-weight: 600;
    }

    .donut-row:last-child {
      border-bottom: none;
    }

    /* Tabelas Clássicas .datagrid-table */
    .tables-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }

    @media (max-width: 960px) {
      .tables-row {
        grid-template-columns: 1fr;
      }
    }

    .table-header-strip {
      background: #e4e4e4;
      border-bottom: 1px solid #b5b5b5;
      padding: 3px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      font-weight: bold;
      color: #003366;
    }

    .table-scroll {
      overflow-x: auto;
      width: 100%;
    }

    .datagrid-table {
      border-collapse: collapse;
      width: 100%;
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    .datagrid-table th {
      background: linear-gradient(180deg, #f9f9f9 0%, #ececec 100%);
      border-right: 1px solid #d0d0d0;
      border-bottom: 1px solid #a0a0a0;
      padding: 3px 6px;
      font-weight: 600;
      color: #333333;
      white-space: nowrap;
      text-align: left;
    }

    .datagrid-table th.text-right {
      text-align: right;
    }

    .datagrid-table td {
      border-right: 1px solid #e5e5e5;
      border-bottom: 1px solid #e5e5e5;
      padding: 3px 6px;
      color: #222222;
      white-space: nowrap;
    }

    .datagrid-table td.text-right {
      text-align: right;
      font-family: Consolas, "Courier New", monospace;
    }

    .datagrid-table tr:hover td {
      background-color: #f0f7ff !important;
    }

    .datagrid-table tr:nth-child(even) td {
      background-color: #fafafa;
    }

    .datagrid-table tfoot td {
      background: #f0f4f8;
      font-weight: bold;
      border-top: 2px solid #b0b0b0;
    }

    .progress-bar-bg {
      width: 48px;
      height: 7px;
      background: #e5e5e5;
      border: 1px solid #cccccc;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-right: 4px;
    }

    .progress-bar-fill {
      height: 100%;
      background: #005a9e;
    }

    /* Auditoria Fiscal Callout */
    .audit-box {
      padding: 6px 10px;
      background: #fffbe6;
      border: 1px solid #ffe58f;
      color: #874d00;
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    /* Rodapé do Modal / Assinaturas */
    .erp-footer {
      background: #f0f0f0;
      border-top: 1px solid #b5b5b5;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #555555;
    }

    .footer-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin: 12px 10px 4px 10px;
      padding-top: 10px;
      border-top: 1px dashed #cccccc;
    }

    .sign-box {
      border-top: 1px solid #333333;
      text-align: center;
      padding-top: 4px;
      font-size: 11px;
      font-weight: bold;
      color: #333333;
    }

    .sign-sub {
      font-size: 10px;
      color: #666666;
      font-weight: normal;
    }

    /* Impressão em A4 Oficial */
    @media print {
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }

      .erp-window {
        border: none !important;
        box-shadow: none !important;
        max-width: 100% !important;
      }

      .vb-btn, .no-print {
        display: none !important;
      }

      .kpi-card, .vb-groupbox {
        border: 1px solid #999999 !important;
        break-inside: avoid;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="erp-window">
    
    <!-- Barra Superior Clássica WinForms -->
    <div class="erp-titlebar">
      <div class="titlebar-left">
        <span class="titlebar-app">CONT-AI - Gestor de Movimento Fiscal</span>
        <span class="titlebar-sub">· Painel Executivo do Movimento Fiscal Consolidado</span>
      </div>
      <div class="no-print">
        <button type="button" class="vb-btn" onclick="window.print()" title="Imprimir em folha A4 ou salvar como PDF">
          🖨️ Imprimir / Salvar em PDF
        </button>
      </div>
    </div>

    <!-- Barra de Subtítulo e Ferramentas Clássica -->
    <div class="erp-toolbar">
      <div class="company-details">
        <strong>Empresa: ${empresa.razaoSocial}</strong>
        <span>(CNPJ: <strong style="font-family: Consolas, monospace;">${formatDoc(empresa.cnpj)}</strong> — UF: <strong>${empresa.uf || "SP"}</strong>)</span>
        <span class="badge-periodo">Período: ${periodo}</span>
      </div>
      <div style="font-size: 10px; color: #555555;">
        Emissão: <strong>${nowFormatted}</strong> · Processamento Local Seguro DPAPI
      </div>
    </div>

    <!-- Área de Conteúdo do ERP -->
    <div class="erp-content">
      
      <!-- Grid de KPIs Clássicos -->
      <div class="kpi-grid">
        <!-- 1. Compras NF-e -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Compras (NF-e 55)</span>
            <span style="font-size: 11px;">📥</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value blue">${formatBRL(resumo.totalNfeCompras)}</div>
            <div class="kpi-card-sub">
              <span>${resumo.qtdNfe} notas</span>
              <span>DIFAL: ${formatBRL(resumo.difalTotal)}</span>
            </div>
          </div>
        </div>

        <!-- 2. Vendas NFC-e -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Vendas (NFC-e 65)</span>
            <span style="font-size: 11px;">🛒</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value purple">${formatBRL(resumo.totalNfceSaidas)}</div>
            <div class="kpi-card-sub">
              <span>${resumo.qtdNfce} cupons emitidos</span>
              <span>Consumidor</span>
            </div>
          </div>
        </div>

        <!-- 3. Fretes CT-e -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Fretes (CT-e 57)</span>
            <span style="font-size: 11px;">🚚</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value amber">${formatBRL(resumo.totalCteFretes)}</div>
            <div class="kpi-card-sub">
              <span>${resumo.qtdCte} conhecimentos</span>
              <span>Transportes</span>
            </div>
          </div>
        </div>

        <!-- 4. Serviços Tomados -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Serviços Tomados</span>
            <span style="font-size: 11px;">🛠️</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value emerald">${formatBRL(resumo.totalNfseTomadas)}</div>
            <div class="kpi-card-sub">
              <span>${resumo.qtdNfseTomadas} NFS-e</span>
              <span>Ret: ${formatBRL(resumo.retencoesTomadas)}</span>
            </div>
          </div>
        </div>

        <!-- 5. Serviços Prestados -->
        <div class="kpi-card">
          <div class="kpi-card-header">
            <span class="kpi-card-title">Serviços Prestados</span>
            <span style="font-size: 11px;">📑</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value teal">${formatBRL(resumo.totalNfsePrestadas)}</div>
            <div class="kpi-card-sub">
              <span>${resumo.qtdNfsePrestadas} NFS-e</span>
              <span>Faturamento</span>
            </div>
          </div>
        </div>

        <!-- 6. Resultado Comercial -->
        <div class="kpi-card">
          <div class="kpi-card-header ${isSuperavit ? "superavit" : "deficit"}">
            <span class="kpi-card-title ${isSuperavit ? "superavit" : "deficit"}">Resultado Comercial</span>
            <span style="font-size: 11px;">${isSuperavit ? "📈" : "📉"}</span>
          </div>
          <div class="kpi-card-body">
            <div class="kpi-card-value ${isSuperavit ? "superavit" : "deficit"}">${formatBRL(saldoComercial)}</div>
            <div class="kpi-card-sub">
              <strong style="color: ${isSuperavit ? "#047857" : "#b91c1c"}">${isSuperavit ? "Superávit Comercial" : "Déficit Comercial"}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Gráficos Visuais -->
      <div class="charts-row">
        <!-- Gráfico 1: Evolução Mensal -->
        <fieldset class="vb-groupbox">
          <legend class="vb-legend">📊 Evolução Mensal do Movimento (Compras vs Vendas vs Serviços)</legend>
          
          <div class="chart-legend-row">
            <span style="color: #555555;">Valores consolidados por competência cronológica oficial (MM/AAAA)</span>
            <div class="chart-colors">
              <span class="legend-chip" style="color: #0284c7;">
                <span class="legend-chip-box" style="background: #0284c7;"></span> Compras
              </span>
              <span class="legend-chip" style="color: #9333ea;">
                <span class="legend-chip-box" style="background: #9333ea;"></span> Vendas
              </span>
              <span class="legend-chip" style="color: #059669;">
                <span class="legend-chip-box" style="background: #059669;"></span> Serviços
              </span>
            </div>
          </div>

          <div style="overflow-x: auto; width: 100%; padding-top: 4px;">
            <svg viewBox="0 0 ${chartWidth} 275" style="width: 100%; min-width: 520px; height: 240px;">
              ${yAxisSvg}
              ${monthlyBarsSvg}
            </svg>
          </div>
        </fieldset>

        <!-- Gráfico 2: Composição do Movimento -->
        <fieldset class="vb-groupbox" style="display: flex; flex-direction: column; justify-content: space-between;">
          <legend class="vb-legend">🎯 Composição do Movimento Fiscal</legend>

          <div class="donut-wrapper">
            <svg width="150" height="150" viewBox="0 0 180 180">
              ${donutSegmentsSvg}
              <text x="90" y="86" text-anchor="middle" font-size="10" font-weight="bold" fill="#64748b">Total Geral</text>
              <text x="90" y="102" text-anchor="middle" font-size="11" font-weight="800" fill="#003366">${formatBRL(totalMovimentadoGeral).split(",")[0]}</text>
            </svg>

            <div class="donut-list">
              ${slices
                .map(
                  (s) => `
                <div class="donut-row">
                  <span style="display: flex; align-items: center; gap: 4px;">
                    <span style="width: 8px; height: 8px; background: ${s.cor}; display: inline-block; border: 1px solid rgba(0,0,0,0.15);"></span>
                    ${s.label}
                  </span>
                  <strong style="color: #003366; font-family: Consolas, monospace;">${formatBRL(s.valor)}</strong>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        </fieldset>
      </div>

      <!-- Tabelas Clássicas de Detalhamento -->
      <div class="tables-row">
        <!-- Tabela 1: Demonstrativo por Competência -->
        <fieldset class="vb-groupbox" style="padding: 0; overflow: hidden;">
          <div class="table-header-strip">
            <span>📅 Demonstrativo Sintético por Competência (Ordem Cronológica)</span>
            <span style="font-size: 10px; color: #555555; font-weight: normal;">${evolucaoMensal.length} competência(s)</span>
          </div>
          <div class="table-scroll">
            <table class="datagrid-table">
              <thead>
                <tr>
                  <th style="min-width: 80px;">Competência</th>
                  <th class="text-right" style="min-width: 80px;">Compras (NF-e)</th>
                  <th class="text-right" style="min-width: 80px;">Vendas (NFC-e)</th>
                  <th class="text-right" style="min-width: 80px;">Fretes (CT-e)</th>
                  <th class="text-right" style="min-width: 80px;">Serviços</th>
                  <th class="text-right" style="min-width: 90px;">Total Mês</th>
                </tr>
              </thead>
              <tbody>
                ${evolucaoMensal
                  .map(
                    (m) => `
                  <tr>
                    <td><strong style="color: #003366;">${m.competencia}</strong></td>
                    <td class="text-right">${formatBRL(m.nfe)}</td>
                    <td class="text-right" style="color: #6b21a8;">${formatBRL(m.nfce)}</td>
                    <td class="text-right" style="color: #b45309;">${formatBRL(m.cte)}</td>
                    <td class="text-right" style="color: #047857;">${formatBRL(m.nfseTomada + m.nfsePrestada)}</td>
                    <td class="text-right" style="font-weight: bold; color: #003366;">${formatBRL(m.total)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td>TOTAIS</td>
                  <td class="text-right">${formatBRL(resumo.totalNfeCompras)}</td>
                  <td class="text-right">${formatBRL(resumo.totalNfceSaidas)}</td>
                  <td class="text-right">${formatBRL(resumo.totalCteFretes)}</td>
                  <td class="text-right">${formatBRL(resumo.totalNfseTomadas + resumo.totalNfsePrestadas)}</td>
                  <td class="text-right" style="color: #003366;">${formatBRL(totalMovimentadoGeral)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </fieldset>

        <!-- Tabela 2: Top Parceiros Comerciais -->
        <fieldset class="vb-groupbox" style="padding: 0; overflow: hidden;">
          <div class="table-header-strip">
            <span>🏆 Top Parceiros Comerciais (Fornecedores & Prestadores)</span>
            <span style="font-size: 10px; color: #555555; font-weight: normal;">Exibindo até 7 maiores</span>
          </div>
          <div class="table-scroll">
            <table class="datagrid-table">
              <thead>
                <tr>
                  <th style="width: 28px; text-align: center;">#</th>
                  <th style="min-width: 170px;">Razão Social / Parceiro</th>
                  <th class="text-right" style="width: 40px;">Qtd</th>
                  <th class="text-right" style="min-width: 90px;">Volume (R$)</th>
                  <th class="text-right" style="width: 105px;">% Part.</th>
                </tr>
              </thead>
              <tbody>
                ${topParceiros.slice(0, 7)
                  .map(
                    (p, i) => `
                  <tr>
                    <td style="text-align: center; color: #777777; font-weight: bold;">${i + 1}º</td>
                    <td>
                      <div style="font-weight: 600; color: #111111; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${p.nome}">${p.nome}</div>
                      <span style="font-size: 10px; color: #666666; font-family: Consolas, monospace;">${formatDoc(p.cnpj)} · ${p.papel}</span>
                    </td>
                    <td class="text-right">${p.qtdNotas}</td>
                    <td class="text-right" style="font-weight: bold; color: #003366;">${formatBRL(p.valorTotal)}</td>
                    <td class="text-right">
                      <div class="progress-bar-bg">
                        <div class="progress-bar-fill" style="width: ${Math.min(100, Math.max(0, p.percentual))}%;"></div>
                      </div>
                      <span style="font-family: Consolas, monospace; font-weight: bold;">${Math.min(100, Math.max(0, p.percentual)).toFixed(1)}%</span>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </fieldset>
      </div>

      <!-- Auditoria Fiscal Callout -->
      ${resumo.totalCanceladas > 0 ? `
      <div class="audit-box">
        <strong>⚠️ Auditoria Fiscal:</strong>
        <span>Identificadas <strong>${resumo.totalCanceladas}</strong> nota(s) com evento de cancelamento ou substituição no período, as quais foram expurgadas dos cálculos operacionais e gráficos consolidados.</span>
      </div>
      ` : ""}

      <!-- Termo de Encerramento e Assinaturas -->
      <div class="footer-signatures">
        <div class="sign-box">
          <p>Responsável Técnico / Contabilidade</p>
          <p class="sign-sub">CRC / Registro Profissional</p>
        </div>
        <div class="sign-box">
          <p>Diretoria / Representante Legal da Empresa</p>
          <p class="sign-sub">${empresa.razaoSocial}</p>
        </div>
      </div>

    </div>

    <!-- Rodapé Clássico do Sistema -->
    <div class="erp-footer">
      <span>Relatório gerado automaticamente por <strong>CONT-AI - Gestor de Movimento Fiscal</strong> em ${nowFormatted}.</span>
      <span>Processamento Local & Seguro · Fidelidade às bases SEFAZ, ADN e PMSP · Ambiente DPAPI</span>
    </div>

  </div>
</body>
</html>
`;
}
