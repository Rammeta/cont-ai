import React from "react";
import { ShieldCheck, AlertTriangle, AlertCircle } from "lucide-react";
import { formatDateBr, calculateDaysRemaining } from "../utils/certUtils";

interface CertificateBadgeProps {
  certInfo?: {
    daysRemaining?: number | null;
    isExpired?: boolean;
    validTo?: string;
  } | null;
  compact?: boolean;
  onClick?: () => void;
}

export default function CertificateBadge({ certInfo, compact = false, onClick }: CertificateBadgeProps) {
  if (!certInfo) return null;

  const validToStr = formatDateBr(certInfo.validTo, "");
  let daysRemaining = certInfo.daysRemaining;
  let isExpired = certInfo.isExpired ?? false;

  if ((daysRemaining === undefined || daysRemaining === null) && certInfo.validTo) {
    const calc = calculateDaysRemaining(certInfo.validTo);
    if (calc !== null) {
      daysRemaining = calc;
      isExpired = calc < 0;
    }
  }

  const clickClass = onClick ? "cursor-pointer hover:opacity-90 active:scale-95 transition-all" : "";
  const clickHint = onClick ? " · Clique para gerenciar certificados" : "";

  if (isExpired || (daysRemaining !== undefined && daysRemaining !== null && daysRemaining < 0)) {
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[10px] bg-rose-100 text-rose-900 border border-rose-400 shadow-2xs ${clickClass}`}
        title={`Certificado A1 expirado em ${validToStr || "data anterior"}. Renove seu certificado digital para continuar consultando a SEFAZ.${clickHint}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
        <AlertCircle size={11} className="text-rose-700" />
        <span>{compact ? "Vencido" : "Certificado Vencido"}</span>
      </span>
    );
  }

  const daysNum = daysRemaining ?? 0;

  if (daysNum <= 30) {
    const isUrgent = daysNum <= 7;
    return (
      <span
        onClick={onClick}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-bold text-[10px] shadow-2xs ${clickClass} ${
          isUrgent
            ? "bg-amber-200 text-amber-950 border border-amber-600 animate-pulse"
            : "bg-[#fef3c7] text-[#92400e] border border-[#f59e0b]"
        }`}
        title={`Atenção: Certificado A1 vence em ${daysNum} dias (${validToStr}). Providencie a renovação com antecedência.${clickHint}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
        <AlertTriangle size={11} className="text-[#92400e]" />
        <span>
          {compact
            ? `Vence em ${daysNum}d`
            : `Vence em ${daysNum} ${daysNum === 1 ? "dia" : "dias"}`}
        </span>
      </span>
    );
  }

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-semibold text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-400 shadow-2xs ${clickClass}`}
      title={`Certificado A1 válido e operacional até ${validToStr || "data futura"}.${clickHint}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
      <ShieldCheck size={11} className="text-emerald-700" />
      <span>{compact ? `${daysNum}d` : `Certificado Válido (${daysNum} dias)`}</span>
    </span>
  );
}
