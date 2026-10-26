import React, { useState, useEffect, useMemo, useRef } from "react";
import { EmpresaSefaz, ParsedNfse, NotaAcompanhamentoItem } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import { useDebounce } from "../utils/useDebounce";
import {
  Building2,
  Calendar,
  Search,
  Download,
  FileText,
  Copy,
  Check,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  ChevronDown,
  RefreshCw,
  Clock,
  ShieldCheck,
  ShoppingBag,
  Truck,
  DownloadCloud,
  XCircle,
  Settings,
  BarChart3,
  Zap,
  ArrowLeft,
  FolderOpen,
  Globe
} from "lucide-react";
import {
  listCompanyXmls,
  listAvailableMonths,
  readXmlsContent,
  openDanfePdf,
  saveSingleXml,
  listNfseNotas,
  openNfsePdf,
  saveNfseXml,
  listCompanyNfceXmls,
  openNfceDanfePdf,
  saveSingleNfceXml,
  listCompanyCteXmls,
  openCteDactePdf,
  saveSingleCteXml,
  saveCsvFile,
  saveHtmlDashboard,
  openCompanyFolder
} from "../utils/electronBridge";
import { formatBRL, normalizeCompetencia, parseDateToTimestamp } from "../utils/calc";
import CertificateBadge from "./CertificateBadge";
import ExecutiveDashboardModal from "./ExecutiveDashboardModal";
import SyncAllProgressModal from "./SyncAllProgressModal";
import { DashboardData, generateExecutiveDashboardHtml } from "../utils/dashboardHtmlGenerator";
import logoImg from "../../assets/logo.png";

interface GuiaAcompanhamentoViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onNotify: (text: string, type: "success" | "error") => void;
  onOpenCompanyModal?: (tab?: "empresas" | "schedulers" | "storage") => void;
  onNavigateHub?: () => void;
  refreshKey?: number;
}

