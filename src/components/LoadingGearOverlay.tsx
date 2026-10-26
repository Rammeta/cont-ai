import React from "react";
import { Cog } from "lucide-react";

interface LoadingGearOverlayProps {
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  variant?: "overlay" | "table" | "inline";
  colSpan?: number;
}

export default function LoadingGearOverlay({
  isLoading,
  title = "Carregando Documentos Fiscais...",
  subtitle = "Lendo e validando arquivos XML em disco...",
  variant = "overlay",
  colSpan = 12,
}: LoadingGearOverlayProps) {
  if (!isLoading) return null;

  const cardContent = (
    <div
      className="bg-[#f8fafd] border border-[#3c7fb1] rounded p-4 shadow-md flex items-center gap-4 select-none max-w-[460px]"
      style={{ boxShadow: "0 4px 16px rgba(0, 51, 102, 0.20)" }}
    >
      {/* Engrenagens mecânicas interconectadas no tom corporativo azul/marinho do app */}
      <div className="relative inline-flex items-center justify-center shrink-0 w-12 h-12">
        <Cog
          size={38}
          className="text-[#003366] animate-spin-slow"
          strokeWidth={1.8}
        />
        <Cog
          size={20}
          className="text-[#005a9e] animate-spin-reverse absolute -bottom-1 -right-1"
          strokeWidth={2}
        />
      </div>

      <div className="flex flex-col flex-1 min-w-0 text-left">
        <div className="text-[12px] font-bold text-[#003366] tracking-tight truncate">
          {title}
        </div>
        <div className="text-[11px] text-[#555555] mt-0.5 leading-snug">
          {subtitle}
        </div>
        {/* Barra de progresso contínua e discreta no padrão ERP */}
        <div className="mt-2 w-full bg-[#dbe4ef] h-1.5 rounded-full overflow-hidden">
          <div className="bg-gradient-to-r from-[#003366] via-[#005a9e] to-[#003366] h-full w-2/3 animate-pulse rounded-full" />
        </div>
      </div>
    </div>
  );

  if (variant === "table") {
    return (
      <tr>
        <td colSpan={colSpan} className="py-12 px-4 text-center">
          <div className="flex items-center justify-center">
            {cardContent}
          </div>
        </td>
      </tr>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center p-4">
        {cardContent}
      </div>
    );
  }

  // Variant "overlay" (padrão flutuante cobrindo o container relativo)
  return (
    <div className="absolute inset-0 bg-white/65 backdrop-blur-[0.5px] z-30 flex items-center justify-center select-none pointer-events-auto transition-opacity duration-150">
      {cardContent}
    </div>
  );
}
