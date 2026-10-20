import React, { useRef, useState } from "react";
import { UploadCloud, FileCode, Trash2, Database, AlertCircle } from "lucide-react";

interface DropzoneProps {
  onXMLsLoaded: (files: FileList | File[]) => void;
  onCFOPLoaded: (file: File) => void;
  onClear: () => void;
  hasFiles: boolean;
  cfopCount: number;
}

export default function Dropzone({
  onXMLsLoaded,
  onCFOPLoaded,
  onClear,
  hasFiles,
  cfopCount,
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const xmlInputRef = useRef<HTMLInputElement>(null);
  const cfopInputRef = useRef<HTMLInputElement>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setErrorStatus(null);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const fileListArray = Array.from(files) as File[];
      const xmlFiles = fileListArray.filter((file: File) =>
        file.name.toLowerCase().endsWith(".xml")
      );
      if (xmlFiles.length > 0) {
        onXMLsLoaded(xmlFiles);
      } else {
        setErrorStatus("Apenas arquivos .xml de Notas Fiscais são permitidos.");
      }
    }
  };

  const handleXmlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorStatus(null);
    if (e.target.files && e.target.files.length > 0) {
      onXMLsLoaded(e.target.files);
    }
  };

  const handleCfopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorStatus(null);
    if (e.target.files && e.target.files.length > 0) {
      onCFOPLoaded(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2 text-[11px]">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => xmlInputRef.current?.click()}
        id="dropzone"
        className={`border border-dashed p-4 text-center cursor-pointer transition-colors ${
          isDragOver
            ? "border-[#005a9e] bg-[#eef5fd]"
            : "border-[#808080] bg-[#ffffff] hover:bg-[#f8f9fa]"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-1.5">
          <UploadCloud size={24} className="text-[#005a9e]" />
          <div>
            <p className="font-bold text-[#003366] text-xs">
              Arraste seus arquivos XML de NF-e aqui
            </p>
            <p className="text-[10px] text-[#555555] mt-0.5">
              ou clique para selecionar arquivos do computador (Modelo 55).
            </p>
          </div>
        </div>

        <input
          ref={xmlInputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          className="hidden"
          onChange={handleXmlChange}
          id="xmlInput"
        />
      </div>

      {errorStatus && (
        <div className="bg-[#fdeeed] border border-[#e8a399] text-[#8a1f11] p-1.5 flex items-center gap-1.5 text-[11px]">
          <AlertCircle size={13} className="shrink-0 text-[#8a1f11]" />
          <span>{errorStatus}</span>
        </div>
      )}

      {/* Barra de Ações Rápidas ERP */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => xmlInputRef.current?.click()}
          className="vb-btn vb-btn-primary flex-1 justify-center"
        >
          <FileCode size={12} />
          <span>Selecionar XMLs</span>
        </button>

        <label className="vb-btn flex-1 justify-center cursor-pointer">
          <Database size={12} className="text-[#005a9e]" />
          <span>Mesclar CFOP (JSON)</span>
          <input
            ref={cfopInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleCfopChange}
            id="cfopInput"
          />
        </label>

        {hasFiles && (
          <button
            type="button"
            onClick={onClear}
            className="vb-btn vb-btn-danger"
            id="btnLimpar"
            title="Limpar notas da tela"
          >
            <Trash2 size={12} />
            <span>Limpar</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-[#555555] border-t border-[#d0d0d0] pt-1">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#107c41]"></span>
          <span>Base CFOP ativa: <strong>{cfopCount}</strong> códigos</span>
        </span>
      </div>
    </div>
  );
}
