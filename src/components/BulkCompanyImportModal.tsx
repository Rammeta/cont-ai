import React, { useState, useMemo, useRef } from "react";
import {
  UploadCloud,
  FileText,
  ClipboardPaste,
  Download,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Building2,
  Scale,
  X,
  Search,
  Check,
  StopCircle
} from "lucide-react";
import { EmpresaSefaz, ProcuradorConfig, RegimeDestinatario } from "../types";
import { consultarCnpj } from "../utils/electronBridge";

interface BulkCompanyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSefaz[];
  onSaveEmpresas: (updated: EmpresaSefaz[]) => void;
  procuradorConfig: ProcuradorConfig | null;
  onNotify: (text: string, type: "success" | "error") => void;
}

interface ParsedCnpjItem {
  cnpj: string;
  cnpjFormatado: string;
  valido: boolean;
  jaCadastrado: boolean;
  razaoSocialExistente?: string;
}

interface ImportProgressItem {
  cnpj: string;
  cnpjFormatado: string;
  status: "pending" | "querying" | "success" | "skipped" | "warning";
  razaoSocial: string;
  uf: string;
  regime: RegimeDestinatario;
  mensagem?: string;
}

function validarDigitosCnpj(cnpjRaw: string): boolean {
  const digits = cnpjRaw.replace(/\D/g, "");
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma1 = 0;
  for (let i = 0; i < 12; i++) soma1 += parseInt(digits[i], 10) * pesos1[i];
  const r1 = soma1 % 11;
  const d1 = r1 < 2 ? 0 : 11 - r1;
  if (parseInt(digits[12], 10) !== d1) return false;

  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let soma2 = 0;
  for (let i = 0; i < 13; i++) soma2 += parseInt(digits[i], 10) * pesos2[i];
  const r2 = soma2 % 11;
  const d2 = r2 < 2 ? 0 : 11 - r2;
  if (parseInt(digits[13], 10) !== d2) return false;

  return true;
}

function formatarCnpj(cnpj: string): string {
  const c = cnpj.replace(/\D/g, "");
  if (c.length === 14) {
    return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
  }
  return cnpj;
}

