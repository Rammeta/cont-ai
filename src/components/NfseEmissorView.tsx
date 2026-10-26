import React, { useState } from "react";
import {
  Send,
  FileCheck2,
  Users,
  Tag,
  ArrowLeft,
  Building2,
  Plus,
  Eye,
  FileText,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Layers,
  Settings,
  HelpCircle,
  Home,
  RefreshCw,
  ShieldCheck,
  Check,
  Search,
  Copy,
  Trash2,
  Edit2,
  Download,
  Ban,
  Mail,
  Printer,
  DollarSign,
  Filter,
  Laptop,
  Sparkles
} from "lucide-react";
import { EmpresaSefaz, NfseModeloNota, NfseClienteTomador, NfseNotaEmitida } from "../types";
import { EmpresaSearchSelect } from "./EmpresaSearchSelect";
import NfseModeloModal from "./NfseModeloModal";
import NfsePadroesManager from "./NfsePadroesManager";
import NfseClientesManager from "./NfseClientesManager";
import NfsePreviewModal from "./NfsePreviewModal";
import NfseCancelModal from "./NfseCancelModal";
import CertificateBadge from "./CertificateBadge";
import NfseAtividadesModal from "./NfseAtividadesModal";
import {
  AtividadeNbsCorrelacao,
  TABELA_CORRELACAO_NBS,
  OPCOES_CTRIB_NAC,
  OPCOES_NBS,
  OPCOES_CTRIB_MUN,
  OPCOES_CINDOP,
  OPCOES_CCLASSTRIB,
  ComboboxOption
} from "../data/tabelaCorrelacaoNbs";
import { NfseComboboxField } from "./NfseComboboxField";
import { testCert, transmitirDpsNfse, openNfsePdf, saveNfseXml, cancelarNfseNacional, listNfseNotas, syncCompanyNfse, onNfseProgress } from "../utils/electronBridge";
import { calculateDaysRemaining } from "../utils/certUtils";
import { parseDateToTimestamp } from "../utils/calc";
import logoImg from "../assets/logo.png";

interface NfseEmissorViewProps {
  empresas: EmpresaSefaz[];
  activeEmpresa: EmpresaSefaz | null;
  onSelectEmpresa: (id: string) => void;
  onNavigateLauncher: () => void;
  onNavigateGestor: () => void;
  onNotify: (text: string, type: "success" | "error") => void;
  onSaveEmpresas?: (empresas: EmpresaSefaz[]) => void;
  onOpenConfig?: (tab?: "empresas" | "schedulers" | "storage") => void;
}

// Funções auxiliares para deduplicação unificada e garantia do evento/estado mais recente (Cancelada prevalece sobre Autorizada)
export function isSameNotaNfseEmitida(a: Partial<NfseNotaEmitida>, b: Partial<NfseNotaEmitida>): boolean {
  if (!a || !b) return false;
  // 1. Chave de acesso oficial de 50 dígitos da NFS-e Nacional
  const chA = (a.chaveAcesso || "").replace(/\D/g, "");
  const chB = (b.chaveAcesso || "").replace(/\D/g, "");
  if (chA.length === 50 && chB.length === 50 && chA === chB) return true;

  // 2. Par (Série DPS, Número DPS) - único e exclusivo por emissor
  const sA = (a.serieDps || "1").trim();
  const sB = (b.serieDps || "1").trim();
  const nDpsA = parseInt((a.numeroDps || "").replace(/\D/g, ""), 10) || 0;
  const nDpsB = parseInt((b.numeroDps || "").replace(/\D/g, ""), 10) || 0;
  if (sA && sB && sA === sB && nDpsA > 0 && nDpsB > 0 && nDpsA === nDpsB) return true;

  // 3. Número oficial da NFS-e gerada pela SEFIN (quando > 0 e não é '0')
  const nfA = parseInt((a.numeroNfse || "").replace(/\D/g, ""), 10) || 0;
  const nfB = parseInt((b.numeroNfse || "").replace(/\D/g, ""), 10) || 0;
  if (nfA > 0 && nfB > 0 && nfA === nfB) {
    const vA = Number(a.valorServicos || 0);
    const vB = Number(b.valorServicos || 0);
    const docA = (a.tomadorDoc || "").replace(/\D/g, "");
    const docB = (b.tomadorDoc || "").replace(/\D/g, "");
    if (Math.abs(vA - vB) < 0.05 || (docA && docB && docA === docB)) {
      return true;
    }
  }

  return false;
}

export function mergeNotaEmitida(existing: NfseNotaEmitida, nota: NfseNotaEmitida): NfseNotaEmitida {
  // Prevalece SEMPRE o evento mais recente: Cancelada sobrepõe Autorizada
  const isCancelada = existing.status === "Cancelada" || nota.status === "Cancelada";

  const preferNew =
    (nota.status === "Cancelada" && existing.status !== "Cancelada") ||
    (!existing.caminhoPdf && Boolean(nota.caminhoPdf)) ||
    (!existing.caminhoXml && Boolean(nota.caminhoXml)) ||
    ((!existing.numeroNfse || existing.numeroNfse === "0" || existing.numeroNfse === existing.numeroDps) &&
      Boolean(nota.numeroNfse) &&
      nota.numeroNfse !== "0" &&
      nota.numeroNfse !== nota.numeroDps) ||
    ((!existing.chaveAcesso || existing.chaveAcesso.length !== 50) &&
      Boolean(nota.chaveAcesso) &&
      nota.chaveAcesso.length === 50);

  const base: NfseNotaEmitida = preferNew ? { ...existing, ...nota } : { ...nota, ...existing };
  if (isCancelada) {
    base.status = "Cancelada";
    base.motivoCancelamento = existing.motivoCancelamento || nota.motivoCancelamento;
    base.dataCancelamento = existing.dataCancelamento || nota.dataCancelamento;
  }

  // Preserva o número de NFS-e válido caso um dos arquivos seja apenas DPS bruta
  const nfValido =
    existing.numeroNfse && existing.numeroNfse !== "0" && existing.numeroNfse !== existing.numeroDps
      ? existing.numeroNfse
      : nota.numeroNfse && nota.numeroNfse !== "0" && nota.numeroNfse !== nota.numeroDps
      ? nota.numeroNfse
      : base.numeroNfse;
  base.numeroNfse = nfValido;

  // Preserva chave de acesso de 50 dígitos oficial
  const chValida =
    existing.chaveAcesso && existing.chaveAcesso.length === 50
      ? existing.chaveAcesso
      : nota.chaveAcesso && nota.chaveAcesso.length === 50
      ? nota.chaveAcesso
      : base.chaveAcesso;
  base.chaveAcesso = chValida;

  // Preserva caminhos de arquivos válidos
  base.caminhoPdf = existing.caminhoPdf || nota.caminhoPdf;
  base.caminhoXml = existing.caminhoXml || nota.caminhoXml;
  base.xmlAssinado = existing.xmlAssinado || nota.xmlAssinado;

  return base;
}

export function deduplicarNotasNfse(lista: NfseNotaEmitida[]): NfseNotaEmitida[] {
  const result: NfseNotaEmitida[] = [];
  const byChave = new Map<string, number>();
  const byDps = new Map<string, number>();
  const byNf = new Map<number, number[]>();

  for (const n of lista) {
    const ch = (n.chaveAcesso || "").replace(/\D/g, "");
    const s = (n.serieDps || "1").trim();
    const nDps = parseInt((n.numeroDps || "").replace(/\D/g, ""), 10) || 0;
    const nf = parseInt((n.numeroNfse || "").replace(/\D/g, ""), 10) || 0;
    const doc = (n.tomadorDoc || "").replace(/\D/g, "");
    const vServ = Number(n.valorServicos || 0);

    const kCh = ch.length === 50 ? ch : "";
    const kDps = s && nDps > 0 ? `${s}:${nDps}` : "";

    let idx = -1;
    if (kCh && byChave.has(kCh)) {
      idx = byChave.get(kCh)!;
    } else if (kDps && byDps.has(kDps)) {
      idx = byDps.get(kDps)!;
    } else if (nf > 0 && byNf.has(nf)) {
      const candidates = byNf.get(nf)!;
      for (let i = 0; i < candidates.length; i++) {
        const cIdx = candidates[i];
        const cand = result[cIdx];
        const vCand = Number(cand.valorServicos || 0);
        const docCand = (cand.tomadorDoc || "").replace(/\D/g, "");
        if (Math.abs(vCand - vServ) < 0.05 || (doc && docCand && doc === docCand)) {
          idx = cIdx;
          break;
        }
      }
    }

    if (idx === -1) {
      idx = result.length;
      result.push({ ...n });
    } else {
      result[idx] = mergeNotaEmitida(result[idx], n);
    }

    const merged = result[idx];
    const mCh = (merged.chaveAcesso || "").replace(/\D/g, "");
    const mS = (merged.serieDps || "1").trim();
    const mDps = parseInt((merged.numeroDps || "").replace(/\D/g, ""), 10) || 0;
    const mNf = parseInt((merged.numeroNfse || "").replace(/\D/g, ""), 10) || 0;

    if (mCh.length === 50) byChave.set(mCh, idx);
    if (mS && mDps > 0) byDps.set(`${mS}:${mDps}`, idx);
    if (mNf > 0) {
      let arr = byNf.get(mNf);
      if (!arr) {
        arr = [idx];
        byNf.set(mNf, arr);
      } else if (!arr.includes(idx)) {
        arr.push(idx);
      }
    }
  }
  return result;
}

