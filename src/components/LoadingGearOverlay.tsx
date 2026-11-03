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

  const gearContent = (
    <div
      className="flex items-center justify-center select-none pointer-events-none bg-transparent"
      title={title}
    >
      {/* Somente a engrenagem com fundo 100% transparente (sem quadrado atrás), centralizada na tela */}
      <Settings
        size={56}
        className="text-[#003366] animate-spin"
        strokeWidth={2.2}
        style={{
          animationDuration: "2s",
          filter: "drop-shadow(0 2px 6px rgba(0, 51, 102, 0.28))",
        }}
      />
    </div>
  );

  if (variant === "table") {
    return (
      <tr>
        <td colSpan={colSpan} className="py-16 px-4 text-center border-none bg-transparent">
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {gearContent}
          </div>
        </td>
      </tr>
    );
  }

  if (variant === "inline") {
    return (
      <div className="flex items-center justify-center p-4 bg-transparent">
        {gearContent}
      </div>
    );
  }

  // Variant "overlay": engrenagem pura centralizada na tela, sem quadrado ou fundo atrás
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center select-none pointer-events-none">
      {gearContent}
    </div>
  );
}
