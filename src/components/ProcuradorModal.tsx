import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Eye,
  EyeOff,
  Building2,
  Search,
  CheckSquare,
  Square,
  Trash2,
  X,
  RotateCw,
  Award
} from "lucide-react";
import { EmpresaSefaz, ProcuradorConfig, InstalledCertItem } from "../types";
import {
  selectCertFile,
  testCert,
  listInstalledCerts,
  saveProcuradorConfig
} from "../utils/electronBridge";
import { formatDateBr } from "../utils/certUtils";

interface ProcuradorModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSefaz[];
  onSaveEmpresas: (updated: EmpresaSefaz[]) => void;
  procuradorConfig: ProcuradorConfig | null;
  onUpdateProcuradorConfig: (config: ProcuradorConfig | null) => void;
  onNotify: (text: string, type: "success" | "error") => void;
}

export default function ProcuradorModal({
  isOpen,
  onClose,
  empresas,
  onSaveEmpresas,
  procuradorConfig,
  onUpdateProcuradorConfig,
  onNotify,
}: ProcuradorModalProps) {
  const [sourceType, setSourceType] = useState<"windows" | "file">(
    procuradorConfig?.certStore || "windows"
  );
  const [certPath, setCertPath] = useState(procuradorConfig?.certPath || "");
  const [password, setPassword] = useState(procuradorConfig?.password || "");
  const [showPassword, setShowPassword] = useState(false);
  const [thumbprint, setThumbprint] = useState(procuradorConfig?.certThumbprint || "");
  const [padraoNovas, setPadraoNovas] = useState(procuradorConfig?.padraoNovasEmpresas !== false);

  // Certificados do Windows
  const [installedCerts, setInstalledCerts] = useState<InstalledCertItem[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [installedFilter, setInstalledFilter] = useState("");

  // Status de teste
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    info?: any;
  } | null>(
    procuradorConfig?.certInfo
      ? { success: true, info: procuradorConfig.certInfo }
      : null
  );

  // Lista de IDs de empresas vinculadas
  const [selectedEmpresaIds, setSelectedEmpresaIds] = useState<string[]>([]);
  const [empresaSearch, setEmpresaSearch] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Inicializa estado ao abrir o modal
  useEffect(() => {
    if (isOpen) {
      if (procuradorConfig) {
        setSourceType(procuradorConfig.certStore || "windows");
        setCertPath(procuradorConfig.certPath || "");
        setPassword(procuradorConfig.password || "");
        setThumbprint(procuradorConfig.certThumbprint || "");
        setPadraoNovas(procuradorConfig.padraoNovasEmpresas !== false);
        if (procuradorConfig.certInfo) {
          setTestResult({ success: true, info: procuradorConfig.certInfo });
        }
      }

      // Identifica empresas que já possuem usarProcuradorNfse ativo
      const linked = empresas
        .filter((e) => e.usarProcuradorNfse === true)
        .map((e) => e.id);
      setSelectedEmpresaIds(linked);

      // Carrega certificados do Windows
      handleLoadWindowsCerts();
    }
  }, [isOpen, procuradorConfig]);

  const handleLoadWindowsCerts = async () => {
    setLoadingInstalled(true);
    try {
      const res = await listInstalledCerts();
      if (res.success && res.certs) {
        const sorted = [...(res.certs || [])].sort((a, b) => {
          const nameA = (a.CleanName || a.CommonName || "").trim();
          const nameB = (b.CleanName || b.CommonName || "").trim();
          return nameA.localeCompare(nameB, "pt-BR", { sensitivity: "base", numeric: true });
        });
        setInstalledCerts(sorted);
      }
    } catch (e: any) {
      console.warn("Erro ao listar certificados do Windows:", e.message);
    } finally {
      setLoadingInstalled(false);
    }
  };

  // Filtra certificados do Windows
  const filteredInstalledCerts = useMemo(() => {
    const q = installedFilter.trim().toLowerCase();
    if (!q) return installedCerts;
    return installedCerts.filter((c) => {
      const name = (c.CleanName || c.CommonName || "").toLowerCase();
      const doc = (c.Documento || "").toLowerCase();
      const iss = (c.Issuer || "").toLowerCase();
      const thumb = (c.Thumbprint || "").toLowerCase();
      return name.includes(q) || doc.includes(q) || iss.includes(q) || thumb.includes(q);
    });
  }, [installedCerts, installedFilter]);

  // Filtra empresas
  const filteredEmpresas = useMemo(() => {
    const q = empresaSearch.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((e) => {
      const raz = (e.razaoSocial || "").toLowerCase();
      const c = (e.cnpj || "").toLowerCase();
      return raz.includes(q) || c.includes(q);
    });
  }, [empresas, empresaSearch]);

  const handleSelectWindowsCert = (cert: InstalledCertItem) => {
    setThumbprint(cert.Thumbprint);
    setSourceType("windows");
    const cleanDoc = (cert.Documento || "").replace(/\D/g, "");
    setTestResult({
      success: true,
      info: {
        subject: cert.CommonName || cert.CleanName || cert.Subject,
        issuer: cert.Issuer,
        validTo: cert.NotAfter,
        daysRemaining: cert.daysRemaining || 0,
        isExpired: cert.isExpired || false,
        extractedCnpj: cleanDoc,
      },
    });
  };

  const handleSelectPfxFile = async () => {
    const filePath = await selectCertFile(certPath);
    if (filePath) {
      setCertPath(filePath);
      setSourceType("file");
      if (password) {
        handleTestFileCert(filePath, password);
      }
    }
  };

  const handleTestFileCert = async (pathPfx?: string, pwd?: string) => {
    const targetPath = pathPfx || certPath;
    const targetPwd = pwd !== undefined ? pwd : password;
    if (!targetPath) {
      alert("Selecione o arquivo do certificado (.pfx ou .p12).");
      return;
    }
    setTesting(true);
    try {
      const res = await testCert(targetPath, targetPwd);
      if (res.success && res.info) {
        setTestResult({ success: true, info: res.info });
      } else {
        setTestResult({ success: false, error: res.error || "Senha incorreta ou arquivo inválido." });
      }
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTesting(false);
    }
  };

  // Empresas sem certPath e sem certThumbprint
  const empresasSemCertCount = useMemo(() => {
    return empresas.filter(
      (e) => !e.certPath && (!e.certThumbprint || e.certStore !== "windows")
    ).length;
  }, [empresas]);

  const handleToggleEmpresa = (id: string) => {
    setSelectedEmpresaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllEmpresas = () => {
    setSelectedEmpresaIds(empresas.map((e) => e.id));
  };

  const handleSelectWithoutCert = () => {
    // Empresas sem certPath e sem certThumbprint
    const semCert = empresas
      .filter((e) => !e.certPath && (!e.certThumbprint || e.certStore !== "windows"))
      .map((e) => e.id);
    setSelectedEmpresaIds(semCert);
  };

  const handleDeselectAll = () => {
    setSelectedEmpresaIds([]);
  };

  const handleSave = async () => {
    const isWindows = sourceType === "windows";
    if (isWindows && !thumbprint) {
      alert("Selecione um certificado do repositório Windows.");
      return;
    }
    if (!isWindows && !certPath) {
      alert("Selecione o arquivo .pfx do certificado.");
      return;
    }

    if (testResult?.info && (testResult.info.isExpired || (testResult.info.daysRemaining !== undefined && testResult.info.daysRemaining <= 0))) {
      if (!confirm("Atenção: O Certificado do Procurador selecionado está VENCIDO / EXPIRADO. Ele não conseguirá autenticar no Portal Nacional ADN para capturar NFS-e.\n\nDeseja salvar mesmo assim para fins de cadastro?")) {
        return;
      }
    }

    const doc = testResult?.info?.extractedCnpj || "";
    const name = testResult?.info?.subject?.split(":")[0]?.trim() || "Procurador Contábil";

    const isCertExpired = Boolean(testResult?.info?.isExpired || (testResult?.info?.daysRemaining !== undefined && testResult.info.daysRemaining <= 0));

    const config: ProcuradorConfig = {
      ativo: true,
      nome: name,
      documento: doc,
      certStore: sourceType,
      certPath: isWindows ? "" : certPath,
      password: isWindows ? "" : password,
      certThumbprint: isWindows ? thumbprint : "",
      padraoNovasEmpresas: padraoNovas,
      certInfo: testResult?.info
        ? {
            subject: testResult.info.subject,
            issuer: testResult.info.issuer,
            validTo: testResult.info.validTo ? new Date(testResult.info.validTo).toISOString() : "",
            daysRemaining: testResult.info.daysRemaining || 0,
            isExpired: isCertExpired,
          }
        : undefined,
    };

    try {
      const res = await saveProcuradorConfig(config);
      if (!res.success) {
        alert(res.error || "Erro ao salvar certificado do procurador.");
        return;
      }

      onUpdateProcuradorConfig(config);

      // Atualiza as empresas com usarProcuradorNfse
      const updatedEmpresas = empresas.map((emp) => {
        const isLinked = selectedEmpresaIds.includes(emp.id);
        return {
          ...emp,
          usarProcuradorNfse: isLinked,
        };
      });

      onSaveEmpresas(updatedEmpresas);
      onNotify(
        `Certificado do Procurador (${name}) ativado e vinculado a ${selectedEmpresaIds.length} empresa(s)!`,
        "success"
      );
      onClose();
    } catch (e: any) {
      alert("Falha ao salvar: " + e.message);
    }
  };

  const handleDesvincular = async () => {
    if (!confirm("Deseja realmente remover o Certificado do Procurador e desvincular todas as empresas?")) {
      return;
    }

    try {
      await saveProcuradorConfig(null);
      onUpdateProcuradorConfig(null);

      const updatedEmpresas = empresas.map((emp) => ({
        ...emp,
        usarProcuradorNfse: false,
      }));

      onSaveEmpresas(updatedEmpresas);
      onNotify("Certificado do Procurador removido com sucesso.", "success");
      onClose();
    } catch (e: any) {
      alert("Erro ao desvincular: " + e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 select-none">
      <style>{`
        .vb-groupbox {
          border: 1px solid #c0c0c0;
          border-radius: 2px;
          position: relative;
          margin-top: 8px;
        }
        .vb-legend {
          font-size: 11px;
          font-weight: bold;
          color: #003366;
          padding: 0 6px;
          margin-left: 8px;
        }
        .vb-btn {
          background: linear-gradient(180deg, #ffffff 0%, #f4f4f4 50%, #e6e6e6 100%);
          border: 1px solid #7a7a7a;
          border-radius: 2px;
          padding: 4px 10px;
          font-size: 11px;
          font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, Arial, sans-serif;
          color: #000000;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.06);
          white-space: nowrap;
          transition: all 0.08s ease-in-out;
          user-select: none;
        }
        .vb-btn:hover {
          background: linear-gradient(180deg, #fbfdff 0%, #e8f1fc 50%, #d8e6f8 100%);
          border-color: #005a9e;
          color: #003366;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 3px rgba(0,90,158,0.18);
        }
        .vb-btn:active {
          background: #d4d4d4 !important;
          border-color: #444444 !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.25) !important;
          transform: translateY(1px) scale(0.98);
        }
        .vb-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
          background: #ececec !important;
          border-color: #b8b8b8 !important;
          color: #777777 !important;
          box-shadow: none !important;
          transform: none !important;
        }
        .vb-btn-primary {
          background: linear-gradient(180deg, #0066b3 0%, #004578 100%);
          border: 1px solid #002e50;
          font-weight: 600;
          color: #ffffff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(0,0,0,0.2);
        }
        .vb-btn-primary:hover {
          background: linear-gradient(180deg, #0078d4 0%, #005a9e 100%);
          border-color: #001f38;
          color: #ffffff !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 2px 4px rgba(0,90,158,0.25);
        }
        .vb-btn-primary:active {
          background: #003862 !important;
          border-color: #00182b !important;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.4) !important;
          transform: translateY(1px) scale(0.98);
        }
        .vb-btn-danger {
          background: linear-gradient(180deg, #fff5f5 0%, #fed7d7 100%);
          border: 1px solid #c53030;
          color: #742a2a;
        }
        .vb-btn-danger:hover {
          background: linear-gradient(180deg, #fee2e2 0%, #fca5a5 100%);
          border-color: #9b2c2c;
          color: #63171b;
        }
        .vb-btn-danger:active {
          background: #f87171 !important;
          border-color: #7f1d1d !important;
          transform: translateY(1px) scale(0.98);
        }
      `}</style>

      <div className="w-full max-w-4xl bg-[#f0f0f0] border-2 border-[#003366] shadow-2xl flex flex-col max-h-[92vh] text-[#000000] font-sans text-[11px]">
        {/* Titlebar Classic WinForms */}
        <div className="bg-gradient-to-r from-[#003366] to-[#005a9e] text-white px-3 py-1.5 flex items-center justify-between font-bold text-[12px] shrink-0">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-amber-300" />
            <span>Gerenciador de Certificado do Procurador / Contador (Procuração Eletrônica)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-rose-600 px-2 py-0.5 rounded-xs transition text-white font-bold"
            title="Fechar Janela"
          >
            ✕
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-[#e6f2ff] border-b border-[#b8d4f6] px-3 py-2 flex items-start gap-2.5 shrink-0 text-[#003366]">
          <Award size={18} className="shrink-0 text-[#005a9e] mt-0.5" />
          <div className="leading-tight">
            <strong className="block text-[12px]">Captação Automatizada de NFS-e via Procuração Eletrônica (Portal Nacional ADN)</strong>
            <span className="text-[11px] text-[#335577]">
              Cadastre o seu <strong>e-CPF</strong> ou <strong>e-CNPJ</strong> contábil para consultar automaticamente as notas fiscais de serviços tomados e prestados via <strong>Portal Nacional ADN</strong> de todos os clientes que outorgaram procuração ao seu escritório. <em>(Atenção: a consulta via procuração opera exclusivamente pelo padrão nacional, sem busca em prefeituras municipais).</em>
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          
          {/* SEÇÃO 1: ORIGEM DO CERTIFICADO */}
          <fieldset className="vb-groupbox bg-white p-3">
            <legend className="vb-legend flex items-center gap-1 font-bold text-[#003366]">
              <ShieldCheck size={13} className="text-[#005a9e]" />
              <span>1. Origem do Certificado Digital do Contador</span>
            </legend>

            {/* Radio Tabs */}
            <div className="flex items-center gap-4 mb-3 pb-2 border-b border-[#e5e5e5]">
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[11px]">
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === "windows"}
                  onChange={() => setSourceType("windows")}
                  className="accent-[#003366]"
                />
                <span>Repositório do Windows (Certificados Instalados - CurrentUser\My)</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-[11px]">
                <input
                  type="radio"
                  name="sourceType"
                  checked={sourceType === "file"}
                  onChange={() => setSourceType("file")}
                  className="accent-[#003366]"
                />
                <span>Arquivo .PFX / .P12 em Disco ou Rede</span>
              </label>
            </div>

            {/* ABA WINDOWS STORE */}
            {sourceType === "windows" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="relative flex-1">
                    <Search size={13} className="absolute left-2 top-2 text-[#777777]" />
                    <input
                      type="text"
                      value={installedFilter}
                      onChange={(e) => setInstalledFilter(e.target.value)}
                      placeholder="Filtrar por Nome, CPF, CNPJ, Certificadora ou Thumbprint..."
                      className="w-full pl-7 pr-2 py-1 text-[11px] border border-[#a0a0a0] rounded-xs bg-[#ffffff]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadWindowsCerts}
                    disabled={loadingInstalled}
                    className="vb-btn active:scale-95 active:translate-y-0.5 transition-all text-[11px] py-1 px-3"
                    title="Recarregar lista de certificados instalados no Windows"
                  >
                    <RotateCw size={12} className={loadingInstalled ? "animate-spin" : ""} />
                    <span>Atualizar</span>
                  </button>
                </div>

                {/* Grid de Certificados Instalados */}
                <div className="border border-[#b0b0b0] bg-[#fafafa] max-h-44 overflow-y-auto">
                  {loadingInstalled ? (
                    <div className="p-4 text-center text-[#666666] italic">
                      Lendo certificados do Windows...
                    </div>
                  ) : filteredInstalledCerts.length === 0 ? (
                    <div className="p-4 text-center text-[#777777]">
                      Nenhum certificado digital localizado no Windows com o filtro informado.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse text-[10.5px]">
                      <thead className="bg-[#e8e8e8] border-b border-[#c0c0c0] text-[#333333] sticky top-0">
                        <tr>
                          <th className="p-1.5">Sel.</th>
                          <th className="p-1.5">Titular / Razão Social</th>
                          <th className="p-1.5">CPF / CNPJ</th>
                          <th className="p-1.5">Emissor</th>
                          <th className="p-1.5">Validade</th>
                          <th className="p-1.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInstalledCerts.map((cert) => {
                          const isSelected = thumbprint === cert.Thumbprint;
                          const cleanDoc = (cert.Documento || "").replace(/\D/g, "");
                          const formattedDoc =
                            cleanDoc.length === 11
                              ? cleanDoc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
                              : cleanDoc.length === 14
                              ? cleanDoc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                              : cert.Documento;

                          return (
                            <tr
                              key={cert.Thumbprint}
                              onClick={() => handleSelectWindowsCert(cert)}
                              className={`border-b border-[#e5e5e5] cursor-pointer hover:bg-[#dbe8f8] transition ${
                                isSelected ? "bg-[#cbe0f8] font-semibold" : ""
                              }`}
                            >
                              <td className="p-1.5 text-center">
                                <input
                                  type="radio"
                                  name="selectedThumb"
                                  checked={isSelected}
                                  onChange={() => handleSelectWindowsCert(cert)}
                                  className="accent-[#003366]"
                                />
                              </td>
                              <td className="p-1.5 max-w-[240px] truncate" title={cert.Subject}>
                                {cert.CleanName || cert.CommonName}
                              </td>
                              <td className="p-1.5 font-mono">{formattedDoc || "N/D"}</td>
                              <td className="p-1.5 truncate max-w-[140px]" title={cert.Issuer}>
                                {cert.Issuer}
                              </td>
                              <td className="p-1.5">
                                {cert.NotAfter ? new Date(cert.NotAfter).toLocaleDateString("pt-BR") : "N/D"}
                              </td>
                              <td className="p-1.5 text-center">
                                {cert.isExpired || (cert.daysRemaining !== undefined && cert.daysRemaining <= 0) ? (
                                  <span className="text-rose-700 font-bold">Expirado ({Math.abs(cert.daysRemaining || 0)}d)</span>
                                ) : cert.daysRemaining !== undefined && cert.daysRemaining <= 30 ? (
                                  <span className="text-amber-700 font-bold">Expira em {cert.daysRemaining}d</span>
                                ) : (
                                  <span className="text-emerald-700 font-bold">
                                    {cert.daysRemaining} dias
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {/* ABA ARQUIVO PFX */}
            {sourceType === "file" && (
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                    Arquivo do Certificado Digital A1 (.pfx ou .p12):
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        const f = e.dataTransfer.files[0];
                        const pathF = (f as any).path || f.name;
                        setCertPath(pathF);
                        if (password) handleTestFileCert(pathF, password);
                      }
                    }}
                    className={`flex items-center gap-1.5 p-1 border ${
                      isDragging ? "border-[#005a9e] bg-[#e6f2ff]" : "border-[#7a7a7a] bg-white"
                    }`}
                  >
                    <input
                      type="text"
                      value={certPath}
                      onChange={(e) => setCertPath(e.target.value)}
                      placeholder="Selecione o arquivo .pfx ou arraste para este campo..."
                      className="flex-1 bg-transparent text-[11px] font-mono outline-none px-1"
                    />
                    <button
                      type="button"
                      onClick={handleSelectPfxFile}
                      className="vb-btn shrink-0 active:scale-95 active:translate-y-0.5 transition-all text-[11px] py-1 px-3 flex items-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen size={13} className="text-[#005a9e] shrink-0" />
                      <span>Selecionar Arquivo</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                  <div>
                    <label className="block text-[10px] font-bold text-[#333333] mb-0.5">
                      Senha do Arquivo .PFX:
                    </label>
                    <div className="flex items-center border border-[#7a7a7a] bg-white px-1">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Digite a senha..."
                        className="flex-1 bg-transparent text-[11px] font-mono outline-none py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 text-[#666666] hover:text-[#003366]"
                      >
                        {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleTestFileCert()}
                      disabled={testing || !certPath}
                      className="vb-btn vb-btn-primary w-full justify-center active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      {testing ? (
                        <>
                          <RotateCw size={13} className="animate-spin shrink-0" />
                          <span>Validando Senha e Chave...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={13} className="shrink-0" />
                          <span>Testar e Validar Certificado PFX</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Painel de Diagnóstico do Certificado Selecionado */}
            {testResult && testResult.success && testResult.info && (() => {
              const days = testResult.info.daysRemaining ?? 0;
              const isExpired = Boolean(testResult.info.isExpired || days <= 0);
              const isExpiringSoon = !isExpired && days <= 30;

              if (isExpired) {
                const diasVencido = Math.abs(days);
                return (
                  <div className="mt-3 p-2.5 bg-[#fdeaea] border border-[#e57373] text-rose-950 text-[11px] flex items-start gap-2.5 shadow-xs">
                    <AlertTriangle size={18} className="text-rose-700 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <div>
                        <strong className="text-rose-900 font-bold">Certificado do Procurador Vencido / Expirado:</strong>{" "}
                        <span className="font-semibold text-rose-950">
                          {testResult.info.subject?.split(":")[0] || testResult.info.subject}
                        </span>
                      </div>
                      <div className="text-[10px] text-rose-800 mt-1 font-mono">
                        Documento: <strong>{testResult.info.extractedCnpj || "Identificado no Certificado"}</strong> | Validade expirou em:{" "}
                        <strong>{formatDateBr(testResult.info.validTo)}</strong>{" "}
                        <span className="font-bold">({diasVencido === 0 ? "Venceu hoje" : `Vencido há ${diasVencido} dias`})</span>
                      </div>
                      <div className="text-[10px] text-rose-700 mt-1">
                        ⚠️ <strong>Atenção:</strong> Este certificado perdeu a validade e será rejeitado pela RFB e pelo Portal Nacional ADN. Providencie a renovação do certificado A1.
                      </div>
                    </div>
                  </div>
                );
              }

              if (isExpiringSoon) {
                return (
                  <div className="mt-3 p-2.5 bg-[#fff8e6] border border-[#f5c26b] text-amber-950 text-[11px] flex items-start gap-2.5 shadow-xs">
                    <AlertTriangle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="leading-tight">
                      <div>
                        <strong className="text-amber-900 font-bold">Certificado do Procurador Próximo do Vencimento:</strong>{" "}
                        <span className="font-semibold text-amber-950">
                          {testResult.info.subject?.split(":")[0] || testResult.info.subject}
                        </span>
                      </div>
                      <div className="text-[10px] text-amber-800 mt-1 font-mono">
                        Documento: <strong>{testResult.info.extractedCnpj || "Identificado no Certificado"}</strong> | Validade:{" "}
                        <strong>{formatDateBr(testResult.info.validTo)}</strong> ({days} dias restantes)
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="mt-3 p-2.5 bg-[#eaf7ea] border border-[#7bc97b] text-emerald-950 text-[11px] flex items-center gap-2.5 shadow-xs">
                  <CheckCircle2 size={18} className="text-emerald-700 shrink-0" />
                  <div className="leading-tight">
                    <div>
                      <strong className="text-emerald-900 font-bold">Certificado Operacional:</strong>{" "}
                      <span className="font-semibold text-emerald-900">
                        {testResult.info.subject?.split(":")[0] || testResult.info.subject}
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-800 mt-0.5 font-mono">
                      Documento: <strong>{testResult.info.extractedCnpj || "Identificado no Certificado"}</strong> | Validade:{" "}
                      <strong>{formatDateBr(testResult.info.validTo)}</strong> ({days} dias restantes)
                    </div>
                  </div>
                </div>
              );
            })()}

            {testResult && !testResult.success && testResult.error && (
              <div className="mt-3 p-2 bg-[#fdeaea] border border-[#e57373] text-rose-950 text-[11px] flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-700 shrink-0" />
                <div>
                  <strong>Falha na validação:</strong> {testResult.error}
                </div>
              </div>
            )}
          </fieldset>

          {/* SEÇÃO 2: VINCULAÇÃO EM LOTE DAS EMPRESAS */}
          <fieldset className="vb-groupbox bg-white p-3">
            <legend className="vb-legend flex items-center gap-1 font-bold text-[#003366]">
              <Building2 size={13} className="text-[#005a9e]" />
              <span>2. Empresas Vinculadas para Captação de NFS-e via Procuração (Portal Nacional ADN)</span>
            </legend>

            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectAllEmpresas}
                  className="vb-btn active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-3 text-[11px] font-semibold text-[#003366] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Marcar todas as empresas cadastradas"
                >
                  <CheckSquare size={13} className="text-[#005a9e] shrink-0" />
                  <span>Marcar Todas ({empresas.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectWithoutCert}
                  className="vb-btn active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-3 text-[11px] font-semibold text-[#8a2400] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Marcar apenas empresas que não possuem certificado próprio configurado"
                >
                  <ShieldCheck size={13} className="text-[#d83b01] shrink-0" />
                  <span>Apenas Sem Certificado Próprio ({empresasSemCertCount})</span>
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="vb-btn active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-3 text-[11px] font-semibold text-[#555555] flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="Desmarcar todas as empresas"
                >
                  <Square size={13} className="text-[#777777] shrink-0" />
                  <span>Desmarcar Todas</span>
                </button>
              </div>

              <div className="relative w-48 sm:w-60">
                <Search size={12} className="absolute left-2 top-2 text-[#777777]" />
                <input
                  type="text"
                  value={empresaSearch}
                  onChange={(e) => setEmpresaSearch(e.target.value)}
                  placeholder="Buscar empresa..."
                  className="w-full pl-6 pr-2 py-0.5 text-[11px] border border-[#a0a0a0] rounded-xs"
                />
              </div>
            </div>

            {/* Grid de Empresas */}
            <div className="border border-[#b0b0b0] bg-[#fafafa] max-h-48 overflow-y-auto">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead className="bg-[#e8e8e8] border-b border-[#c0c0c0] text-[#333333] sticky top-0">
                  <tr>
                    <th className="p-1.5 w-8 text-center">Vínculo</th>
                    <th className="p-1.5">Razão Social da Empresa</th>
                    <th className="p-1.5">CNPJ</th>
                    <th className="p-1.5">Certificado Próprio Atual</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmpresas.map((emp) => {
                    const isChecked = selectedEmpresaIds.includes(emp.id);
                    const cleanC = (emp.cnpj || "").replace(/\D/g, "");
                    const formattedCnpj =
                      cleanC.length === 14
                        ? cleanC.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                        : emp.cnpj;

                    const hasOwnCert = Boolean(emp.certPath || (emp.certStore === "windows" && emp.certThumbprint));

                    return (
                      <tr
                        key={emp.id}
                        onClick={() => handleToggleEmpresa(emp.id)}
                        className={`border-b border-[#e5e5e5] cursor-pointer hover:bg-[#dbe8f8] transition ${
                          isChecked ? "bg-[#e2edf8] font-semibold" : ""
                        }`}
                      >
                        <td className="p-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleEmpresa(emp.id)}
                            className="accent-[#003366] cursor-pointer"
                          />
                        </td>
                        <td className="p-1.5 max-w-[280px] truncate" title={emp.razaoSocial}>
                          {emp.razaoSocial}
                        </td>
                        <td className="p-1.5 font-mono">{formattedCnpj}</td>
                        <td className="p-1.5">
                          {hasOwnCert ? (
                            <span className="text-emerald-700 text-[10px]">Possui Certificado Próprio</span>
                          ) : (
                            <span className="text-[#888888] text-[10px] italic">Sem Certificado Próprio</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-[#444444]">
              <span>
                <strong>{selectedEmpresaIds.length}</strong> de <strong>{empresas.length}</strong> empresa(s) vinculada(s) para busca de NFS-e via procuração no Portal Nacional ADN.
              </span>

              <label className="flex items-center gap-1.5 cursor-pointer select-none text-[#003366] font-semibold">
                <input
                  type="checkbox"
                  checked={padraoNovas}
                  onChange={(e) => setPadraoNovas(e.target.checked)}
                  className="accent-[#003366]"
                />
                <span>Vincular automaticamente novas empresas cadastradas</span>
              </label>
            </div>
          </fieldset>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#e0e0e0] border-t border-[#b0b0b0] px-4 py-2.5 flex items-center justify-between shrink-0">
          <div>
            {procuradorConfig?.ativo && (
              <button
                type="button"
                onClick={handleDesvincular}
                className="vb-btn vb-btn-danger active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
                title="Desvincular o certificado do procurador e desmarcar empresas"
              >
                <Trash2 size={13} className="shrink-0 text-rose-700" />
                <span>Desvincular / Remover Procurador</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="vb-btn active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-4 text-[11.5px] font-semibold text-[#333333] cursor-pointer shadow-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="vb-btn vb-btn-primary active:scale-95 active:translate-y-0.5 transition-all py-1.5 px-5 text-[11.5px] font-bold text-white cursor-pointer shadow-sm flex items-center gap-2"
            >
              <CheckCircle2 size={14} className="text-white shrink-0" />
              <span>Salvar Configurações do Procurador</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
