import React from "react";
import { formatBRL } from "../utils/calc";
import { FileCheck, Layers, HelpCircle, Wallet, Settings } from "lucide-react";
import { motion } from "motion/react";

interface StatsCardsProps {
  xmlsCount: number;
  itensCount: number;
  cfopCount: number;
  totalRecolher: number;
  predominantMode: string;
}

export default function StatsCards({
  xmlsCount,
  itensCount,
  cfopCount,
  totalRecolher,
  predominantMode,
}: StatsCardsProps) {
  const statsList = [
    {
      title: "XMLs Processados",
      value: xmlsCount,
      sub: "NF-e Carregadas",
      icon: <FileCheck className="text-emerald-600" size={20} />,
      bgColor: "bg-white border-slate-200",
      iconBg: "bg-emerald-50 border-emerald-100",
    },
    {
      title: "Itens Conciliados",
      value: itensCount,
      sub: "Linhas Auditadas",
      icon: <Layers className="text-blue-600" size={20} />,
      bgColor: "bg-white border-slate-200",
      iconBg: "bg-blue-50 border-blue-100",
    },
    {
      title: "Dicionário de CFOP",
      value: cfopCount,
      sub: "Regras de CFOP Ativas",
      icon: <HelpCircle className="text-purple-600" size={20} />,
      bgColor: "bg-white border-slate-200",
      iconBg: "bg-purple-50 border-purple-100",
    },
    {
      title: "Total a Recolher",
      value: formatBRL(totalRecolher),
      sub: "DIFAL + FCP Calculados",
      icon: <Wallet className="text-white" size={20} />,
      bgColor: "bg-blue-600 border-transparent shadow-lg shadow-blue-100/50",
      iconBg: "bg-blue-700 border-blue-500",
      highlight: true,
    },
    {
      title: "Enquadramento Predominante",
      value: predominantMode || "Nenhum",
      sub: "Regra prevalente geral",
      icon: <Settings className="text-pink-600" size={20} />,
      bgColor: "bg-white border-slate-200",
      iconBg: "bg-pink-50 border-pink-100",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
      {statsList.map((stat, idx) => (
        <motion.div
          key={stat.title}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: idx * 0.05 }}
          className={`flex flex-col justify-between border rounded-2xl p-4 shadow-sm transition-all duration-200 hover:shadow-md ${stat.bgColor}`}
        >
          <div className="flex items-center justify-between gap-3 mb-2 min-h-[28px]">
            <span className={`text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-normal break-words ${stat.highlight ? "text-blue-100" : "text-slate-400"}`}>
              {stat.title}
            </span>
            <div className={`p-1.5 rounded-lg border ${stat.iconBg}`}>
              {stat.icon}
            </div>
          </div>

          <div className="flex flex-col mt-1 min-w-0">
            <span
              className={`text-base sm:text-lg xl:text-xl font-extrabold tracking-tight whitespace-nowrap overflow-visible ${
                stat.highlight ? "text-white" : "text-slate-950"
              }`}
              title={String(stat.value)}
            >
              {stat.value}
            </span>
            <span className={`text-[10px] font-medium mt-0.5 ${stat.highlight ? "text-blue-100/80" : "text-slate-500"}`}>
              {stat.sub}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
