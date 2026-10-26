import React from "react";
import { NfseModeloNota } from "../types";
import NfsePadroesManager from "./NfsePadroesManager";

interface NfseModeloModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (modelo: NfseModeloNota) => void;
  initialData?: NfseModeloNota | null;
  modelos?: NfseModeloNota[];
  onSaveModelos?: (modelos: NfseModeloNota[]) => void;
  onNotify?: (text: string, type: "success" | "error") => void;
  onSelectAndApply?: (modelo: NfseModeloNota) => void;
}

export default function NfseModeloModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  modelos = [],
  onSaveModelos,
  onNotify,
  onSelectAndApply,
}: NfseModeloModalProps) {
  if (!isOpen) return null;

  // Se não foi passada a lista completa, usa initialData para compor a lista
  const effectiveModelos = modelos.length > 0 ? modelos : (initialData ? [initialData] : []);

  const handleSaveModelosWrapper = (updatedModelos: NfseModeloNota[]) => {
    if (onSaveModelos) {
      onSaveModelos(updatedModelos);
    }
    if (onSave && updatedModelos.length > 0) {
      const last = updatedModelos[updatedModelos.length - 1];
      onSave(last);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 select-none p-3 font-sans text-[11px]">
      <div className="w-full max-w-5xl bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl flex flex-col h-[85vh] max-h-[720px] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Titlebar Clássico Windows / ERP */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">📄</span>
            <span>CONT-AI - [ Gerenciador de Padrões de Emissão de NFS-e ]</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white hover:text-red-300 font-bold px-1.5 cursor-pointer text-[13px]"
            title="Fechar janela"
          >
            ✕
          </button>
        </div>

        {/* Master-Detail Body: Lista à esquerda e Painel de Ajuste à direita */}
        <div className="flex-1 overflow-hidden">
          <NfsePadroesManager
            modelos={effectiveModelos}
            onSaveModelos={handleSaveModelosWrapper}
            onNotify={onNotify}
            initialSelectedId={initialData?.id || (effectiveModelos.length > 0 ? effectiveModelos[0].id : "novo")}
            onSelectAndApply={onSelectAndApply}
            onClose={onClose}
            isModal={true}
          />
        </div>
      </div>
    </div>
  );
}