export default function GuiaAcompanhamentoView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onNotify,
  onOpenCompanyModal,
  onNavigateHub,
  refreshKey,
}: GuiaAcompanhamentoViewProps) {
  // Filtros
  const [selectedAno, setSelectedAno] = useState<string>("todos");
  const [selectedMes, setSelectedMes] = useState<string>("todos");
  const [activeTabFilter, setActiveTabFilter] = useState<
    "todas" | "nfe" | "nfce" | "cte" | "nfse_tomadas" | "nfse_prestadas"
  >("todas");
  const [extraFilter, setExtraFilter] = useState<"todos" | "canceladas">("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [displayLimit, setDisplayLimit] = useState<number>(100);
  const [sortColumn, setSortColumn] = useState<string>("emissao");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const handleHeaderSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Estados de sincronização e dados
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [itensConsolidados, setItensConsolidados] = useState<NotaAcompanhamentoItem[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Modificadores de teclado reais para CAPS e NUM da StatusBar
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isNumLockOn, setIsNumLockOn] = useState(true);

  // Relógio clássico no rodapé da StatusBar
  const [clock, setClock] = useState(() => {
    const now = new Date();
    return now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR");
  });

  const activeEmpresaCnpjRef = useRef<string | null>(activeEmpresa?.cnpj || null);
  const loadRequestIdRef = useRef<number>(0);

  useEffect(() => {
    activeEmpresaCnpjRef.current = activeEmpresa?.cnpj || null;
  }, [activeEmpresa?.cnpj]);

  // Atualização do relógio a cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setClock(now.toLocaleDateString("pt-BR") + " " + now.toLocaleTimeString("pt-BR"));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitoramento de CAPS LOCK e NUM LOCK em tempo real
  useEffect(() => {
    const handleModifiers = (e: KeyboardEvent | MouseEvent) => {
      if (e && typeof (e as any).getModifierState === "function") {
        setIsCapsLockOn((e as any).getModifierState("CapsLock"));
        setIsNumLockOn((e as any).getModifierState("NumLock"));
      }
    };

    window.addEventListener("keydown", handleModifiers);
    window.addEventListener("keyup", handleModifiers);
    window.addEventListener("mousemove", handleModifiers);
    return () => {
      window.removeEventListener("keydown", handleModifiers);
      window.removeEventListener("keyup", handleModifiers);
      window.removeEventListener("mousemove", handleModifiers);
    };
  }, []);

  // Carrega competências disponíveis da empresa (NF-e, NFC-e e NFS-e)
  useEffect(() => {
    if (!activeEmpresa) return;
    listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial)
      .then((months) => setAvailableMonths(months || []))
      .catch(() => setAvailableMonths([]));
  }, [activeEmpresa?.id]);

  // Carrega e consolida dados de NF-e (55), NFC-e (65), CT-e (57) e NFS-e
  const carregarDadosConsolidados = async () => {
    if (!activeEmpresa) {
      setItensConsolidados([]);
      return;
    }
    const targetCnpj = activeEmpresa.cnpj;
    const targetRazao = activeEmpresa.razaoSocial;
    const targetUf = activeEmpresa.uf;
    const reqId = ++loadRequestIdRef.current;

    setLoading(true);

    try {
      const itens: NotaAcompanhamentoItem[] = [];

      // 1. CARREGA NFS-e (Serviços Tomados e Prestados)
      const nfseRes = await listNfseNotas(
        targetCnpj,
        targetRazao,
        selectedAno,
        selectedMes,
        "todos"
      );
      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;

      if (nfseRes.success && nfseRes.notas) {
        nfseRes.notas.forEach((n: ParsedNfse) => {
          // Filtro estrito por Competência Fiscal (ignora data de emissão retroativa)
          if (selectedAno !== "todos" || selectedMes !== "todos") {
            const normComp = normalizeCompetencia(n.competencia || n.dataGeracao);
            if (selectedAno !== "todos" && normComp.year !== Number(selectedAno)) {
              return;
            }
            if (selectedMes !== "todos" && normComp.month !== Number(selectedMes)) {
              return;
            }
          }

          const isPrestada = (n.tipo || "").toLowerCase().includes("prest");
          const isCancelada = n.isCancelada || (n.situacao || "").toLowerCase().includes("cancelada");
          const valorBruto = Number(n.valorServicos) || 0;
          const valorLiquido = (n.valorLiquido !== undefined && n.valorLiquido !== null && Number(n.valorLiquido) > 0)
            ? Number(n.valorLiquido)
            : valorBruto;
          const vDescIncond = Number(n.descIncond) || 0;
          const vDescCond = Number(n.descCond) || 0;
          const totalDescontos = vDescIncond + vDescCond;
          const temDescontoCond = Boolean(n.temDescontoCond || vDescCond > 0);
          const temDescontoIncond = Boolean(n.temDescontoIncond || vDescIncond > 0);
          const difValores = Math.max(0, valorBruto - valorLiquido);
          const retencaoRestante = Math.max(0, difValores - totalDescontos);
          const temRetencao = Boolean(valorBruto > 0 && valorLiquido > 0 && retencaoRestante >= 0.01);
          const temDesconto = Boolean(n.temDesconto || temDescontoCond || temDescontoIncond || (difValores > 0 && !temRetencao));
          const retTotal = temRetencao ? retencaoRestante : 0;
          const valorDescFinal = totalDescontos > 0 ? totalDescontos : (temDesconto ? difValores : 0);

          let detalheTrib = "Sem Retenções";
          if (temRetencao && retTotal > 0) {
            detalheTrib = `Retenção Impostos: ${formatBRL(retTotal)}`;
          } else if (temDesconto && valorDescFinal > 0) {
            detalheTrib = `Desconto: ${formatBRL(valorDescFinal)}`;
          }

          const origemCaptacao =
            n.origemCaptacao ||
            ((n.tipo || "").toLowerCase().includes("são paulo") ? "PORTAL_SP" : "PORTAL_NACIONAL");

          itens.push({
            id: `nfse_${n.numeroNFe}_${n.prestadorCnpj}_${n.dataGeracao}`,
            origem: isPrestada ? "NFSE_PRESTADA" : "NFSE_TOMADA",
            origemCaptacao,
            tipoBadge: isPrestada ? "NFS-e Prestada" : "NFS-e Tomada",
            numero: n.numeroNFe || "S/N",
            serie: n.dpsSerie || "1",
            dataEmissao: n.dataGeracao || "",
            competencia: n.competencia || "",
            parceiroNome: isPrestada ? (n.tomadorNome || "Tomador não informado") : (n.prestadorNome || "Prestador não informado"),
            parceiroCnpj: isPrestada ? (n.tomadorCnpj || "") : (n.prestadorCnpj || ""),
            papelParceiro: isPrestada ? "Tomador" : "Prestador",
            valorTotal: valorBruto,
            valorLiquido,
            temRetencao,
            temDesconto,
            temDescontoCond,
            temDescontoIncond,
            valorDesconto: valorDescFinal,
            valorTributoRecolher: retTotal,
            detalheTributario: detalheTrib,
            temAlertaTributario: temRetencao,
            status: isCancelada ? "Cancelada" : "Normal",
            isCancelada,
            chaveAcesso: n.chaveNotaNacional || "",
            caminhoXml: n.caminhoXml,
            caminhoPdf: n.caminhoPdf,
          });
        });
      }

      // 2. CARREGA NF-e (Mercadorias - Entradas Modelo 55)
      try {
        const nfeTargetMonth = (selectedAno !== "todos" && selectedMes !== "todos")
          ? `${selectedAno}-${selectedMes}`
          : "all";
        const nfeList = await listCompanyXmls(targetCnpj, nfeTargetMonth, targetRazao);
        if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;

        if (nfeList && nfeList.length > 0) {
          nfeList.forEach((nfe: any) => {
            if (nfe.modelo && String(nfe.modelo) !== "55") return;
            // Filtro estrito por Competência Fiscal
            if (selectedAno !== "todos" || selectedMes !== "todos") {
              const normComp = normalizeCompetencia(nfe.folder || nfe.dhSaiEnt || nfe.dhEmi);
              if (selectedAno !== "todos" && normComp.year !== Number(selectedAno)) {
                return;
              }
              if (selectedMes !== "todos" && normComp.month !== Number(selectedMes)) {
                return;
              }
            }
            const vNF = Number(nfe.vNF) || 0;
            const ufEmit = nfe.ufRem || "";
            const isInterestadual = Boolean(
              nfe.isInterestadual ?? (ufEmit && targetUf && ufEmit.toUpperCase() !== targetUf.toUpperCase())
            );
            const difalEst = isInterestadual ? vNF * 0.06 : 0;
            const dateOnly = nfe.dhEmi
              ? nfe.dhEmi.substring(0, 10).split("-").reverse().join("/")
              : (nfe.formattedDate ? nfe.formattedDate.split(" ")[0] : "");

            itens.push({
              id: `nfe_${nfe.chNFe}_${nfe.nNF}`,
              origem: "NFE",
              tipoBadge: "NF-e Mercadoria",
              numero: nfe.nNF || "S/N",
              serie: nfe.serie || "1",
              dataEmissao: dateOnly,
              competencia: nfe.folder || "",
              parceiroNome: nfe.emitente || "Fornecedor Desconhecido",
              parceiroCnpj: nfe.cnpjEmitente || "",
              papelParceiro: "Fornecedor",
              valorTotal: vNF,
              valorTributoRecolher: difalEst,
              detalheTributario: isInterestadual ? `Interestadual (${ufEmit} ➔ ${targetUf})` : "Operação Interna",
              temAlertaTributario: isInterestadual,
              status: "Normal",
              isCancelada: false,
              chaveAcesso: nfe.chNFe || "",
              caminhoXml: nfe.fullPath,
              caminhoPdf: null,
            });
          });
        }
      } catch (_) {}

      // 3. CARREGA NFC-e (Mercadorias - Vendas / Saídas Modelo 65)
      try {
        const nfceTargetMonth = (selectedAno !== "todos" && selectedMes !== "todos")
          ? `${selectedAno}-${selectedMes}`
          : "all";
        const nfceRes = await listCompanyNfceXmls(activeEmpresa.cnpj, activeEmpresa.razaoSocial, nfceTargetMonth);

        if (nfceRes.success && nfceRes.list) {
          nfceRes.list.forEach((n) => {
            // Filtro estrito por Competência Fiscal
            if (selectedAno !== "todos" || selectedMes !== "todos") {
              const normComp = normalizeCompetencia(n.folder || n.dhEmi);
              if (selectedAno !== "todos" && normComp.year !== Number(selectedAno)) {
                return;
              }
              if (selectedMes !== "todos" && normComp.month !== Number(selectedMes)) {
                return;
              }
            }

            const valorNota = Number(n.vNF) || 0;
            const isCanc = Boolean(n.isCancelada);

            itens.push({
              id: `nfce_${n.chNFe}_${n.nNF}`,
              origem: "NFCE",
              tipoBadge: "NFC-e 65 (Venda)",
              numero: n.nNF || "S/N",
              serie: n.serie || "1",
              dataEmissao: n.formattedDate || (n.dhEmi ? n.dhEmi.substring(0, 10).split("-").reverse().join("/") : ""),
              competencia: n.folder || "",
              parceiroNome: n.destinatario || "Consumidor Final",
              parceiroCnpj: n.cnpjDest || "",
              papelParceiro: "Cliente",
              valorTotal: valorNota,
              valorLiquido: valorNota,
              temRetencao: false,
              valorTributoRecolher: 0,
              detalheTributario: "Venda Balcão ao Consumidor",
              temAlertaTributario: false,
              status: isCanc ? "Cancelada" : "Normal",
              isCancelada: isCanc,
              chaveAcesso: n.chNFe,
              caminhoXml: n.fullPath,
              caminhoPdf: n.pdfPath,
            });
          });

          if (nfceRes.months && nfceRes.months.length > 0) {
            setAvailableMonths((prev) => {
              const merged = new Set([...prev, ...nfceRes.months]);
              return Array.from(merged).sort().reverse();
            });
          }
        }
      } catch (errNfce) {
        console.warn("Aviso ao carregar NFC-e na Guia Geral:", errNfce);
      }

      // 4. CARREGA CT-e (Transportes - Fretes Modelo 57)
      try {
        const cteTargetMonth = (selectedAno !== "todos" && selectedMes !== "todos")
          ? `${selectedAno}-${selectedMes}`
          : "all";
        const cteRes = await listCompanyCteXmls(activeEmpresa.cnpj, activeEmpresa.razaoSocial, cteTargetMonth);

        if (cteRes.success && cteRes.list) {
          cteRes.list.forEach((c) => {
            // Filtro estrito por Competência Fiscal
            if (selectedAno !== "todos" || selectedMes !== "todos") {
              const normComp = normalizeCompetencia(c.folder || c.dhEmi);
              if (selectedAno !== "todos" && normComp.year !== Number(selectedAno)) {
                return;
              }
              if (selectedMes !== "todos" && normComp.month !== Number(selectedMes)) {
                return;
              }
            }

            const valorCte = Number(c.vTPrest) || 0;
            const isCanc = Boolean(c.isCancelada);

            itens.push({
              id: `cte_${c.chCTe}_${c.nCT}`,
              origem: "CTE",
              tipoBadge: "CT-e 57 (Frete)",
              numero: c.nCT || "S/N",
              serie: c.serie || "1",
              dataEmissao: c.formattedDate || (c.dhEmi ? c.dhEmi.substring(0, 10).split("-").reverse().join("/") : ""),
              competencia: c.folder || "",
              parceiroNome: c.emitente || "Transportadora",
              parceiroCnpj: c.cnpjEmitente || "",
              papelParceiro: "Transportadora",
              valorTotal: valorCte,
              valorLiquido: valorCte,
              temRetencao: false,
              valorTributoRecolher: 0,
              detalheTributario: `Frete ${c.modal || "Rodoviário"} (${c.ufRem || "?"} ➔ ${c.ufDest || "?"})`,
              temAlertaTributario: false,
              status: isCanc ? "Cancelada" : "Normal",
              isCancelada: isCanc,
              chaveAcesso: c.chCTe,
              caminhoXml: c.fullPath,
              caminhoPdf: c.pdfPath,
            });
          });

          if (cteRes.months && cteRes.months.length > 0) {
            setAvailableMonths((prev) => {
              const merged = new Set([...prev, ...cteRes.months]);
              return Array.from(merged).sort().reverse();
            });
          }
        }
      } catch (errCte) {
        console.warn("Aviso ao carregar CT-e na Guia Geral:", errCte);
      }

      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;

      // Ordenação cronológica rigorosa: da nota emitida mais recentemente para a mais antiga
      itens.sort((a, b) => parseDateToTimestamp(b.dataEmissao) - parseDateToTimestamp(a.dataEmissao));

      setItensConsolidados(itens);
    } catch (e: any) {
      if (activeEmpresaCnpjRef.current !== targetCnpj || loadRequestIdRef.current !== reqId) return;
      console.error("Erro ao consolidar notas:", e);
      onNotify(`Erro ao carregar dados: ${e.message}`, "error");
    } finally {
      if (activeEmpresaCnpjRef.current === targetCnpj && loadRequestIdRef.current === reqId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setItensConsolidados([]);
    setDisplayLimit(100);
    carregarDadosConsolidados();
  }, [activeEmpresa?.id, activeEmpresa?.cnpj, selectedAno, selectedMes, refreshKey]);

  // Resumo de Totais
  const resumo = useMemo(() => {
    let totalNfeCompras = 0;
    let qtdNfe = 0;
    let difalTotal = 0;

    let totalNfceSaidas = 0;
    let qtdNfce = 0;

    let totalCteFretes = 0;
    let qtdCte = 0;

    let totalNfseTomadas = 0;
    let qtdNfseTomadas = 0;
    let retencoesTomadas = 0;

    let totalNfsePrestadas = 0;
    let qtdNfsePrestadas = 0;

    let totalCanceladas = 0;

    itensConsolidados.forEach((it) => {
      if (it.isCancelada) {
        totalCanceladas++;
        return;
      }

      if (it.origem === "NFE") {
        totalNfeCompras += it.valorTotal;
        qtdNfe++;
        difalTotal += it.valorTributoRecolher;
      } else if (it.origem === "NFCE") {
        totalNfceSaidas += it.valorTotal;
        qtdNfce++;
      } else if (it.origem === "CTE") {
        totalCteFretes += it.valorTotal;
        qtdCte++;
      } else if (it.origem === "NFSE_TOMADA") {
        totalNfseTomadas += it.valorTotal;
        qtdNfseTomadas++;
        retencoesTomadas += it.valorTributoRecolher;
      } else if (it.origem === "NFSE_PRESTADA") {
        totalNfsePrestadas += it.valorTotal;
        qtdNfsePrestadas++;
      }
    });

    const totalTributosRecolher = difalTotal + retencoesTomadas;

    return {
      totalNfeCompras,
      qtdNfe,
      difalTotal,
      totalNfceSaidas,
      qtdNfce,
      totalCteFretes,
      qtdCte,
      totalNfseTomadas,
      qtdNfseTomadas,
      retencoesTomadas,
      totalNfsePrestadas,
      qtdNfsePrestadas,
      totalCanceladas,
      totalTributosRecolher,
      totalGeralDocumentos: itensConsolidados.length,
    };
  }, [itensConsolidados]);

  // Anos detectados dinamicamente das notas e meses disponíveis
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    availableMonths.forEach((m) => {
      const y = m.split("-")[0];
      if (y && y.length === 4) yearsSet.add(y);
    });

    itensConsolidados.forEach((it) => {
      const norm = normalizeCompetencia(it.competencia || it.dataEmissao);
      if (norm.year) yearsSet.add(String(norm.year));
    });

    const currentYear = new Date().getFullYear().toString();
    yearsSet.add(currentYear);
    return Array.from(yearsSet).sort().reverse();
  }, [availableMonths, itensConsolidados]);

  // Filtros aplicados
  const itensFiltrados = useMemo(() => {
    return itensConsolidados.filter((item) => {
      if (activeTabFilter === "nfe" && item.origem !== "NFE") return false;
      if (activeTabFilter === "nfce" && item.origem !== "NFCE") return false;
      if (activeTabFilter === "cte" && item.origem !== "CTE") return false;
      if (activeTabFilter === "nfse_tomadas" && item.origem !== "NFSE_TOMADA") return false;
      if (activeTabFilter === "nfse_prestadas" && item.origem !== "NFSE_PRESTADA") return false;

      if (extraFilter === "canceladas" && !item.isCancelada) return false;

      if (debouncedSearchTerm.trim()) {
        const term = debouncedSearchTerm.trim().toLowerCase();
        const numQuery = term.replace(/^(n[º°o]?|nf(?:s?-?e)?|#)\s*/i, "").trim();
        const isShortNumeric = /^\d{1,10}$/.test(numQuery);

        if (isShortNumeric) {
          const normDocNum = String(item.numero || "").replace(/\D/g, "").replace(/^0+/, "") || "0";
          const normQuery = numQuery.replace(/^0+/, "") || "0";
          const rawDocDigits = String(item.numero || "").replace(/\D/g, "");
          const numMatch =
            normDocNum === normQuery ||
            normDocNum.startsWith(normQuery) ||
            rawDocDigits === numQuery;
          const cnpjDigits = String(item.parceiroCnpj || "").replace(/\D/g, "");
          const cnpjMatch = numQuery.length >= 8 && cnpjDigits.includes(numQuery);
          return numMatch || cnpjMatch;
        }

        const numMatch = (item.numero || "").toLowerCase().includes(term);
        const cnpjDigits = String(item.parceiroCnpj || "").replace(/\D/g, "");
        const termDigits = term.replace(/\D/g, "");
        const parcMatch =
          (item.parceiroNome || "").toLowerCase().includes(term) ||
          (item.parceiroCnpj || "").toLowerCase().includes(term) ||
          (termDigits.length >= 6 && cnpjDigits.includes(termDigits));
        const chaveMatch =
          (item.chaveAcesso || "").toLowerCase().includes(term) ||
          (termDigits.length >= 11 && (item.chaveAcesso || "").includes(termDigits));
        return numMatch || parcMatch || chaveMatch;
      }

      return true;
    });
  }, [itensConsolidados, activeTabFilter, extraFilter, debouncedSearchTerm]);

  // Ordenação consolidada da grid (menor para maior / maior para menor)
  const itensOrdenados = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...itensFiltrados].sort((a, b) => {
      switch (sortColumn) {
        case "modelo":
          return (a.tipoBadge || a.origem || "").localeCompare(b.tipoBadge || b.origem || "", "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        case "numero": {
          const numA = Number(String(a.numero || "0").replace(/\D/g, "")) || 0;
          const numB = Number(String(b.numero || "0").replace(/\D/g, "")) || 0;
          return (numA - numB) * dir;
        }
        case "emissao": {
          const tsA = parseDateToTimestamp(a.dataEmissao || a.competencia || "");
          const tsB = parseDateToTimestamp(b.dataEmissao || b.competencia || "");
          if (tsA !== tsB) return (tsA - tsB) * dir;
          const numA = Number(String(a.numero || "0").replace(/\D/g, "")) || 0;
          const numB = Number(String(b.numero || "0").replace(/\D/g, "")) || 0;
          return (numA - numB) * dir;
        }
        case "competencia": {
          const compA = normalizeCompetencia(a.competencia || a.dataEmissao || "").key;
          const compB = normalizeCompetencia(b.competencia || b.dataEmissao || "").key;
          if (compA !== compB) return compA.localeCompare(compB) * dir;
          const tsA = parseDateToTimestamp(a.dataEmissao || "");
          const tsB = parseDateToTimestamp(b.dataEmissao || "");
          return (tsA - tsB) * dir;
        }
        case "parceiro":
          return (a.parceiroNome || "").localeCompare(b.parceiroNome || "", "pt-BR", { sensitivity: "base", numeric: true }) * dir;
        case "cnpj": {
          const cA = (a.parceiroCnpj || "").replace(/\D/g, "");
          const cB = (b.parceiroCnpj || "").replace(/\D/g, "");
          return cA.localeCompare(cB, "pt-BR", { numeric: true }) * dir;
        }
        case "papel":
          return (a.papelParceiro || "").localeCompare(b.papelParceiro || "", "pt-BR", { sensitivity: "base" }) * dir;
        case "tributo": {
          const tA = Number(a.valorTributoRecolher || a.valorDesconto || 0);
          const tB = Number(b.valorTributoRecolher || b.valorDesconto || 0);
          return (tA - tB) * dir;
        }
        case "valorBruto":
          return ((Number(a.valorTotal) || 0) - (Number(b.valorTotal) || 0)) * dir;
        case "valorLiquido": {
          const lA = Number(a.valorLiquido !== undefined ? a.valorLiquido : a.valorTotal) || 0;
          const lB = Number(b.valorLiquido !== undefined ? b.valorLiquido : b.valorTotal) || 0;
          return (lA - lB) * dir;
        }
        case "situacao":
          return ((a.isCancelada ? 1 : 0) - (b.isCancelada ? 1 : 0)) * dir;
        default:
          return 0;
      }
    });
  }, [itensFiltrados, sortColumn, sortDirection]);

  // Paginação inteligente (limite inicial de 100 notas)
  const itensPaginados = useMemo(() => {
    return itensOrdenados.slice(0, displayLimit);
  }, [itensOrdenados, displayLimit]);

  // Manter item selecionado na grid
  useEffect(() => {
    if (itensPaginados.length > 0) {
      if (!selectedItemId || !itensPaginados.some((i) => i.id === selectedItemId)) {
        setSelectedItemId(itensPaginados[0].id);
      }
    } else {
      setSelectedItemId(null);
    }
  }, [itensPaginados, selectedItemId]);

  // Abertura de DANFE / DACTE / DANFSe em PDF
  const handleAbrirPdf = async (item: NotaAcompanhamentoItem) => {
    if (!activeEmpresa) return;

    if (item.origem === "NFE") {
      const res = await openDanfePdf(activeEmpresa.cnpj, item.chaveAcesso, item.competencia, activeEmpresa.razaoSocial);
      if (!res?.success) {
        onNotify(res?.error || "Não foi possível abrir o PDF do DANFE.", "error");
      }
    } else if (item.origem === "NFCE") {
      const res = await openNfceDanfePdf(item.caminhoPdf || undefined, item.caminhoXml);
      if (!res?.success) {
        onNotify(res?.error || "Não foi possível abrir o PDF do DANFE da NFC-e.", "error");
      }
    } else if (item.origem === "CTE") {
      const res = await openCteDactePdf(item.caminhoPdf || undefined, item.caminhoXml);
      if (!res?.success) {
        onNotify(res?.error || "Não foi possível abrir o PDF do DACTE.", "error");
      }
    } else {
      const res = await openNfsePdf(item.caminhoPdf || undefined, item.caminhoXml);
      if (!res?.success) {
        onNotify(res?.error || "Não foi possível abrir o PDF do DANFSe.", "error");
      }
    }
  };

  // Salvar XML individual da nota
  const handleSalvarXml = async (item: NotaAcompanhamentoItem) => {
    if (!activeEmpresa) return;

    try {
      if (item.origem === "NFE") {
        const res = await saveSingleXml(activeEmpresa.cnpj, item.chaveAcesso, item.competencia);
        if (res?.canceled) return;
        if (res?.success) {
          onNotify("Arquivo XML da NF-e salvo com sucesso!", "success");
        } else {
          onNotify(res?.error || "Erro ao salvar XML da NF-e.", "error");
        }
      } else if (item.origem === "NFCE") {
        const res = await saveSingleNfceXml(
          activeEmpresa.cnpj,
          item.chaveAcesso,
          activeEmpresa.razaoSocial,
          item.caminhoXml
        );
        if (res?.canceled) return;
        if (res?.success) {
          onNotify("Arquivo XML da NFC-e salvo com sucesso!", "success");
        } else {
          onNotify(res?.error || "Erro ao salvar XML da NFC-e.", "error");
        }
      } else if (item.origem === "CTE") {
        const res = await saveSingleCteXml(
          activeEmpresa.cnpj,
          item.chaveAcesso,
          activeEmpresa.razaoSocial,
          item.caminhoXml
        );
        if (res?.canceled) return;
        if (res?.success) {
          onNotify("Arquivo XML do CT-e salvo com sucesso!", "success");
        } else {
          onNotify(res?.error || "Erro ao salvar XML do CT-e.", "error");
        }
      } else {
        const defaultName = `NFSe_${item.numero || "doc"}.xml`;
        const res = await saveNfseXml(item.caminhoXml, defaultName);
        if (res?.canceled) return;
        if (res?.success) {
          onNotify("Arquivo XML da NFS-e salvo com sucesso!", "success");
        } else {
          onNotify(res?.error || "Erro ao salvar XML da NFS-e.", "error");
        }
      }
    } catch (err: any) {
      onNotify(`Erro ao salvar XML: ${err.message}`, "error");
    }
  };

  // Copiar chave de acesso
  const handleCopyKey = (key: string) => {
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
    onNotify("Chave de acesso copiada para a área de transferência!", "success");
  };

  // Abrir pasta da empresa no Windows Explorer
  const handleOpenFolder = async () => {
    if (!activeEmpresa) return;
    try {
      const res = await openCompanyFolder(activeEmpresa.cnpj, undefined, activeEmpresa.razaoSocial);
      if (!res.success) {
        onNotify(res.error || "Não foi possível abrir a pasta da empresa.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir pasta: ${err.message}`, "error");
    }
  };

  // Navegação por teclado: Enter abre PDF, setas navegam, F5 atualiza
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.key === "Enter" && selectedItemId) {
        const item = itensPaginados.find((i) => i.id === selectedItemId);
        if (item) {
          e.preventDefault();
          handleAbrirPdf(item);
        }
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const curIdx = itensPaginados.findIndex((i) => i.id === selectedItemId);
        if (curIdx >= 0 && curIdx < itensPaginados.length - 1) {
          setSelectedItemId(itensPaginados[curIdx + 1].id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const curIdx = itensPaginados.findIndex((i) => i.id === selectedItemId);
        if (curIdx > 0) {
          setSelectedItemId(itensPaginados[curIdx - 1].id);
        }
      } else if (e.key === "F5") {
        e.preventDefault();
        carregarDadosConsolidados();
        onNotify("Documentos fiscais recarregados com sucesso.", "success");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [itensPaginados, selectedItemId]);

  // Exportar Guia em CSV / Excel
  const handleExportarGuiaCsv = async () => {
    if (itensFiltrados.length === 0) {
      onNotify("Nenhuma nota disponível para exportar.", "error");
      return;
    }

    const formatMoeda = (val?: number) => {
      if (val == null || isNaN(val)) return "0,00";
      return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const headers = [
      "Origem/Modelo",
      "Número",
      "Série",
      "Data Emissão",
      "Competência",
      "Parceiro Comercial",
      "CNPJ/CPF Parceiro",
      "Papel",
      "Valor Total (R$)",
      "Tributos/Retenções (R$)",
      "Detalhes Tributários",
      "Situação",
      "Chave de Acesso"
    ];

    let totGeral = 0, totTrib = 0;

    const rows = itensFiltrados.map((it) => {
      const vTot = Number(it.valorTotal) || 0;
      const vTrb = Number(it.valorTributoRecolher) || 0;
      totGeral += vTot;
      totTrib += vTrb;

      const chaveExcel = it.chaveAcesso ? `="${it.chaveAcesso}"` : '""';
      const escape = (txt: string) => `"${String(txt || "").replace(/"/g, '""')}"`;

      return [
        escape(it.tipoBadge),
        escape(it.numero),
        escape(it.serie || "1"),
        escape(it.dataEmissao),
        escape(it.competencia),
        escape(it.parceiroNome || ""),
        escape(it.parceiroCnpj || ""),
        escape(it.papelParceiro || ""),
        escape(formatMoeda(vTot)),
        escape(formatMoeda(vTrb)),
        escape(it.detalheTributario || ""),
        escape(it.status || ""),
        chaveExcel
      ].join(";");
    });

    const linhaTotais = [
      '"TOTAIS"',
      '""',
      '""',
      '""',
      '""',
      '""',
      '""',
      `"${itensFiltrados.length} documento(s)"`,
      `"${formatMoeda(totGeral)}"`,
      `"${formatMoeda(totTrib)}"`,
      '""',
      '""',
      '""'
    ].join(";");

    const csvContent = "\uFEFF" + [headers.map(h => `"${h}"`).join(";"), ...rows, linhaTotais].join("\r\n");
    const defaultName = `guia_geral_notas_${activeEmpresa?.cnpj || "empresa"}_${selectedAno}_${selectedMes}.csv`;

    const res = await saveCsvFile(defaultName, csvContent, "Salvar Guia Geral em Planilha (.csv)");
    if (res.canceled) return;
    if (res.success) {
      onNotify(`Guia Geral exportada com sucesso! (${itensFiltrados.length} documentos)`, "success");
    } else {
      onNotify(res.error || "Erro ao exportar planilha CSV.", "error");
    }
  };

  const [isDashboardModalOpen, setIsDashboardModalOpen] = useState(false);
  const [exportingHtml, setExportingHtml] = useState(false);

  // Computa dados analíticos mensais para o Dashboard Executivo
  const dashboardData: DashboardData = useMemo(() => {
    const mesesMap = new Map<
      string,
      {
        competenciaKey: string;
        competencia: string;
        nfe: number;
        nfce: number;
        cte: number;
        nfseTomada: number;
        nfsePrestada: number;
        retencoes: number;
        total: number;
        qtd: number;
      }
    >();

    const parceirosMap = new Map<
      string,
      {
        nome: string;
        cnpj: string;
        papel: string;
        qtdNotas: number;
        valorTotal: number;
      }
    >();

    const totalMovimentadoGeral =
      resumo.totalNfeCompras +
      resumo.totalNfceSaidas +
      resumo.totalCteFretes +
      resumo.totalNfseTomadas +
      resumo.totalNfsePrestadas;

    itensConsolidados.forEach((it) => {
      if (it.isCancelada) return;

      const norm = normalizeCompetencia(it.competencia || it.dataEmissao);
      const cKey = norm.key;
      const cLabel = norm.label;

      if (!mesesMap.has(cKey)) {
        mesesMap.set(cKey, {
          competenciaKey: cKey,
          competencia: cLabel,
          nfe: 0,
          nfce: 0,
          cte: 0,
          nfseTomada: 0,
          nfsePrestada: 0,
          retencoes: 0,
          total: 0,
          qtd: 0,
        });
      }

      const m = mesesMap.get(cKey)!;
      m.qtd++;
      m.total += it.valorTotal;

      if (it.origem === "NFE") {
        m.nfe += it.valorTotal;
      } else if (it.origem === "NFCE") {
        m.nfce += it.valorTotal;
      } else if (it.origem === "CTE") {
        m.cte += it.valorTotal;
      } else if (it.origem === "NFSE_TOMADA") {
        m.nfseTomada += it.valorTotal;
        m.retencoes += it.valorTributoRecolher;
      } else if (it.origem === "NFSE_PRESTADA") {
        m.nfsePrestada += it.valorTotal;
      }

      // Agrupamento por parceiro comercial
      const pKey = it.parceiroCnpj ? it.parceiroCnpj.replace(/\D/g, "") : (it.parceiroNome || "");
      if (pKey) {
        if (!parceirosMap.has(pKey)) {
          parceirosMap.set(pKey, {
            nome: it.parceiroNome || "Não informado",
            cnpj: it.parceiroCnpj || "",
            papel: it.papelParceiro || "Parceiro",
            qtdNotas: 0,
            valorTotal: 0,
          });
        }
        const p = parceirosMap.get(pKey)!;
        p.qtdNotas++;
        p.valorTotal += it.valorTotal;
      }
    });

    const evolucaoMensal = Array.from(mesesMap.values()).sort((a, b) =>
      a.competenciaKey.localeCompare(b.competenciaKey)
    );

    const topParceiros = Array.from(parceirosMap.values())
      .sort((a, b) => b.valorTotal - a.valorTotal)
      .map((p) => {
        const pct = totalMovimentadoGeral > 0 ? (p.valorTotal / totalMovimentadoGeral) * 100 : 0;
        return {
          ...p,
          percentual: Math.min(100, Math.max(0, Math.round(pct * 10) / 10)),
        };
      });

    const periodoStr =
      selectedAno !== "todos"
        ? (selectedMes !== "todos" ? `Mês ${selectedMes}/${selectedAno}` : `Ano Completo ${selectedAno}`)
        : "Consolidado Geral";

    return {
      empresa: {
        razaoSocial: activeEmpresa?.razaoSocial || "Empresa sob Análise",
        cnpj: activeEmpresa?.cnpj || "",
        uf: activeEmpresa?.uf || "SP",
      },
      periodo: periodoStr,
      resumo,
      evolucaoMensal: evolucaoMensal.length > 0 ? evolucaoMensal : [{
        competencia: selectedAno !== "todos" ? `${selectedAno}` : "Geral",
        nfe: resumo.totalNfeCompras,
        nfce: resumo.totalNfceSaidas,
        cte: resumo.totalCteFretes,
        nfseTomada: resumo.totalNfseTomadas,
        nfsePrestada: resumo.totalNfsePrestadas,
        retencoes: resumo.retencoesTomadas,
        total: resumo.totalNfeCompras + resumo.totalNfceSaidas + resumo.totalCteFretes + resumo.totalNfseTomadas + resumo.totalNfsePrestadas,
        qtd: resumo.totalGeralDocumentos,
      }],
      topParceiros,
    };
  }, [itensConsolidados, resumo, activeEmpresa, selectedAno, selectedMes]);

  const handleExportarDashboardHtml = async () => {
    if (!activeEmpresa || itensConsolidados.length === 0) {
      onNotify("Nenhum documento fiscal carregado para gerar o dashboard.", "error");
      return;
    }

    setExportingHtml(true);
    try {
      const htmlContent = generateExecutiveDashboardHtml(dashboardData);
      const cleanCnpj = activeEmpresa.cnpj.replace(/\D/g, "");
      const cleanPeriodo = dashboardData.periodo.replace(/[^a-zA-Z0-9_-]/g, "_");
      const defaultFilename = `dashboard_executivo_${cleanCnpj}_${cleanPeriodo}.html`;

      const res = await saveHtmlDashboard(defaultFilename, htmlContent, "Salvar Dashboard Executivo (.html)");
      if (res.canceled) return;
      if (res.success) {
        onNotify("Dashboard executivo exportado e aberto no navegador com sucesso!", "success");
      } else {
        onNotify(res.error || "Erro ao salvar arquivo HTML.", "error");
      }
    } catch (err: any) {
      onNotify(`Falha ao exportar dashboard HTML: ${err.message}`, "error");
    } finally {
      setExportingHtml(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[#f0f0f0] select-none text-[11px] text-[#000000] font-sans">
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
        .vb-btn:active {
          background: #d4d4d4;
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
        }
        .vb-btn-primary {
          background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
          border: 1px solid #336699;
          font-weight: 600;
          color: #002244;
        }
        .vb-input {
          background-color: #ffffff;
          border: 1px solid #7a7a7a;
          border-radius: 0px;
          padding: 3px 6px;
          font-size: 11px;
          color: #000000;
          outline: none;
        }
        .vb-input:focus {
          border-color: #005a9e;
          box-shadow: 0 0 0 1px #005a9e;
        }
        fieldset.vb-groupbox {
          border: 1px solid #b0b0b0;
          padding: 7px 10px 8px 10px;
          margin-bottom: 6px;
          background-color: #f7f7f7;
        }
        legend.vb-legend {
          font-weight: 600;
          font-size: 11px;
          color: #003366;
          padding: 0 4px;
        }
        .datagrid-table {
          width: 100%;
          border-collapse: collapse;
          background: #ffffff;
          border: 1px solid #999999;
          font-size: 11px;
        }
        .datagrid-table th {
          background: linear-gradient(180deg, #f5f5f5 0%, #e6e6e6 100%);
          border-right: 1px solid #b5b5b5;
          border-bottom: 1px solid #999999;
          padding: 4px 6px;
          font-weight: 600;
          color: #222222;
          text-align: left;
          font-size: 11px;
        }
        .datagrid-table td {
          border-right: 1px solid #e0e0e0;
          border-bottom: 1px solid #e8e8e8;
          padding: 3px 6px;
          white-space: nowrap;
        }
        .datagrid-table tr.selected {
          background-color: #005a9e !important;
          color: #ffffff !important;
        }
        .datagrid-table tr.selected td {
          color: #ffffff !important;
          border-bottom-color: #004d88;
        }
        .datagrid-table tr:hover:not(.selected) {
          background-color: #f0f6ff;
        }
        .status-bar {
          background: linear-gradient(180deg, #f2f2f2 0%, #e1e1e1 100%);
          border-top: 1px solid #b0b0b0;
          padding: 2px 6px;
          font-size: 11px;
          color: #333333;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .status-panel {
          border-right: 1px solid #b0b0b0;
          padding-right: 10px;
        }
      `}</style>


      {/* ================= 2. BARRA DE FERRAMENTAS CLÁSSICA PADRONIZADA (ACTION TOOLBAR) ================= */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 py-1.5 flex items-center justify-between gap-2 flex-wrap shrink-0 shadow-2xs">
        {/* Grupo Esquerdo: Sincronização Completa da Empresa, Painel Executivo e Pasta */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            disabled={!activeEmpresa}
            className="vb-btn vb-btn-primary"
            title="Sincronizar todos os 4 modelos fiscais (NF-e 55, NFC-e 65, CT-e 57 e NFS-e) desta empresa"
          >
            <RefreshCw size={13} className="text-[#003366]" />
            <span>⚡ Sincronizar Tudo (Empresa)</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={() => setIsDashboardModalOpen(true)}
            disabled={itensConsolidados.length === 0}
            className="vb-btn font-semibold text-[#003366]"
            title="Abrir Painel Executivo com gráficos e demonstrativos"
          >
            <BarChart3 size={13} className="text-[#005a9e]" />
            <span>Painel Executivo</span>
          </button>

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={!activeEmpresa}
            className="vb-btn"
            title="Abrir pasta local de arquivos XML no Windows Explorer"
          >
            <FolderOpen size={13} className="text-[#886600]" />
            <span>Abrir Pasta de XMLs</span>
          </button>
        </div>

        {/* Grupo Direito: Exportações e Atualização */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={handleExportarDashboardHtml}
            disabled={itensConsolidados.length === 0 || exportingHtml}
            className="vb-btn"
            title="Exportar página HTML independente com apresentação gerencial para reuniões"
          >
            <Globe size={13} className="text-[#005a9e]" />
            <span>{exportingHtml ? "Gerando..." : "Exportar Relatório HTML"}</span>
          </button>

          <button
            type="button"
            onClick={handleExportarGuiaCsv}
            disabled={itensFiltrados.length === 0}
            className="vb-btn"
            title="Exportar relação completa de notas fiscais em planilha Excel (.csv)"
          >
            <FileSpreadsheet size={13} className="text-[#107c41]" />
            <span>Exportar Excel / CSV</span>
          </button>

          <div className="h-4 w-[1px] bg-[#b5b5b5] mx-0.5" />

          <button
            type="button"
            onClick={carregarDadosConsolidados}
            disabled={loading || !activeEmpresa}
            className="vb-btn"
            title="Recarregar e sincronizar notas em disco (F5)"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Atualizando..." : "Atualizar Grid (F5)"}</span>
          </button>
        </div>
      </div>

      {/* ================= 3. ÁREA PRINCIPAL DA GUIA ================= */}
      <div className="p-2 flex flex-col gap-2 flex-1 overflow-auto">
        {/* GROUPBOX 1: EMPRESA ATIVA & SELEÇÃO DE PERÍODO */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Empresa sob Análise & Seleção de Período</legend>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <label className="font-semibold text-[#333333]">
                  Empresa:
                </label>
                <EmpresaSearchSelect
                  empresas={empresas}
                  value={activeEmpresa?.id || ""}
                  onChange={onSelectEmpresa}
                  className="w-[330px] max-w-[350px]"
                />
              </div>

              {onOpenCompanyModal && (
                <button
                  type="button"
                  onClick={() => onOpenCompanyModal("empresas")}
                  className="vb-btn"
                  title="Cadastrar, editar ou gerenciar dados da empresa"
                >
                  <span>⚙</span>
                  <span>Gerenciar Empresas</span>
                </button>
              )}

              <div className="h-4 w-[1px] bg-[#b0b0b0] hidden sm:block"></div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="anoSelect" className="font-semibold text-[#333333]">
                  Ano:
                </label>
                <select
                  id="anoSelect"
                  value={selectedAno}
                  onChange={(e) => setSelectedAno(e.target.value)}
                  className="vb-input"
                >
                  <option value="todos">Todos os Anos</option>
                  {availableYears.map((ano) => (
                    <option key={ano} value={ano}>
                      {ano}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <label htmlFor="mesSelect" className="font-semibold text-[#333333]">
                  Mês:
                </label>
                <select
                  id="mesSelect"
                  value={selectedMes}
                  onChange={(e) => setSelectedMes(e.target.value)}
                  className="vb-input"
                >
                  <option value="todos">Todos os Meses</option>
                  <option value="01">01 - Jan</option>
                  <option value="02">02 - Fev</option>
                  <option value="03">03 - Mar</option>
                  <option value="04">04 - Abr</option>
                  <option value="05">05 - Mai</option>
                  <option value="06">06 - Jun</option>
                  <option value="07">07 - Jul</option>
                  <option value="08">08 - Ago</option>
                  <option value="09">09 - Set</option>
                  <option value="10">10 - Out</option>
                  <option value="11">11 - Nov</option>
                  <option value="12">12 - Dez</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CertificateBadge
                certInfo={activeEmpresa?.certInfo}
                onClick={() => onOpenCompanyModal?.("empresas")}
              />
              <span className="text-[10px] text-[#555555]">
                UF: <strong>{activeEmpresa?.uf || "SP"}</strong> | Regime:{" "}
                <strong>{activeEmpresa?.regime === "simples" ? "Simples Nacional" : "Regime Normal"}</strong>
              </span>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 2: RESUMO OPERACIONAL DO MOVIMENTO FISCAL */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Resumo Financeiro & Operacional do Movimento (Clique no quadro para filtrar a Grid)</legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {/* 1. Compras (NF-e 55) */}
            <div
              onClick={() => setActiveTabFilter((prev) => (prev === "nfe" ? "todas" : "nfe"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "nfe"
                  ? "bg-[#e6f2ff] border-[#005a9e]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#f5f9ff]"
              }`}
              title="Clique para filtrar apenas compras de NF-e 55"
            >
              <div className="flex items-center justify-between text-[#003366] font-semibold text-[11px]">
                <span>Compras (NF-e 55):</span>
                <span>📦</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#003366] block">
                  {formatBRL(resumo.totalNfeCompras)}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {resumo.qtdNfe} notas | DIFAL: <strong className="text-[#005a9e]">{formatBRL(resumo.difalTotal)}</strong>
                </span>
              </div>
            </div>

            {/* 2. Vendas (NFC-e 65) */}
            <div
              onClick={() => setActiveTabFilter((prev) => (prev === "nfce" ? "todas" : "nfce"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "nfce"
                  ? "bg-[#f3e8ff] border-[#9333ea]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#faf5ff]"
              }`}
              title="Clique para filtrar apenas vendas de NFC-e 65"
            >
              <div className="flex items-center justify-between text-[#6b21a8] font-semibold text-[11px]">
                <span>Vendas (NFC-e 65):</span>
                <span>🛍</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#6b21a8] block">
                  {formatBRL(resumo.totalNfceSaidas)}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {resumo.qtdNfce} cupons emitidos
                </span>
              </div>
            </div>

            {/* 3. Fretes (CT-e 57) */}
            <div
              onClick={() => setActiveTabFilter((prev) => (prev === "cte" ? "todas" : "cte"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "cte"
                  ? "bg-[#fef3c7] border-[#d97706]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#fffbeb]"
              }`}
              title="Clique para filtrar apenas fretes de CT-e 57"
            >
              <div className="flex items-center justify-between text-[#b45309] font-semibold text-[11px]">
                <span>Fretes (CT-e 57):</span>
                <span>🚚</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#b45309] block">
                  {formatBRL(resumo.totalCteFretes)}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {resumo.qtdCte} conhecimentos
                </span>
              </div>
            </div>

            {/* 4. Serviços Tomados (NFS-e) */}
            <div
              onClick={() => setActiveTabFilter((prev) => (prev === "nfse_tomadas" ? "todas" : "nfse_tomadas"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "nfse_tomadas"
                  ? "bg-[#e0f2fe] border-[#0284c7]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#f0f9ff]"
              }`}
              title="Clique para filtrar apenas serviços tomados (NFS-e)"
            >
              <div className="flex items-center justify-between text-[#0369a1] font-semibold text-[11px]">
                <span>Serviços Tomados:</span>
                <span>↙</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#0369a1] block">
                  {formatBRL(resumo.totalNfseTomadas)}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {resumo.qtdNfseTomadas} notas | Ret.: <strong className="text-[#b45309]">{formatBRL(resumo.retencoesTomadas)}</strong>
                </span>
              </div>
            </div>

            {/* 5. Serviços Prestados (NFS-e) */}
            <div
              onClick={() => setActiveTabFilter((prev) => (prev === "nfse_prestadas" ? "todas" : "nfse_prestadas"))}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "nfse_prestadas"
                  ? "bg-[#d1fae5] border-[#059669]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#f0fdf4]"
              }`}
              title="Clique para filtrar apenas serviços prestados (NFS-e)"
            >
              <div className="flex items-center justify-between text-[#047857] font-semibold text-[11px]">
                <span>Serviços Prestados:</span>
                <span>↗</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#047857] block">
                  {formatBRL(resumo.totalNfsePrestadas)}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {resumo.qtdNfsePrestadas} faturadas
                </span>
              </div>
            </div>

            {/* 6. Movimento Total Consolidado */}
            <div
              onClick={() => {
                setActiveTabFilter("todas");
                setExtraFilter("todos");
              }}
              className={`p-1.5 flex flex-col justify-between cursor-pointer border transition-colors ${
                activeTabFilter === "todas" && extraFilter === "todos"
                  ? "bg-[#e2e8f0] border-[#475569]"
                  : "bg-white border-[#c0c0c0] hover:bg-[#f8fafc]"
              }`}
              title="Clique para limpar o filtro de modelo e exibir todo o movimento"
            >
              <div className="flex items-center justify-between text-[#1e293b] font-semibold text-[11px]">
                <span>Movimento Geral:</span>
                <span>📊</span>
              </div>
              <div className="mt-1">
                <span className="text-sm font-bold text-[#0f172a] block">
                  {formatBRL(
                    resumo.totalNfeCompras +
                      resumo.totalNfceSaidas +
                      resumo.totalCteFretes +
                      resumo.totalNfseTomadas +
                      resumo.totalNfsePrestadas
                  )}
                </span>
                <span className="text-[10px] text-[#555555] block">
                  {itensConsolidados.length - resumo.totalCanceladas} válidas •{" "}
                  {resumo.totalCanceladas > 0 ? (
                    <strong className="text-[#a80000]">{resumo.totalCanceladas} cancelada(s)</strong>
                  ) : (
                    "0 canc."
                  )}
                </span>
              </div>
            </div>
          </div>
        </fieldset>

        {/* GROUPBOX 3: FILTROS DE SELEÇÃO & PESQUISA */}
        <fieldset className="vb-groupbox">
          <legend className="vb-legend">Filtros de Pesquisa & Seleção de Documentos</legend>
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Chips de Modelos Fiscais */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("todas");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${
                  activeTabFilter === "todas" && extraFilter === "todos" ? "vb-btn-primary" : ""
                }`}
              >
                Todas ({itensConsolidados.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("nfe");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${activeTabFilter === "nfe" ? "vb-btn-primary" : ""}`}
              >
                NF-e (55) ({resumo.qtdNfe})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("nfce");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${activeTabFilter === "nfce" ? "vb-btn-primary" : ""}`}
              >
                NFC-e (65) ({resumo.qtdNfce})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("cte");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${activeTabFilter === "cte" ? "vb-btn-primary" : ""}`}
              >
                CT-e (57) ({resumo.qtdCte})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("nfse_tomadas");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${activeTabFilter === "nfse_tomadas" ? "vb-btn-primary" : ""}`}
              >
                NFS-e Tomadas ({resumo.qtdNfseTomadas})
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTabFilter("nfse_prestadas");
                  setExtraFilter("todos");
                }}
                className={`vb-btn ${activeTabFilter === "nfse_prestadas" ? "vb-btn-primary" : ""}`}
              >
                NFS-e Prestadas ({resumo.qtdNfsePrestadas})
              </button>

              <button
                type="button"
                onClick={() => setExtraFilter((prev) => (prev === "canceladas" ? "todos" : "canceladas"))}
                className={`vb-btn ${extraFilter === "canceladas" ? "vb-btn-primary text-[#a80000]" : ""}`}
              >
                ⚠️ Canceladas ({resumo.totalCanceladas})
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="buscaDoc" className="font-semibold text-[#333333]">
                Pesquisar:
              </label>
              <input
                id="buscaDoc"
                type="text"
                placeholder="Número, parceiro comercial, CNPJ ou chave..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="vb-input w-64"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="vb-btn"
                  title="Limpar pesquisa"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </fieldset>

        {/* ================= DATAGRID PRINCIPAL DE NOTAS FISCAIS (ESTILO DOMÍNIO / SCI) ================= */}
        <div className="flex-1 flex flex-col bg-white border border-[#999999] min-h-[300px]">
          {/* Cabeçalho de Barra da Grid */}
          <div className="bg-[#e4e4e4] border-b border-[#b5b5b5] px-2 py-1 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#333333]">
              Relação Consolidada de Documentos Fiscais (Dê dois cliques na linha ou pressione Enter para abrir o DANFE/PDF)
            </span>
            <span className="text-[#555555]">
              Exibindo <strong>{itensPaginados.length}</strong> de <strong>{itensFiltrados.length}</strong> filtradas (
              <strong>{itensConsolidados.length}</strong> total) · Mais recentes primeiro
            </span>
          </div>

          {/* Tabela com Rolagem Real */}
          <div className="flex-1 overflow-auto bg-white">
            <table className="datagrid-table">
              <thead>
                <tr>
                  <th
                    onClick={() => handleHeaderSort("modelo")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px" }}
                    title="Clique para ordenar por modelo"
                  >
                    <div className="flex items-center justify-between">
                      <span>Modelo</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "modelo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("numero")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px" }}
                    title="Clique para ordenar por número da nota"
                  >
                    <div className="flex items-center justify-between">
                      <span>Doc / Série</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "numero" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("emissao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "95px" }}
                    title="Clique para ordenar por data de emissão"
                  >
                    <div className="flex items-center justify-between">
                      <span>Emissão</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "emissao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("competencia")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px" }}
                    title="Clique para ordenar por competência"
                  >
                    <div className="flex items-center justify-between">
                      <span>Competência</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "competencia" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("parceiro")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ minWidth: "220px" }}
                    title="Clique para ordenar por parceiro comercial"
                  >
                    <div className="flex items-center justify-between">
                      <span>Parceiro Comercial</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "parceiro" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("cnpj")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "135px" }}
                    title="Clique para ordenar por CNPJ/CPF"
                  >
                    <div className="flex items-center justify-between">
                      <span>CNPJ / CPF</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "cnpj" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("papel")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "85px" }}
                    title="Clique para ordenar por papel fiscal"
                  >
                    <div className="flex items-center justify-between">
                      <span>Papel</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "papel" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("tributo")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ minWidth: "150px" }}
                    title="Clique para ordenar por tributação / retenções / DIFAL"
                  >
                    <div className="flex items-center justify-between">
                      <span>Tributação / Retenções / DIFAL</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "tributo" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valorBruto")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px", textAlign: "right" }}
                    title="Clique para ordenar por valor bruto"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Bruto</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valorBruto" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("valorLiquido")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "105px", textAlign: "right" }}
                    title="Clique para ordenar por valor líquido"
                  >
                    <div className="flex items-center justify-between">
                      <span>Valor Líquido</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "valorLiquido" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th
                    onClick={() => handleHeaderSort("situacao")}
                    className="cursor-pointer hover:bg-[#e2e2e2] select-none transition-colors"
                    style={{ width: "75px", textAlign: "center" }}
                    title="Clique para ordenar por situação"
                  >
                    <div className="flex items-center justify-between">
                      <span>Situação</span>
                      <span className="text-[10px] text-[#005a9e] font-bold">
                        {sortColumn === "situacao" ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                      </span>
                    </div>
                  </th>
                  <th style={{ width: "130px", textAlign: "center" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-[#555555]">
                      <span>Carregando notas fiscais consolidadas do disco...</span>
                    </td>
                  </tr>
                ) : itensFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-[#777777]">
                      Nenhum documento fiscal encontrado com os critérios e período selecionados.
                    </td>
                  </tr>
                ) : (
                  itensPaginados.map((it) => {
                    const isSelected = selectedItemId === it.id;
                    const chaveCurta = it.chaveAcesso
                      ? `${it.chaveAcesso.substring(0, 6)}...${it.chaveAcesso.substring(Math.max(0, it.chaveAcesso.length - 6))}`
                      : "";

                    let modeloBadgeCls = "font-bold text-[#003366]";
                    if (it.origem === "NFCE") modeloBadgeCls = "font-bold text-[#6b21a8]";
                    if (it.origem === "CTE") modeloBadgeCls = "font-bold text-[#b45309]";
                    if (it.origem === "NFSE_PRESTADA") modeloBadgeCls = "font-bold text-[#047857]";
                    if (it.origem === "NFSE_TOMADA") modeloBadgeCls = "font-bold text-[#0369a1]";

                    return (
                      <tr
                        key={it.id}
                        onClick={() => setSelectedItemId(it.id)}
                        onDoubleClick={() => handleAbrirPdf(it)}
                        className={`cursor-pointer ${isSelected ? "selected" : ""}`}
                      >
                        {/* MODELO */}
                        <td className={isSelected ? "text-white" : modeloBadgeCls}>
                          {it.origem === "NFE"
                            ? "NF-e 55"
                            : it.origem === "NFCE"
                            ? "NFC-e 65"
                            : it.origem === "CTE"
                            ? "CT-e 57"
                            : it.origem === "NFSE_PRESTADA"
                            ? "NFS-e (P)"
                            : "NFS-e (T)"}
                        </td>

                        {/* DOC / SÉRIE */}
                        <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                          NF {it.numero} {it.serie ? `(s.${it.serie})` : ""}
                        </td>

                        {/* DATA EMISSÃO */}
                        <td>{it.dataEmissao || "—"}</td>

                        {/* COMPETÊNCIA */}
                        <td>{it.competencia || "—"}</td>

                        {/* PARCEIRO COMERCIAL */}
                        <td style={{ fontWeight: 600 }} title={it.parceiroNome}>
                          {it.parceiroNome || "Consumidor Final"}
                        </td>

                        {/* CNPJ / CPF */}
                        <td style={{ fontFamily: "monospace" }}>
                          {it.parceiroCnpj ? (
                            it.parceiroCnpj.length === 14
                              ? it.parceiroCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")
                              : it.parceiroCnpj.length === 11
                              ? it.parceiroCnpj.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                              : it.parceiroCnpj
                          ) : (
                            "—"
                          )}
                        </td>

                        {/* PAPEL */}
                        <td>{it.papelParceiro || "—"}</td>

                        {/* TRIBUTAÇÃO / RETENÇÕES / DIFAL */}
                        <td>
                          {it.valorTributoRecolher > 0 ? (
                            <span className={isSelected ? "text-[#fff2a8] font-bold" : "text-[#b45309] font-bold"}>
                              {formatBRL(it.valorTributoRecolher)} · {it.detalheTributario}
                            </span>
                          ) : (
                            <span className={isSelected ? "text-white/80" : "text-[#666666]"}>
                              {it.detalheTributario || "Sem Retenções"}
                            </span>
                          )}
                        </td>

                        {/* VALOR BRUTO */}
                        <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>
                          {formatBRL(it.valorTotal)}
                        </td>

                        {/* VALOR LÍQUIDO */}
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {it.valorLiquido !== undefined ? formatBRL(it.valorLiquido) : formatBRL(it.valorTotal)}
                        </td>

                        {/* SITUAÇÃO */}
                        <td style={{ textAlign: "center" }}>
                          {it.isCancelada ? (
                            <span className={isSelected ? "text-[#ffcccc] font-bold" : "text-[#a80000] font-bold"}>
                              Cancelada
                            </span>
                          ) : (
                            <span className={isSelected ? "text-[#cce2ff]" : "text-[#107c41] font-semibold"}>
                              Normal
                            </span>
                          )}
                        </td>

                        {/* AÇÕES RÁPIDAS */}
                        <td style={{ textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAbrirPdf(it)}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Abrir DANFE/DACTE/DANFSe em PDF oficial"
                            >
                              PDF
                            </button>

                            <button
                              type="button"
                              onClick={() => handleSalvarXml(it)}
                              className="vb-btn"
                              style={{ padding: "1px 5px", fontSize: "10px" }}
                              title="Salvar arquivo XML da nota fiscal"
                            >
                              XML
                            </button>

                            {it.chaveAcesso && (
                              <button
                                type="button"
                                onClick={() => handleCopyKey(it.chaveAcesso)}
                                className="vb-btn"
                                style={{ padding: "1px 5px", fontSize: "10px" }}
                                title={`Copiar chave de acesso completa (${chaveCurta})`}
                              >
                                {copiedKey === it.chaveAcesso ? "✓" : "Chave"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Grid com Paginação Inteligente */}
          <div className="border-t border-[#b5b5b5] bg-[#e4e4e4] px-2 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-[#333333]">
              <span>
                Exibindo <strong>{itensPaginados.length}</strong> de <strong>{itensFiltrados.length}</strong> notas
                filtradas (total no disco: <strong>{itensConsolidados.length}</strong>).
              </span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {itensFiltrados.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit((prev) => prev + 100)}
                  className="vb-btn vb-btn-primary"
                  title="Carregar as próximas 100 notas mais recentes"
                >
                  <span>+ Carregar Mais 100 Notas</span>
                </button>
              )}

              {itensFiltrados.length > displayLimit && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(itensFiltrados.length)}
                  className="vb-btn"
                  title="Exibir todas as notas de uma vez"
                >
                  <span>Exibir Todas ({itensFiltrados.length})</span>
                </button>
              )}

              {displayLimit > 100 && (
                <button
                  type="button"
                  onClick={() => setDisplayLimit(100)}
                  className="vb-btn"
                  title="Recolher lista para as 100 notas mais recentes"
                >
                  <span>Recolher para 100</span>
                </button>
              )}

              <span className="font-bold text-[#003366] ml-2 border-l border-[#b0b0b0] pl-3">
                Total Exibido:{" "}
                {formatBRL(
                  itensPaginados.reduce((sum, n) => sum + (n.isCancelada ? 0 : n.valorTotal), 0)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ================= 4. STATUSBAR CLÁSSICA DO WINDOWS / ERP NO RODAPÉ ================= */}
      <footer className="status-bar">
        <div className="status-panel flex items-center gap-1.5">
          <img
            src={logoImg}
            alt="CONT-AI"
            className="h-3.5 w-3.5 rounded-xs object-contain bg-white p-[0.5px] border border-[#a0a0a0]"
          />
          <strong className="text-[#003366] text-[11px]">CONT-AI v2.0</strong>
        </div>

        <div className="status-panel">
          <span>
            Empresa: <strong>{activeEmpresa?.razaoSocial || "Não selecionada"}</strong>
          </span>
        </div>

        <div className="status-panel hidden sm:block">
          <span>
            Período: <strong>{selectedMes !== "todos" ? `${selectedMes}/` : ""}{selectedAno !== "todos" ? selectedAno : "Geral"}</strong>
          </span>
        </div>

        <div className="status-panel hidden md:block">
          <span>
            Status: <strong className="text-[#107c41]">● Conectado</strong>
          </span>
        </div>

        <div className="status-panel">
          <span>
            Documentos:{" "}
            <strong>
              {itensPaginados.length} de {itensFiltrados.length}
            </strong>
          </span>
        </div>

        {/* Indicador CAPS Lock 100% Funcional */}
        <div className="status-panel">
          <span
            className={isCapsLockOn ? "text-[#000000] font-black" : "text-[#a0a0a0] font-normal"}
            title="Indicador de Caixa Alta (Caps Lock)"
          >
            CAPS
          </span>
        </div>

        {/* Indicador NUM Lock 100% Funcional */}
        <div className="status-panel">
          <span
            className={isNumLockOn ? "text-[#000000] font-black" : "text-[#a0a0a0] font-normal"}
            title="Indicador de Teclado Numérico (Num Lock)"
          >
            NUM
          </span>
        </div>

        {/* Relógio do Sistema */}
        <div className="ml-auto text-[#555555] font-mono text-[10px] hidden sm:block">
          <span>{clock}</span>
        </div>
      </footer>

      {/* Modal de Dashboard Executivo */}
      <ExecutiveDashboardModal
        isOpen={isDashboardModalOpen}
        onClose={() => setIsDashboardModalOpen(false)}
        data={dashboardData}
        onExportHtml={handleExportarDashboardHtml}
        exportingHtml={exportingHtml}
      />

      {/* Modal de Sincronização Unificada em 1 Clique (Todos os Modelos) */}
      <SyncAllProgressModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        targetCompany={activeEmpresa}
        allCompanies={empresas}
        onComplete={() => {
          carregarDadosConsolidados();
          if (activeEmpresa) {
            listAvailableMonths(activeEmpresa.cnpj, activeEmpresa.razaoSocial)
              .then((months) => setAvailableMonths(months || []))
              .catch(() => {});
          }
          onNotify("Sincronização de todos os modelos concluída com sucesso!", "success");
        }}
      />
    </div>
  );
}