export default function BulkCompanyImportModal({
  isOpen,
  onClose,
  empresas,
  onSaveEmpresas,
  procuradorConfig,
  onNotify,
}: BulkCompanyImportModalProps) {
  const [tab, setTab] = useState<"paste" | "file">("paste");
  const [rawText, setRawText] = useState("");
  const [pularExistentes, setPularExistentes] = useState(true);
  const [vincularProcurador, setVincularProcurador] = useState(
    Boolean(procuradorConfig?.ativo)
  );
  const [consultarReceita, setConsultarReceita] = useState(true);
  const [padraoUf, setPadraoUf] = useState("SP");
  const [padraoRegime, setPadraoRegime] = useState<RegimeDestinatario>("simples");

  // Estados de execução
  const [isProcessing, setIsProcessing] = useState(false);
  const [shouldStop, setShouldStop] = useState(false);
  const stopRequestedRef = useRef(false);
  const [progressItems, setProgressItems] = useState<ImportProgressItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // Mapa de CNPJs cadastrados
  const existingCnpjsMap = useMemo(() => {
    const map = new Map<string, string>();
    empresas.forEach((e) => {
      const clean = (e.cnpj || "").replace(/\D/g, "");
      if (clean) map.set(clean, e.razaoSocial || "Empresa Cadastrada");
    });
    return map;
  }, [empresas]);

  // Lista parsed dos CNPJs inseridos
  const parsedItems: ParsedCnpjItem[] = useMemo(() => {
    if (!rawText.trim()) return [];
    
    // Divide por quebra de linha, ponto-e-vírgula ou vírgula
    const lines = rawText.split(/[\r\n;,]+/);
    const seen = new Set<string>();
    const list: ParsedCnpjItem[] = [];

    for (const line of lines) {
      const clean = line.replace(/\D/g, "");
      if (clean.length === 14 && !seen.has(clean)) {
        seen.add(clean);
        const valido = validarDigitosCnpj(clean);
        const jaCadastrado = existingCnpjsMap.has(clean);
        list.push({
          cnpj: clean,
          cnpjFormatado: formatarCnpj(clean),
          valido,
          jaCadastrado,
          razaoSocialExistente: existingCnpjsMap.get(clean),
        });
      }
    }
    return list;
  }, [rawText, existingCnpjsMap]);

  const totalCnpjs = parsedItems.length;
  const cnpjsNovos = parsedItems.filter((i) => !i.jaCadastrado && i.valido);
  const cnpjsExistentes = parsedItems.filter((i) => i.jaCadastrado);
  const cnpjsInvalidos = parsedItems.filter((i) => !i.valido);

  if (!isOpen) return null;

  // Gerador de modelo CSV para download
  const handleDownloadTemplate = () => {
    const csvContent =
      "CNPJ;OBSERVACOES_OPCIONAIS\r\n" +
      "04.109.493/0005-13;ACTA ASSESSORIA CONTABIL LTDA\r\n" +
      "40.378.576/0001-01;LH CONSTRUTORA LTDA\r\n" +
      "12345678000199;CLIENTE EXEMPLO CONTABILIDADE\r\n";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_importacao_cnpjs_cont_ai.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Upload de arquivo CSV / TXT
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = String(e.target?.result || "");
      setRawText((prev) => (prev ? prev + "\n" + content : content));
    };
    reader.readAsText(file, "UTF-8");
  };

  // Execução do Cadastro em Lote
  const handleStartImport = async () => {
    const targets = pularExistentes
      ? parsedItems.filter((item) => !item.jaCadastrado && item.valido)
      : parsedItems.filter((item) => item.valido);

    if (targets.length === 0) {
      alert("Nenhum CNPJ novo válido para cadastrar.");
      return;
    }

    setIsProcessing(true);
    setShouldStop(false);
    stopRequestedRef.current = false;
    setFinished(false);
    setCurrentIndex(0);

    const initialProgress: ImportProgressItem[] = targets.map((t) => ({
      cnpj: t.cnpj,
      cnpjFormatado: t.cnpjFormatado,
      status: "pending",
      razaoSocial: "Aguardando consulta...",
      uf: padraoUf,
      regime: padraoRegime,
    }));
    setProgressItems(initialProgress);

    const newCompanies: EmpresaSefaz[] = [];
    let wasStopped = false;

    for (let i = 0; i < targets.length; i++) {
      if (stopRequestedRef.current) {
        wasStopped = true;
        break;
      }
      setCurrentIndex(i + 1);
      const target = targets[i];

      // Atualiza status para querying
      setProgressItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "querying", razaoSocial: "Consultando Receita Federal..." } : item
        )
      );

      let razaoSocial = `EMPRESA CNPJ ${target.cnpjFormatado}`;
      let uf = padraoUf;
      let regime = padraoRegime;
      let queryStatus: ImportProgressItem["status"] = "success";
      let mensagem = "Cadastrado com dados da Receita Federal";

      if (consultarReceita) {
        try {
          const res = await consultarCnpj(target.cnpj, false);
          if (stopRequestedRef.current) {
            wasStopped = true;
            setProgressItems((prev) =>
              prev.map((item, idx) =>
                idx === i ? { ...item, status: "pending", razaoSocial: "Processamento interrompido" } : item
              )
            );
            break;
          }
          if (res && res.sucesso) {
            razaoSocial = res.razao_social || res.nome_fantasia || razaoSocial;
            if (res.uf && res.uf.length === 2) uf = res.uf.toUpperCase();
            if (res.opcao_simples_raw !== undefined) {
              regime = res.opcao_simples_raw ? "simples" : "normal";
            }
          } else {
            queryStatus = "warning";
            mensagem = res?.erro || "Consulta RFB não retornou dados. Cadastrado com dados padrão.";
          }
        } catch (err: any) {
          if (stopRequestedRef.current) {
            wasStopped = true;
            break;
          }
          queryStatus = "warning";
          mensagem = "Falha temporária na consulta: " + (err.message || "Erro de rede");
        }
      }

      if (stopRequestedRef.current) {
        wasStopped = true;
        break;
      }

      // Cria a nova empresa
      const newCompany: EmpresaSefaz = {
        id: "emp_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        razaoSocial: razaoSocial.trim(),
        cnpj: target.cnpj,
        uf: uf,
        regime: regime,
        ambiente: 1,
        certPath: "",
        password: "",
        certStore: "windows",
        certThumbprint: "",
        inscricaoMunicipal: "",
        usarProcuradorNfse: Boolean(vincularProcurador),
        modelosHabilitados: {
          nfe: true,
          nfce: false,
          cte: true,
          nfse: true,
        },
        modelosNfse: [],
      };

      newCompanies.push(newCompany);

      // Atualiza linha no grid
      setProgressItems((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? {
                ...item,
                status: queryStatus,
                razaoSocial,
                uf,
                regime,
                mensagem,
              }
            : item
        )
      );

      if (stopRequestedRef.current) {
        wasStopped = true;
        break;
      }

      // Pequena pausa para permitir renderização e resposta ágil a interrupções
      await new Promise((r) => setTimeout(r, 60));
    }

    setIsProcessing(false);
    setFinished(true);

    if (newCompanies.length > 0) {
      // Mescla com a lista existente
      const updatedList = [...empresas, ...newCompanies];
      onSaveEmpresas(updatedList);
      if (wasStopped) {
        onNotify(
          `Processamento interrompido. ${newCompanies.length} empresa(s) cadastrada(s) antes da interrupção.`,
          "success"
        );
      } else {
        onNotify(
          `${newCompanies.length} nova(s) empresa(s) cadastrada(s) com sucesso em massa!`,
          "success"
        );
      }
    } else if (wasStopped) {
      onNotify("Processamento interrompido pelo usuário. Nenhuma empresa cadastrada.", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 select-none">
      <style>{`
        .vb-groupbox {
          border: 1px solid #c0c0c0;
          border-radius: 2px;
          position: relative;
          margin-top: 8px;
        }
        .vb-legend {
          font-size: 11px;
          font-weight: bold;
          color: #003366;
          padding: 0 6px;
          margin-left: 8px;
        }
        .vb-btn {
          background: linear-gradient(180deg, #ffffff 0%, #f4f4f4 50%, #e6e6e6 100%);
          border: 1px solid #7a7a7a;
          border-radius: 2px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif;
          color: #000000;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.06);
          white-space: nowrap;
          transition: all 0.08s ease-in-out;
          user-select: none;
        }
        .vb-btn:hover {
          background: linear-gradient(180deg, #fbfdff 0%, #e8f1fc 50%, #d8e6f8 100%);
          border-color: #005a9e;
          color: #003366;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,90,158,0.18);
        }
        .vb-btn:active {
          background: #d4d4d4 !important;
          border-color: #444444 !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.25) !important;
          transform: translateY(1px) scale(0.98);
        }
        .vb-btn-primary {
          background: linear-gradient(180deg, #0066b3 0%, #004578 100%);
          border: 1px solid #002e50;
          font-weight: bold;
          color: #ffffff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(0,0,0,0.2);
        }
        .vb-btn-primary:hover {
          background: linear-gradient(180deg, #0078d4 0%, #005a9e 100%);
          border-color: #001f38;
          color: #ffffff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 4px rgba(0,90,158,0.25);
        }
        .vb-btn-primary:active {
          background: #003862 !important;
          border-color: #00182b !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4) !important;
          transform: translateY(1px) scale(0.98);
        }
      `}</style>

      <div className="w-full max-w-4xl bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl flex flex-col max-h-[92vh] text-[#000000] font-sans text-[11px]">
        {/* Titlebar Classic WinForms */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <UploadCloud size={15} className="text-amber-300" />
            <span>Assistente de Cadastro de Empresas em Massa (CNPJ / Planilha CSV)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="hover:bg-rose-600 px-2 py-0.5 rounded-xs transition text-white font-bold disabled:opacity-50"
            title="Fechar Janela"
          >
            ✕
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-[#e6f2ff] border-b border-[#b8d4f6] px-3 py-2 flex items-start justify-between gap-2 shrink-0 text-[#003366]">
          <div className="flex items-start gap-2">
            <Building2 size={16} className="text-[#005a9e] mt-0.5 shrink-0" />
            <div className="leading-tight">
              <strong className="block text-[11.5px]">Cadastro Rápido de Múltiplos Contribuintes</strong>
              <span className="text-[10.5px] text-[#335577]">
                Cole sua lista de CNPJs ou carregue um arquivo CSV. O sistema consultará a Razão Social, UF e Regime na Receita Federal e vinculará em massa à Procuração Eletrônica do Procurador.
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="vb-btn active:scale-95 active:translate-y-0.5 text-[10.5px] py-1 px-2.5 font-bold text-[#003366] shrink-0"
            title="Baixar planilha de exemplo com cabeçalho CNPJ"
          >
            <Download size={12} className="text-[#005a9e]" />
            <span>Baixar Modelo CSV</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!isProcessing && !finished ? (
            <>
              {/* Abas de Entrada */}
              <div className="flex items-center gap-2 border-b border-[#c0c0c0] pb-1">
                <button
                  type="button"
                  onClick={() => setTab("paste")}
                  className={`vb-btn py-1 px-3 font-semibold ${
                    tab === "paste" ? "bg-[#dbeafe] border-[#005a9e] text-[#003366] font-bold" : ""
                  }`}
                >
                  <ClipboardPaste size={13} />
                  <span>Colar Lista de CNPJs</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab("file")}
                  className={`vb-btn py-1 px-3 font-semibold ${
                    tab === "file" ? "bg-[#dbeafe] border-[#005a9e] text-[#003366] font-bold" : ""
                  }`}
                >
                  <FileText size={13} />
                  <span>Carregar Arquivo (.CSV / .TXT)</span>
                </button>
              </div>

              {/* Área de Entrada */}
              {tab === "paste" ? (
                <div>
                  <label className="block text-[10.5px] font-bold text-[#333333] mb-1">
                    Cole os CNPJs abaixo (um por linha, com ou sem pontuação):
                  </label>
                  <textarea
                    rows={7}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Exemplo:&#10;04.109.493/0005-13&#10;40378576000101&#10;12.345.678/0001-99"
                    className="w-full p-2 text-[11px] font-mono border border-[#a0a0a0] rounded-xs bg-white focus:border-[#005a9e] focus:outline-none"
                  />
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      handleFileUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  className="p-6 border-2 border-dashed border-[#005a9e] bg-[#f8fbff] text-center rounded-xs cursor-pointer hover:bg-[#eef5fc] transition"
                  onClick={() => {
                    const inp = document.createElement("input");
                    inp.type = "file";
                    inp.accept = ".csv,.txt,.tsv";
                    inp.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) handleFileUpload(file);
                    };
                    inp.click();
                  }}
                >
                  <UploadCloud size={32} className="mx-auto text-[#005a9e] mb-2" />
                  <div className="font-bold text-[12px] text-[#003366]">
                    Clique para selecionar um arquivo CSV ou arraste-o aqui
                  </div>
                  <div className="text-[10px] text-[#666666] mt-1">
                    Formatos suportados: .CSV (separado por vírgula ou ponto-e-vírgula) e .TXT
                  </div>
                </div>
              )}

              {/* Sumário de Contagem e Validação */}
              {totalCnpjs > 0 && (
                <div className="p-2 bg-[#f4f4f4] border border-[#d0d0d0] flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
                  <div className="flex items-center gap-3">
                    <span>
                      Total Identificado: <strong>{totalCnpjs}</strong>
                    </span>
                    <span className="text-emerald-800">
                      Novos para Cadastrar: <strong>{cnpjsNovos.length}</strong>
                    </span>
                    {cnpjsExistentes.length > 0 && (
                      <span className="text-[#666666]">
                        Já Cadastrados: <strong>{cnpjsExistentes.length}</strong>
                      </span>
                    )}
                    {cnpjsInvalidos.length > 0 && (
                      <span className="text-amber-800">
                        Dígito Inválido: <strong>{cnpjsInvalidos.length}</strong>
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRawText("")}
                    className="text-[10px] text-rose-700 hover:underline"
                  >
                    Limpar Lista
                  </button>
                </div>
              )}

              {/* Opções de Configuração em Lote */}
              <fieldset className="vb-groupbox bg-white p-2.5">
                <legend className="vb-legend">Configurações para as Empresas Importadas</legend>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[#003366]">
                    <input
                      type="checkbox"
                      checked={vincularProcurador}
                      onChange={(e) => setVincularProcurador(e.target.checked)}
                      className="accent-[#003366]"
                    />
                    <Scale size={13} className="text-[#005a9e]" />
                    <span>
                      Vincular automaticamente ao Certificado do Procurador / Contador para NFS-e (Portal Nacional ADN)
                    </span>
                  </label>
                  {vincularProcurador && (
                    <div className="text-[10px] text-[#446688] ml-6 leading-tight">
                      {procuradorConfig?.ativo ? (
                        <span>
                          ✓ Procurador ativo: <strong>{procuradorConfig.nome}</strong>. Todas as empresas cadastradas poderão ter suas notas de serviços tomados e prestados capturadas no ADN sem necessidade de certificado individual.
                        </span>
                      ) : (
                        <span className="text-amber-800">
                          ⚠️ O Procurador ainda não está configurado na tela inicial. As empresas serão marcadas com o vínculo e passarão a operar assim que você cadastrar o certificado do procurador.
                        </span>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-[#f0f0f0]">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pularExistentes}
                        onChange={(e) => setPularExistentes(e.target.checked)}
                        className="accent-[#003366]"
                      />
                      <span>Pular CNPJs que já estiverem cadastrados no sistema</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consultarReceita}
                        onChange={(e) => setConsultarReceita(e.target.checked)}
                        className="accent-[#003366]"
                      />
                      <span>Consultar Razão Social e Regime na Receita Federal / BrasilAPI</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-[#555555]">UF padrão (se não encontrada):</label>
                      <select
                        value={padraoUf}
                        onChange={(e) => setPadraoUf(e.target.value)}
                        className="w-full p-1 border border-[#a0a0a0] rounded-xs text-[11px] bg-white"
                      >
                        {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-[#555555]">Regime padrão de fallback:</label>
                      <select
                        value={padraoRegime}
                        onChange={(e) => setPadraoRegime(e.target.value as RegimeDestinatario)}
                        className="w-full p-1 border border-[#a0a0a0] rounded-xs text-[11px] bg-white"
                      >
                        <option value="simples">Simples Nacional</option>
                        <option value="normal">Regime Normal (Lucro Presumido / Real)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </fieldset>
            </>
          ) : (
            /* Painel de Progresso / Conclusão */
            <div className="space-y-3">
              {/* Barra de Progresso */}
              <div className="bg-white border border-[#c0c0c0] p-3 rounded-xs shadow-2xs">
                <div className="flex items-center justify-between text-[11px] mb-1.5">
                  <span className="font-bold text-[#003366]">
                    {isProcessing ? "Consultando e Cadastrando Empresas..." : "Processamento Concluído!"}
                  </span>
                  <span className="font-mono text-[#555555]">
                    {currentIndex} de {progressItems.length} (
                    {progressItems.length > 0 ? Math.round((currentIndex / progressItems.length) * 100) : 0}%)
                  </span>
                </div>

                <div className="w-full bg-[#e0e0e0] h-3 rounded-xs overflow-hidden border border-[#b0b0b0]">
                  <div
                    className="bg-gradient-to-r from-[#005a9e] to-[#107c41] h-full transition-all duration-200"
                    style={{
                      width: `${progressItems.length > 0 ? (currentIndex / progressItems.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              {/* Tabela de Resultados em Tempo Real */}
              <div className="border border-[#b0b0b0] bg-white max-h-80 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[10.5px]">
                  <thead className="bg-[#e8e8e8] border-b border-[#c0c0c0] text-[#333333] sticky top-0">
                    <tr>
                      <th className="p-1.5 w-8 text-center">#</th>
                      <th className="p-1.5 w-32">CNPJ</th>
                      <th className="p-1.5">Razão Social Identificada</th>
                      <th className="p-1.5 w-12 text-center">UF</th>
                      <th className="p-1.5 w-24">Regime</th>
                      <th className="p-1.5 w-32">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressItems.map((item, idx) => {
                      let statusBadge = (
                        <span className="text-[#777777] italic">Pendente</span>
                      );
                      if (item.status === "querying") {
                        statusBadge = (
                          <span className="text-[#005a9e] font-bold flex items-center gap-1">
                            <RotateCw size={11} className="animate-spin" />
                            <span>Consultando...</span>
                          </span>
                        );
                      } else if (item.status === "success") {
                        statusBadge = (
                          <span className="text-emerald-700 font-bold flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            <span>Cadastrado</span>
                          </span>
                        );
                      } else if (item.status === "warning") {
                        statusBadge = (
                          <span className="text-amber-800 font-bold flex items-center gap-1" title={item.mensagem}>
                            <AlertTriangle size={12} className="text-amber-600" />
                            <span>Aviso RFB</span>
                          </span>
                        );
                      } else if (item.status === "skipped") {
                        statusBadge = (
                          <span className="text-[#888888]">Já Cadastrado</span>
                        );
                      }

                      return (
                        <tr
                          key={item.cnpj}
                          className={`border-b border-[#f0f0f0] ${
                            item.status === "querying" ? "bg-[#eef5fc]" : ""
                          }`}
                        >
                          <td className="p-1.5 text-center text-[#888888]">{idx + 1}</td>
                          <td className="p-1.5 font-mono">{item.cnpjFormatado}</td>
                          <td className="p-1.5 font-semibold text-[#003366] max-w-[240px] truncate" title={item.razaoSocial}>
                            {item.razaoSocial}
                          </td>
                          <td className="p-1.5 text-center">{item.uf}</td>
                          <td className="p-1.5 capitalize">{item.regime}</td>
                          <td className="p-1.5">{statusBadge}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {finished && !shouldStop && (
                <div className="p-2.5 bg-[#eaf7ea] border border-[#7bc97b] text-emerald-950 text-[11px] flex items-center gap-2 rounded-xs">
                  <CheckCircle2 size={16} className="text-emerald-700 shrink-0" />
                  <div>
                    <strong>Importação concluída com sucesso!</strong> As empresas cadastradas já estão salvas no sistema e prontas para sincronização de notas fiscais.
                  </div>
                </div>
              )}

              {finished && shouldStop && (
                <div className="p-2.5 bg-[#fff8e6] border border-[#f5c26b] text-amber-950 text-[11px] flex items-center gap-2 rounded-xs">
                  <AlertTriangle size={16} className="text-amber-700 shrink-0" />
                  <div>
                    <strong>Processamento interrompido pelo usuário.</strong> As empresas cadastradas até o momento da interrupção foram salvas no sistema.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-[#e0e0e0] border-t border-[#b0b0b0] px-4 py-2.5 flex items-center justify-between shrink-0">
          <div>
            {isProcessing && (
              <button
                type="button"
                onClick={() => {
                  stopRequestedRef.current = true;
                  setShouldStop(true);
                }}
                disabled={shouldStop}
                className="vb-btn text-rose-700 hover:text-rose-800 font-bold flex items-center gap-1.5 active:scale-95 disabled:opacity-60 cursor-pointer"
              >
                <StopCircle size={14} className="text-rose-600 animate-pulse" />
                <span>{shouldStop ? "Interrompendo processamento..." : "Interromper Processamento"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isProcessing && !finished ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="vb-btn active:scale-95 active:translate-y-0.5 py-1.5 px-4 font-semibold text-[#333333]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleStartImport}
                  disabled={cnpjsNovos.length === 0}
                  className="vb-btn vb-btn-primary active:scale-95 active:translate-y-0.5 py-1.5 px-5 font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play size={13} className="fill-white" />
                  <span>
                    Iniciar Cadastro em Massa ({pularExistentes ? cnpjsNovos.length : totalCnpjs} empresas)
                  </span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                disabled={isProcessing}
                className="vb-btn vb-btn-primary active:scale-95 active:translate-y-0.5 py-1.5 px-6 font-bold flex items-center gap-1.5"
              >
                <Check size={14} />
                <span>Concluir e Fechar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
