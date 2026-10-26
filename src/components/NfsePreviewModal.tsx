import React from "react";
import { Printer, Download, Send, CheckCircle2, ShieldCheck, X, FileText, Building2, Users, ExternalLink, Copy } from "lucide-react";
import { EmpresaSefaz, NfseNotaEmitida } from "../types";

interface NfsePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresa: EmpresaSefaz | null;
  nota: Partial<NfseNotaEmitida>;
  isConfirmed?: boolean;
  onConfirmTransmission?: () => void;
  onDownloadXml?: () => void;
  onOpenPdf?: () => void;
}

export default function NfsePreviewModal({
  isOpen,
  onClose,
  empresa,
  nota,
  isConfirmed = false,
  onConfirmTransmission,
  onDownloadXml,
  onOpenPdf,
}: NfsePreviewModalProps) {
  if (!isOpen) return null;

  const numVal = nota.valorServicos || 0;
  const numIss = nota.valorIss || 0;
  const numLiq = nota.valorLiquido !== undefined ? nota.valorLiquido : (numVal - (nota.totalRetencoes || 0));

  const formatBrl = (v: number) => {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const handlePrint = () => {
    window.print();
  };

  // Formata chave de acesso em blocos de 4 dígitos (padrão nacional de 50 caracteres)
  const formatChave = (ch?: string) => {
    if (!ch) return "3526 0100 0000 0000 0000 0000 0000 0000 0000 0000 0001";
    const clean = ch.replace(/\s+/g, "");
    return clean.match(/.{1,4}/g)?.join(" ") || clean;
  };

  const handleCopyChave = () => {
    if (nota.chaveAcesso) {
      navigator.clipboard.writeText(nota.chaveAcesso.replace(/\s+/g, ""));
    }
  };

  const rawChave = nota.chaveAcesso || "";
  const numNfseDisplay = nota.numeroNfse || nota.numeroDps || "000001";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 font-sans text-[11px]">
      <div className="w-full max-w-4xl bg-white border-2 border-[#003366] shadow-2xl flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        
        {/* Titlebar Windows Clássico */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0 print:hidden select-none">
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-sky-300" />
            <span>
              {isConfirmed
                ? `DANFSE Oficial - Documento Auxiliar da NFS-e nº ${numNfseDisplay}`
                : "Espelho da DPS / DANFSE - Padrão Nacional (Nota Técnica nº 008)"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenPdf && (
              <button
                type="button"
                onClick={onOpenPdf}
                className="text-white hover:text-emerald-300 flex items-center gap-1 font-normal text-[11px] px-2 py-0.5 rounded hover:bg-white/10"
                title="Abrir DANFSE Oficial em PDF no leitor padrão do Windows"
              >
                <FileText size={12} />
                <span>Abrir PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="text-white hover:text-emerald-300 flex items-center gap-1 font-normal text-[11px] px-2 py-0.5 rounded hover:bg-white/10"
              title="Imprimir DANFSE"
            >
              <Printer size={12} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-white hover:text-red-300 font-bold px-1.5 cursor-pointer text-[13px]"
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="bg-[#f0f6ff] border-b border-[#b8d4f6] px-3 py-1.5 flex items-center justify-between shrink-0 print:hidden select-none">
          <div className="flex items-center gap-1.5 text-[#003366] font-semibold">
            {isConfirmed ? (
              <>
                <CheckCircle2 size={13} className="text-emerald-600" />
                <span className="text-emerald-800 font-bold">NFS-e Emitida no Sistema Nacional NFS-e</span>
                <span className="text-[#555555] font-normal text-[10px] ml-2 font-mono">
                  DPS nº {nota.numeroDps || "1"} (Série {nota.serieDps || "1"}) • NFS-e nº {numNfseDisplay}
                </span>
              </>
            ) : (
              <>
                <ShieldCheck size={13} className="text-[#005a9e]" />
                <span>Pré-visualização do DANFSE antes do envio à SEFIN Nacional</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenPdf && (
              <button
                type="button"
                onClick={onOpenPdf}
                className="vb-btn bg-white hover:bg-blue-50 text-[#003366] border-[#005a9e] flex items-center gap-1 font-bold"
                title="Gerar e abrir o DANFSE oficial em PDF vetorial"
              >
                <FileText size={11} className="text-red-600" />
                <span>Abrir DANFSE em PDF</span>
              </button>
            )}

            {isConfirmed && onDownloadXml && (
              <button
                type="button"
                onClick={onDownloadXml}
                className="vb-btn"
                title="Download do arquivo XML da DPS/NFS-e"
              >
                <Download size={11} className="text-[#005a9e]" />
                <span>Baixar XML</span>
              </button>
            )}

            {!isConfirmed && onConfirmTransmission && (
              <button
                type="button"
                onClick={onConfirmTransmission}
                className="vb-btn bg-emerald-700 hover:bg-emerald-800 text-white font-bold border-emerald-900 flex items-center gap-1 px-3 py-1"
              >
                <Send size={11} className="text-white" />
                <span>Confirmar e Transmitir NFS-e Agora</span>
              </button>
            )}
          </div>
        </div>

        {/* Document Body: DANFSE Padrão Nacional Oficial (NT 008) */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#e9ecef] print:p-0 print:bg-white select-text">
          <div className="max-w-[210mm] mx-auto bg-white border border-black shadow-lg print:shadow-none print:border-none p-4 text-[9.5px] leading-tight text-black font-sans">
            
            {/* 1. CABEÇALHO OFICIAL DANFSE (NT 008) */}
            <div className="border border-black mb-1">
              <div className="grid grid-cols-12 divide-x divide-black">
                {/* Brasão / Identificação do Sistema Nacional */}
                <div className="col-span-3 p-2 flex flex-col items-center justify-center text-center bg-[#fafafa]">
                  <div className="w-10 h-10 border border-slate-400 rounded-full flex items-center justify-center bg-emerald-800 text-white font-bold text-[8px] mb-1">
                    BR
                  </div>
                  <strong className="text-[9px] uppercase tracking-wider text-[#002244] leading-tight">
                    REPÚBLICA FEDERATIVA<br />DO BRASIL
                  </strong>
                  <span className="text-[7.5px] text-[#555555] font-semibold mt-0.5">
                    SISTEMA NACIONAL NFS-e
                  </span>
                </div>

                {/* Título Central DANFSE */}
                <div className="col-span-5 p-2 flex flex-col items-center justify-center text-center">
                  <h1 className="text-[14px] font-black tracking-wide text-black uppercase mb-0.5">
                    DANFSE
                  </h1>
                  <h2 className="text-[9px] font-bold text-[#222222] uppercase leading-tight">
                    Documento Auxiliar da Nota Fiscal<br />de Serviço Eletrônica
                  </h2>
                  <span className="text-[7.5px] text-[#666666] mt-1">
                    Padrão Nacional • Convênio NFS-e • NT 008
                  </span>
                </div>

                {/* Bloco de Controle e Numeração */}
                <div className="col-span-4 p-1.5 flex flex-col justify-between bg-[#fafafa] divide-y divide-[#cccccc]">
                  <div className="pb-1">
                    <span className="text-[8px] text-[#666666] uppercase block font-semibold">Número da NFS-e:</span>
                    <strong className="text-[13px] font-mono text-[#002244] block font-black">
                      {numNfseDisplay}
                    </strong>
                  </div>
                  <div className="py-0.5 grid grid-cols-2 gap-1 text-[8px]">
                    <div>
                      <span className="text-[#666666] block">Data e Hora de Emissão:</span>
                      <strong className="font-mono">{nota.dataEmissao || new Date().toLocaleString("pt-BR")}</strong>
                    </div>
                    <div>
                      <span className="text-[#666666] block">Competência:</span>
                      <strong className="font-mono">{nota.competencia || new Date().toLocaleDateString("pt-BR", { month: "2-digit", year: "numeric" })}</strong>
                    </div>
                  </div>
                  <div className="pt-0.5 grid grid-cols-2 gap-1 text-[8px]">
                    <div>
                      <span className="text-[#666666] block">Cód. Verificação:</span>
                      <strong className="font-mono uppercase text-[#005a9e]">
                        {nota.codigoVerificacao || "ABCD-1234"}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[#666666] block">Número da DPS:</span>
                      <strong className="font-mono">
                        {nota.numeroDps || "1"} / Série {nota.serieDps || "1"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CHAVE DE ACESSO DA NFS-E (50 DÍGITOS) */}
            <div className="border border-black mb-1 p-1.5 bg-[#fbfbfb]">
              <div className="flex items-center justify-between text-[8px] font-bold text-[#555555] uppercase mb-0.5">
                <span>CHAVE DE ACESSO DA NFS-e</span>
                {rawChave && (
                  <button
                    type="button"
                    onClick={handleCopyChave}
                    className="text-[#005a9e] hover:underline flex items-center gap-1 font-semibold text-[8px] print:hidden cursor-pointer"
                  >
                    <Copy size={9} />
                    <span>Copiar Chave</span>
                  </button>
                )}
              </div>
              <div className="font-mono text-[11px] font-black tracking-wider text-center text-[#002244] py-0.5 bg-white border border-[#cccccc]">
                {formatChave(rawChave)}
              </div>
              <div className="text-[7.5px] text-[#666666] text-center mt-0.5">
                Consulte a autenticidade deste documento acessando o Portal Nacional: <strong className="text-black">www.nfse.gov.br/consultapublica</strong>
              </div>
            </div>

            {/* 3. QUADRO EMITENTE DA NFS-E (PRESTADOR DE SERVIÇOS) */}
            <div className="border border-black mb-1">
              <div className="bg-[#e9e9e9] border-b border-black px-2 py-0.5 font-bold uppercase text-[8.5px] text-black">
                EMITENTE DA NFS-e (PRESTADOR DOS SERVIÇOS)
              </div>
              <div className="p-1.5 grid grid-cols-12 gap-x-2 gap-y-1 text-[8.5px]">
                <div className="col-span-8">
                  <span className="text-[#666666] block text-[7.5px]">Razão Social / Nome:</span>
                  <strong className="text-[10px] uppercase text-[#002244] block">
                    {empresa?.razaoSocial || "-"}
                  </strong>
                </div>
                <div className="col-span-4">
                  <span className="text-[#666666] block text-[7.5px]">CNPJ / CPF:</span>
                  <strong className="font-mono text-[10px] block">
                    {empresa?.cnpj || "-"}
                  </strong>
                </div>

                <div className="col-span-4">
                  <span className="text-[#666666] block text-[7.5px]">Inscrição Municipal:</span>
                  <strong className="font-mono">
                    {empresa?.inscricaoMunicipal || empresa?.emissaoConfig?.inscricaoMunicipal || "-"}
                  </strong>
                </div>
                <div className="col-span-5">
                  <span className="text-[#666666] block text-[7.5px]">Município de Incidência / UF:</span>
                  <strong className="uppercase">
                    {empresa?.emissaoConfig?.cLocEmi || "São Paulo - SP"}
                  </strong>
                </div>
                <div className="col-span-3">
                  <span className="text-[#666666] block text-[7.5px]">Regime de Tributação:</span>
                  <strong>
                    {empresa?.emissaoConfig?.opSimpNac === "3"
                      ? "Simples Nacional (ME/EPP)"
                      : empresa?.emissaoConfig?.opSimpNac === "2"
                      ? "Simples Nacional (MEI)"
                      : "Regime Normal"}
                  </strong>
                </div>
              </div>
            </div>

            {/* 4. QUADRO TOMADOR DO SERVIÇO (CLIENTE) */}
            <div className="border border-black mb-1">
              <div className="bg-[#e9e9e9] border-b border-black px-2 py-0.5 font-bold uppercase text-[8.5px] text-black">
                TOMADOR DO SERVIÇO
              </div>
              <div className="p-1.5 grid grid-cols-12 gap-x-2 gap-y-1 text-[8.5px]">
                <div className="col-span-8">
                  <span className="text-[#666666] block text-[7.5px]">Nome / Razão Social:</span>
                  <strong className="text-[10px] uppercase text-[#002244] block">
                    {nota.tomadorNome || "-"}
                  </strong>
                </div>
                <div className="col-span-4">
                  <span className="text-[#666666] block text-[7.5px]">CNPJ / CPF:</span>
                  <strong className="font-mono text-[10px] block">
                    {nota.tomadorDoc || "-"}
                  </strong>
                </div>

                <div className="col-span-4">
                  <span className="text-[#666666] block text-[7.5px]">Inscrição Municipal:</span>
                  <span className="font-mono">{nota.tomadorIm || "-"}</span>
                </div>
                <div className="col-span-5">
                  <span className="text-[#666666] block text-[7.5px]">Município / UF:</span>
                  <strong className="uppercase">{nota.tomadorMunicipio || "-"}</strong>
                </div>
                <div className="col-span-3">
                  <span className="text-[#666666] block text-[7.5px]">E-mail:</span>
                  <span className="truncate block">{nota.tomadorEmail || "-"}</span>
                </div>
              </div>
            </div>

            {/* 5. QUADRO DISCRIMINAÇÃO DOS SERVIÇOS */}
            <div className="border border-black mb-1">
              <div className="bg-[#e9e9e9] border-b border-black px-2 py-0.5 font-bold uppercase text-[8.5px] text-black">
                DISCRIMINAÇÃO DOS SERVIÇOS PRESTADOS
              </div>
              <div className="p-2 whitespace-pre-wrap font-mono text-[9px] leading-relaxed min-h-[65px] bg-[#ffffff]">
                {nota.discriminacao || "(Serviço não informado)"}
              </div>
              <div className="border-t border-black bg-[#fafafa] px-2 py-1 grid grid-cols-4 gap-2 text-[8px]">
                <div>
                  <span className="text-[#666666] block">Cód. Tributação Nacional (cTribNac):</span>
                  <strong className="font-mono text-[#003366]">{nota.cTribNac || "170101"}</strong>
                </div>
                <div>
                  <span className="text-[#666666] block">Item LC 116 / Cód. Municipal:</span>
                  <strong className="font-mono">{nota.cTribMun || "-"}</strong>
                </div>
                <div>
                  <span className="text-[#666666] block">Nomenclatura Bras. Serviços (NBS):</span>
                  <strong className="font-mono">{nota.cNBS || "-"}</strong>
                </div>
                <div>
                  <span className="text-[#666666] block">Local da Prestação:</span>
                  <strong>{nota.cLocPrestacao || "No endereço do prestador"}</strong>
                </div>
              </div>
            </div>

            {/* 6. QUADRO TRIBUTAÇÃO MUNICIPAL (ISSQN) - GRADE OFICIAL NT 008 */}
            <div className="border border-black mb-1">
              <div className="bg-[#e9e9e9] border-b border-black px-2 py-0.5 font-bold uppercase text-[8.5px] text-black">
                TRIBUTAÇÃO MUNICIPAL DO ISSQN
              </div>
              <table className="w-full text-center border-collapse text-[8.5px]">
                <thead>
                  <tr className="bg-[#f4f4f4] border-b border-black text-[#444444] font-bold text-[7.5px] uppercase">
                    <th className="p-1 border-r border-[#cccccc]">Valor do Serviço</th>
                    <th className="p-1 border-r border-[#cccccc]">Desconto Incond.</th>
                    <th className="p-1 border-r border-[#cccccc]">Deduções / Base</th>
                    <th className="p-1 border-r border-[#cccccc]">Base de Cálculo</th>
                    <th className="p-1 border-r border-[#cccccc]">Alíquota (%)</th>
                    <th className="p-1 border-r border-[#cccccc]">Valor do ISSQN</th>
                    <th className="p-1">ISSQN Retido?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono font-semibold">
                    <td className="p-1 border-r border-[#cccccc] text-[#002244] font-bold">{formatBrl(numVal)}</td>
                    <td className="p-1 border-r border-[#cccccc]">R$ 0,00</td>
                    <td className="p-1 border-r border-[#cccccc]">R$ 0,00</td>
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(numVal)}</td>
                    <td className="p-1 border-r border-[#cccccc]">{nota.aliquotaIss ? `${nota.aliquotaIss}%` : "5,00%"}</td>
                    <td className="p-1 border-r border-[#cccccc] text-emerald-800 font-bold">{formatBrl(numIss)}</td>
                    <td className="p-1 font-sans">
                      {nota.issRetido ? (
                        <span className="text-red-700 font-bold">SIM (Retido)</span>
                      ) : (
                        <span className="text-slate-700">NÃO</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 7. QUADRO RETENÇÕES FEDERAIS - GRADE OFICIAL NT 008 */}
            <div className="border border-black mb-1">
              <div className="bg-[#e9e9e9] border-b border-black px-2 py-0.5 font-bold uppercase text-[8.5px] text-black">
                RETENÇÕES DE TRIBUTOS FEDERAIS
              </div>
              <table className="w-full text-center border-collapse text-[8.5px]">
                <thead>
                  <tr className="bg-[#f4f4f4] border-b border-black text-[#444444] font-bold text-[7.5px] uppercase">
                    <th className="p-1 border-r border-[#cccccc]">PIS</th>
                    <th className="p-1 border-r border-[#cccccc]">COFINS</th>
                    <th className="p-1 border-r border-[#cccccc]">INSS / CP</th>
                    <th className="p-1 border-r border-[#cccccc]">IRRF</th>
                    <th className="p-1 border-r border-[#cccccc]">CSLL</th>
                    <th className="p-1">Outras Retenções</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="font-mono font-semibold">
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(nota.pis || 0)}</td>
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(nota.cofins || 0)}</td>
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(nota.inss || 0)}</td>
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(nota.irrf || 0)}</td>
                    <td className="p-1 border-r border-[#cccccc]">{formatBrl(nota.csll || 0)}</td>
                    <td className="p-1">R$ 0,00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 8. QUADRO RESUMO E VALOR LÍQUIDO DA NFS-E */}
            <div className="border-2 border-[#003366] bg-[#f0f6ff] p-2 mb-1 flex items-center justify-between">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[8px] text-[#555555] uppercase block font-semibold">Valor Total dos Serviços:</span>
                  <strong className="text-[11px] font-mono text-[#002244]">{formatBrl(numVal)}</strong>
                </div>
                <div>
                  <span className="text-[8px] text-[#555555] uppercase block font-semibold">Total de Deduções / Retenções:</span>
                  <strong className="text-[11px] font-mono text-amber-900">- {formatBrl(nota.totalRetencoes || 0)}</strong>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-white px-3 py-1.5 border border-[#003366] shadow-sm">
                <div className="text-right">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-[#002244] block">
                    VALOR LÍQUIDO DA NFS-e
                  </span>
                  <span className="text-[7px] text-[#666666]">Valor a receber pelo prestador</span>
                </div>
                <strong className="text-[15px] font-mono font-black text-[#003366]">
                  {formatBrl(numLiq)}
                </strong>
              </div>
            </div>

            {/* 9. INFORMAÇÕES COMPLEMENTARES */}
            <div className="border border-black p-1.5 bg-[#fafafa] text-[7.5px] text-[#444444] leading-normal">
              <strong className="text-black uppercase block mb-0.5">Informações Complementares:</strong>
              <p>
                {nota.temIbsCbs ? (
                  <span>
                    Operação enquadrada no Sistema Tributário Nacional (EC 132/2023 - NT 004). cIndOp: {nota.cIndOp || "010101"} • cClassTrib: {nota.cClassTrib || "000001"}.{" "}
                  </span>
                ) : (
                  <span>Operação sem incidência direta transitória de IBS/CBS. </span>
                )}
                Documento emitido por empresa optante pelo Simples Nacional ou Regime Normal com conformidade tributária pela SEFIN Nacional.
                Tributos aproximados conforme Lei Federal nº 12.741/2012.
              </p>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#e8e8e8] border-t border-[#b0b0b0] px-3 py-2 flex items-center justify-between shrink-0 print:hidden select-none">
          <div className="text-[10px] text-[#666666] flex items-center gap-1.5">
            {isConfirmed ? (
              <span className="text-emerald-800 font-bold">✔ Documento assinado digitalmente com certificado ICP-Brasil e transmitido</span>
            ) : (
              <span>* Esta é a visualização oficial prévia. Clique em "Confirmar e Transmitir" para assinar com Certificado Digital A1.</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onOpenPdf && (
              <button
                type="button"
                onClick={onOpenPdf}
                className="vb-btn font-semibold flex items-center gap-1 text-[#003366]"
                title="Abrir DANFSE em PDF"
              >
                <FileText size={11} className="text-red-600" />
                <span>Abrir PDF</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="vb-btn font-semibold flex items-center gap-1"
            >
              <Printer size={11} />
              <span>Imprimir</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="vb-btn px-4 font-bold"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}