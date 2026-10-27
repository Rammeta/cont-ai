import React from "react";
import { Settings } from "lucide-react";

interface LoadingGearOverlayProps {
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  variant?: "overlay" | "table" | "inline";
  colSpan?: number;
}

export default function LoadingGearOverlay({
  isLoading,
  title = "Carregando dados...",
  variant = "overlay",
  colSpan = 12,
}: LoadingGearOverlayProps) {
  if (!isLoading) return null;

  const cardContent = (
    <div
      className="bg-[#f8fafd] border border-[#3c7fb1] rounded-lg p-3.5 shadow-md flex items-center justify-center select-none"
      style={{ boxShadow: "0 4px 16px rgba(0, 51, 102, 0.18)" }}
      title={title}
    >
      {/* Somente uma catraca/engrenagem grande girando, na cor institucional #003366 e estilo do app */}
      <Settings
        size={48}
        className="text-[#003366] animate-spin"
        strokeWidth={2.2}
        style={{ animationDuration: "2s" }}
      />
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
    <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px] z-30 flex items-center justify-center select-none pointer-events-auto transition-opacity duration-150">
      {cardContent}
    </div>
  );
}
