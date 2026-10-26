import React, { useState } from "react";
import {
  Layers,
  Send,
  Building2,
  ShieldCheck,
  Calculator,
  DownloadCloud,
  FileText,
  Users,
  Settings,
  HelpCircle,
  FileCheck2,
  ArrowRight,
  Landmark,
  Check
} from "lucide-react";
import logoImg from "../assets/logo.png";
import { EmpresaSefaz } from "../types";

interface LauncherPortalViewProps {
  onSelectGestor: (remember?: boolean) => void;
  onSelectEmissor: (remember?: boolean) => void;
  empresasCount: number;
  activeEmpresa: EmpresaSefaz | null;
  onOpenConfig?: (tab?: "empresas" | "schedulers" | "storage") => void;
  onOpenHelp?: () => void;
}

export default function LauncherPortalView({
  onSelectGestor,
  onSelectEmissor,
  empresasCount,
  activeEmpresa,
  onOpenConfig,
  onOpenHelp,
}: LauncherPortalViewProps) {
  const [rememberChoice, setRememberChoice] = useState(false);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e8e8e8] text-[#000000] flex flex-col font-sans select-none text-[11px]">
      <style>{`
        .vb-launcher-btn {
          background: linear-gradient(180deg, #ffffff 0%, #ececec 50%, #e0e0e0 100%);
          border: 1px solid #707070;
          border-radius: 2px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 500;
          color: #000000;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
          white-space: nowrap;
        }
        .vb-launcher-btn:hover {
          background: linear-gradient(180deg, #f5f8fc 0%, #e1e9f5 50%, #d4e1f2 100%);
          border-color: #3c7fb1;
        }
        .launcher-card {
          background: #ffffff;
          border: 1px solid #707070;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
          transition: all 0.15s ease-in-out;
          cursor: pointer;
        }
        .launcher-card:hover {
          border-color: #005a9e;
          box-shadow: 0 4px 12px rgba(0,90,158,0.18);
        }
      `}</style>

      {/* Top Header Ribbon - Padrão CONT-AI */}
      <header className="shrink-0 border-b border-[#b0b0b0] bg-[#f0f0f0] px-3 py-1 shadow-xs z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src={logoImg}
            alt="Logo CONT-AI"
            className="h-5 w-auto object-contain shrink-0"
          />
          <span className="font-extrabold text-[#003366] text-[12px] tracking-tight">
            CONT-AI
          </span>
          <span className="text-[9px] font-bold text-[#005a9e] bg-[#dbe8f8] border border-[#99bce8] px-1 rounded-xs">
            v2.0
          </span>
          <div className="h-4 w-[1px] bg-[#b8b8b8] mx-1" />
          <span className="text-[11px] text-[#444444] font-medium">
            Central de Seleção de Módulos
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {empresasCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-[#ffffff] border border-[#b0b0b0] text-[11px] text-[#333333]">
              <Building2 size={12} className="text-[#005a9e]" />
              <span>
                <strong>{empresasCount}</strong> empresa{empresasCount > 1 ? "s" : ""} cadastrada{empresasCount > 1 ? "s" : ""}
              </span>
            </div>
          )}

          {onOpenConfig && (
            <button
              onClick={() => onOpenConfig("empresas")}
              className="vb-launcher-btn"
              title="Configurações e Empresas"
            >
              <Settings size={12} className="text-[#333333]" />
              <span>Configurações</span>
            </button>
          )}

          {onOpenHelp && (
            <button
              onClick={onOpenHelp}
              className="vb-launcher-btn"
              title="Ajuda e Documentação"
            >
              <HelpCircle size={12} className="text-[#333333]" />
              <span>Ajuda</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Center Area: Classic Desktop Modal / Box */}
      <main className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
        <div className="w-full max-w-4xl bg-[#f0f0f0] border-2 border-[#003366] shadow-lg">
          {/* Classic Window Titlebar */}
          <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px]">
            <div className="flex items-center gap-1.5">
              <span>🛡️</span>
              <span>CONT-AI - Seleção do Ambiente de Trabalho</span>
            </div>
            <span className="text-[10px] text-sky-200 font-normal">
              Versão 2.0.0
            </span>
          </div>

          {/* Window Body */}
          <div className="p-4 sm:p-6 flex flex-col gap-4">
            <div className="bg-[#ffffff] border border-[#b5b5b5] p-2.5 text-center">
              <h1 className="text-[14px] font-bold text-[#003366]">
                O que você deseja fazer agora?
              </h1>
              <p className="text-[11px] text-[#555555] mt-0.5">
                Selecione o módulo de trabalho que deseja acessar:
              </p>
            </div>

            {/* 2 Big Cards Grid - Padrão CONT-AI (Bordas sóbrias, fontes 11px, botões clássicos) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* CARD 1: GESTOR FISCAL */}
              <div
                onClick={() => onSelectGestor(rememberChoice)}
                className="launcher-card p-4 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header Strip */}
                  <div className="bg-gradient-to-r from-[#f0f6ff] to-[#d6e6ff] border border-[#b8d4f6] px-3 py-2 flex items-center gap-2.5 mb-3">
                    <div className="p-1.5 bg-[#003366] text-white rounded-[2px] shadow-2xs">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-bold text-[#002244] leading-tight">
                        Gestor Fiscal
                      </h2>
                      <span className="text-[10px] text-[#005a9e] font-semibold">
                        Captação, Fechamento e Auditoria
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#333333] leading-relaxed mb-3">
                    Captação automatizada de documentos fiscais eletrônicos via Certificado A1, controle de certificados e cálculo de DIFAL.
                  </p>

                  {/* Feature Checklist */}
                  <div className="bg-[#fafafa] border border-[#e0e0e0] p-2.5 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      <span>Captação de <strong>NF-e (55)</strong>, <strong>NFC-e (65)</strong> e <strong>CT-e (57)</strong></span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      <span>NFS-e Tomadas e Prestadas (ADN Nacional & Prefeitura SP)</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      <span>Guia Geral de Notas Fiscais e Fechamento Mensal</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      <span>Motor de Cálculo e Memória Analítica de <strong>DIFAL</strong></span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      <span>Painel Multi-CNPJ com monitoramento de Certificados A1</span>
                    </div>
                  </div>
                </div>

                {/* Big Button */}
                <div className="mt-4 pt-3 border-t border-[#e5e5e5]">
                  <button
                    type="button"
                    className="w-full text-center py-2 px-3 text-white font-bold text-[11px] cursor-pointer"
                    style={{
                      background: "linear-gradient(180deg, #005a9e 0%, #003366 100%)",
                      border: "1px solid #002244",
                      borderRadius: "2px",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)"
                    }}
                  >
                    ▶ ACESSAR GESTOR FISCAL
                  </button>
                </div>
              </div>

              {/* CARD 2: EMISSOR DE NFS-E */}
              <div
                onClick={() => onSelectEmissor(rememberChoice)}
                className="launcher-card p-4 flex flex-col justify-between"
              >
                <div>
                  {/* Card Header Strip */}
                  <div className="bg-gradient-to-r from-[#f0fdf4] to-[#dcfce7] border border-[#bbf7d0] px-3 py-2 flex items-center gap-2.5 mb-3">
                    <div className="p-1.5 bg-[#166534] text-white rounded-[2px] shadow-2xs">
                      <Send size={18} />
                    </div>
                    <div>
                      <h2 className="text-[13px] font-bold text-[#14532d] leading-tight">
                        Emissor de NFS-e
                      </h2>
                      <span className="text-[10px] text-[#15803d] font-semibold">
                        Padrão Nacional (DPS / Sefin Nacional)
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[#333333] leading-relaxed mb-3">
                    Emissão de Notas Fiscais de Serviços Eletrônicas via Declaração de Prestação de Serviços (DPS) com assinatura digital A1.
                  </p>

                  {/* Feature Checklist */}
                  <div className="bg-[#fafafa] border border-[#e0e0e0] p-2.5 flex flex-col gap-1.5 text-[11px]">
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#16a34a] shrink-0 mt-0.5" />
                      <span>Emissão no <strong>Padrão Nacional</strong> (DPS / Sefin Nacional)</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#16a34a] shrink-0 mt-0.5" />
                      <span>Transmissão e assinatura digital direta via <strong>Certificado A1</strong></span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#16a34a] shrink-0 mt-0.5" />
                      <span>Cadastro e preenchimento ágil de <strong>Clientes / Tomadores</strong></span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#16a34a] shrink-0 mt-0.5" />
                      <span>Cálculo automático de ISS e retenções federais</span>
                    </div>
                    <div className="flex items-start gap-1.5 text-[#222222]">
                      <Check size={13} className="text-[#16a34a] shrink-0 mt-0.5" />
                      <span>Emissão imediata de <strong>DANFSE em PDF</strong> e arquivo XML</span>
                    </div>
                  </div>
                </div>

                {/* Big Button */}
                <div className="mt-4 pt-3 border-t border-[#e5e5e5]">
                  <button
                    type="button"
                    className="w-full text-center py-2 px-3 text-white font-bold text-[11px] cursor-pointer"
                    style={{
                      background: "linear-gradient(180deg, #15803d 0%, #166534 100%)",
                      border: "1px solid #14532d",
                      borderRadius: "2px",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)"
                    }}
                  >
                    ▶ ACESSAR EMISSOR NFS-E
                  </button>
                </div>
              </div>

            </div>

            {/* Checkbox: Lembrar escolha */}
            <div className="pt-2 flex items-center justify-between border-t border-[#d0d0d0] text-[11px] text-[#444444]">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberChoice}
                  onChange={(e) => setRememberChoice(e.target.checked)}
                  className="rounded-none border-[#707070]"
                />
                <span>Lembrar minha escolha e entrar automaticamente na próxima abertura</span>
              </label>

              <span className="text-[10px] text-[#666666]">
                Dica: Você pode retornar a esta tela a qualquer momento clicando no botão "Início" no cabeçalho.
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Classic Windows-style Status Bar */}
      <footer className="shrink-0 h-6 bg-[#f0f0f0] border-t border-[#b0b0b0] px-3 flex items-center justify-between text-[11px] text-[#444444]">
        <div className="flex items-center gap-3">
          <span>CONT-AI v2.0 • Gestor de Movimento Fiscal</span>
          <span>|</span>
          <span>Zero-Cloud Storage (Conexão Direta mTLS)</span>
        </div>
        <div className="flex items-center gap-3 font-medium">
          <span>Ambiente Nacional & Prefeituras</span>
          <span>|</span>
          <span>Desenvolvido para Escritórios Contábeis e Departamentos Fiscais</span>
        </div>
      </footer>
    </div>
  );
}
