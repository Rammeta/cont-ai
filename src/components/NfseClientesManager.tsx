import React, { useState, useEffect } from "react";
import {
  Users,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Search,
  CheckCircle2,
  Building2,
  ChevronRight,
  ExternalLink,
  Phone,
  Mail,
  MapPin
} from "lucide-react";
import { NfseClienteTomador } from "../types";

interface NfseClientesManagerProps {
  clientes: NfseClienteTomador[];
  onSaveClientes: (clientes: NfseClienteTomador[]) => void;
  onNotify?: (text: string, type: "success" | "error") => void;
  onSelectAndEmit?: (cliente: NfseClienteTomador) => void;
  initialSelectedId?: string | null;
}

export default function NfseClientesManager({
  clientes,
  onSaveClientes,
  onNotify,
  onSelectAndEmit,
  initialSelectedId,
}: NfseClientesManagerProps) {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelectedId || (clientes.length > 0 ? clientes[0].id : "novo")
  );
  const [searchFilter, setSearchFilter] = useState("");

  // Formulário do Tomador
  const [cnpjCpf, setCnpjCpf] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [email, setEmail] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState("SP");
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState("");
  const [telefone, setTelefone] = useState("");

  useEffect(() => {
    if (selectedId === "novo") {
      setCnpjCpf("");
      setRazaoSocial("");
      setNomeFantasia("");
      setEmail("");
      setMunicipio("");
      setUf("SP");
      setInscricaoMunicipal("");
      setTelefone("");
    } else {
      const cli = clientes.find((c) => c.id === selectedId);
      if (cli) {
        setCnpjCpf(cli.cnpjCpf || "");
        setRazaoSocial(cli.razaoSocial || "");
        setNomeFantasia(cli.nomeFantasia || "");
        setEmail(cli.email || "");
        setMunicipio(cli.municipio || "");
        setUf(cli.uf || "SP");
        setInscricaoMunicipal(cli.inscricaoMunicipal || "");
        setTelefone(cli.telefone || "");
      }
    }
  }, [selectedId, clientes]);

  const filteredClientes = clientes.filter((c) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      c.razaoSocial.toLowerCase().includes(q) ||
      c.cnpjCpf.toLowerCase().includes(q) ||
      (c.nomeFantasia && c.nomeFantasia.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.municipio && c.municipio.toLowerCase().includes(q))
    );
  });

  const isEditingExisting = selectedId !== "novo";
  const activeCliente = clientes.find((c) => c.id === selectedId);

  const handleStartNew = () => {
    setSelectedId("novo");
  };

  const handleSave = () => {
    if (!cnpjCpf.trim() || !razaoSocial.trim()) {
      if (onNotify) onNotify("Informe o CNPJ/CPF e a Razão Social do Tomador.", "error");
      else alert("Informe o CNPJ/CPF e a Razão Social do Tomador.");
      return;
    }

    const payload: NfseClienteTomador = {
      id: isEditingExisting ? selectedId : "cli_" + Date.now(),
      cnpjCpf: cnpjCpf.trim(),
      razaoSocial: razaoSocial.trim(),
      nomeFantasia: nomeFantasia.trim() || undefined,
      email: email.trim() || undefined,
      municipio: municipio.trim() || undefined,
      uf: uf.trim() || undefined,
      inscricaoMunicipal: inscricaoMunicipal.trim() || undefined,
      telefone: telefone.trim() || undefined,
    };

    let updatedList: NfseClienteTomador[];
    if (isEditingExisting) {
      updatedList = clientes.map((c) => (c.id === selectedId ? payload : c));
      if (onNotify) onNotify(`Tomador "${payload.razaoSocial}" atualizado!`, "success");
    } else {
      updatedList = [...clientes, payload];
      setSelectedId(payload.id);
      if (onNotify) onNotify(`Novo tomador "${payload.razaoSocial}" cadastrado!`, "success");
    }

    onSaveClientes(updatedList);
  };

  const handleRemove = () => {
    if (!isEditingExisting) {
      handleStartNew();
      return;
    }
    const targetCli = clientes.find((c) => c.id === selectedId);
    if (!targetCli) return;

    if (!window.confirm(`Deseja realmente excluir o tomador "${targetCli.razaoSocial}"?`)) {
      return;
    }

    const updatedList = clientes.filter((c) => c.id !== selectedId);
    onSaveClientes(updatedList);
    if (onNotify) onNotify(`Tomador "${targetCli.razaoSocial}" excluído.`, "success");

    if (updatedList.length > 0) {
      setSelectedId(updatedList[0].id);
    } else {
      setSelectedId("novo");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] text-[11px] select-none">
      {/* Sub-Header */}
      <div className="bg-[#e6f0fa] border-b border-[#b8d4f6] px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={13} className="text-[#005a9e]" />
          <span className="font-bold text-[#003366]">Caderno de Tomadores (Clientes Frequentes)</span>
          <span className="text-[#666666] text-[10px]">
            — Cadastre clientes habituais para preenchimento em 1 clique na emissão de novas DPS.
          </span>
        </div>
      </div>

      {/* Master-Detail Split */}
      <div className="flex-1 flex overflow-hidden min-h-[460px]">
        {/* Esquerda: Lista de Clientes */}
        <aside className="w-80 shrink-0 border-r border-[#b0b0b0] bg-[#fafafa] flex flex-col justify-between">
          <div className="p-2 border-b border-[#d0d0d0] bg-[#f0f0f0] flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#333333] flex items-center gap-1">
                <span>Tomadores Cadastrados</span>
                <span className="bg-[#003366] text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  {clientes.length}
                </span>
              </span>

              <button
                type="button"
                onClick={handleStartNew}
                className={`vb-btn font-bold flex items-center gap-1 ${
                  selectedId === "novo" ? "bg-[#dbeafe] border-[#005a9e] text-[#003366]" : "text-[#003366]"
                }`}
              >
                <Plus size={12} className="text-emerald-700" />
                <span>+ Novo Cliente</span>
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por nome, CNPJ ou e-mail..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="vb-input w-full pl-6 text-[10px]"
              />
              <Search size={11} className="absolute left-1.5 top-1.5 text-[#888888]" />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter("")}
                  className="absolute right-1.5 top-1 text-[#888888] hover:text-black font-bold"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Lista de Clientes com Rolagem */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
            {selectedId === "novo" && (
              <div className="p-2 bg-[#dbeafe] border-2 border-[#005a9e] rounded shadow-sm flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 animate-pulse" />
                <div className="flex-1">
                  <div className="font-bold text-[#003366] text-[11px]">Novo Tomador de Serviços</div>
                  <div className="text-[10px] text-[#555555]">Preencha o formulário ao lado para salvar</div>
                </div>
              </div>
            )}

            {filteredClientes.length > 0 ? (
              filteredClientes.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-2 border rounded cursor-pointer transition-all ${
                      isSelected
                        ? "bg-[#dbeafe] border-[#005a9e] shadow-sm text-[#003366]"
                        : "bg-white border-[#d0d0d0] hover:bg-[#f0f4f9] text-[#222222]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="font-bold text-[11px] leading-tight line-clamp-1">
                        {c.razaoSocial}
                      </div>
                      {isSelected && (
                        <ChevronRight size={13} className="text-[#005a9e] shrink-0 mt-0.5" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="font-mono bg-[#f0f0f0] text-[#333333] px-1 py-0.2 rounded border border-[#d0d0d0]">
                        {c.cnpjCpf}
                      </span>
                      {c.uf && (
                        <span className="font-bold text-[#005a9e] bg-[#e8f0fe] px-1 py-0.2 rounded">
                          {c.uf}
                        </span>
                      )}
                    </div>

                    {c.email && (
                      <div className="text-[10px] text-[#666666] truncate mt-1">
                        {c.email}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-[#777777] italic text-[10px]">
                {searchFilter ? "Nenhum cliente encontrado para a busca." : "Nenhum tomador cadastrado. Clique em '+ Novo Cliente' para começar."}
              </div>
            )}
          </div>

          <div className="p-1.5 border-t border-[#d0d0d0] bg-[#e8e8e8] flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handleRemove}
              disabled={!isEditingExisting}
              className="vb-btn text-red-700 hover:text-red-800 disabled:opacity-40 w-full justify-center"
            >
              <Trash2 size={11} />
              <span>Excluir Cliente</span>
            </button>
          </div>
        </aside>

        {/* Direita: Formulário de Ajuste do Cliente */}
        <main className="flex-1 overflow-y-auto p-3 flex flex-col justify-between bg-[#f4f4f4]">
          <div className="flex flex-col gap-2.5">
            <div className="bg-white border border-[#b0b0b0] p-2 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                {isEditingExisting ? (
                  <Building2 size={16} className="text-[#005a9e]" />
                ) : (
                  <Users size={16} className="text-[#005a9e]" />
                )}
                <div>
                  <h2 className="font-bold text-[#003366] text-[12px]">
                    {isEditingExisting
                      ? `Editar Tomador: "${activeCliente?.razaoSocial}"`
                      : "Novo Cadastro de Tomador (Cliente)"}
                  </h2>
                  <span className="text-[10px] text-[#666666]">
                    Dados do cliente para emissão de notas fiscais de serviço e envio de DANFSE/XML.
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {isEditingExisting && onSelectAndEmit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeCliente) onSelectAndEmit(activeCliente);
                    }}
                    className="vb-btn bg-[#e6f4ea] border-emerald-600 text-emerald-800 font-bold"
                    title="Preencher estes dados e ir para Nova Emissão"
                  >
                    <ExternalLink size={11} />
                    <span>Emitir Nota para este Cliente</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  className="vb-btn bg-[#005a9e] border-[#004578] text-white font-bold hover:bg-[#004578]"
                >
                  <Save size={12} className="text-white" />
                  <span>Salvar Tomador</span>
                </button>
              </div>
            </div>

            {/* Campos do Tomador */}
            <fieldset className="vb-groupbox bg-white">
              <legend className="vb-legend flex items-center gap-1">
                <Building2 size={11} />
                <span>Dados Cadastrais do Tomador</span>
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2">
                <div>
                  <label className="block font-bold text-[#003366] mb-0.5">
                    CNPJ ou CPF do Cliente: *
                  </label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00 ou CPF"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                    className="vb-input w-full font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[#003366] mb-0.5">
                    Razão Social ou Nome Completo: *
                  </label>
                  <input
                    type="text"
                    placeholder="Nome empresarial completo ou nome civil"
                    value={razaoSocial}
                    onChange={(e) => setRazaoSocial(e.target.value)}
                    className="vb-input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Nome Fantasia:
                  </label>
                  <input
                    type="text"
                    placeholder="Nome fantasia (se houver)"
                    value={nomeFantasia}
                    onChange={(e) => setNomeFantasia(e.target.value)}
                    className="vb-input w-full"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Inscrição Municipal (IM):
                  </label>
                  <input
                    type="text"
                    placeholder="Inscrição Municipal (se houver)"
                    value={inscricaoMunicipal}
                    onChange={(e) => setInscricaoMunicipal(e.target.value)}
                    className="vb-input w-full font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    E-mail para Envio Automático (XML e DANFSE):
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="financeiro@empresa.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="vb-input w-full pl-6"
                    />
                    <Mail size={11} className="absolute left-1.5 top-2 text-[#888888]" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Telefone / Contato Comercial:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="(11) 98765-4321"
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className="vb-input w-full pl-6"
                    />
                    <Phone size={11} className="absolute left-1.5 top-2 text-[#888888]" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    Município do Tomador:
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      className="vb-input w-full pl-6"
                    />
                    <MapPin size={11} className="absolute left-1.5 top-2 text-[#888888]" />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#333333] mb-0.5">
                    UF do Tomador:
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    value={uf}
                    onChange={(e) => setUf(e.target.value.toUpperCase())}
                    className="vb-input w-20 font-bold uppercase text-center"
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Rodapé */}
          <div className="mt-3 pt-2 border-t border-[#d0d0d0] bg-[#e8e8e8] p-2 flex items-center justify-between">
            <div className="text-[10px] text-[#666666] flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-700" />
              <span>
                {isEditingExisting
                  ? `Tomador "${activeCliente?.razaoSocial}" pronto para preenchimento na DPS.`
                  : "Preencha os dados e clique em Salvar para disponibilizar no seletor de clientes."}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStartNew}
                className="vb-btn"
              >
                <RotateCcw size={11} />
                <span>Novo Cadastro</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="vb-btn bg-[#005a9e] border-[#004578] text-white font-bold hover:bg-[#004578] px-4"
              >
                <Save size={12} className="text-white" />
                <span>Salvar Tomador</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