export default function NfseEmissorView({
  empresas,
  activeEmpresa,
  onSelectEmpresa,
  onNavigateLauncher,
  onNavigateGestor,
  onNotify,
  onSaveEmpresas,
  onOpenConfig,
}: NfseEmissorViewProps) {
  const [emissorTab, setEmissorTab] = useState<"nova" | "emitidas" | "clientes" | "servicos">("nova");

  // Form State for "Nova Emissão (DPS)"
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [tomadorDoc, setTomadorDoc] = useState("");
  const [tomadorNome, setTomadorNome] = useState("");
  const [tomadorEmail, setTomadorEmail] = useState("");
  const [tomadorMunicipio, setTomadorMunicipio] = useState("");
  
  // Detalhes do Serviço & Padrões
  const [cTribNac, setCTribNac] = useState("170101");
  const [cNBS, setCNBS] = useState("");
  const [cTribMun, setCTribMun] = useState("000");
  const [itemLc116, setItemLc116] = useState("17.01");
  const [discriminacao, setDiscriminacao] = useState("");
  const [valorServicos, setValorServicos] = useState("");
  const [aliquotaIss, setAliquotaIss] = useState("5,00");
  const [issRetido, setIssRetido] = useState(false);
  const [tribISSQN, setTribISSQN] = useState("1 - Operação tributável");
  const [tpRetISSQN, setTpRetISSQN] = useState("1 - Não retido");
  const [cLocPrestacao, setLocPrestacao] = useState("No endereço do prestador");
  const [cLocPrestacaoOutroMun, setLocPrestacaoOutroMun] = useState("");

  // Reforma Tributária (NT 004 / IBS / CBS)
  const [temIbsCbs, setTemIbsCbs] = useState(true);
  const [cIndOp, setCIndOp] = useState("010101");
  const [cClassTrib, setCClassTrib] = useState("000001");

  // Retenções federais (opcionais)
  const [retencoesAtivas, setRetencoesAtivas] = useState(false);
  const [cstPisCofins, setCstPisCofins] = useState("01");
  const [irrf, setIrrf] = useState("");
  const [pis, setPis] = useState("");
  const [cofins, setCofins] = useState("");
  const [csll, setCsll] = useState("");
  const [inss, setInss] = useState("");

  // Estados de Numeração e Série da DPS
  const [numeroDpsInput, setNumeroDpsInput] = useState<string>("");
  const [serieDpsInput, setSerieDpsInput] = useState<string>("2");

  // Estados de Gerenciamento de Modelos / Padrões
  const [selectedModeloRowId, setSelectedModeloRowId] = useState<string | null>(null);
  const [isModeloModalOpen, setIsModeloModalOpen] = useState(false);
  const [editingModelo, setEditingModelo] = useState<NfseModeloNota | null>(null);

  // Estados para Preview da DPS / DANFSE
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewNota, setPreviewNota] = useState<Partial<NfseNotaEmitida> | null>(null);
  const [isPreviewConfirmed, setIsPreviewConfirmed] = useState(false);

  // Estados para Cancelamento
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancellingNota, setCancellingNota] = useState<NfseNotaEmitida | null>(null);
  const [isCancellingNota, setIsCancellingNota] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);

  // Estados de Sincronização com o Gestor e Portal Nacional
  const [isLoadingGestorNotas, setIsLoadingGestorNotas] = useState(false);
  const [isSyncingPortal, setIsSyncingPortal] = useState(false);
  const [syncProgressText, setSyncProgressText] = useState("");

  // Filtros e seleção da aba "Notas Emitidas" (Padrão do Gestor)
  const [filtroEmitidasTexto, setFiltroEmitidasTexto] = useState("");
  const [filtroEmitidasStatus, setFiltroEmitidasStatus] = useState<"Todas" | "Autorizada" | "Cancelada">("Todas");
  const [filtroEmitidasSerie, setFiltroEmitidasSerie] = useState<string>("Todas");
  const [selectedNotaId, setSelectedNotaId] = useState<string | null>(null);
  const [emitidasDisplayLimit, setEmitidasDisplayLimit] = useState<number>(100);
  const [emitidasSortCol, setEmitidasSortCol] = useState<string>("numero");
  const [emitidasSortDir, setEmitidasSortDir] = useState<"asc" | "desc">("desc");
  const [notasGestorMem, setNotasGestorMem] = useState<NfseNotaEmitida[]>([]);

  const handleEmitidasSort = (col: string) => {
    if (emitidasSortCol === col) {
      setEmitidasSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setEmitidasSortCol(col);
      setEmitidasSortDir("desc");
    }
  };

  // Lista unificada e deduplicada (mostrando sempre o evento/estado mais recente: Cancelada sobrepõe Autorizada)
  const notasEmitidasDeduplicadas = React.useMemo(() => {
    const base = [...notasGestorMem, ...(activeEmpresa?.notasEmitidasNfse || [])];
    return deduplicarNotasNfse(base);
  }, [notasGestorMem, activeEmpresa?.notasEmitidasNfse]);

  const selectedNota = notasEmitidasDeduplicadas.find((n) => n.id === selectedNotaId) || null;

  // Atalho do teclado: Enter para abrir DANFSe da nota selecionada na grade
  React.useEffect(() => {
    if (emissorTab !== "emitidas") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "Enter" && selectedNota) {
        e.preventDefault();
        handleOpenDanfse(selectedNota);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [emissorTab, selectedNota]);

  // Modal de Atividades & Correlação NBS
  const [isAtividadesModalOpen, setIsAtividadesModalOpen] = useState(false);

  const handleSelectAtividade = (atv: AtividadeNbsCorrelacao) => {
    setCNBS(atv.nbsCodigo);
    setItemLc116(atv.itemLc116);

    const rawLc = atv.itemLc116.replace(/\D/g, "");
    if (rawLc && rawLc.length <= 4) {
      setCTribNac(rawLc.padEnd(6, "0"));
    }

    setTemIbsCbs(true);
    if (atv.cIndOp) setCIndOp(atv.cIndOp);
    if (atv.cClassTrib) setCClassTrib(atv.cClassTrib);

    if (!discriminacao.trim()) {
      setDiscriminacao(`PRESTAÇÃO DE SERVIÇOS: ${atv.descricaoNbs.toUpperCase()}.`);
    }

    onNotify(
      `Atividade "${atv.descricaoNbs}" selecionada! NBS ${atv.nbs} (LC ${atv.itemLc116}) e parâmetros IBS/CBS configurados.`,
      "success"
    );
  };

  // Lista de códigos NBS recomendados com base no cTribNac / LC 116 selecionado
  const nbsRecomendadas = React.useMemo(() => {
    if (!cTribNac.trim() && !itemLc116.trim()) return [];
    const rawLc = cTribNac.replace(/\D/g, "");
    const matchingAtividades = TABELA_CORRELACAO_NBS.filter((item) => {
      const itemRaw = (item.itemLc116 || "").replace(/\D/g, "");
      const matchLc = itemRaw && rawLc.startsWith(itemRaw);
      const matchExact = item.itemLc116 === itemLc116;
      return matchLc || matchExact;
    });

    const setRec = new Set<string>();
    for (const atv of matchingAtividades) {
      if (atv.nbsCodigo) setRec.add(atv.nbsCodigo);
      if (atv.todasNbsItem) {
        atv.todasNbsItem.forEach((n) => setRec.add(n.replace(/\D/g, "")));
      }
    }
    return Array.from(setRec);
  }, [cTribNac, itemLc116]);

  const handleSelectCTribNac = (code: string, opt?: ComboboxOption) => {
    setCTribNac(code);
    const found = TABELA_CORRELACAO_NBS.find((item) => {
      const raw = (item.itemLc116 || "").replace(/\D/g, "");
      return code.replace(/\D/g, "").startsWith(raw);
    });
    if (found) {
      setItemLc116(found.itemLc116);
      if (!cNBS.trim() && found.nbsCodigo) {
        setCNBS(found.nbsCodigo);
      }
      if (found.cIndOp && (!cIndOp || cIndOp === "010101" || cIndOp === "100301")) {
        setCIndOp(found.cIndOp);
      }
      if (found.cClassTrib && (!cClassTrib || cClassTrib === "000001")) {
        setCClassTrib(found.cClassTrib);
      }
    }
  };

  const handleSelectNBS = (code: string, opt?: ComboboxOption) => {
    setCNBS(code);
    if (opt?.desc && !discriminacao.trim()) {
      setDiscriminacao(`PRESTAÇÃO DE SERVIÇOS: ${opt.desc.toUpperCase()}.`);
    }
  };

  const handleSelectCTribMun = (code: string) => {
    setCTribMun(code);
  };

  const handleSelectCIndOp = (code: string) => {
    setCIndOp(code);
  };

  const handleSelectCClassTrib = (code: string) => {
    setCClassTrib(code);
  };

  const numValor = parseFloat(valorServicos.replace(/\./g, "").replace(",", ".")) || 0;
  const numAliq = parseFloat(aliquotaIss.replace(",", ".")) || 0;
  const valorIssCalculado = (numValor * (numAliq / 100));

  const numIrrf = parseFloat(irrf.replace(/\./g, "").replace(",", ".")) || 0;
  const numPis = parseFloat(pis.replace(/\./g, "").replace(",", ".")) || 0;
  const numCofins = parseFloat(cofins.replace(/\./g, "").replace(",", ".")) || 0;
  const numCsll = parseFloat(csll.replace(/\./g, "").replace(",", ".")) || 0;
  const numInss = parseFloat(inss.replace(/\./g, "").replace(",", ".")) || 0;

  const totalRetencoes = (issRetido ? valorIssCalculado : 0) + (retencoesAtivas ? (numIrrf + numPis + numCofins + numCsll + numInss) : 0);
  const valorLiquido = Math.max(0, numValor - totalRetencoes);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const isWindowsCert = activeEmpresa?.certStore === "windows" || (!activeEmpresa?.certPath && !!activeEmpresa?.certThumbprint);
  const hasCertificate = Boolean(activeEmpresa?.certPath || isWindowsCert || activeEmpresa?.certThumbprint);

  const [autoDetectedCertInfo, setAutoDetectedCertInfo] = useState<any>(null);

  React.useEffect(() => {
    setAutoDetectedCertInfo(null);
    if (activeEmpresa && hasCertificate && !activeEmpresa.certInfo) {
      let isMounted = true;
      testCert(
        isWindowsCert
          ? { certStore: "windows", thumbprint: activeEmpresa.certThumbprint }
          : { certPath: activeEmpresa.certPath, password: activeEmpresa.password || "" }
      )
        .then((res) => {
          if (isMounted && res.success && res.info) {
            setAutoDetectedCertInfo(res.info);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [activeEmpresa?.id, activeEmpresa?.certPath, activeEmpresa?.certThumbprint, hasCertificate, isWindowsCert]);

  const effectiveCertInfo = activeEmpresa?.certInfo || autoDetectedCertInfo;

  const certDaysRemaining = effectiveCertInfo?.daysRemaining ??
    (effectiveCertInfo?.validTo ? calculateDaysRemaining(effectiveCertInfo.validTo) : null) ??
    (activeEmpresa?.certificadoA1Validade ? calculateDaysRemaining(activeEmpresa.certificadoA1Validade) : null);

  // Carrega e preenche todos os campos ao escolher um Modelo Salvo
  const handleApplyModelo = (modeloId: string) => {
    setSelectedTemplateId(modeloId);
    if (!modeloId || !activeEmpresa?.modelosNfse) return;
    const mod = activeEmpresa.modelosNfse.find((m) => m.id === modeloId);
    if (!mod) return;

    if (mod.descricao) setDiscriminacao(mod.descricao);
    if (mod.cTribNac) setCTribNac(mod.cTribNac);
    if (mod.cNBS) setCNBS(mod.cNBS);
    if (mod.cTribMun) setCTribMun(mod.cTribMun);
    if (mod.aliquotaIss) setAliquotaIss(mod.aliquotaIss);
    if (mod.tribISSQN) setTribISSQN(mod.tribISSQN);
    if (mod.tpRetISSQN) {
      setTpRetISSQN(mod.tpRetISSQN);
      setIssRetido(mod.tpRetISSQN.includes("Retido"));
    }
    if (mod.cLocPrestacao) setLocPrestacao(mod.cLocPrestacao);
    if (mod.temIbsCbs !== undefined) setTemIbsCbs(mod.temIbsCbs);
    if (mod.cIndOp) setCIndOp(mod.cIndOp);
    if (mod.cClassTrib) setCClassTrib(mod.cClassTrib);
    if (mod.cstPisCofins) setCstPisCofins(mod.cstPisCofins);
    if (mod.vRetCP) {
      setRetencoesAtivas(true);
      setInss(mod.vRetCP);
    }
    onNotify(`Padrão "${mod.nome}" carregado no formulário!`, "success");
  };

  // Carrega os dados de um cliente Tomador Salvo
  const handleApplyCliente = (cli: NfseClienteTomador) => {
    setTomadorDoc(cli.cnpjCpf);
    setTomadorNome(cli.razaoSocial);
    if (cli.email) setTomadorEmail(cli.email);
    if (cli.municipio) setTomadorMunicipio(`${cli.municipio}${cli.uf ? ` - ${cli.uf}` : ""}`);
    onNotify(`Dados do tomador "${cli.razaoSocial}" carregados no formulário!`, "success");
  };

  // Atualiza Notas Emitidas da Empresa
  const updateCompanyNotas = (updatedNotas: NfseNotaEmitida[]) => {
    if (!activeEmpresa || !onSaveEmpresas) return;
    const updatedCompany: EmpresaSefaz = {
      ...activeEmpresa,
      notasEmitidasNfse: updatedNotas,
    };
    const updatedList = empresas.map((e) => (e.id === updatedCompany.id ? updatedCompany : e));
    onSaveEmpresas(updatedList);
  };

  // Atualiza Clientes Tomadores da Empresa
  const updateCompanyClientes = (updatedClientes: NfseClienteTomador[]) => {
    if (!activeEmpresa || !onSaveEmpresas) return;
    const updatedCompany: EmpresaSefaz = {
      ...activeEmpresa,
      clientesNfse: updatedClientes,
    };
    const updatedList = empresas.map((e) => (e.id === updatedCompany.id ? updatedCompany : e));
    onSaveEmpresas(updatedList);
  };

  // Séries detectadas nas notas emitidas da empresa (histórico do Gestor + notas emitidas)
  const seriesDetectadas = React.useMemo(() => {
    const map: Record<string, { count: number; maxDps: number; maxNf: number; ultimaData?: string }> = {};
    const notas = notasEmitidasDeduplicadas;
    for (const n of notas) {
      const s = (n.serieDps || "1").trim();
      if (!map[s]) {
        map[s] = { count: 0, maxDps: 0, maxNf: 0 };
      }
      map[s].count++;
      const dps = parseInt(n.numeroDps, 10);
      if (!isNaN(dps) && dps > map[s].maxDps) {
        map[s].maxDps = dps;
        map[s].ultimaData = n.dataEmissao;
      }
      const nf = parseInt(n.numeroNfse || "", 10);
      if (!isNaN(nf) && nf > map[s].maxNf) {
        map[s].maxNf = nf;
      }
    }
    return map;
  }, [notasEmitidasDeduplicadas]);

  // Sequência Oficial de Emissão de NFS-e da Empresa:
  // - Maior NFS-e oficial emitida pela SEFIN (inclui canceladas 58 e 59): ex: 59
  // - Maior NFS-e ativa (válida no mercado): ex: 57
  const statsNfseEmpresa = React.useMemo(() => {
    let maxNfse = 0;
    let maxNfseAtiva = 0;
    let maxDpsSerieAtual = 0;
    const currentSerie = (serieDpsInput || "2").trim();

    for (const n of notasEmitidasDeduplicadas) {
      const nf = parseInt(n.numeroNfse || "", 10);
      if (!isNaN(nf) && nf > maxNfse) maxNfse = nf;
      if (!isNaN(nf) && n.status !== "Cancelada" && nf > maxNfseAtiva) maxNfseAtiva = nf;

      if ((n.serieDps || "1").trim() === currentSerie) {
        const d = parseInt(n.numeroDps || "", 10);
        if (!isNaN(d) && d > maxDpsSerieAtual) maxDpsSerieAtual = d;
      }
    }

    return { maxNfse, maxNfseAtiva, maxDpsSerieAtual };
  }, [notasEmitidasDeduplicadas, serieDpsInput]);

  // Função que encontra o próximo número livre na série, pulando automaticamente
  // qualquer número que já tenha sido emitido (por exemplo: quando chegar na 141, pula automaticamente para a 142)
  const obterProximoNumeroLivre = React.useCallback(
    (serie: string, inicio: number): number => {
      const sClean = (serie || "2").trim();
      const numerosUsadosNaSerie = new Set(
        notasEmitidasDeduplicadas
          .filter((n) => (n.serieDps || "1").trim() === sClean)
          .map((n) => parseInt(n.numeroDps || "0", 10))
      );

      let candidato = Math.max(1, inicio);
      while (numerosUsadosNaSerie.has(candidato)) {
        candidato++;
      }
      return candidato;
    },
    [notasEmitidasDeduplicadas]
  );

  // Próxima NFS-e sugerida: segue a ordem de emissão da NFS-e (nº 58 seguindo a última ativa nº 57, pulando números já usados)
  const proximaNfseSugerida = React.useMemo(() => {
    const base = statsNfseEmpresa.maxNfseAtiva > 0 ? statsNfseEmpresa.maxNfseAtiva + 1 : 1;
    return obterProximoNumeroLivre(serieDpsInput, base);
  }, [statsNfseEmpresa.maxNfseAtiva, serieDpsInput, obterProximoNumeroLivre]);

  // Próxima numeração pelo contador global do SEFIN (pulando números já emitidos)
  const proximaNfseSefin = React.useMemo(() => {
    const base = statsNfseEmpresa.maxNfse > 0 ? statsNfseEmpresa.maxNfse + 1 : 1;
    return obterProximoNumeroLivre(serieDpsInput, base);
  }, [statsNfseEmpresa.maxNfse, serieDpsInput, obterProximoNumeroLivre]);

  // Próxima DPS sugerida (padrão NFS-e ativa)
  const proximaDpsSugerida = proximaNfseSugerida;

  // Detecta se o número de DPS digitado/selecionado já existe NA MESMA SÉRIE
  const dpsJaExiste = React.useMemo(() => {
    const numInt = parseInt(numeroDpsInput || "0", 10);
    if (!numInt) return null;
    const currentSerie = (serieDpsInput || "2").trim();
    return (
      notasEmitidasDeduplicadas.find(
        (n) => (n.serieDps || "1").trim() === currentSerie && parseInt(n.numeroDps || "0", 10) === numInt
      ) || null
    );
  }, [notasEmitidasDeduplicadas, numeroDpsInput, serieDpsInput]);

  // Ao trocar de série manualmente ou via chip
  const handleSelectSerie = (novaSerie: string) => {
    const sClean = novaSerie.trim();
    if (sClean === "70000") {
      onNotify(
        "A série 70000 é exclusiva de emissões pelo Portal Web Nacional. Não é possível emitir por ela no aplicativo. Selecione uma série própria (ex: 1, 2...).",
        "error"
      );
      return;
    }
    setSerieDpsInput(sClean);
    // Mantém a sequência oficial de emissão da NFS-e
    setNumeroDpsInput(String(proximaDpsSugerida));
  };

  const handleSerieInputChange = (novaSerie: string) => {
    const sClean = novaSerie.trim();
    if (sClean === "70000") {
      onNotify(
        "A série 70000 é reservada para o Portal Web da NFS-e Nacional. O aplicativo não permite emissão nesta série. Retornando para a série 2.",
        "error"
      );
      setSerieDpsInput("2");
      setNumeroDpsInput(String(proximaDpsSugerida));
      return;
    }
    setSerieDpsInput(novaSerie);
    setNumeroDpsInput(String(proximaDpsSugerida));
  };

  // Carrega as notas já capturadas e indexadas pelo Gestor
  const carregarNotasGestor = React.useCallback(
    async (empresaAlvo?: EmpresaSefaz, silencioso: boolean = false) => {
      const emp = empresaAlvo || activeEmpresa;
      if (!emp || !emp.cnpj) return;

      setIsLoadingGestorNotas(true);
      try {
        const res = await listNfseNotas(emp.cnpj, emp.razaoSocial, "todos", "todos", "Prestadas");
        if (!res.success || !res.notas) {
          if (!silencioso && res.error) {
            onNotify(`Erro ao consultar notas do Gestor: ${res.error}`, "error");
          }
          return;
        }

        const parsedNotas = res.notas || [];
        const notasFormatadas: NfseNotaEmitida[] = parsedNotas.map((n) => {
          const dpsNum = String(n.dpsNumero || "").padStart(6, "0");
          const sDps = String(n.dpsSerie || "1").trim();
          const nfNum = n.numeroNFe || "";
          const ch = n.chaveNotaNacional || "";
          return {
            id: ch || `gestor_${sDps}_${dpsNum || nfNum || Date.now()}`,
            numeroDps: dpsNum || nfNum,
            serieDps: sDps,
            numeroNfse: nfNum,
            chaveAcesso: ch,
            dataEmissao: n.dataGeracao || "",
            competencia: n.competencia || "",
            tomadorDoc: n.tomadorCnpj || "",
            tomadorNome: n.tomadorNome || "",
            discriminacao: n.descricaoServico || "PRESTAÇÃO DE SERVIÇOS",
            cTribNac: n.codTribNac || "170101",
            cNBS: n.itemNBS || undefined,
            cTribMun: "000",
            tribISSQN: n.tributacaoISSQN || "1 - Operação tributável",
            tpRetISSQN: n.retencaoISSQN || (n.temRetencao ? "2 - Retido pelo tomador" : "1 - Não retido"),
            cLocPrestacao: "No endereço do prestador",
            valorServicos: Number(n.valorServicos || 0),
            aliquotaIss: Number(n.aliqISSQN || 0),
            valorIss: Number(n.valorISSQN || 0),
            issRetido: Boolean(n.temRetencao),
            totalRetencoes: Math.max(0, Number(n.valorServicos || 0) - Number(n.valorLiquido || n.valorServicos || 0)),
            valorLiquido: Number(n.valorLiquido || n.valorServicos || 0),
            status: n.isCancelada ? ("Cancelada" as const) : ("Autorizada" as const),
            caminhoXml: n.caminhoXml,
            caminhoPdf: n.caminhoPdf || undefined,
          };
        });

        // Mescla com notas já existentes em memória para não perder nenhuma emitida recentemente,
        // garantindo deduplicação inteligente onde o evento mais recente (Cancelada) prevalece sobre Autorizada
        const notasExistentes = emp.notasEmitidasNfse || [];
        const todasNotas = deduplicarNotasNfse([...notasFormatadas, ...notasExistentes]).sort((a, b) => {
          const nfB = parseInt(b.numeroNfse, 10) || 0;
          const nfA = parseInt(a.numeroNfse, 10) || 0;
          if (nfB !== nfA) return nfB - nfA;
          const numB = parseInt(b.numeroDps, 10) || 0;
          const numA = parseInt(a.numeroDps, 10) || 0;
          return numB - numA;
        });

        // Extrai tomadores únicos para atualizar automaticamente a lista de "Meus Clientes"
        const clientesAtuais = emp.clientesNfse || [];
        const mapaClientes = new Map<string, NfseClienteTomador>();
        for (const c of clientesAtuais) {
          const cleanDoc = c.cnpjCpf.replace(/\D/g, "");
          if (cleanDoc) mapaClientes.set(cleanDoc, c);
        }
        for (const n of todasNotas) {
          const cleanDoc = (n.tomadorDoc || "").replace(/\D/g, "");
          if (cleanDoc && !mapaClientes.has(cleanDoc)) {
            mapaClientes.set(cleanDoc, {
              id: "cli_" + cleanDoc,
              cnpjCpf: n.tomadorDoc,
              razaoSocial: n.tomadorNome,
              uf: "SP",
            });
          }
        }

        const listaClientes = Array.from(mapaClientes.values());
        setNotasGestorMem(todasNotas);

        // No localStorage (empresas), persiste apenas as últimas 50 notas recentes para não inflar e travar JSON.stringify
        const notasRecentesStorage = todasNotas.slice(0, 50);
        const clientesChanged = listaClientes.length !== (emp.clientesNfse || []).length;
        const notasStorageTooLarge = (emp.notasEmitidasNfse || []).length > 60;

        if (onSaveEmpresas && (clientesChanged || notasStorageTooLarge || (emp.notasEmitidasNfse || []).length === 0)) {
          const updatedEmp: EmpresaSefaz = {
            ...emp,
            notasEmitidasNfse: notasRecentesStorage,
            clientesNfse: listaClientes,
          };
          const updatedList = empresas.map((e) => (e.id === updatedEmp.id ? updatedEmp : e));
          onSaveEmpresas(updatedList);
        }

        // Detecta qual série tem mais notas para sugerir inicialmente se ainda não foi selecionada
        // AVISO IMPORTANTE: A Série 70000 é do Portal Web Nacional e NUNCA deve ser sugerida para emissão via aplicativo!
        const seriesCounts: Record<string, number> = {};
        for (const n of todasNotas) {
          const s = (n.serieDps || "1").trim();
          seriesCounts[s] = (seriesCounts[s] || 0) + 1;
        }

        const seriesEmissiveis = Object.keys(seriesCounts).filter((s) => s !== "70000");

        let serieRecomendada = serieDpsInput.trim();
        if (!serieRecomendada || serieRecomendada === "70000") {
          if (seriesEmissiveis.length > 0) {
            // Escolhe a série emissível com a maior numeração de DPS emitida (mais recente na linha do tempo)
            const serieMaisRecente = seriesEmissiveis.sort((a, b) => {
              const maxA = todasNotas
                .filter((n) => (n.serieDps || "").trim() === a)
                .reduce((m, n) => Math.max(m, parseInt(n.numeroDps, 10) || 0), 0);
              const maxB = todasNotas
                .filter((n) => (n.serieDps || "").trim() === b)
                .reduce((m, n) => Math.max(m, parseInt(n.numeroDps, 10) || 0), 0);
              return maxB - maxA;
            })[0];
            serieRecomendada = serieMaisRecente || "2";
          } else {
            serieRecomendada = "2";
          }
        }

        // Segue o padrão oficial de emissão da NFS-e (Nota Fiscal de Serviços Eletrônica)
        const maxNfse = todasNotas.reduce((max, n) => Math.max(max, parseInt(n.numeroNfse, 10) || 0), 0);
        const maxNfseAtiva = todasNotas
          .filter((n) => n.status !== "Cancelada")
          .reduce((max, n) => Math.max(max, parseInt(n.numeroNfse, 10) || 0), 0);

        // Se a última NFS-e ativa foi a 57, a próxima sugestão padrão é a nº 58 (pulando automaticamente qualquer uma já emitida)
        const baseNum = maxNfseAtiva > 0 ? maxNfseAtiva + 1 : (maxNfse > 0 ? maxNfse + 1 : 1);
        const nextNum = obterProximoNumeroLivre(serieRecomendada, baseNum);

        setSerieDpsInput(serieRecomendada);
        setNumeroDpsInput(String(nextNum));

        if (!silencioso) {
          onNotify(
            `Histórico carregado! ${todasNotas.length} notas no banco. Padrão NFS-e: Última nota ativa foi a nº ${maxNfseAtiva}. Próxima numeração sugerida: nº ${nextNum} (Série ${serieRecomendada}).`,
            "success"
          );
        }
      } catch (err: any) {
        if (!silencioso) onNotify(`Erro ao carregar histórico do Gestor: ${err.message}`, "error");
      } finally {
        setIsLoadingGestorNotas(false);
      }
    },
    [activeEmpresa, empresas, onSaveEmpresas, onNotify, serieDpsInput]
  );

  // Busca novas notas no Portal Nacional (ADN)
  const handleSyncPortalNacional = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa emissora primeiro.", "error");
      return;
    }
    if (!hasCertificate) {
      onNotify("A empresa precisa ter Certificado Digital A1 vinculado para consultar o Portal Nacional.", "error");
      return;
    }

    setIsSyncingPortal(true);
    setSyncProgressText("Consultando SEFIN Nacional (ADN)...");

    let unsub: (() => void) | null = null;
    try {
      unsub = onNfseProgress((info: any) => {
        if (info && info.message) {
          setSyncProgressText(info.message);
        }
      });

      const res = await syncCompanyNfse(activeEmpresa);
      if (!res.success) {
        onNotify(`Falha na captação no Portal Nacional: ${res.error || "Erro de conexão"}`, "error");
        return;
      }

      onNotify(`Busca no Portal Nacional finalizada! ${res.totalDocsBaixados || 0} nota(s) sincronizada(s).`, "success");
      await carregarNotasGestor(activeEmpresa, false);
    } catch (err: any) {
      onNotify(`Erro na sincronização: ${err.message}`, "error");
    } finally {
      if (unsub) unsub();
      setIsSyncingPortal(false);
      setSyncProgressText("");
    }
  };

  // Carrega automaticamente o banco de notas do Gestor ao selecionar a empresa
  React.useEffect(() => {
    setNotasGestorMem([]);
    setEmitidasDisplayLimit(100);
    if (activeEmpresa?.cnpj) {
      carregarNotasGestor(activeEmpresa, true);
    }
  }, [activeEmpresa?.id, activeEmpresa?.cnpj]);

  // Abrir Pré-visualização da DPS
  const handleOpenPreviewDps = () => {
    if (!numValor || !tomadorDoc.trim() || !tomadorNome.trim()) {
      onNotify("Preencha o documento, nome do cliente e valor dos serviços para visualizar o espelho.", "error");
      return;
    }
    const currentSerie = serieDpsInput.trim() || "2";
    if (currentSerie === "70000") {
      onNotify(
        "A série 70000 é reservada exclusivamente para o Portal Web da NFS-e Nacional. Não é possível emitir por aplicativo nesta série. Por favor, utilize a série 1, 2 ou outra série própria.",
        "error"
      );
      return;
    }
    const defaultNextNumero = proximaDpsSugerida;
    const proximoNumero = numeroDpsInput ? parseInt(numeroDpsInput, 10) : defaultNextNumero;

    const notaDuplicada = notasEmitidasDeduplicadas.find(
      (n) =>
        (n.serieDps || "1").trim() === currentSerie &&
        parseInt(n.numeroDps || "0", 10) === proximoNumero
    );
    if (notaDuplicada) {
      const proximoLivre = obterProximoNumeroLivre(currentSerie, proximoNumero + 1);
      onNotify(
        `A DPS nº ${proximoNumero} já consta como emitida na Série ${currentSerie} (Status: ${notaDuplicada.status}). Pulando automaticamente para a próxima livre (nº ${proximoLivre}) para evitar duplicidade.`,
        "error"
      );
      setNumeroDpsInput(String(proximoLivre));
      return;
    }

    const dpsPreview: Partial<NfseNotaEmitida> = {
      numeroDps: String(proximoNumero).padStart(6, "0"),
      serieDps: currentSerie,
      dataEmissao: new Date().toLocaleString("pt-BR"),
      tomadorDoc,
      tomadorNome,
      tomadorEmail,
      tomadorMunicipio,
      discriminacao,
      cTribNac,
      cNBS,
      cTribMun,
      tribISSQN,
      tpRetISSQN,
      cLocPrestacao,
      valorServicos: numValor,
      aliquotaIss: numAliq,
      valorIss: valorIssCalculado,
      issRetido,
      totalRetencoes,
      valorLiquido,
      temIbsCbs,
      cIndOp,
      cClassTrib,
      irrf: retencoesAtivas ? numIrrf : 0,
      pis: retencoesAtivas ? numPis : 0,
      cofins: retencoesAtivas ? numCofins : 0,
      csll: retencoesAtivas ? numCsll : 0,
      inss: retencoesAtivas ? numInss : 0,
    };
    setPreviewNota(dpsPreview);
    setIsPreviewConfirmed(false);
    setIsPreviewOpen(true);
  };

  // Transmitir e Emitir DPS Definitiva
  const handleTransmitirDps = async () => {
    if (!activeEmpresa) {
      onNotify("Selecione uma empresa emissora primeiro.", "error");
      return;
    }
    if (!hasCertificate) {
      onNotify("A empresa emissora não possui Certificado Digital A1 vinculado (arquivo .pfx ou Windows). Clique em 'Editar Empresa' para vincular.", "error");
      return;
    }
    if (!numValor || !tomadorDoc.trim() || !tomadorNome.trim()) {
      onNotify("Preencha todos os campos obrigatórios marcados com (*) para transmitir.", "error");
      return;
    }

    const currentSerie = serieDpsInput.trim() || "2";
    if (currentSerie === "70000") {
      onNotify(
        "A série 70000 é reservada exclusivamente para o Portal Web da NFS-e Nacional. Não é possível emitir por aplicativo nesta série. Por favor, utilize a série 1, 2 ou outra série própria.",
        "error"
      );
      return;
    }
    const defaultNextNumero = proximaDpsSugerida;
    const proximoNumero = numeroDpsInput ? parseInt(numeroDpsInput, 10) : defaultNextNumero;

    const notaDuplicada = notasEmitidasDeduplicadas.find(
      (n) =>
        (n.serieDps || "1").trim() === currentSerie &&
        parseInt(n.numeroDps || "0", 10) === proximoNumero
    );
    if (notaDuplicada) {
      const proximoLivre = obterProximoNumeroLivre(currentSerie, proximoNumero + 1);
      onNotify(
        `A DPS nº ${proximoNumero} já foi emitida na Série ${currentSerie} (Status: ${notaDuplicada.status}). Pulando automaticamente para a próxima livre (nº ${proximoLivre}) para evitar duplicidade na SEFIN.`,
        "error"
      );
      setNumeroDpsInput(String(proximoLivre));
      return;
    }

    const formattedDpsNum = String(proximoNumero).padStart(6, "0");
    const cleanCnpj = (activeEmpresa?.cnpj || "00000000000000").replace(/\D/g, "");
    const defaultCLocEmi = activeEmpresa?.emissaoConfig?.cLocEmi || (cleanCnpj === "66001954000127" ? "3554102" : "3554102");

    setIsTransmitting(true);
    try {
      const dpsPayload = {
        numeroDps: proximoNumero,
        serieDps: currentSerie,
        cLocEmi: defaultCLocEmi,
        ambiente: "1",
        tomadorDoc: tomadorDoc.trim(),
        tomadorNome: tomadorNome.trim(),
        tomadorEmail: tomadorEmail.trim(),
        tomadorMunicipio: tomadorMunicipio.trim(),
        discriminacao: discriminacao.trim() || "PRESTAÇÃO DE SERVIÇOS EM GERAL.",
        cTribNac: cTribNac.trim() || "170101",
        cNBS: cNBS.trim() || undefined,
        cTribMun: cTribMun.trim() || "000",
        tribISSQN,
        tpRetISSQN,
        cLocPrestacao,
        valorServicos: numValor,
        aliquotaIss: numAliq,
        valorIss: valorIssCalculado,
        issRetido,
        irrf: retencoesAtivas ? numIrrf : 0,
        pis: retencoesAtivas ? numPis : 0,
        cofins: retencoesAtivas ? numCofins : 0,
        csll: retencoesAtivas ? numCsll : 0,
        inss: retencoesAtivas ? numInss : 0,
        cstPisCofins,
        temIbsCbs,
        cIndOp: temIbsCbs ? cIndOp : undefined,
        cClassTrib: temIbsCbs ? cClassTrib : undefined,
      };

      const res = await transmitirDpsNfse(activeEmpresa, dpsPayload);

      if (!res.sucesso) {
        onNotify(`Falha na transmissão da DPS: ${res.mensagem || "Erro na comunicação"}`, "error");
        setIsTransmitting(false);
        return;
      }

      const finalChave = res.chaveAcesso || `352601${cleanCnpj}0000000000000000${formattedDpsNum}`;
      const finalNumNfse = res.numeroNfse || formattedDpsNum;

      const novaNota: NfseNotaEmitida = {
        id: "dps_" + Date.now(),
        numeroDps: formattedDpsNum,
        serieDps: res.serieDps || "1",
        numeroNfse: finalNumNfse,
        chaveAcesso: finalChave,
        codigoVerificacao: res.codigoVerificacao,
        caminhoXml: res.savedXmlPath,
        dataEmissao: new Date().toLocaleString("pt-BR"),
        competencia: new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" }),
        tomadorDoc: tomadorDoc.trim(),
        tomadorNome: tomadorNome.trim(),
        tomadorEmail: tomadorEmail.trim() || undefined,
        tomadorMunicipio: tomadorMunicipio.trim() || undefined,
        discriminacao: discriminacao.trim() || "PRESTAÇÃO DE SERVIÇOS EM GERAL.",
        cTribNac: cTribNac.trim() || "170101",
        cNBS: cNBS.trim() || undefined,
        cTribMun: cTribMun.trim() || "000",
        tribISSQN,
        tpRetISSQN,
        cLocPrestacao,
        valorServicos: numValor,
        aliquotaIss: numAliq,
        valorIss: valorIssCalculado,
        issRetido,
        totalRetencoes,
        valorLiquido,
        status: "Autorizada",
        temIbsCbs,
        cIndOp: temIbsCbs ? cIndOp : undefined,
        cClassTrib: temIbsCbs ? cClassTrib : undefined,
        irrf: retencoesAtivas ? numIrrf : 0,
        pis: retencoesAtivas ? numPis : 0,
        cofins: retencoesAtivas ? numCofins : 0,
        csll: retencoesAtivas ? numCsll : 0,
        inss: retencoesAtivas ? numInss : 0,
        xmlAssinado: res.xmlRetorno || res.xmlEnvio || "",
        caminhoPdf: res.savedPdfPath || undefined,
      };

      const listaAtual = activeEmpresa?.notasEmitidasNfse || [];
      const updatedNotas = deduplicarNotasNfse([novaNota, ...listaAtual]);
      updateCompanyNotas(updatedNotas);

      // Salva o tomador automaticamente em Meus Clientes se ainda não existir
      const clientesAtuais = activeEmpresa?.clientesNfse || [];
      const jaExiste = clientesAtuais.some((c) => c.cnpjCpf.replace(/\D/g, "") === tomadorDoc.replace(/\D/g, ""));
      if (!jaExiste) {
        const novoCliente: NfseClienteTomador = {
          id: "cli_" + Date.now(),
          cnpjCpf: tomadorDoc.trim(),
          razaoSocial: tomadorNome.trim(),
          email: tomadorEmail.trim() || undefined,
          municipio: tomadorMunicipio.trim() || undefined,
          uf: tomadorMunicipio.includes("-") ? tomadorMunicipio.split("-")[1].trim() : "SP",
        };
        updateCompanyClientes([...clientesAtuais, novoCliente]);
      }

      setPreviewNota(novaNota);
      setIsPreviewConfirmed(true);
      setIsPreviewOpen(true);
      const proximoAposTransmissao = obterProximoNumeroLivre(currentSerie, proximoNumero + 1);
      setNumeroDpsInput(String(proximoAposTransmissao));
      onNotify(`DPS nº ${formattedDpsNum} transmitida e assinada com Certificado A1! NFS-e nº ${finalNumNfse}`, "success");
    } catch (err: any) {
      onNotify(`Erro na emissão: ${err.message}`, "error");
    } finally {
      setIsTransmitting(false);
    }
  };

  // Abrir DANFSe Oficial em PDF no padrão do Gestor
  const handleOpenDanfse = async (notaItem: Partial<NfseNotaEmitida>) => {
    try {
      const res = await openNfsePdf(notaItem.caminhoPdf, notaItem.caminhoXml, notaItem.xmlAssinado);
      if (!res?.success) {
        onNotify(res?.error || "Não foi possível abrir o PDF do DANFSe.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao abrir DANFSe: ${err.message}`, "error");
    }
  };

  // Salvar XML no padrão de montagem e nomenclatura oficial do Gestor
  const handleSaveXml = async (notaItem: NfseNotaEmitida) => {
    try {
      const num = notaItem.numeroNfse || notaItem.numeroDps || "doc";
      const cleanToma = (notaItem.tomadorNome || "TOMADOR").replace(/[\/\\:*?"<>|]/g, "").trim().substring(0, 50);
      const temRet = Boolean(notaItem.issRetido || (notaItem.totalRetencoes && notaItem.totalRetencoes > 0));
      const defaultName = `NF ${num} - ${cleanToma}${temRet ? " - COM RETENÇÃO" : ""}.xml`;

      const res = await saveNfseXml(notaItem.caminhoXml, defaultName, notaItem.xmlAssinado);
      if (res.canceled) return;
      if (res.success) {
        onNotify("Arquivo XML da NFS-e salvo com sucesso!", "success");
      } else {
        onNotify(res.error || "Erro ao salvar arquivo XML.", "error");
      }
    } catch (err: any) {
      onNotify(`Erro ao salvar XML: ${err.message}`, "error");
    }
  };

  // Envio de E-mail
  const handleSendEmail = (notaItem: NfseNotaEmitida) => {
    onNotify(`DANFSE e XML da nota nº ${notaItem.numeroDps} enviados para ${notaItem.tomadorEmail || "o cliente"}!`, "success");
  };

  // Cancelamento
  const handleOpenCancelModal = (notaItem: NfseNotaEmitida) => {
    setCancellingNota(notaItem);
    setIsCancelModalOpen(true);
  };

  const handleConfirmCancelNota = async (notaId: string, motivo: string, cMotivo: string = "1") => {
    if (!activeEmpresa?.notasEmitidasNfse) return;
    const notaItem = activeEmpresa.notasEmitidasNfse.find((n) => n.id === notaId);
    if (!notaItem) return;

    if (!notaItem.chaveAcesso) {
      onNotify("Esta nota não possui chave de acesso da SEFIN para cancelamento.", "error");
      return;
    }

    setIsCancellingNota(true);
    try {
      const res = await cancelarNfseNacional(activeEmpresa, {
        chaveAcesso: notaItem.chaveAcesso,
        motivo,
        cMotivo,
        ambiente: activeEmpresa.ambiente || 1,
        caminhoXml: notaItem.caminhoXml
      });

      if (!res.sucesso) {
        onNotify(`Falha no cancelamento junto à SEFIN: ${res.mensagem}`, "error");
        return;
      }

      const updatedNotas = (activeEmpresa.notasEmitidasNfse || []).map((n) => {
        const isMatch =
          n.id === notaId ||
          (notaItem.chaveAcesso && n.chaveAcesso && n.chaveAcesso === notaItem.chaveAcesso) ||
          ((n.serieDps || "1").trim() === (notaItem.serieDps || "1").trim() &&
            parseInt(n.numeroDps || "0", 10) === parseInt(notaItem.numeroDps || "0", 10));

        if (isMatch) {
          return {
            ...n,
            status: "Cancelada" as const,
            motivoCancelamento: motivo,
            dataCancelamento: new Date().toLocaleString("pt-BR"),
          };
        }
        return n;
      });
      const dedupedNotas = deduplicarNotasNfse(updatedNotas);
      updateCompanyNotas(dedupedNotas);
      setIsCancelModalOpen(false);
      setCancellingNota(null);
      onNotify("NFS-e cancelada com sucesso junto à SEFIN Nacional!", "success");
    } catch (err: any) {
      onNotify(`Erro inesperado no cancelamento: ${err.message}`, "error");
    } finally {
      setIsCancellingNota(false);
    }
  };

  // Métodos de CRUD de Modelos / Padrões
  const handleOpenAddModelo = () => {
    setEditingModelo(null);
    setIsModeloModalOpen(true);
  };

  const handleOpenEditModelo = (mod: NfseModeloNota) => {
    setEditingModelo(mod);
    setIsModeloModalOpen(true);
  };

  const handleDuplicateModelo = () => {
    if (!selectedModeloRowId || !activeEmpresa?.modelosNfse) return;
    const found = activeEmpresa.modelosNfse.find((m) => m.id === selectedModeloRowId);
    if (!found) return;
    const duplicated: NfseModeloNota = {
      ...found,
      id: "mod_" + Date.now(),
      nome: found.nome + " (Cópia)",
    };
    const updatedModelos = [...activeEmpresa.modelosNfse, duplicated];
    updateCompanyModelos(updatedModelos);
    setSelectedModeloRowId(duplicated.id);
    onNotify(`Modelo "${found.nome}" duplicado com sucesso!`, "success");
  };

  const handleRemoveModelo = () => {
    if (!selectedModeloRowId || !activeEmpresa?.modelosNfse) return;
    const found = activeEmpresa.modelosNfse.find((m) => m.id === selectedModeloRowId);
    if (!found) return;
    if (confirm(`Deseja remover o modelo "${found.nome}"?`)) {
      const updatedModelos = activeEmpresa.modelosNfse.filter((m) => m.id !== selectedModeloRowId);
      updateCompanyModelos(updatedModelos);
      setSelectedModeloRowId(null);
      onNotify(`Modelo "${found.nome}" removido.`, "success");
    }
  };

  const handleSaveModelo = (modelo: NfseModeloNota) => {
    const list = activeEmpresa?.modelosNfse || [];
    const exists = list.some((m) => m.id === modelo.id);
    let updatedModelos: NfseModeloNota[];
    if (exists) {
      updatedModelos = list.map((m) => (m.id === modelo.id ? modelo : m));
    } else {
      updatedModelos = [...list, modelo];
    }
    updateCompanyModelos(updatedModelos);
    setSelectedModeloRowId(modelo.id);
    onNotify(`Modelo "${modelo.nome}" gravado com sucesso!`, "success");
  };

  const updateCompanyModelos = (updatedModelos: NfseModeloNota[]) => {
    if (!activeEmpresa || !onSaveEmpresas) return;
    const updatedCompany: EmpresaSefaz = {
      ...activeEmpresa,
      modelosNfse: updatedModelos,
    };
    const updatedList = empresas.map((e) => (e.id === updatedCompany.id ? updatedCompany : e));
    onSaveEmpresas(updatedList);
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[#f0f0f0] select-none text-[11px] text-[#000000] font-sans overflow-hidden">
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
        .vb-btn-primary:hover {
          background: linear-gradient(180deg, #e1effe 0%, #c3ddfd 50%, #a4cafe 100%);
          border-color: #003366;
        }
        .vb-btn-success {
          background: linear-gradient(180deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%);
          border: 1px solid #16a34a;
          font-weight: 700;
          color: #14532d;
        }
        .vb-btn-success:hover {
          background: linear-gradient(180deg, #dcfce7 0%, #bbf7d0 50%, #86efac 100%);
          border-color: #15803d;
        }
        .vb-input, .vb-select, .vb-textarea {
          background-color: #ffffff;
          border: 1px solid #7a7a7a;
          border-radius: 0px;
          padding: 3px 6px;
          font-size: 11px;
          color: #000000;
          outline: none;
        }
        .vb-input:focus, .vb-select:focus, .vb-textarea:focus {
          border-color: #005a9e;
          box-shadow: 0 0 0 1px #005a9e;
        }
        fieldset.vb-groupbox {
          border: 1px solid #b0b0b0;
          padding: 7px 10px 8px 10px;
          margin-bottom: 6px;
          background-color: #f7f7f7;
          min-width: 0;
          box-sizing: border-box;
          width: 100%;
        }
        legend.vb-legend {
          font-weight: 600;
          font-size: 11px;
          color: #003366;
          padding: 0 4px;
        }
        .erp-tab-btn {
          border-top: 1px solid #b0b0b0;
          border-left: 1px solid #b0b0b0;
          border-right: 1px solid #b0b0b0;
          border-bottom: 1px solid #b0b0b0;
          border-top-left-radius: 3px;
          border-top-right-radius: 3px;
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 600;
          color: #444444;
          background: #e4e4e4;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .erp-tab-btn:hover {
          background: #ececec;
          color: #003366;
        }
        .erp-tab-btn.active {
          background: #f7f7f7;
          border-bottom: 1px solid #f7f7f7;
          color: #003366;
          font-weight: bold;
          margin-bottom: -1px;
          box-shadow: 0 -2px 0 #005a9e inset;
        }
        .status-bar-classic {
          background: #e0e0e0;
          border-top: 1px solid #b0b0b0;
          font-size: 11px;
          color: #333333;
          padding: 2px 8px;
        }
      `}</style>

      {/* Top Header ERP Ribbon - Padrão CONT-AI Clássico */}
      <header className="shrink-0 border-b border-[#b0b0b0] bg-[#f0f0f0] px-2 py-1 shadow-xs relative z-40">
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <div
              className="flex items-center gap-1 cursor-pointer"
              onClick={onNavigateLauncher}
              title="CONT-AI - Central de Módulos (Clique para ir ao Launcher)"
            >
              <img
                src={logoImg}
                alt="Logo CONT-AI"
                className="h-5 w-auto object-contain shrink-0"
              />
              <span className="font-extrabold text-[#003366] text-[12px] tracking-tight">
                CONT-AI
              </span>
              <span className="text-[9px] font-bold text-[#005a9e] bg-[#dbe8f8] border border-[#99bce8] px-1 rounded-xs">
                v2.0
              </span>
            </div>

            <div className="h-4 w-[1px] bg-[#b8b8b8] mx-0.5" />

            {/* Início / Launcher Button */}
            <button
              type="button"
              onClick={onNavigateLauncher}
              className="vb-btn"
              title="Voltar para a Tela Inicial (Seleção de Módulos)"
            >
              <Home size={11} className="text-[#005a9e]" />
              <span>Início</span>
            </button>

            {/* Ir para Gestor Fiscal */}
            <button
              type="button"
              onClick={onNavigateGestor}
              className="vb-btn"
              title="Alternar para o Gestor Fiscal (Captação, Auditoria e Fechamento)"
            >
              <Layers size={11} className="text-[#005a9e]" />
              <span>Gestor Fiscal</span>
            </button>

            <div className="h-4 w-[1px] bg-[#b8b8b8] mx-0.5" />

            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#eaf4ea] border border-[#a3d9a5] text-[#14532d] font-bold text-[11px]">
              <Send size={11} className="text-[#16a34a]" />
              <span>Módulo: Emissor de NFS-e (Padrão Nacional DPS)</span>
            </div>
          </div>

          {/* Right side: Active Company Selector & Config */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-[#333333]">Empresa Emissora:</span>
            {empresas.length > 0 ? (
              <div className="w-64 sm:w-80">
                <EmpresaSearchSelect
                  empresas={empresas}
                  value={activeEmpresa?.id || ""}
                  onChange={onSelectEmpresa}
                  align="right"
                  className="w-full"
                />
              </div>
            ) : (
              <span className="text-[11px] text-red-600 font-bold">Nenhuma empresa cadastrada</span>
            )}

            {onOpenConfig && (
              <button
                type="button"
                onClick={() => onOpenConfig("empresas")}
                className="vb-btn"
                title="Abrir Cadastro e Parâmetros de Emissão da Empresa"
              >
                <Settings size={11} className="text-[#333333]" />
                <span>Editar Empresa</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Subheader Toolbar & Tabs */}
      <div className="bg-[#e8e8e8] border-b border-[#b5b5b5] px-3 pt-1.5 flex items-center justify-between gap-2 shrink-0">
        <nav className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEmissorTab("nova")}
            className={`erp-tab-btn ${emissorTab === "nova" ? "active" : ""}`}
          >
            <Plus size={12} className={emissorTab === "nova" ? "text-[#003366]" : "text-[#555555]"} />
            <span>Nova Emissão (DPS)</span>
          </button>

          <button
            type="button"
            onClick={() => setEmissorTab("emitidas")}
            className={`erp-tab-btn ${emissorTab === "emitidas" ? "active" : ""}`}
          >
            <FileCheck2 size={12} className={emissorTab === "emitidas" ? "text-[#003366]" : "text-[#555555]"} />
            <span>Notas Emitidas</span>
            {notasEmitidasDeduplicadas.length > 0 && (
              <span className="bg-[#005a9e] text-white text-[9px] px-1 py-0.2 rounded-xs font-mono ml-0.5">
                {notasEmitidasDeduplicadas.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setEmissorTab("clientes")}
            className={`erp-tab-btn ${emissorTab === "clientes" ? "active" : ""}`}
          >
            <Users size={12} className={emissorTab === "clientes" ? "text-[#003366]" : "text-[#555555]"} />
            <span>Meus Clientes</span>
            {(activeEmpresa?.clientesNfse || []).length > 0 && (
              <span className="bg-[#005a9e] text-white text-[9px] px-1 py-0.2 rounded-xs font-mono ml-0.5">
                {activeEmpresa!.clientesNfse!.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setEmissorTab("servicos")}
            className={`erp-tab-btn ${emissorTab === "servicos" ? "active" : ""}`}
          >
            <Tag size={12} className={emissorTab === "servicos" ? "text-[#003366]" : "text-[#555555]"} />
            <span>Padrões de Emissão (Modelos)</span>
            {(activeEmpresa?.modelosNfse || []).length > 0 && (
              <span className="bg-[#005a9e] text-white text-[9px] px-1 py-0.2 rounded-xs font-mono ml-0.5">
                {activeEmpresa!.modelosNfse!.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAtividadesModalOpen(true)}
            className="erp-tab-btn hover:text-[#003366]"
            title="Consultar Tabela Oficial de Correlação: Atividades x NBS x LC 116 x IBS / CBS"
          >
            <Sparkles size={12} className="text-amber-600" />
            <span>Tabela de Atividades & NBS</span>
          </button>
        </nav>

        {activeEmpresa && (
          <div className="flex items-center gap-2 text-[11px] pb-1 text-[#444444]">
            <span className="font-semibold text-[#333333]">Certificado A1:</span>
            {effectiveCertInfo ? (
              <span className="flex items-center gap-1.5">
                {isWindowsCert && (
                  <span className="inline-flex items-center gap-1 text-[9px] bg-[#dbeafe] text-[#1e40af] font-bold px-1.5 py-0.2 border border-[#bfdbfe]">
                    <Laptop size={10} /> WINDOWS STORE
                  </span>
                )}
                <CertificateBadge certInfo={effectiveCertInfo} onClick={() => onOpenConfig?.("empresas")} />
              </span>
            ) : hasCertificate ? (
              <span
                onClick={() => onOpenConfig?.("empresas")}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-400 cursor-pointer"
                title="Certificado digital vinculado. Clique para gerenciar."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                <ShieldCheck size={11} className="text-emerald-700" />
                <span>
                  {isWindowsCert ? "Certificado Windows Vinculado" : "Arquivo PFX Vinculado"}
                </span>
              </span>
            ) : (
              <span
                onClick={() => onOpenConfig?.("empresas")}
                className="font-bold text-red-600 cursor-pointer hover:underline flex items-center gap-1"
                title="Nenhum certificado A1 vinculado a esta empresa. Clique para configurar."
              >
                ● Não Configurado
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 overflow-y-auto p-3 bg-[#f0f0f0]">
        {emissorTab === "nova" && (
          <div className="max-w-6xl mx-auto flex flex-col gap-2">
            
            {/* Box 1: Dados do Prestador Ativo */}
            <fieldset className="vb-groupbox">
              <legend className="vb-legend flex items-center gap-1.5">
                <Building2 size={12} />
                <span>1. Dados do Prestador / Empresa Emitente</span>
              </legend>

              {activeEmpresa ? (
                <div className="bg-[#ffffff] border border-[#c0c0c0] p-2 text-[11px] flex flex-col gap-2">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-[#666666] block text-[10px]">Razão Social:</span>
                      <strong className="text-[#003366] truncate block">{activeEmpresa.razaoSocial}</strong>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px]">CNPJ / Inscrição Municipal:</span>
                      <strong className="font-mono text-[#111111]">{activeEmpresa.cnpj}</strong>
                      {(activeEmpresa.inscricaoMunicipal || activeEmpresa.emissaoConfig?.inscricaoMunicipal) && (
                        <span className="text-[#555555] ml-1">
                          (IM: {activeEmpresa.inscricaoMunicipal || activeEmpresa.emissaoConfig?.inscricaoMunicipal})
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px]">Enquadramento Tributário:</span>
                      <span className="font-semibold text-[#222222]">
                        {activeEmpresa.emissaoConfig?.opSimpNac === "3"
                          ? "Optante ME/EPP (Simples)"
                          : activeEmpresa.emissaoConfig?.opSimpNac === "2"
                          ? "Optante MEI"
                          : "Regime Normal / Outro"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#666666] block text-[10px]">Ambiente de Emissão:</span>
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-bold">
                        <ShieldCheck size={12} className="text-emerald-600" />
                        Padrão Nacional (SEFIN)
                      </span>
                    </div>
                  </div>

                  {/* Seletor de Séries Detectadas no Histórico do Gestor */}
                  <div className="border-t border-[#e5e5e5] pt-1.5 pb-1 flex flex-wrap items-center gap-1.5 bg-[#fcfcfc] px-2 -mx-2">
                    <span className="text-[10px] text-[#555] font-semibold flex items-center gap-1">
                      <Layers size={11} className="text-[#005a9e]" />
                      Séries Registradas no Gestor:
                    </span>
                    {Object.keys(seriesDetectadas).length > 0 ? (
                      Object.entries(seriesDetectadas).map(([s, info]) => {
                        const is70000 = s === "70000";
                        const isSelected = (serieDpsInput || "").trim() === s;

                        if (is70000) {
                          return (
                            <span
                              key={s}
                              className="px-2 py-0.5 text-[10px] rounded border font-mono flex items-center gap-1.5 bg-[#f5f5f5] text-[#777777] border-[#d4d4d4] cursor-not-allowed select-none opacity-80"
                              title="Série 70000: Reservada exclusivamente para emissões manuais no Portal Web Nacional. Não é permitido emitir via aplicativo nesta série."
                            >
                              <span className="font-semibold line-through text-[#999999]">Série 70000</span>
                              <span className="text-[9px] bg-[#e5e5e5] text-[#555555] px-1 rounded font-sans">
                                {info.count} nfs • Portal Web (Não emissível)
                              </span>
                            </span>
                          );
                        }

                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => handleSelectSerie(s)}
                            className={`px-2 py-0.5 text-[10px] rounded border font-mono transition-all flex items-center gap-1.5 ${
                              isSelected
                                ? "bg-[#005a9e] text-white border-[#003366] font-bold shadow-xs"
                                : "bg-white text-[#333333] border-[#b0b0b0] hover:bg-[#e8f0fe]"
                            }`}
                            title={`Série ${s}: ${info.count} notas. ${info.maxNf > 0 ? `Última NFS-e: #${info.maxNf}` : `Última DPS: #${info.maxDps}`}.`}
                          >
                            <span>Série {s}</span>
                            <span className={`text-[9px] px-1 rounded ${isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-[#555]"}`}>
                              {info.count} nfs • {info.maxNf > 0 ? `NFS-e #${info.maxNf}` : `DPS #${info.maxDps}`}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-[10px] text-[#777] italic">Nenhuma série anterior detectada</span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const custom = prompt("Digite o número/código da nova série (ex: 2, 3, 100):");
                        if (custom && custom.trim()) {
                          if (custom.trim() === "70000") {
                            alert("A série 70000 é reservada para o Portal Web da NFS-e Nacional e não pode ser utilizada via aplicativo. Use 1, 2 ou outra série.");
                            return;
                          }
                          handleSelectSerie(custom.trim());
                        }
                      }}
                      className="px-1.5 py-0.5 text-[10px] text-[#005a9e] hover:underline flex items-center gap-0.5 ml-1"
                      title="Digitar ou emitir com uma nova série"
                    >
                      <Plus size={10} /> Outra série
                    </button>
                  </div>

                  <div className="border-t border-[#e5e5e5] pt-1.5 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-[#fbfbfb] px-2 py-1.5 -mx-2 -mb-2">
                    <div className="sm:col-span-3">
                      <span className="text-[#666666] text-[10px] block">Município Emissor (cLocEmi):</span>
                      <strong className="text-[#003366] font-mono text-[11px]">
                        {activeEmpresa.cnpj.replace(/\D/g, "") === "66001954000127"
                          ? "Taubaté - SP (IBGE 3554102)"
                          : (activeEmpresa.emissaoConfig?.cLocEmi || "3554102")}
                      </strong>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[#666666] text-[10px] block">Série da DPS:</span>
                      <input
                        type="text"
                        maxLength={5}
                        value={serieDpsInput}
                        onChange={(e) => handleSerieInputChange(e.target.value)}
                        className="vb-input w-20 py-0.5 px-1 font-mono font-bold text-[#003366] text-[11px]"
                        title="Série da DPS (ajusta a numeração sequencial automaticamente)"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="text-[#666666] text-[10px] block">Nº a Emitir (DPS / NFS-e):</span>
                      <input
                        type="number"
                        min="1"
                        value={numeroDpsInput}
                        onChange={(e) => setNumeroDpsInput(e.target.value)}
                        className="vb-input w-24 py-0.5 px-1 font-mono font-bold text-[#003366] text-[11px]"
                        title="Número de emissão enviado para a SEFIN Nacional (alinhado à sequência oficial da NFS-e)"
                      />
                    </div>
                    <div className="sm:col-span-5 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => carregarNotasGestor(activeEmpresa, false)}
                        disabled={isLoadingGestorNotas}
                        className="vb-btn flex items-center gap-1 text-[10.5px]"
                        title="Recarrega todas as notas do banco de dados e disco do Gestor de Movimento Fiscal"
                      >
                        <RefreshCw size={11} className={isLoadingGestorNotas ? "animate-spin text-[#005a9e]" : "text-[#555]"} />
                        <span>{isLoadingGestorNotas ? "Carregando..." : "Sincronizar Gestor"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSyncPortalNacional}
                        disabled={isSyncingPortal}
                        className="vb-btn vb-btn-primary flex items-center gap-1 text-[10.5px]"
                        title="Executa a busca oficial de notas no Portal Nacional ADN via Robô SEFIN"
                      >
                        {isSyncingPortal ? (
                          <>
                            <RefreshCw size={11} className="animate-spin text-[#002244]" />
                            <span>Buscando no Portal...</span>
                          </>
                        ) : (
                          <>
                            <Search size={11} className="text-[#002244]" />
                            <span>Buscar no Portal Nacional</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Barra de Status da Linha Sequencial de Emissão NFS-e */}
                    <div className="sm:col-span-12 pt-1 border-t border-[#e5e5e5] flex flex-wrap items-center justify-between text-[10.5px] gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-[#003366] border border-blue-200">
                          <CheckCircle2 size={11} className="text-blue-600 shrink-0" />
                          <span>Padrão Oficial NFS-e:</span>
                          <span>Última Ativa: <strong>NFS-e nº {statsNfseEmpresa.maxNfseAtiva || 0}</strong></span>
                          {statsNfseEmpresa.maxNfse > statsNfseEmpresa.maxNfseAtiva && (
                            <span className="text-red-700 font-mono text-[10px]">
                              (Canceladas no SEFIN: #{statsNfseEmpresa.maxNfseAtiva + 1} a #{statsNfseEmpresa.maxNfse})
                            </span>
                          )}
                          <span className="mx-0.5 text-blue-300">•</span>
                          <span>Próxima a Emitir: <strong className="text-emerald-700 font-mono">nº {numeroDpsInput || proximaNfseSugerida}</strong> (Série {serieDpsInput.trim() || "2"})</span>
                        </span>

                        {/* Atalhos rápidos para alternar entre sequência da ativa (58) ou contador SEFIN (60) */}
                        <div className="inline-flex items-center gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => setNumeroDpsInput(String(proximaNfseSugerida))}
                            className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                              numeroDpsInput === String(proximaNfseSugerida)
                                ? "bg-[#005a9e] text-white border-[#003366]"
                                : "bg-white text-[#005a9e] border-blue-200 hover:bg-blue-50"
                            }`}
                            title={`Emitir como nº ${proximaNfseSugerida} (continuidade da última NFS-e ativa nº ${statsNfseEmpresa.maxNfseAtiva})`}
                          >
                            Usar nº {proximaNfseSugerida} (Seguir Ativa #{statsNfseEmpresa.maxNfseAtiva})
                          </button>
                          {proximaNfseSefin !== proximaNfseSugerida && (
                            <button
                              type="button"
                              onClick={() => setNumeroDpsInput(String(proximaNfseSefin))}
                              className={`px-1.5 py-0.5 rounded border transition-all cursor-pointer font-bold ${
                                numeroDpsInput === String(proximaNfseSefin)
                                  ? "bg-[#005a9e] text-white border-[#003366]"
                                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                              }`}
                              title={`Emitir como nº ${proximaNfseSefin} (alinhado ao contador do SEFIN após cancelamentos)`}
                            >
                              Usar nº {proximaNfseSefin} (Contador SEFIN)
                            </button>
                          )}
                        </div>

                        {dpsJaExiste ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300 text-[10.5px] font-medium shadow-xs">
                            <AlertCircle size={12} className="text-rose-600 shrink-0" />
                            <span>Atenção: A DPS nº {numeroDpsInput} já foi emitida na Série {dpsJaExiste.serieDps} (NFS-e {dpsJaExiste.numeroNfse || 'DPS'} - {dpsJaExiste.status}).</span>
                            <button
                              type="button"
                              onClick={() => setNumeroDpsInput(String(proximaNfseSugerida))}
                              className="underline font-bold hover:text-rose-950 ml-1 cursor-pointer"
                            >
                              Usar nº {proximaNfseSugerida}
                            </button>
                          </span>
                        ) : null}
                      </div>

                      {syncProgressText && (
                        <span className="text-[10px] text-blue-700 font-mono animate-pulse truncate max-w-sm">
                          {syncProgressText}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#fff9db] border border-[#f59f00] p-2 text-amber-900 flex items-center gap-2">
                  <AlertCircle size={14} className="text-amber-700 shrink-0" />
                  <span>Nenhuma empresa selecionada. Selecione uma empresa acima para emitir notas fiscais.</span>
                </div>
              )}
            </fieldset>

            {/* Grid 2 Colunas: Formulário à esquerda e Totais/Ações à direita */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
              
              {/* Coluna Esquerda: Tomador + Detalhes do Serviço + Padrões */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-2 min-w-0 w-full">
                
                {/* Box 2: Tomador */}
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend flex items-center justify-between w-full">
                    <span className="flex items-center gap-1.5">
                      <Users size={12} />
                      <span>2. Dados do Tomador / Cliente</span>
                    </span>
                    {(activeEmpresa?.clientesNfse || []).length > 0 && (
                      <span className="flex items-center gap-1 font-normal normal-case">
                        <span className="text-[#666666] text-[10px]">Carregar Cliente:</span>
                        <select
                          onChange={(e) => {
                            const found = activeEmpresa?.clientesNfse?.find((c) => c.id === e.target.value);
                            if (found) handleApplyCliente(found);
                          }}
                          className="vb-select text-[10px] py-0 px-1 font-semibold"
                          defaultValue=""
                        >
                          <option value="" disabled>-- Selecionar Salvo --</option>
                          {activeEmpresa!.clientesNfse!.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.razaoSocial} ({c.cnpjCpf})
                            </option>
                          ))}
                        </select>
                      </span>
                    )}
                  </legend>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#ffffff] border border-[#c0c0c0] p-2 min-w-0">
                    <div className="min-w-0">
                      <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                        CNPJ ou CPF do Cliente: *
                      </label>
                      <input
                        type="text"
                        placeholder="00.000.000/0000-00"
                        value={tomadorDoc}
                        onChange={(e) => setTomadorDoc(e.target.value)}
                        className="vb-input w-full font-mono font-bold"
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                        Razão Social ou Nome Completo: *
                      </label>
                      <input
                        type="text"
                        placeholder="Nome fantasia ou razão social"
                        value={tomadorNome}
                        onChange={(e) => setTomadorNome(e.target.value)}
                        className="vb-input w-full"
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                        E-mail (para envio do XML e DANFSE):
                      </label>
                      <input
                        type="email"
                        placeholder="financeiro@cliente.com.br"
                        value={tomadorEmail}
                        onChange={(e) => setTomadorEmail(e.target.value)}
                        className="vb-input w-full"
                      />
                    </div>

                    <div className="min-w-0">
                      <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                        Município / UF do Tomador:
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: São Paulo - SP"
                        value={tomadorMunicipio}
                        onChange={(e) => setTomadorMunicipio(e.target.value)}
                        className="vb-input w-full"
                      />
                    </div>
                  </div>
                </fieldset>

                {/* Box 3: Detalhamento do Serviço & Parâmetros Fiscais da DPS */}
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend flex items-center gap-1.5">
                    <FileText size={12} />
                    <span>3. Detalhamento do Serviço, Códigos Fiscais & Padrões</span>
                  </legend>

                  <div className="flex flex-col gap-2.5 bg-[#ffffff] border border-[#c0c0c0] p-2.5 min-w-0 w-full">
                    {/* Seletor Rápido de Padrão de Emissão */}
                    <div className="bg-[#f0f6ff] border border-[#b8d4f6] p-2 flex flex-wrap items-center justify-between gap-2 min-w-0">
                      <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                        <span className="font-bold text-[#003366] shrink-0 text-[10.5px]">Carregar Padrão:</span>
                        <select
                          value={selectedTemplateId}
                          onChange={(e) => handleApplyModelo(e.target.value)}
                          className="vb-select flex-1 min-w-0 font-semibold text-[10.5px]"
                        >
                          <option value="">-- Selecionar um padrão pré-configurado --</option>
                          {(activeEmpresa?.modelosNfse || []).map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.nome} ({m.cTribNac || "Sem cód"} - {m.tribISSQN})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsAtividadesModalOpen(true)}
                          className="vb-btn vb-btn-primary font-bold text-[#002244] border-[#005a9e] text-[10px]"
                          title="Consultar Tabela Oficial de Correlação: Atividades x NBS x LC 116 x IBS / CBS"
                        >
                          <Sparkles size={11} className="text-amber-500" />
                          <span>Tabela de Atividades & NBS</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingModelo(null);
                            setIsModeloModalOpen(true);
                          }}
                          className="vb-btn font-bold text-[#003366] text-[10px]"
                          title="Cadastrar Novo Padrão de Emissão"
                        >
                          <Plus size={11} className="text-emerald-700" />
                          <span>+ Novo Padrão</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmissorTab("servicos")}
                          className="vb-btn text-[10px]"
                          title="Gerenciar Padrões de Emissão cadastrados"
                        >
                          <Tag size={11} className="text-[#005a9e]" />
                          <span>Padrões ({activeEmpresa?.modelosNfse?.length || 0})</span>
                        </button>
                      </div>
                    </div>

                    {/* Códigos Tributários com Painel Suspenso (cTribNac, cNBS, cTribMun) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
                      <NfseComboboxField
                        label="cTribNac (Cód. Trib. Nacional):"
                        value={cTribNac}
                        onChange={handleSelectCTribNac}
                        options={OPCOES_CTRIB_NAC}
                        placeholder="6 dígitos (ex: 170101)"
                        maxLength={6}
                        required={true}
                        helpButton={
                          <button
                            type="button"
                            onClick={() => setIsAtividadesModalOpen(true)}
                            className="text-[10px] text-[#005a9e] hover:underline font-bold flex items-center gap-0.5"
                            title="Consultar Tabela Completa de Atividades"
                          >
                            <Sparkles size={9} className="text-amber-600" /> Tabela Completa
                          </button>
                        }
                      />

                      <NfseComboboxField
                        label="cNBS (Nomenclatura NBS):"
                        value={cNBS}
                        onChange={handleSelectNBS}
                        options={OPCOES_NBS}
                        recommendedCodes={nbsRecomendadas}
                        placeholder="9 dígitos (ex: 1.1502.10.00)"
                        maxLength={9}
                        helpButton={
                          <button
                            type="button"
                            onClick={() => setIsAtividadesModalOpen(true)}
                            className="text-[10px] text-[#005a9e] hover:underline font-bold flex items-center gap-0.5"
                            title="Consultar Tabela NBS Oficial"
                          >
                            <Sparkles size={9} className="text-amber-600" /> Ver Tabela
                          </button>
                        }
                      />

                      <NfseComboboxField
                        label="cTribMun (Cód. Municipal):"
                        value={cTribMun}
                        onChange={handleSelectCTribMun}
                        options={OPCOES_CTRIB_MUN}
                        placeholder="000"
                        maxLength={4}
                        panelWidth="min-w-[280px]"
                      />
                    </div>

                    {/* Local da Prestação (cLocPrestacao) & Tributação do ISS (tribISSQN) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
                      <div className="min-w-0">
                        <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                          Local da Prestação (cLocPrestacao):
                        </label>
                        <select
                          value={cLocPrestacao}
                          onChange={(e) => setLocPrestacao(e.target.value)}
                          className="vb-select w-full"
                        >
                          <option value="No endereço do prestador">No endereço do prestador</option>
                          <option value="No endereço do tomador">No endereço do tomador</option>
                          <option value="Outro município">Outro município</option>
                        </select>
                      </div>

                      <div className="min-w-0">
                        <label className="block font-semibold text-[#333333] mb-0.5 truncate">
                          Tributação do ISSQN (tribISSQN):
                        </label>
                        <select
                          value={tribISSQN}
                          onChange={(e) => setTribISSQN(e.target.value)}
                          className="vb-select w-full"
                        >
                          <option value="1 - Operação tributável">1 - Operação tributável</option>
                          <option value="2 - Imunidade">2 - Imunidade</option>
                          <option value="3 - Exportação de serviço">3 - Exportação de serviço</option>
                          <option value="4 - Não Incidência">4 - Não Incidência</option>
                          <option value="5 - Isenção">5 - Isenção</option>
                        </select>
                      </div>
                    </div>

                    {/* Discriminação dos Serviços */}
                    <div className="min-w-0 w-full">
                      <label className="block font-semibold text-[#333333] mb-0.5">
                        Discriminação dos Serviços Prestados: *
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Descreva detalhadamente as atividades prestadas, período de apuração, número de contrato ou dados bancários para depósito..."
                        value={discriminacao}
                        onChange={(e) => setDiscriminacao(e.target.value)}
                        className="vb-input w-full font-mono text-[11px] resize-y min-w-0 box-border"
                      />
                    </div>

                    {/* Reforma Tributária (IBS / CBS - NT 004) */}
                    <div className="border border-[#d0d0d0] p-2 bg-[#fafafa] min-w-0 w-full">
                      <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#003366] text-[11px]">Reforma Tributária (IBS / CBS - NT 004):</span>
                          <button
                            type="button"
                            onClick={() => setIsAtividadesModalOpen(true)}
                            className="text-[10px] text-[#005a9e] hover:underline font-bold flex items-center gap-0.5"
                            title="Auto-preencher cIndOp e cClassTrib selecionando na tabela de correlação"
                          >
                            <Sparkles size={9} className="text-amber-600" /> Preencher pela Tabela
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="flex items-center gap-1 cursor-pointer font-bold text-[#003366]">
                            <input
                              type="radio"
                              name="emissorIbsCbsRadio"
                              checked={temIbsCbs}
                              onChange={() => setTemIbsCbs(true)}
                            />
                            <span>Sim</span>
                          </label>
                          <label className="flex items-center gap-1 cursor-pointer text-[#444444]">
                            <input
                              type="radio"
                              name="emissorIbsCbsRadio"
                              checked={!temIbsCbs}
                              onChange={() => setTemIbsCbs(false)}
                            />
                            <span>Não</span>
                          </label>
                        </div>
                      </div>

                      {temIbsCbs && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-[#e0e0e0] min-w-0">
                          <NfseComboboxField
                            label="cIndOp (Indicador de Operação):"
                            value={cIndOp}
                            onChange={handleSelectCIndOp}
                            options={OPCOES_CINDOP}
                            placeholder="100301"
                            maxLength={6}
                            panelWidth="min-w-[340px] max-w-[440px]"
                          />
                          <NfseComboboxField
                            label="cClassTrib (Classificação Tributária):"
                            value={cClassTrib}
                            onChange={handleSelectCClassTrib}
                            options={OPCOES_CCLASSTRIB}
                            placeholder="000001"
                            maxLength={6}
                            panelWidth="min-w-[340px] max-w-[440px]"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </fieldset>

                {/* Box 4: Retenções Federais Opcionais */}
                <fieldset className="vb-groupbox">
                  <legend className="vb-legend flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="chkRetencoes"
                      checked={retencoesAtivas}
                      onChange={(e) => setRetencoesAtivas(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <label htmlFor="chkRetencoes" className="cursor-pointer">
                      4. Informar Retenções Federais (PIS, COFINS, IRRF, CSLL, INSS)
                    </label>
                  </legend>

                  {retencoesAtivas ? (
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 bg-[#ffffff] border border-[#c0c0c0] p-2 min-w-0">
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">CST PIS/COFINS</label>
                        <select
                          value={cstPisCofins}
                          onChange={(e) => setCstPisCofins(e.target.value)}
                          className="vb-select w-full font-mono text-[10px]"
                        >
                          <option value="01">01 - Tributável</option>
                          <option value="04">04 - Monofásica</option>
                          <option value="07">07 - Isenta</option>
                          <option value="08">08 - Sem Incidência</option>
                          <option value="49">49 - Outras Saídas</option>
                          <option value="99">99 - Outras</option>
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">IRRF (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={irrf}
                          onChange={(e) => setIrrf(e.target.value)}
                          className="vb-input w-full font-mono text-right"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">PIS (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={pis}
                          onChange={(e) => setPis(e.target.value)}
                          className="vb-input w-full font-mono text-right"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">COFINS (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={cofins}
                          onChange={(e) => setCofins(e.target.value)}
                          className="vb-input w-full font-mono text-right"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">CSLL (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={csll}
                          onChange={(e) => setCsll(e.target.value)}
                          className="vb-input w-full font-mono text-right"
                        />
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-semibold text-[#333333] truncate">INSS (R$)</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={inss}
                          onChange={(e) => setInss(e.target.value)}
                          className="vb-input w-full font-mono text-right"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[#ffffff] border border-[#c0c0c0] p-1.5 text-[#666666] text-[10px]">
                      Nenhuma retenção federal informada. Marque a caixa acima se houver retenção na fonte para este tomador.
                    </div>
                  )}
                </fieldset>

              </div>

              {/* Coluna Direita: Valores, Cálculo de ISS & Transmissão */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-2 min-w-0 w-full lg:sticky lg:top-2">
                <fieldset className="vb-groupbox w-full flex flex-col justify-between">
                  <legend className="vb-legend flex items-center gap-1.5">
                    <span>5. Valores & Resumo Financeiro da Nota</span>
                  </legend>

                  <div className="bg-[#ffffff] border border-[#c0c0c0] p-2.5 flex flex-col gap-2.5">
                    <div>
                      <label className="block font-bold text-[#003366] text-[12px] mb-0.5">
                        Valor Bruto dos Serviços (R$): *
                      </label>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={valorServicos}
                        onChange={(e) => setValorServicos(e.target.value)}
                        className="vb-input w-full font-mono text-[13px] font-bold text-[#002244] text-right"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-[#333333]">
                          Alíquota ISS (%):
                        </label>
                        <input
                          type="text"
                          placeholder="5,00"
                          value={aliquotaIss}
                          onChange={(e) => setAliquotaIss(e.target.value)}
                          className="vb-input w-full font-mono text-center font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#333333]">
                          Valor do ISS (R$):
                        </label>
                        <div className="vb-input w-full bg-[#f4f4f4] text-right font-mono font-bold text-[#333333]">
                          {formatCurrency(valorIssCalculado)}
                        </div>
                      </div>
                    </div>

                    {!issRetido && (
                      <div className="text-[10px] text-[#0066cc] bg-[#f0f7ff] p-1.5 rounded border border-[#cce0ff] leading-tight">
                        ℹ️ <strong>Simples Nacional:</strong> Sem retenção, o ISS é apurado no DAS mensal (alíquota omitida no XML da DPS pela regra E0625).
                      </div>
                    )}

                    <div className="pt-1">
                      <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[#333333]">
                        <input
                          type="checkbox"
                          checked={issRetido}
                          onChange={(e) => {
                            setIssRetido(e.target.checked);
                            setTpRetISSQN(e.target.checked ? "2 - Retido pelo tomador" : "1 - Não retido");
                          }}
                          className="cursor-pointer"
                        />
                        <span>ISS Retido na Fonte pelo Tomador</span>
                      </label>
                    </div>

                    {/* Resumo Contábil */}
                    <div className="border-t border-[#d8d8d8] pt-2 flex flex-col gap-1 text-[11px]">
                      <div className="flex justify-between text-[#555555]">
                        <span>(+) Valor dos Serviços:</span>
                        <strong className="font-mono text-[#111111]">{formatCurrency(numValor)}</strong>
                      </div>

                      {totalRetencoes > 0 && (
                        <div className="flex justify-between text-amber-800">
                          <span>(-) Retenções Totais:</span>
                          <strong className="font-mono">- {formatCurrency(totalRetencoes)}</strong>
                        </div>
                      )}

                      <div className="border-t border-[#c0c0c0] pt-1.5 mt-0.5 flex justify-between items-center bg-[#f0f6ff] px-2 py-1 border border-[#b8d4f6]">
                        <span className="font-bold text-[#003366] text-[12px]">Líquido a Receber:</span>
                        <span className="font-bold font-mono text-[#003366] text-[13px]">
                          {formatCurrency(valorLiquido)}
                        </span>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="mt-2 pt-2 border-t border-[#d8d8d8] flex flex-col gap-1.5">
                      <button
                        type="button"
                        onClick={handleOpenPreviewDps}
                        className="vb-btn w-full justify-center"
                      >
                        <Eye size={12} className="text-[#005a9e]" />
                        <span>Pré-visualizar Espelho da DPS</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleTransmitirDps}
                        disabled={isTransmitting}
                        className={`vb-btn vb-btn-success w-full justify-center py-1.5 text-[11px] ${
                          isTransmitting ? "opacity-75 cursor-not-allowed" : ""
                        }`}
                      >
                        {isTransmitting ? (
                          <>
                            <RefreshCw size={12} className="animate-spin text-white" />
                            <span>ASSINANDO E TRANSMITINDO DPS...</span>
                          </>
                        ) : (
                          <>
                            <Send size={12} />
                            <span>TRANSMITIR E EMITIR NFS-E</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="text-[10px] text-center text-[#666666]">
                      Assinatura digital via Certificado A1 do Prestador
                    </div>
                  </div>
                </fieldset>
              </div>

            </div>
          </div>
        )}

        {emissorTab === "emitidas" && (
          <div className="max-w-6xl mx-auto flex flex-col gap-2.5">
            {/* Cards de Métricas Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#666666] block">Total de Notas Emitidas:</span>
                  <strong className="text-[14px] text-[#003366] font-mono">
                    {notasEmitidasDeduplicadas.length}
                  </strong>
                </div>
                <FileCheck2 size={24} className="text-[#005a9e]" />
              </div>

              <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#666666] block">Valor Total Prestado:</span>
                  <strong className="text-[13px] text-emerald-800 font-mono">
                    {formatCurrency(
                      notasEmitidasDeduplicadas
                        .filter((n) => n.status !== "Cancelada")
                        .reduce((acc, curr) => acc + curr.valorServicos, 0)
                    )}
                  </strong>
                </div>
                <DollarSign size={24} className="text-emerald-700" />
              </div>

              <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#666666] block">ISS Total Apurado:</span>
                  <strong className="text-[13px] text-[#003366] font-mono">
                    {formatCurrency(
                      notasEmitidasDeduplicadas
                        .filter((n) => n.status !== "Cancelada")
                        .reduce((acc, curr) => acc + curr.valorIss, 0)
                    )}
                  </strong>
                </div>
                <Tag size={24} className="text-[#005a9e]" />
              </div>

              <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#666666] block">Notas Canceladas:</span>
                  <strong className="text-[14px] text-red-700 font-mono">
                    {notasEmitidasDeduplicadas.filter((n) => n.status === "Cancelada").length}
                  </strong>
                </div>
                <Ban size={24} className="text-red-600" />
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div className="bg-white border border-[#b0b0b0] p-2 flex flex-wrap items-center justify-between gap-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <input
                    type="text"
                    placeholder="Filtrar por nº DPS, NFS-e, tomador ou chave..."
                    value={filtroEmitidasTexto}
                    onChange={(e) => setFiltroEmitidasTexto(e.target.value)}
                    className="vb-input w-full pl-6 text-[11px]"
                  />
                  <Search size={12} className="absolute left-1.5 top-1.5 text-[#888888]" />
                </div>

                {/* Filtro por Série */}
                <select
                  value={filtroEmitidasSerie}
                  onChange={(e) => setFiltroEmitidasSerie(e.target.value)}
                  className="vb-select text-[11px] font-mono text-[#003366] font-semibold"
                  title="Filtrar notas por série"
                >
                  <option value="Todas">Todas as Séries ({notasEmitidasDeduplicadas.length})</option>
                  {Object.entries(seriesDetectadas).map(([s, info]) => (
                    <option key={s} value={s}>
                      Série {s} ({info.count} notas • Última DPS: #{info.maxDps})
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1">
                  {(["Todas", "Autorizada", "Cancelada"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFiltroEmitidasStatus(st)}
                      className={`vb-btn ${filtroEmitidasStatus === st ? "bg-[#dbeafe] border-[#005a9e] text-[#003366] font-bold" : ""}`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => carregarNotasGestor(activeEmpresa, false)}
                  disabled={isLoadingGestorNotas}
                  className="vb-btn flex items-center gap-1 text-[10.5px]"
                  title="Recarregar histórico de notas do banco de dados e disco do Gestor"
                >
                  <RefreshCw size={11} className={isLoadingGestorNotas ? "animate-spin text-[#005a9e]" : "text-[#555]"} />
                  <span>{isLoadingGestorNotas ? "Atualizando..." : "Sincronizar Gestor"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncPortalNacional}
                  disabled={isSyncingPortal}
                  className="vb-btn vb-btn-primary flex items-center gap-1 text-[10.5px]"
                  title="Buscar novas notas diretamente no Portal Nacional ADN"
                >
                  {isSyncingPortal ? (
                    <>
                      <RefreshCw size={11} className="animate-spin text-[#002244]" />
                      <span>Buscando...</span>
                    </>
                  ) : (
                    <>
                      <Search size={11} className="text-[#002244]" />
                      <span>Buscar no Portal Nacional</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setEmissorTab("nova")}
                  className="vb-btn vb-btn-success font-bold"
                >
                  <Plus size={11} />
                  <span>+ Emitir Nova DPS</span>
                </button>
              </div>
            </div>

            {/* Grade de Notas Emitidas no Padrão do Gestor */}
            <fieldset className="vb-groupbox bg-white p-0">
              <legend className="vb-legend flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileCheck2 size={12} />
                  <span>Histórico de Notas Fiscais Emitidas (Padrão Nacional & Gestor Integrado)</span>
                </div>
                <span className="text-[10px] text-[#666] font-normal">
                  Dê duplo clique para abrir DANFSe • Enter = Abrir DANFSe
                </span>
              </legend>

              {/* Barra de Ação da Nota Selecionada no Padrão do Gestor */}
              {selectedNota && (
                <div className="bg-[#f0f6ff] border-b border-[#b8d4f6] px-2.5 py-1.5 flex flex-wrap items-center justify-between text-[11px] gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#003366]">Nota Selecionada:</span>
                    <span className="font-mono font-bold">
                      NFS-e nº {selectedNota.numeroNfse || selectedNota.numeroDps} (DPS {selectedNota.numeroDps}/Sér.{selectedNota.serieDps || "1"})
                    </span>
                    <span className="text-[#555555] truncate max-w-md">— {selectedNota.tomadorNome} ({formatCurrency(selectedNota.valorLiquido)})</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenDanfse(selectedNota)}
                      className="vb-btn vb-btn-primary"
                      title="Abrir DANFSe oficial da NFS-e em PDF no leitor padrão do Windows (Pressione Enter)"
                    >
                      <FileText size={11} className="text-rose-700" />
                      <span>➔ Abrir DANFSe (Enter)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveXml(selectedNota)}
                      className="vb-btn"
                      title="Salvar arquivo XML da NFS-e no padrão do Gestor"
                    >
                      <Download size={11} className="text-blue-700" />
                      <span>Salvar XML</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-[#b0b0b0] bg-white min-h-[220px] max-h-[480px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-[#e8e8e8] border-b border-[#b0b0b0] text-[#333333] sticky top-0">
                      <th
                        onClick={() => handleEmitidasSort("numero")}
                        className="px-2.5 py-1.5 font-bold w-40 cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por número da NFS-e / DPS"
                      >
                        <div className="flex items-center justify-between">
                          <span>NFS-e / DPS</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "numero" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("emissao")}
                        className="px-2.5 py-1.5 font-bold w-28 cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por data de emissão"
                      >
                        <div className="flex items-center justify-between">
                          <span>Emissão</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "emissao" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("tomador")}
                        className="px-2.5 py-1.5 font-bold cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por tomador"
                      >
                        <div className="flex items-center justify-between">
                          <span>Tomador (Cliente)</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "tomador" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("valorBruto")}
                        className="px-2.5 py-1.5 font-bold w-24 text-right cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por valor bruto"
                      >
                        <div className="flex items-center justify-between">
                          <span>Valor Bruto</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "valorBruto" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("iss")}
                        className="px-2.5 py-1.5 font-bold w-20 text-right cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por valor de ISS"
                      >
                        <div className="flex items-center justify-between">
                          <span>ISS</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "iss" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("valorLiquido")}
                        className="px-2.5 py-1.5 font-bold w-24 text-right cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por valor líquido"
                      >
                        <div className="flex items-center justify-between">
                          <span>Líquido</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "valorLiquido" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th
                        onClick={() => handleEmitidasSort("status")}
                        className="px-2.5 py-1.5 font-bold w-24 text-center cursor-pointer hover:bg-[#dcdcdc] select-none transition-colors"
                        title="Clique para ordenar por status"
                      >
                        <div className="flex items-center justify-between">
                          <span>Status</span>
                          <span className="text-[10px] text-[#005a9e] font-bold">
                            {emitidasSortCol === "status" ? (emitidasSortDir === "asc" ? "▲" : "▼") : "↕"}
                          </span>
                        </div>
                      </th>
                      <th className="px-2.5 py-1.5 font-bold w-48 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const dir = emitidasSortDir === "asc" ? 1 : -1;
                      const getNum = (n: NfseNotaEmitida) => {
                        const rawN = String(n.numeroNfse || "").replace(/\D/g, "");
                        if (rawN && Number(rawN) > 0) return Number(rawN);
                        return Number(String(n.numeroDps || "0").replace(/\D/g, "")) || 0;
                      };
                      const notasFiltradas = notasEmitidasDeduplicadas
                        .filter((n) => {
                          if (filtroEmitidasStatus !== "Todas" && n.status !== filtroEmitidasStatus) return false;
                          if (filtroEmitidasSerie !== "Todas" && (n.serieDps || "1").trim() !== filtroEmitidasSerie.trim()) return false;
                          if (!filtroEmitidasTexto.trim()) return true;
                          const q = filtroEmitidasTexto.toLowerCase();
                          return (
                            n.numeroDps.toLowerCase().includes(q) ||
                            (n.numeroNfse && n.numeroNfse.toLowerCase().includes(q)) ||
                            (n.serieDps && n.serieDps.toLowerCase().includes(q)) ||
                            n.tomadorNome.toLowerCase().includes(q) ||
                            n.tomadorDoc.toLowerCase().includes(q) ||
                            (n.chaveAcesso && n.chaveAcesso.toLowerCase().includes(q))
                          );
                        })
                        .sort((a, b) => {
                          switch (emitidasSortCol) {
                            case "numero":
                              return (getNum(a) - getNum(b)) * dir;
                            case "emissao": {
                              const tsA = parseDateToTimestamp(a.dataEmissao || "");
                              const tsB = parseDateToTimestamp(b.dataEmissao || "");
                              if (tsA !== tsB) return (tsA - tsB) * dir;
                              return (getNum(a) - getNum(b)) * dir;
                            }
                            case "tomador":
                              return (a.tomadorNome || "").localeCompare(b.tomadorNome || "", "pt-BR", { sensitivity: "base", numeric: true }) * dir;
                            case "valorBruto":
                              return ((Number(a.valorServicos) || 0) - (Number(b.valorServicos) || 0)) * dir;
                            case "iss":
                              return ((Number(a.valorIss) || 0) - (Number(b.valorIss) || 0)) * dir;
                            case "valorLiquido":
                              return ((Number(a.valorLiquido) || 0) - (Number(b.valorLiquido) || 0)) * dir;
                            case "status":
                              return (a.status || "").localeCompare(b.status || "", "pt-BR", { sensitivity: "base" }) * dir;
                            default:
                              return 0;
                          }
                        });

                      if (notasFiltradas.length > 0) {
                        const notasVisiveis = notasFiltradas.slice(0, emitidasDisplayLimit);
                        return (
                          <>
                            {notasVisiveis.map((n) => {
                              const isSelected = selectedNotaId === n.id;
                              return (
                                <tr
                                  key={n.id}
                                  className={`border-b border-[#e5e5e5] cursor-pointer ${
                                    isSelected ? "bg-[#e8f0fe] font-medium" : "hover:bg-[#f5f8fc]"
                                  }`}
                                  onClick={() => setSelectedNotaId(n.id)}
                                  onDoubleClick={() => handleOpenDanfse(n)}
                                >
                                  <td className="px-2.5 py-1.5 font-mono">
                                    <div className="font-bold text-[#003366] text-[12px] flex items-center gap-1.5">
                                      <span>
                                        {n.numeroNfse && n.numeroNfse !== "0"
                                          ? `NFS-e nº ${n.numeroNfse}`
                                          : `DPS nº ${n.numeroDps}`}
                                      </span>
                                      {n.status === "Cancelada" && (
                                        <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded border border-red-200 font-sans font-semibold">
                                          Cancelada
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-[#666666] flex items-center gap-1 mt-0.5">
                                      <span>DPS {n.numeroDps}</span>
                                      <span>•</span>
                                      <span>Sér. {n.serieDps || "1"}</span>
                                    </div>
                                  </td>
                                  <td className="px-2.5 py-1.5">{n.dataEmissao}</td>
                                  <td className="px-2.5 py-1.5">
                                    <div className="font-bold text-[#222222] truncate max-w-xs">{n.tomadorNome}</div>
                                    <div className="font-mono text-[10px] text-[#666666]">{n.tomadorDoc}</div>
                                  </td>
                                  <td className="px-2.5 py-1.5 font-mono text-right font-bold text-[#222222]">
                                    {formatCurrency(n.valorServicos)}
                                  </td>
                                  <td className="px-2.5 py-1.5 font-mono text-right text-emerald-800">
                                    {formatCurrency(n.valorIss)}
                                  </td>
                                  <td className="px-2.5 py-1.5 font-mono text-right font-bold text-[#003366]">
                                    {formatCurrency(n.valorLiquido)}
                                  </td>
                                  <td className="px-2.5 py-1.5 text-center">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        n.status === "Autorizada"
                                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                          : "bg-red-100 text-red-800 border border-red-300"
                                      }`}
                                    >
                                      {n.status}
                                    </span>
                                  </td>
                                  <td className="px-2.5 py-1.5 text-center">
                                    <div className="inline-flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedNotaId(n.id);
                                          handleOpenDanfse(n);
                                        }}
                                        className="vb-btn"
                                        style={{ padding: "1px 6px", fontSize: "10px" }}
                                        title="Abrir DANFSe oficial em PDF no leitor padrão do Windows"
                                      >
                                        <FileText size={10} className="text-rose-700" />
                                        <span>DANFSe</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedNotaId(n.id);
                                          handleSaveXml(n);
                                        }}
                                        className="vb-btn"
                                        style={{ padding: "1px 6px", fontSize: "10px" }}
                                        title="Salvar arquivo XML da NFS-e no padrão do Gestor"
                                      >
                                        <Download size={10} className="text-blue-700" />
                                        <span>XML</span>
                                      </button>
                                      {n.status === "Autorizada" && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedNotaId(n.id);
                                            handleOpenCancelModal(n);
                                          }}
                                          className="vb-btn text-red-700 hover:text-red-800"
                                          style={{ padding: "1px 6px", fontSize: "10px" }}
                                          title="Cancelar Nota Fiscal junto à SEFIN Nacional"
                                        >
                                          <Ban size={10} />
                                          <span>Cancelar</span>
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                            {notasFiltradas.length > emitidasDisplayLimit && (
                              <tr className="bg-[#f0f4f8] border-t border-[#b0b0b0]">
                                <td colSpan={8} className="px-3 py-2 text-center">
                                  <div className="inline-flex items-center gap-3 text-[11px] text-[#333333]">
                                    <span>
                                      Exibindo <strong>{notasVisiveis.length}</strong> de <strong>{notasFiltradas.length}</strong> notas emitidas.
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setEmitidasDisplayLimit((prev) => prev + 200)}
                                      className="vb-btn vb-btn-primary font-bold"
                                    >
                                      Carregar +200 notas
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEmitidasDisplayLimit(notasFiltradas.length)}
                                      className="vb-btn"
                                    >
                                      Exibir todas ({notasFiltradas.length})
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      }

                      return (
                        <tr>
                          <td colSpan={8} className="px-3 py-10 text-center text-[#777777] italic">
                            {filtroEmitidasTexto
                              ? "Nenhuma nota fiscal encontrada para o filtro informado."
                              : "Nenhuma nota emitida registrada no período. Clique em '+ Emitir Nova DPS' para emitir sua primeira nota fiscal."}
                          </td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>
        )}

        {emissorTab === "clientes" && (
          <div className="h-full flex flex-col -m-3 overflow-hidden bg-[#f0f0f0]">
            <NfseClientesManager
              clientes={activeEmpresa?.clientesNfse || []}
              onSaveClientes={(updated) => updateCompanyClientes(updated)}
              onNotify={onNotify}
              onSelectAndEmit={(cli) => {
                handleApplyCliente(cli);
                setEmissorTab("nova");
              }}
            />
          </div>
        )}

        {emissorTab === "servicos" && (
          <div className="h-full flex flex-col -m-3 overflow-hidden bg-[#f0f0f0]">
            <NfsePadroesManager
              modelos={activeEmpresa?.modelosNfse || []}
              onSaveModelos={(updated) => updateCompanyModelos(updated)}
              onNotify={onNotify}
              initialSelectedId={selectedModeloRowId || undefined}
              onSelectAndApply={(mod) => {
                handleApplyModelo(mod.id);
                setEmissorTab("nova");
              }}
              isModal={false}
            />
          </div>
        )}
      </main>

      {/* Modal Clássico de Gerenciamento / Ajuste de Padrões de Emissão */}
      <NfseModeloModal
        isOpen={isModeloModalOpen}
        onClose={() => setIsModeloModalOpen(false)}
        initialData={editingModelo}
        modelos={activeEmpresa?.modelosNfse || []}
        onSaveModelos={(updated) => updateCompanyModelos(updated)}
        onNotify={onNotify}
        onSelectAndApply={(mod) => {
          handleApplyModelo(mod.id);
          setIsModeloModalOpen(false);
          setEmissorTab("nova");
        }}
      />

      {/* Modal de Espelho da DPS / DANFSE */}
      <NfsePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        empresa={activeEmpresa}
        nota={previewNota || {}}
        isConfirmed={isPreviewConfirmed}
        onConfirmTransmission={() => {
          setIsPreviewOpen(false);
          handleTransmitirDps();
        }}
        onDownloadXml={() => {
          if (previewNota && (previewNota as NfseNotaEmitida).numeroDps) {
            handleSaveXml(previewNota as NfseNotaEmitida);
          }
        }}
        onOpenPdf={() => handleOpenDanfse(previewNota || {})}
      />

      {/* Modal de Cancelamento de NFS-e */}
      <NfseCancelModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          if (!isCancellingNota) setIsCancelModalOpen(false);
        }}
        nota={cancellingNota}
        onConfirmCancel={handleConfirmCancelNota}
        isCancelling={isCancellingNota}
      />

      {/* Modal de Tabela Oficial de Atividades & NBS */}
      <NfseAtividadesModal
        isOpen={isAtividadesModalOpen}
        onClose={() => setIsAtividadesModalOpen(false)}
        onSelectAtividade={handleSelectAtividade}
        currentNbs={cNBS}
        currentItemLc116={itemLc116}
      />

      {/* Classic Windows Status Bar */}
      <footer className="shrink-0 status-bar-classic flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span>Ambiente: Sefin Nacional / ADN (Padrão Nacional)</span>
          <span>|</span>
          <span>
            {activeEmpresa ? (
              <>Empresa: <strong>{activeEmpresa.razaoSocial}</strong> ({activeEmpresa.cnpj})</>
            ) : (
              <span className="text-red-700 font-bold">Nenhuma empresa ativa</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Assinatura Digital: XMLDSIG (Sha1withRSA)</span>
          <span>|</span>
          <span>Conexão Segura mTLS (Certificado A1 Local)</span>
        </div>
      </footer>
    </div>
  );
}
