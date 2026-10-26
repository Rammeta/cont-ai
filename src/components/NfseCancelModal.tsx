import React, { useState, useEffect } from "react";
import { AlertTriangle, X, Ban, AlertCircle } from "lucide-react";
import { NfseNotaEmitida } from "../types";

interface NfseCancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  nota: NfseNotaEmitida | null;
  onConfirmCancel: (notaId: string, motivo: string, cMotivo: string) => void;
  isCancelling?: boolean;
}

const MOTIVOS_CANCELAMENTO = [
  "1 - Erro na emissão dos dados cadastrais ou valores",
  "2 - Serviço não prestado / Pedido cancelado",
  "3 - Duplicidade de emissão da nota fiscal",
  "4 - Outros motivos acordados entre tomador e prestador",
];

export default function NfseCancelModal({
  isOpen,
  onClose,
  nota,
  onConfirmCancel,
  isCancelling = false,
}: NfseCancelModalProps) {
  const [codigoMotivo, setCodigoMotivo] = useState(MOTIVOS_CANCELAMENTO[0]);
  const [justificativa, setJustificativa] = useState("");
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);

  // Reseta os campos ao abrir o modal para evitar travamentos ou valores residuais
  useEffect(() => {
    if (isOpen) {
      setCodigoMotivo(MOTIVOS_CANCELAMENTO[0]);
      setJustificativa("");
      setErroValidacao(null);
    }
  }, [isOpen]);

  if (!isOpen || !nota) return null;

  const handleConfirm = () => {
    if (isCancelling) return;
    const trimmed = justificativa.trim();
    if (!trimmed || trimmed.length < 15) {
      setErroValidacao(`A justificativa deve conter no mínimo 15 caracteres (atualmente com ${trimmed.length}). Digite uma justificativa detalhada.`);
      return;
    }
    setErroValidacao(null);
    const numMotivo = codigoMotivo.startsWith("1") ? "1" : (codigoMotivo.startsWith("2") ? "2" : "9");
    const fullMotivo = `${codigoMotivo} - ${trimmed}`;
    onConfirmCancel(nota.id, fullMotivo, numMotivo);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 font-sans text-[11px]">
      <div className="w-full max-w-lg bg-[#f0f0f0] border-2 border-red-700 shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Titlebar */}
        <div className="bg-gradient-to-r from-red-800 to-red-600 text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] select-none">
          <div className="flex items-center gap-2">
            <Ban size={14} className="text-white" />
            <span>Cancelamento de NFS-e (Padrão Nacional Sefin)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-red-200 font-bold px-1.5 cursor-pointer text-[13px]"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col gap-2.5 bg-white">
          <div className="bg-red-50 border border-red-200 p-2 text-red-900 flex items-start gap-2">
            <AlertTriangle size={15} className="text-red-700 shrink-0 mt-0.5" />
            <div className="text-[10.5px]">
              <strong>Atenção:</strong> O cancelamento de uma Nota Fiscal de Serviço Eletrônica é um ato irrevogável registrado junto à Receita Federal e ao município.
            </div>
          </div>

          <div className="border border-[#c0c0c0] bg-[#f9f9f9] p-2 space-y-1">
            <div className="flex justify-between">
              <span className="text-[#666666]">Número da DPS / NFS-e:</span>
              <strong className="font-mono text-[#002244]">{nota.numeroDps}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">Data de Emissão:</span>
              <span>{nota.dataEmissao}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666666]">Tomador:</span>
              <strong className="truncate max-w-[280px]">{nota.tomadorNome}</strong>
            </div>
            <div className="flex justify-between border-t border-[#e0e0e0] pt-1">
              <span className="text-[#666666]">Valor dos Serviços:</span>
              <strong className="font-mono text-[#003366]">
                {nota.valorServicos.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </strong>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#333333] mb-0.5">
              Código do Motivo de Cancelamento: *
            </label>
            <select
              value={codigoMotivo}
              onChange={(e) => setCodigoMotivo(e.target.value)}
              className="vb-select w-full"
            >
              {MOTIVOS_CANCELAMENTO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[#333333] mb-0.5">
              Justificativa Detalhada (mínimo 15 caracteres): *
            </label>
            <textarea
              rows={3}
              placeholder="Explique o motivo do cancelamento para registro no evento fiscal da SEFIN..."
              value={justificativa}
              onChange={(e) => {
                setJustificativa(e.target.value);
                if (erroValidacao) setErroValidacao(null);
              }}
              className="vb-input w-full font-mono text-[11px] select-text focus:outline-none focus:ring-1 focus:ring-red-600"
            />
            <div className="flex items-center justify-between mt-1">
              {erroValidacao ? (
                <span className="text-[10px] text-red-600 font-semibold flex items-center gap-1 animate-in fade-in">
                  <AlertCircle size={11} className="shrink-0" />
                  <span>{erroValidacao}</span>
                </span>
              ) : (
                <span className="text-[9.5px] text-[#888888]">
                  Descreva o motivo claro com ao menos 15 caracteres.
                </span>
              )}
              <span
                className={`text-[9.5px] font-mono font-semibold ${
                  justificativa.trim().length >= 15 ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {justificativa.trim().length} / 15 caracteres
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-[#e8e8e8] border-t border-[#d0d0d0] p-2 flex items-center justify-end gap-2 select-none">
          <button
            type="button"
            onClick={onClose}
            disabled={isCancelling}
            className="vb-btn disabled:opacity-50"
          >
            Voltar / Desistir
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCancelling}
            className="vb-btn bg-red-700 hover:bg-red-800 text-white font-bold border-red-900 disabled:opacity-50 flex items-center gap-1.5"
          >
            {isCancelling ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Cancelando junto à SEFIN...</span>
              </>
            ) : (
              <>
                <Ban size={11} className="text-white" />
                <span>Confirmar Cancelamento na SEFIN</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
