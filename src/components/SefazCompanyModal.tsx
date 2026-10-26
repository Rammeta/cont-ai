import React, { useState } from "react";
import { EmpresaSefaz, RegimeDestinatario } from "../types";
import { Building2, X, Plus, Trash2, KeyRound, CheckCircle2, AlertTriangle, ShieldCheck, FolderOpen, Search, UploadCloud, FileKey, Layers, ShoppingBag, Landmark, FileText } from "lucide-react";
import { selectCertFile, testCert, listNetworkCerts, NetworkCertItem } from "../utils/electronBridge";
import CertificateBadge from "./CertificateBadge";
import { formatDateBr } from "../utils/certUtils";

interface SefazCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  empresas: EmpresaSefaz[];
  onSaveEmpresas: (empresas: EmpresaSefaz[]) => void;
  activeEmpresaId: string | null;
  onSelectEmpresa: (id: string) => void;
}

export default function SefazCompanyModal({
  isOpen,
  onClose,
  empresas,
  onSaveEmpresas,
  activeEmpresaId,
  onSelectEmpresa,
}: SefazCompanyModalProps) {
  const [editingCompany, setEditingCompany] = useState<Partial<EmpresaSefaz> | null>(null);
  const [testingStatus, setTestingStatus] = useState<{
    loading: boolean;
    success?: boolean;
    info?: any;
    error?: string;
  }>({ loading: false });

  // Estados para Drag & Drop e Busca de Certificados na Rede
  const [isDragging, setIsDragging] = useState(false);
  const [networkCerts, setNetworkCerts] = useState<NetworkCertItem[]>([]);
  const [loadingNetworkCerts, setLoadingNetworkCerts] = useState(false);
  const [isNetworkModalOpen, setIsNetworkModalOpen] = useState(false);
  const [networkSearchTerm, setNetworkSearchTerm] = useState("");
  const [networkCertDir, setNetworkCertDir] = useState("");

  if (!isOpen) return null;

  const handleStartNew = () => {
    setEditingCompany({
      id: "emp_" + Date.now(),
      razaoSocial: "",
      cnpj: "",
      uf: "SP",
      regime: "simples",
      certPath: "",
      password: "",
      ambiente: 1,
      modelosHabilitados: {
        nfe: true,
        nfce: false,
        nfse: true,
      },
    });
    setTestingStatus({ loading: false });
  };

  const handleToggleModel = (empId: string, model: 'nfe' | 'nfce' | 'nfse') => {
    const updated = empresas.map((e) => {
      if (e.id !== empId) return e;
      const current = e.modelosHabilitados || { nfe: true, nfce: false, nfse: true };
      const currentVal = current[model] !== false;
      return {
        ...e,
        modelosHabilitados: {
          ...current,
          [model]: !currentVal,
        },
      };
    });
    onSaveEmpresas(updated);
  };

  const autoDetectAndTestCert = async (certPath: string, password: string) => {
    if (!certPath) return;
    setTestingStatus({ loading: true });
    try {
      const res = await testCert(certPath, password);
      if (res.success && res.info) {
        setTestingStatus({ loading: false, success: true, info: res.info });
        const cleanSubject = res.info.subject ? res.info.subject.split(":")[0].trim() : "";
        const cleanCnpj = res.info.extractedCnpj || "";
        setEditingCompany((prev) => {
          if (!prev) return null;
          const currentName = prev.razaoSocial || "";
          const isNumericOrCnpj = !currentName || currentName.replace(/\D/g, "") === (prev.cnpj || "").replace(/\D/g, "");
          return {
            ...prev,
            certPath,
            password,
            razaoSocial: isNumericOrCnpj && cleanSubject ? cleanSubject : currentName,
            cnpj: cleanCnpj || prev.cnpj,
            certInfo: {
              subject: res.info.subject,
              issuer: res.info.issuer,
              validTo: res.info.validTo ? new Date(res.info.validTo).toISOString() : "",
              daysRemaining: res.info.daysRemaining,
              isExpired: res.info.isExpired,
            },
          };
        });
      } else {
        setTestingStatus({
          loading: false,
          success: false,
          error: password ? res.error : "Informe a senha do certificado para validar e preencher os dados.",
        });
      }
    } catch (e: any) {
      setTestingStatus({ loading: false, success: false, error: e.message });
    }
  };

  const handleSelectFile = async () => {
    const file = await selectCertFile(editingCompany?.certPath);
    if (file && editingCompany) {
      const pwdMatch = file.match(/_senha[ _]+([^_]+?)_/i) || file.match(/senha[ _]+([^_.]+)/i);
      const pwd = pwdMatch && !editingCompany.password ? pwdMatch[1].trim() : (editingCompany.password || "");
      setEditingCompany({
        ...editingCompany,
        certPath: file,
        password: pwd,
      });
      await autoDetectAndTestCert(file, pwd);
    }
  };

  const handleOpenNetworkCerts = async () => {
    setLoadingNetworkCerts(true);
    setIsNetworkModalOpen(true);
    try {
      const res = await listNetworkCerts();
      if (res.success && res.certs) {
        setNetworkCerts(res.certs);
        setNetworkCertDir(res.dir || "");
        if (editingCompany?.razaoSocial) {
          const firstWord = editingCompany.razaoSocial.trim().split(" ")[0];
          if (firstWord.length > 2) {
            setNetworkSearchTerm(firstWord);
          }
        }
      } else {
        alert(res.error || "Não foi possível carregar os certificados da pasta de rede.");
      }
    } catch (e: any) {
      alert("Erro ao acessar certificados de rede: " + e.message);
    } finally {
      setLoadingNetworkCerts(false);
    }
  };

  const handleSelectNetworkCert = (item: NetworkCertItem) => {
    if (editingCompany) {
      const pwd = item.extractedPassword || editingCompany.password || "";
      setEditingCompany({
        ...editingCompany,
        certPath: item.fullPath,
        password: pwd,
      });
      autoDetectAndTestCert(item.fullPath, pwd);
    }
    setIsNetworkModalOpen(false);
  };

  const handleTestCert = async () => {
    if (editingCompany?.certStore === "windows" && editingCompany?.certThumbprint) {
      setTestingStatus({ loading: true });
      try {
        const res = await testCert({ certStore: "windows", thumbprint: editingCompany.certThumbprint });
        if (res.success) {
          setTestingStatus({ loading: false, success: true, info: res.info });
        } else {
          setTestingStatus({ loading: false, success: false, error: res.error });
        }
      } catch (e: any) {
        setTestingStatus({ loading: false, success: false, error: e.message });
      }
      return;
    }
    if (!editingCompany?.certPath) {
      alert("Selecione o arquivo do certificado primeiro.");
      return;
    }
    await autoDetectAndTestCert(editingCompany.certPath, editingCompany.password || "");
  };

  const handleSaveCompany = () => {
    if (!editingCompany) return;
    const cleanCnpj = (editingCompany.cnpj || "").replace(/\D/g, "");
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      alert("Informe um CNPJ válido com 14 dígitos.");
      return;
    }
    if (!editingCompany.razaoSocial) {
      alert("Informe a Razão Social da empresa.");
      return;
    }
    const hasValidCert = Boolean((editingCompany.certStore === "windows" && editingCompany.certThumbprint) || editingCompany.certPath);
    if (!hasValidCert) {
      alert("Selecione o certificado digital A1 (Arquivo ou Windows).");
      return;
    }

    let finalRazaoSocial = editingCompany.razaoSocial.trim();
    if (finalRazaoSocial.replace(/\D/g, "") === cleanCnpj && testingStatus.info?.subject) {
      finalRazaoSocial = testingStatus.info.subject.split(":")[0].trim();
    }

    const companyToSave: EmpresaSefaz = {
      id: editingCompany.id || "emp_" + Date.now(),
      razaoSocial: finalRazaoSocial,
      cnpj: cleanCnpj,
      uf: (editingCompany.uf || "SP").toUpperCase(),
      regime: (editingCompany.regime as RegimeDestinatario) || "simples",
      certPath: editingCompany.certPath || "",
      password: editingCompany.password || "",
      ambiente: Number(editingCompany.ambiente) || 1,
      certStore: editingCompany.certStore || (editingCompany.certThumbprint ? "windows" : "file"),
      certThumbprint: editingCompany.certThumbprint || "",
      certInfo: testingStatus.info ? {
        subject: testingStatus.info.subject,
        issuer: testingStatus.info.issuer,
        validTo: testingStatus.info.validTo ? new Date(testingStatus.info.validTo).toISOString() : "",
        daysRemaining: testingStatus.info.daysRemaining,
        isExpired: testingStatus.info.isExpired
      } : editingCompany.certInfo
    };

    const exists = empresas.some((e) => e.id === companyToSave.id);
    let updated: EmpresaSefaz[];
    if (exists) {
      updated = empresas.map((e) => (e.id === companyToSave.id ? companyToSave : e));
    } else {
      updated = [...empresas, companyToSave];
    }

    onSaveEmpresas(updated);
    if (!activeEmpresaId || activeEmpresaId === companyToSave.id) {
      onSelectEmpresa(companyToSave.id);
    }
    setEditingCompany(null);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Deseja realmente remover a empresa "${name}" do sistema?`)) {
      const updated = empresas.filter((e) => e.id !== id);
      onSaveEmpresas(updated);
      if (activeEmpresaId === id) {
        onSelectEmpresa(updated.length > 0 ? updated[0].id : "");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-800">
                Gerenciador de Empresas & Certificados SEFAZ
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Cadastre suas empresas optantes pelo Simples Nacional para automação de NF-e e DIFAL
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-slate-200 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4 sm:gap-6">
          {editingCompany ? (
            /* Form Cadastro/Edição */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <KeyRound size={16} className="text-blue-600" />
                  {empresas.some((e) => e.id === editingCompany.id) ? "Editar Empresa" : "Nova Empresa"}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Voltar à lista
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Razão Social / Nome da Empresa *
                  </label>
                  <input
                    type="text"
                    value={editingCompany.razaoSocial || ""}
                    onChange={(e) => setEditingCompany({ ...editingCompany, razaoSocial: e.target.value })}
                    placeholder="Ex: EMPRESA EXEMPLO COMERCIO LTDA"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    CNPJ da Empresa (14 dígitos) *
                  </label>
                  <input
                    type="text"
                    value={editingCompany.cnpj || ""}
                    onChange={(e) => setEditingCompany({ ...editingCompany, cnpj: e.target.value })}
                    placeholder="Ex: 00000000000191"
                    maxLength={18}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    UF do Destinatário *
                  </label>
                  <select
                    value={editingCompany.uf || "SP"}
                    onChange={(e) => setEditingCompany({ ...editingCompany, uf: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Regime Tributário do Destinatário
                  </label>
                  <select
                    value={editingCompany.regime || "simples"}
                    onChange={(e) => setEditingCompany({ ...editingCompany, regime: e.target.value as RegimeDestinatario })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="simples">Simples Nacional (Optante)</option>
                    <option value="normal">Regime Normal (Lucro Presumido / Real)</option>
                    <option value="outro">Outro / MEI</option>
                  </select>
                </div>
              </div>

              {/* Certificado e Senha com Drag & Drop e Busca na Rede */}
              <div className="border-t border-slate-200 pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Certificado Digital A1 (.pfx ou .p12) *
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">
                    Arraste o arquivo ou selecione abaixo
                  </span>
                </div>

                {/* Dropzone & Input do Certificado */}
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
                      const file = e.dataTransfer.files[0];
                      const filePath = (file as any).path || file.name;
                      const pwdMatch = filePath.match(/_senha[ _]+([^_]+?)_/i) || filePath.match(/senha[ _]+([^_.]+)/i);
                      const pwd = pwdMatch && (!editingCompany || !editingCompany.password) ? pwdMatch[1].trim() : (editingCompany?.password || "");
                      setEditingCompany((prev) =>
                        prev
                          ? {
                              ...prev,
                              certPath: filePath,
                              password: pwd,
                            }
                          : null
                      );
                      autoDetectAndTestCert(filePath, pwd);
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/60 border-dashed scale-[0.99]"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={editingCompany.certPath || ""}
                      onChange={(e) => {
                        const newPath = e.target.value;
                        const pwdMatch = newPath.match(/_senha[ _]+([^_]+?)_/i) || newPath.match(/senha[ _]+([^_.]+)/i);
                        setEditingCompany({
                          ...editingCompany,
                          certPath: newPath,
                          password: pwdMatch && !editingCompany.password ? pwdMatch[1].trim() : editingCompany.password,
                        });
                        setTestingStatus({ loading: false });
                      }}
                      placeholder="Cole o caminho do arquivo .pfx ou arraste para cá..."
                      className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                    />

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleOpenNetworkCerts}
                        className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all whitespace-nowrap"
                        title="Buscar nos 237 certificados da pasta de rede Pasta de Rede"
                      >
                        <FileKey size={14} />
                        Buscar na Rede
                      </button>

                      <button
                        type="button"
                        onClick={handleSelectFile}
                        className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors whitespace-nowrap"
                        title="Abrir janela de arquivos do Windows"
                      >
                        <FolderOpen size={14} className="text-blue-600" />
                        Procurar...
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1 font-medium">
                    <UploadCloud size={12} className="text-blue-500" />
                    Você também pode arrastar o arquivo <strong>.pfx</strong> do Windows Explorer diretamente para este campo.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Senha do Certificado
                    </label>
                    <input
                      type="password"
                      value={editingCompany.password || ""}
                      onChange={(e) => setEditingCompany({ ...editingCompany, password: e.target.value })}
                      placeholder="Senha do arquivo .pfx"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={(!editingCompany.certPath && (editingCompany.certStore !== "windows" || !editingCompany.certThumbprint)) || testingStatus.loading}
                      onClick={handleTestCert}
                      className="w-full px-4 py-2 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ShieldCheck size={16} />
                      {testingStatus.loading ? "Validando..." : "Testar Validade do Certificado"}
                    </button>
                  </div>
                </div>

                {/* Status do teste */}
                {testingStatus.success && testingStatus.info && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Certificado Válido!
                    </div>
                    <div>Titular: <strong>{testingStatus.info.subject}</strong></div>
                    <div>Validade: {formatDateBr(testingStatus.info.validTo)} ({testingStatus.info.daysRemaining} dias restantes)</div>
                  </div>
                )}

                {/* Painel de Habilitação de Modelos */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                    <Layers size={15} className="text-blue-600" />
                    <span>Modelos de Notas Fiscais Habilitados para Captação</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Selecione quais tipos de documentos esta empresa opera para otimizar as buscas e não desperdiçar tempo em modelos não emitidos:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-1">
                    {/* NF-e 55 */}
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      editingCompany.modelosHabilitados?.nfe !== false
                        ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/40"
                        : "bg-white border-slate-200 opacity-60"
                    }`}>
                      <input
                        type="checkbox"
                        checked={editingCompany.modelosHabilitados?.nfe !== false}
                        onChange={(e) => {
                          setEditingCompany({
                            ...editingCompany,
                            modelosHabilitados: {
                              ...editingCompany.modelosHabilitados,
                              nfe: e.target.checked,
                            },
                          });
                        }}
                        className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <FileText size={13} className="text-emerald-600" />
                          <span>NF-e (Mod. 55)</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Entradas / Fornecedores</div>
                      </div>
                    </label>

                    {/* NFC-e 65 */}
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      editingCompany.modelosHabilitados?.nfce === true || (editingCompany.modelosHabilitados?.nfce !== false && (editingCompany.razaoSocial?.includes('GAS')))
                        ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-400/40"
                        : "bg-white border-slate-200 opacity-60"
                    }`}>
                      <input
                        type="checkbox"
                        checked={editingCompany.modelosHabilitados?.nfce === true || (editingCompany.modelosHabilitados?.nfce !== false && (editingCompany.razaoSocial?.includes('GAS')))}
                        onChange={(e) => {
                          setEditingCompany({
                            ...editingCompany,
                            modelosHabilitados: {
                              ...editingCompany.modelosHabilitados,
                              nfce: e.target.checked,
                            },
                          });
                        }}
                        className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <ShoppingBag size={13} className="text-blue-600" />
                          <span>NFC-e (Mod. 65)</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Saídas ao Consumidor (SP)</div>
                      </div>
                    </label>

                    {/* NFS-e */}
                    <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      editingCompany.modelosHabilitados?.nfse !== false
                        ? "bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400/40"
                        : "bg-white border-slate-200 opacity-60"
                    }`}>
                      <input
                        type="checkbox"
                        checked={editingCompany.modelosHabilitados?.nfse !== false}
                        onChange={(e) => {
                          setEditingCompany({
                            ...editingCompany,
                            modelosHabilitados: {
                              ...editingCompany.modelosHabilitados,
                              nfse: e.target.checked,
                            },
                          });
                        }}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                          <Landmark size={13} className="text-indigo-600" />
                          <span>NFS-e (Serviços)</span>
                        </div>
                        <div className="text-[10px] text-slate-500">Portal Nacional & SP</div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Ações do formulário */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveCompany}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow-xs transition-colors"
                >
                  Salvar Empresa
                </button>
              </div>
            </div>
          ) : (
            /* Lista de Empresas Cadastradas */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">
                  Empresas Cadastradas ({empresas.length})
                </span>
                <button
                  type="button"
                  onClick={handleStartNew}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Plus size={16} />
                  Adicionar Nova Empresa
                </button>
              </div>

              {empresas.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                  Nenhuma empresa cadastrada ainda. Clique no botão acima para adicionar sua primeira empresa com certificado digital.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {empresas.map((emp) => {
                    const isActive = emp.id === activeEmpresaId;
                    return (
                      <div
                        key={emp.id}
                        className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isActive
                            ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-400"
                            : "bg-white border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg mt-0.5 ${isActive ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-slate-800">
                                {emp.razaoSocial}
                              </h4>
                              {isActive && (
                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                                  Ativa
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500 font-medium mt-0.5">
                              CNPJ: <strong className="text-slate-700">{emp.cnpj}</strong> | UF: {emp.uf} | Regime:{" "}
                              <span className="text-blue-700 font-semibold">{emp.regime === "simples" ? "Simples Nacional" : "Normal"}</span>
                            </div>
                            {emp.certInfo && (
                              <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>Certificado: {emp.certInfo.subject.split(":")[0]}</span>
                                <span>•</span>
                                <CertificateBadge certInfo={emp.certInfo} compact />
                                <span>•</span>
                                <span className="text-slate-500 font-medium">
                                  Válido até: {formatDateBr(emp.certInfo.validTo)}
                                </span>
                              </div>
                            )}

                            {/* Modelos Habilitados: badges com clique rápido */}
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-0.5">
                                Modelos:
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleModel(emp.id, 'nfe');
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                                  emp.modelosHabilitados?.nfe !== false
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                    : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70 hover:opacity-100"
                                }`}
                                title="Clique para alternar habilitação de NF-e (55)"
                              >
                                <FileText size={10} />
                                <span>NF-e (55)</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleModel(emp.id, 'nfce');
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                                  emp.modelosHabilitados?.nfce === true || (emp.modelosHabilitados?.nfce !== false && (emp.razaoSocial?.includes('GAS')))
                                    ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                                    : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70 hover:opacity-100"
                                }`}
                                title="Clique para alternar habilitação de NFC-e (65)"
                              >
                                <ShoppingBag size={10} />
                                <span>NFC-e (65)</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleModel(emp.id, 'nfse');
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-extrabold border transition-all cursor-pointer flex items-center gap-1 ${
                                  emp.modelosHabilitados?.nfse !== false
                                    ? "bg-indigo-50 text-indigo-700 border-indigo-300 hover:bg-indigo-100"
                                    : "bg-slate-100 text-slate-400 border-slate-200 line-through opacity-70 hover:opacity-100"
                                }`}
                                title="Clique para alternar habilitação de NFS-e"
                              >
                                <Landmark size={10} />
                                <span>NFS-e</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end md:self-center">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => onSelectEmpresa(emp.id)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                              Selecionar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCompany(emp);
                              setTestingStatus({ loading: false });
                            }}
                            className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(emp.id, emp.razaoSocial)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Remover Empresa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors"
          >
            Concluir e Fechar
          </button>
        </div>
      </div>

      {/* MODAL DE SELEÇÃO DE CERTIFICADOS DA REDE (Pasta de Rede) */}
      {isNetworkModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 rounded-xl">
                  <FileKey size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">
                    Certificados Digitais na Rede
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {networkCertDir || "Pasta de Rede"} ({networkCerts.length} certificados disponíveis)
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNetworkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={networkSearchTerm}
                  onChange={(e) => setNetworkSearchTerm(e.target.value)}
                  placeholder="Digite para filtrar pelo nome da empresa ou arquivo..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Certificate List */}
            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {loadingNetworkCerts ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Carregando certificados da rede...
                </div>
              ) : networkCerts.filter((c) =>
                  c.name.toLowerCase().includes(networkSearchTerm.toLowerCase())
                ).length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Nenhum certificado encontrado para "{networkSearchTerm}".
                </div>
              ) : (
                networkCerts
                  .filter((c) =>
                    c.name.toLowerCase().includes(networkSearchTerm.toLowerCase())
                  )
                  .map((cert, idx) => (
                    <div
                      key={cert.fullPath || idx}
                      className="py-3 px-2 flex items-center justify-between gap-3 hover:bg-indigo-50/50 rounded-xl transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-950">
                          {cert.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                          {cert.extractedPassword ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-mono font-bold flex items-center gap-1">
                              <KeyRound size={10} />
                              Senha detectada: {cert.extractedPassword}
                            </span>
                          ) : (
                            <span className="text-slate-400">Senha não identificada no nome</span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSelectNetworkCert(cert)}
                        className="px-3 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-700 group-hover:text-white font-bold text-xs rounded-lg transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                      >
                        Usar este
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-100 px-5 py-3 flex justify-between items-center text-xs text-slate-500">
              <span>
                {
                  networkCerts.filter((c) =>
                    c.name.toLowerCase().includes(networkSearchTerm.toLowerCase())
                  ).length
                }{" "}
                de {networkCerts.length} certificado(s)
              </span>
              <button
                type="button"
                onClick={() => setIsNetworkModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold text-xs cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
