import React from "react";
import { AppConfig } from "../types";
import { AlertTriangle, Settings2, Info } from "lucide-react";

interface ConfigSectionProps {
  config: AppConfig;
  onChange: (updated: Partial<AppConfig>) => void;
  summaryText: string;
}

export default function ConfigSection({ config, onChange, summaryText }: ConfigSectionProps) {
  const handleInputChange = (key: keyof AppConfig, value: string) => {
    onChange({ [key]: value });
  };

  const handleBlurFormat = (key: "aliqInterna" | "aliqFcp") => {
    let raw = config[key].trim().replace(/\s/g, "").replace("%", "");
    if (!raw) raw = "0,00";
    raw = raw.replace(".", ",");
    
    if (!raw.includes(",")) {
      raw = raw + ",00";
    } else {
      const parts = raw.split(",");
      if (parts[1].length === 0) raw = raw + "00";
      else if (parts[1].length === 1) raw = raw + "0";
      else if (parts[1].length > 2) raw = parts[0] + "," + parts[1].substring(0, 2);
    }
    onChange({ [key]: raw });
  };

  return (
    <fieldset className="vb-groupbox">
      <legend className="vb-legend flex items-center gap-1.5">
        <Settings2 size={13} />
        <span>Enquadramento & Parâmetros Fiscais do Cálculo</span>
      </legend>

      <div className="flex flex-col gap-2.5 text-[11px]">
        {/* Parâmetros Editáveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-[#ffffff] border border-[#c0c0c0] p-2">
          {/* FCP Rate */}
          <div className="flex flex-col gap-1" id="field_aliqFcp">
            <label className="font-semibold text-[#333333]">
              FCP / FECOEP Destino (%):
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={config.aliqFcp}
                onChange={(e) => handleInputChange("aliqFcp", e.target.value)}
                onBlur={() => handleBlurFormat("aliqFcp")}
                placeholder="2,00"
                className="vb-input w-24 text-center font-mono font-bold"
              />
              <span className="text-[10px] text-[#666666] leading-tight">
                Fundo Estadual Combate à Pobreza (insira 0,00 se isento).
              </span>
            </div>
          </div>

          {/* Observação Livre */}
          <div className="flex flex-col gap-1 sm:col-span-2" id="field_obsLivre">
            <label className="font-semibold text-[#333333]">
              Observação Operacional Livre (Exportação / Relatório):
            </label>
            <input
              type="text"
              value={config.obsLivre}
              onChange={(e) => handleInputChange("obsLivre", e.target.value)}
              placeholder="Ex: Guia recolhida via GNRE - Convênio ICMS 142/2018"
              className="vb-input w-full"
            />
          </div>
        </div>

        {/* Parâmetros Automatizados Conforme Legislação */}
        <fieldset className="vb-groupbox m-0 bg-[#ffffff]">
          <legend className="vb-legend text-[10px]">
            Parâmetros Automatizados Conforme Legislação Tributária
          </legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px] text-[#444444] leading-normal">
            <div className="bg-[#f9f9f9] border border-[#d8d8d8] p-1.5">
              <strong className="text-[#003366] block mb-0.5">Alíquota Interestadual:</strong>
              Extraída automaticamente da tag <code>&lt;pICMS&gt;</code> do XML (4%, 7% ou 12%). Evita erros de parametrização manual.
            </div>
            <div className="bg-[#f9f9f9] border border-[#d8d8d8] p-1.5">
              <strong className="text-[#003366] block mb-0.5">Inclusão do IPI na Base:</strong>
              O IPI integra a base apenas para Consumidor Final (CF/88 Art. 155), sendo excluído na Antecipação de revenda.
            </div>
            <div className="bg-[#f9f9f9] border border-[#d8d8d8] p-1.5">
              <strong className="text-[#003366] block mb-0.5">Cálculo Por Dentro:</strong>
              Base dupla ("por dentro") exigida apenas entre empresas do Regime Normal. Se houver Simples Nacional, aplica Base Simples.
            </div>
            <div className="bg-[#f9f9f9] border border-[#d8d8d8] p-1.5">
              <strong className="text-[#003366] block mb-0.5">Incidência do FCP:</strong>
              Calculado para Uso/Consumo Final onde há alíquota FCP configurada. Bloqueado em Antecipação simples por regra padrão.
            </div>
          </div>
        </fieldset>

        {/* Resumo da Auditoria Operacional */}
        <div className="bg-[#eaf3ff] border border-[#b3d7ff] text-[#003366] p-2 flex items-start gap-2">
          <Info size={14} className="text-[#005a9e] shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong>Auditoria Operacional do Enquadramento:</strong> {summaryText}
          </div>
        </div>

        {/* Alerta do Simples Nacional */}
        {(config.regimeRemet === "simples" || config.regimeDest === "simples") && (
          <div className="bg-[#fff9e6] border border-[#d4a017] text-[#664d03] p-2 flex items-start gap-2">
            <AlertTriangle size={14} className="text-[#b28900] shrink-0 mt-0.5" />
            <div className="text-[10px] leading-tight">
              <strong>Aviso de Regime Simples Nacional:</strong> Para fornecedores do Simples Nacional, os cálculos de Antecipação e DIFAL obedecem às normas da UF destinatária (Art. 13, § 1º, XIII da LC 123/2006). Utilize como memória de apuração fiscal.
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
