import React, { useState } from "react";
import {
  Layers,
  Key,
  FolderTree,
  Clock,
  Calculator,
  DownloadCloud,
  ShoppingBag,
  Truck,
  Landmark,
  ShieldCheck,
  RotateCcw,
  Search,
  Check,
  Cpu,
  FileSpreadsheet,
  AlertTriangle,
  HelpCircle,
  FileText,
  Database,
  ArrowRight,
  ArrowLeft
} from "lucide-react";
import logoImg from "../../assets/logo.png";

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(1);

  if (!isOpen) return null;

  const totalSteps = 5;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 select-none text-[11px] text-[#000000] font-sans"
      id="onboarding_modal_overlay"
    >
      <div
        className="bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        id="onboarding_modal_content"
      >
        <style>{`
          .vb-btn {
            background: linear-gradient(180deg, #ffffff 0%, #ececec 50%, #e0e0e0 100%);
            border: 1px solid #707070;
            border-radius: 2px;
            padding: 3px 9px;
            font-size: 11px;
            font-weight: 500;
            color: #000000;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.8);
            white-space: nowrap;
          }
          .vb-btn:hover {
            background: linear-gradient(180deg, #f5f8fc 0%, #e1e9f5 50%, #d4e1f2 100%);
            border-color: #3c7fb1;
          }
          .vb-btn:active {
            background: #d4d4d4;
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
          }
          .vb-btn-primary {
            background: linear-gradient(180deg, #f0f6ff 0%, #d6e6ff 50%, #bad5ff 100%);
            border: 1px solid #336699;
            font-weight: 600;
            color: #002244;
          }
          fieldset.vb-groupbox {
            border: 1px solid #b0b0b0;
            padding: 8px 10px 10px 10px;
            margin-bottom: 8px;
            background-color: #f7f7f7;
          }
          legend.vb-legend {
            font-weight: 600;
            font-size: 11px;
            color: #003366;
            padding: 0 4px;
          }
        `}</style>

        {/* 1. TITLEBAR CLASSICA CONT-AI (WINFORMS BLUE GRADIENT) */}
        <div className="bg-gradient-to-r from-[#003366] via-[#004b87] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between border-b border-[#002244] shadow-xs">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="CONT-AI" className="h-4 w-4 rounded-xs object-contain bg-white p-[1px] border border-white/40" />
            <strong className="tracking-wide text-[11px]">CONT-AI - Gestor de Movimento fiscal v2.1</strong>
            <span className="text-[#cce2ff] text-[11px]">- [ Guia Geral de Utilização e Procedimentos Fiscais ]</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-xs font-mono font-normal">
              Passo {currentStep} de {totalSteps}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Fechar Guia"
            className="px-1.5 py-0.2 bg-blue-900/60 hover:bg-rose-700 text-white rounded text-[10px] font-sans border border-blue-400/40 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 2. BARRA DE ABAS CLASSICA (TAB CONTROL WINFORMS) */}
        <div className="bg-[#e4e4e4] border-b border-[#b0b0b0] px-2 pt-1 flex items-center gap-1 text-[11px] overflow-x-auto">
          {[
            { step: 1, title: "1. Módulos & Visão 360°", icon: Layers },
            { step: 2, title: "2. Empresas & Certificados A1", icon: Key },
            { step: 3, title: "3. Pastas & Arquivos XML", icon: FolderTree },
            { step: 4, title: "4. Agendadores & Sincronia", icon: Clock },
            { step: 5, title: "5. Auditoria & DIFAL SN", icon: Calculator },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentStep === tab.step;
            return (
              <button
                key={tab.step}
                type="button"
                onClick={() => setCurrentStep(tab.step)}
                className={`px-3 py-1.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#f0f0f0] text-[#003366] border-t-2 border-t-[#005a9e] border-x border-[#b0b0b0] -mb-px z-10"
                    : "text-[#444444] hover:bg-[#d8d8d8] border border-transparent"
                }`}
              >
                <Icon size={13} className={isActive ? "text-[#005a9e]" : "text-[#555555]"} />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>

        {/* 3. CONTEÚDO DO GUIA */}
        <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-3.5 bg-[#f0f0f0]">
          {/* PASSO 1: VISÃO GERAL E OS 6 MÓDULOS */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-3">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Visão Unificada 360° - 6 Módulos Fiscais Integrados</legend>
                <p className="text-[11px] text-[#333333] leading-relaxed mb-2.5">
                  O <strong>CONT-AI - Gestor de Movimento fiscal v2.1</strong> automatiza a captura completa, gravação padronizada em disco, geração de DANFEs/DACTEs/DANFSes em PDF oficial e auditoria tributária para todas as empresas em 6 módulos integrados:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#003366] mb-1">
                      <Layers size={13} />
                      <span>1. Guia Geral de Notas</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Visão consolidada do período: Compras, Vendas, Fretes, Serviços e Retenções. Inclui Dashboard Executivo e exportação HTML para apresentações gerenciais.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#005a9e] mb-1">
                      <DownloadCloud size={13} />
                      <span>2. NF-e Entradas (Mod 55)</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Download automático na SEFAZ Nacional via NSU, manifestação de destinatário (Ciência da Operação), busca pontual por chave e emissão de DANFE PDF.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#6b21a8] mb-1">
                      <ShoppingBag size={13} />
                      <span>3. NFC-e Saídas (Mod 65)</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Captação direta no SAE da SEFAZ-SP dos cupons fiscais emitidos pela empresa, com geração de DANFE NFC-e e exportação em lote ZIP.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#b45309] mb-1">
                      <Truck size={13} />
                      <span>4. CT-e Fretes (Mod 57)</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Captura nacional de Conhecimentos de Transporte, identificando remetente, tomador e transportadora, com geração de DACTE oficial.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#047857] mb-1">
                      <Landmark size={13} />
                      <span>5. NFS-e (Nacional + SP)</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Captura unificada em 1 clique no Portal Nacional ADN e na Prefeitura de São Paulo, priorizando fontes oficiais e evitando duplicidades.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#4338ca] mb-1">
                      <Calculator size={13} />
                      <span>6. Cálculo DIFAL SN</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Motor tributário de conciliação matemática item a item: base dupla ou simples, alíquota interestadual, alíquota interna por NCM e FCP.
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox bg-[#eaf7ea] border-[#7bc97b]">
                <legend className="vb-legend text-[#107c41]">Exportação Padronizada para Excel / CSV (UTF-8 com BOM)</legend>
                <div className="flex items-start gap-2 text-[11px] text-[#0f5132]">
                  <FileSpreadsheet size={16} className="text-[#107c41] shrink-0 mt-0.5" />
                  <p>
                    Todos os módulos possuem o botão <strong>"Exportar Grid / CSV"</strong> gerando arquivos compatíveis diretamente com o Microsoft Excel, sem problemas de acentuação e preservando Chaves de Acesso e CNPJs como texto sem notação científica.
                  </p>
                </div>
              </fieldset>
            </div>
          )}

          {/* PASSO 2: EMPRESAS & CERTIFICADOS A1 */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-3">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Cadastros de Empresas e Certificados Digitais A1</legend>
                <p className="text-[11px] text-[#333333] mb-2.5">
                  Acesse o menu <strong>"Configurações"</strong> ou o <strong>"Painel de Empresas"</strong> para adicionar novas empresas, selecionar certificados A1 e definir quais modelos cada empresa utiliza:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <strong className="text-[#003366] block mb-1">1. Localizar na Rede</strong>
                    <p className="text-[#555555] text-[10.5px]">
                      Localiza automaticamente certificados <code className="font-mono bg-white px-1">.pfx/.p12</code> em pastas de rede (<code className="font-mono bg-white px-1">Servidor de Rede</code>) e extrai a senha quando nomeados com <code className="font-mono bg-white px-1">_senha_XYZ_</code>.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <strong className="text-[#003366] block mb-1">2. Modelos por Empresa</strong>
                    <p className="text-[#555555] text-[10.5px]">
                      Ative ou desative com 1 clique quais modelos cada empresa opera (NF-e, NFC-e, CT-e e NFS-e), poupando tempo durante a sincronização em massa.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <strong className="text-[#003366] block mb-1">3. Banco Seguro Criptografado</strong>
                    <p className="text-[#555555] text-[10.5px]">
                      Todos os ponteiros NSU e credenciais são protegidos em SQLite local com criptografia <strong>AES-256-GCM</strong>, sem expor senhas em texto puro.
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox bg-[#fffbf0] border-[#e0c060]">
                <legend className="vb-legend text-[#b45309]">Selo de Validade do Certificado e Repouso Anti-Bloqueio SEFAZ</legend>
                <div className="flex flex-col gap-2 text-[11px] text-[#444444]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-[#d97706] shrink-0" />
                    <span>
                      <strong>Selo Visual:</strong> Exibe <strong>Válido</strong> (com dias restantes), <strong>Alerta Preventivo de 30 Dias</strong> ou <strong>Expirado</strong>. Clique no selo para abrir o cadastro da empresa e renovar.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-[#107c41] shrink-0" />
                    <span>
                      <strong>Proteção NT 2014.002:</strong> Controla o repouso preventivo de 1 hora quando a SEFAZ informa fim de fila (cStat 137), exibindo cronômetro regressivo e protegendo o CNPJ contra a Rejeição 656 (Consumo Indevido).
                    </span>
                  </div>
                </div>
              </fieldset>
            </div>
          )}

          {/* PASSO 3: PASTAS & ARQUIVOS XML */}
          {currentStep === 3 && (
            <div className="flex flex-col gap-3">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Estrutura de Armazenamento Padronizada em Disco</legend>
                <p className="text-[11px] text-[#333333] mb-2">
                  Todas as notas (arquivos XML originais e DANFEs em PDF) são gravadas de forma organizada por Empresa, Competência e Modelo Fiscal:
                </p>

                <div className="p-2.5 bg-[#1e293b] text-[#f1f5f9] font-mono text-[10.5px] leading-relaxed border border-[#334155] rounded-xs mb-2">
                  <div className="text-[#38bdf8] font-bold">[REPOSITÓRIO RAIZ] \ NOME DA EMPRESA (CNPJ)</div>
                  <div className="pl-3 text-[#fde047]">└── 2026 \ 09 - Setembro</div>
                  <div className="pl-6 text-[#7dd3fc]">├── NFE ENTRADAS \ DENTRO DO ESTADO & FORA DO ESTADO</div>
                  <div className="pl-6 text-[#6ee7b7]">├── NFSE \ SERVIÇOS TOMADOS & SERVIÇOS PRESTADOS</div>
                  <div className="pl-6 text-[#d8b4fe]">├── NFCE (Saídas Mod. 65)</div>
                  <div className="pl-6 text-[#fcd34d]">└── CTE (Fretes Mod. 57)</div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#555555] bg-[#f5f5f5] p-2 border border-[#e0e0e0]">
                  <span>
                    O botão <strong>"Repositório de Salvamento"</strong> no topo abre a pasta raiz ou permite alterar a unidade (ex: para servidor ou disco de rede).
                  </span>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Reinício de NSU e Recuperação de Arquivos Perdidos</legend>
                <p className="text-[11px] text-[#555555] leading-relaxed">
                  Em caso de troca de máquina, exclusão de notas ou necessidade de recuperar o histórico fiscal completo, você pode reiniciar o NSU para 0 (em <strong>Configurações &rarr; Armazenamento & Pastas</strong> ou nos botões de cada tela) para que a SEFAZ e os portais reenviem todo o histórico oficial.
                </p>
              </fieldset>
            </div>
          )}

          {/* PASSO 4: AGENDADORES & SINCRONIZAÇÃO GERAL */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-3">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Agendadores por Modelo Fiscal e Sincronização em Segundo Plano</legend>
                <p className="text-[11px] text-[#333333] mb-2.5">
                  Programe rotinas automáticas de download em <strong>Configurações &rarr; Agendadores por Modelo</strong>:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#003366] mb-1">
                      <Clock size={13} />
                      <span>Agendamentos Independentes</span>
                    </div>
                    <ul className="text-[#555555] text-[10.5px] space-y-1">
                      <li>• <strong>NF-e Entradas:</strong> busca diária de compras na SEFAZ Nacional.</li>
                      <li>• <strong>NFC-e Saídas:</strong> captura de cupons fiscais emitidos pela empresa.</li>
                      <li>• <strong>CT-e Fretes:</strong> busca nacional de conhecimentos de transporte.</li>
                      <li>• <strong>NFS-e Serviços:</strong> varredura no Portal Nacional ADN e Prefeitura de SP.</li>
                    </ul>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#047857] mb-1">
                      <Database size={13} />
                      <span>Sincronizar Todas as Empresas</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px] leading-relaxed">
                      O botão <strong>"Sincronizar Todas as Empresas"</strong> no Painel percorre todos os clientes cadastrados em 4 etapas sequenciais (NF-e &rarr; NFC-e &rarr; CT-e &rarr; NFS-e) de forma segura e incremental.
                    </p>
                  </div>
                </div>
              </fieldset>

              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Operação em Segundo Plano (Bandeja do Sistema)</legend>
                <p className="text-[11px] text-[#555555]">
                  O CONT-AI continua monitorando e executando os agendamentos na bandeja do relógio do Windows (System Tray), mesmo se a janela for minimizada ou fechada.
                </p>
              </fieldset>
            </div>
          )}

          {/* PASSO 5: CONSULTA CADASTRAL & AUDITORIA DIFAL */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-3">
              <fieldset className="vb-groupbox bg-[#ffffff]">
                <legend className="vb-legend">Auditoria Cadastral Simples Nacional / MEI e Cálculo DIFAL</legend>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] mb-2">
                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#003366] mb-1">
                      <Search size={13} />
                      <span>Consulta Simples Nacional / MEI</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      No módulo NF-e Entradas, o sistema consulta automaticamente na Receita Federal se os fornecedores são optantes pelo Simples Nacional ou MEI para apuração correta do DIFAL.
                    </p>
                  </div>

                  <div className="p-2 border border-[#c0c0c0] bg-[#fafafa]">
                    <div className="flex items-center gap-1.5 font-bold text-[#4338ca] mb-1">
                      <Calculator size={13} />
                      <span>Auditoria e Motor DIFAL SN</span>
                    </div>
                    <p className="text-[#555555] text-[10.5px]">
                      Filtra exclusivamente notas interestaduais de fora do estado da empresa, calculando alíquotas por NCM, base dupla "por dentro" ou simples, IPI e FCP com relatórios detalhados.
                    </p>
                  </div>
                </div>

                <div className="p-2 border border-[#b0b0b0] bg-[#f5f5f5] text-[11px] text-[#333333]">
                  <strong>Diagnóstico e Suporte Técnico:</strong> Em <strong>Configurações &rarr; Armazenamento</strong>, o botão <strong>"Exportar Diagnóstico (.txt)"</strong> gera um relatório de integridade (versões, testes de disco e certificados) para suporte sem exibir senhas.
                </div>
              </fieldset>
            </div>
          )}
        </div>

        {/* 4. FOOTER CLÁSSICO DE DIÁLOGO WINDOWS */}
        <div className="bg-[#e8e8e8] border-t border-[#b0b0b0] px-3 py-2 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <button type="button" onClick={handlePrev} className="vb-btn">
                <span>⬅ Voltar Passo</span>
              </button>
            )}
          </div>

          <div className="text-[10px] text-[#666666]">
            Passo <strong>{currentStep}</strong> de <strong>{totalSteps}</strong>
          </div>

          <div className="flex items-center gap-2">
            {currentStep < totalSteps ? (
              <button type="button" onClick={handleNext} className="vb-btn vb-btn-primary">
                <span>Próximo Passo ➡</span>
              </button>
            ) : (
              <button type="button" onClick={onClose} className="vb-btn vb-btn-primary">
                <Check size={12} />
                <span>Concluir e Fechar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
