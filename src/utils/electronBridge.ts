import { EmpresaSefaz, CnpjConsultaResult, ParsedNfse, NfseMetricas, ParsedNfce, ParsedCte, ModelSchedulersMap, EmpresaMetrics, InstalledCertItem } from "../types";

// Helper seguro para obter ipcRenderer se estiver rodando dentro do Electron
function getIpc() {
  if (typeof window !== "undefined" && (window as any).require) {
    try {
      const electron = (window as any).require("electron");
      return electron.ipcRenderer;
    } catch (e) {
      return null;
    }
  }
  return null;
}

export const isElectron = (): boolean => {
  return !!getIpc();
};

export const selectCertFile = async (currentPath?: string): Promise<string | null> => {
  const ipc = getIpc();
  if (!ipc) {
    alert("Esta função requer a execução no aplicativo Desktop (Electron).");
    return null;
  }
  return await ipc.invoke("dialog:open-cert", currentPath);
};

export interface NetworkCertItem {
  name: string;
  fullPath: string;
  extractedPassword?: string;
  dir: string;
  relativePath?: string;
}

export const listNetworkCerts = async (customDir?: string): Promise<{
  success: boolean;
  dir?: string;
  certs?: NetworkCertItem[];
  error?: string;
}> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:list-network-certs", customDir);
};

export const listInstalledCerts = async (): Promise<{
  success: boolean;
  certs?: InstalledCertItem[];
  error?: string;
}> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("system:list-installed-certs");
};

export const exportInstalledCert = async (
  thumbprint: string,
  password?: string
): Promise<{
  success: boolean;
  pfxPath?: string;
  password?: string;
  error?: string;
}> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("system:export-installed-cert", { thumbprint, password });
};

export const selectServerCertFolder = async (): Promise<{
  success: boolean;
  customServerCertDir?: string;
  canceled?: boolean;
  error?: string;
}> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:select-server-cert-dir");
};

export const saveServerCertFolder = async (
  dir: string
): Promise<{ success: boolean; customServerCertDir?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:save-server-cert-dir", dir);
};

export const openServerCertFolder = async (
  dir?: string
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:open-server-cert-dir", dir);
};

export const testCert = async (
  target: string | { certPath?: string; password?: string; certStore?: "windows" | "file"; thumbprint?: string; certThumbprint?: string },
  password?: string
) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  if (typeof target === "string") {
    return await ipc.invoke("sefaz:test-cert", { certPath: target, password: password || "" });
  }
  const norm = {
    ...target,
    thumbprint: target.thumbprint || target.certThumbprint || "",
    certThumbprint: target.certThumbprint || target.thumbprint || ""
  };
  return await ipc.invoke("sefaz:test-cert", norm);
};

export const syncCompanySefaz = async (
  company: EmpresaSefaz,
  options?: { resetNsu?: boolean; clearManifestations?: boolean; targetNsu?: string; forceSync?: boolean } | any
) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };

  // Higieniza para garantir que apenas tipos primitivos serializáveis sejam enviados pelo IPC
  const safeCompany = {
    id: String(company?.id || ""),
    razaoSocial: String(company?.razaoSocial || ""),
    cnpj: String(company?.cnpj || ""),
    uf: String(company?.uf || ""),
    regime: company?.regime,
    certPath: String(company?.certPath || ""),
    password: company?.password ? String(company.password) : "",
    ambiente: Number(company?.ambiente || 1),
    certStore: company?.certStore || (company?.certThumbprint ? "windows" : "file"),
    certThumbprint: company?.certThumbprint ? String(company.certThumbprint) : "",
  };

  const safeOptions: any = {};
  if (options && typeof options === "object" && !options.nativeEvent && !options._reactName) {
    if (options.resetNsu !== undefined) safeOptions.resetNsu = Boolean(options.resetNsu);
    if (options.clearManifestations !== undefined) safeOptions.clearManifestations = Boolean(options.clearManifestations);
    if (options.targetNsu !== undefined && options.targetNsu !== null) safeOptions.targetNsu = String(options.targetNsu);
    if (options.forceSync !== undefined) safeOptions.forceSync = Boolean(options.forceSync);
  }

  return await ipc.invoke("sefaz:sync-company", { company: safeCompany, ...safeOptions });
};

export const getCompanySefazState = async (cnpj: string, razaoSocial?: string) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:get-company-state", { cnpj, razaoSocial });
};

export const resetCompanyNsu = async (
  cnpj: string,
  targetNsu: string = "0",
  clearManifestations: boolean = false,
  razaoSocial?: string,
  clearFiles: boolean = false
) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:reset-nsu", { cnpj, targetNsu, clearManifestations, razaoSocial, clearFiles });
};

export const listAvailableMonths = async (cnpj: string, razaoSocial?: string): Promise<string[]> => {
  const ipc = getIpc();
  if (!ipc) return [];
  const res = await ipc.invoke("sefaz:list-months", { cnpj, razaoSocial });
  return res.success ? res.months : [];
};

export interface CapturedNfeMetadata {
  name: string;
  fullPath: string;
  folder: string;
  chNFe: string;
  nNF: string;
  serie: string;
  dhEmi: string;
  formattedDate: string;
  emitente: string;
  cnpjEmitente: string;
  ufRem: string;
  destinatario: string;
  cnpjDest: string;
  ufDest: string;
  vNF: number;
  isInterestadual: boolean;
  content?: string;
}

export const listCompanyXmls = async (
  cnpj: string,
  yearMonth?: string,
  razaoSocial?: string
): Promise<CapturedNfeMetadata[]> => {
  const ipc = getIpc();
  if (!ipc) return [];
  const res = await ipc.invoke("sefaz:list-xmls", { cnpj, yearMonth, razaoSocial });
  return res.success ? res.xmls : [];
};

export const readXmlsContent = async (
  filePaths: string[]
): Promise<Array<{ name: string; fullPath: string; content: string }>> => {
  const ipc = getIpc();
  if (!ipc) return [];
  const res = await ipc.invoke("sefaz:read-xmls-content", { filePaths });
  return res.success ? res.results : [];
};

export const openDanfePdf = async (cnpj: string, chNFe: string, yearMonth?: string, razaoSocial?: string) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("danfe:open-pdf", { cnpj, chNFe, yearMonth, razaoSocial });
};

export const onSyncProgress = (callback: (info: { status: string; message: string }) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, info: any) => {
    callback(info);
  };

  ipc.on("sefaz:sync-progress", listener);
  return () => {
    ipc.removeListener("sefaz:sync-progress", listener);
  };
};

export const exportCompetencia = async (
  cnpj: string,
  companyName: string,
  yearMonth: string,
  exportType: "all" | "xml" | "pdf",
  options?: { specificKeys?: string[]; startDate?: string; endDate?: string; periodLabel?: string }
): Promise<{ success: boolean; canceled?: boolean; fileCount?: number; targetZipPath?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:export-competencia", { cnpj, companyName, yearMonth, exportType, ...options });
};

export const openCompanyFolder = async (cnpj: string, subfolder?: string, razaoSocial?: string) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:open-folder", { cnpj, subfolder, razaoSocial });
};

export const saveSingleXml = async (cnpj: string, chNFe: string, yearMonth?: string) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:save-single-xml", { cnpj, chNFe, yearMonth });
};

export const consultarCnpj = async (cnpj: string, forceRefresh: boolean = false): Promise<CnpjConsultaResult> => {
  const ipc = getIpc();
  if (!ipc) {
    return { sucesso: false, cnpj, erro: "Ambiente não é Electron." };
  }
  return await ipc.invoke("cnpj:consultar", { cnpj, forceRefresh });
};

export const consultarCnpjsLote = async (
  cnpjs: string[],
  forceRefresh: boolean = false
): Promise<Record<string, CnpjConsultaResult>> => {
  const ipc = getIpc();
  if (!ipc) return {};
  return await ipc.invoke("cnpj:consultar-lote", { cnpjs, forceRefresh });
};

export const obterCnpjCache = async (): Promise<Record<string, CnpjConsultaResult>> => {
  const ipc = getIpc();
  if (!ipc) return {};
  return await ipc.invoke("cnpj:obter-cache");
};

export const onCnpjConsultaProgress = (
  callback: (info: {
    current: number;
    total: number;
    cnpj: string;
    razao?: string;
    isSimples?: boolean;
    statusSimples?: string;
  }) => void
) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, info: any) => {
    callback(info);
  };

  ipc.on("cnpj:consultar-progresso", listener);
  return () => {
    ipc.removeListener("cnpj:consultar-progresso", listener);
  };
};

export const fetchNfeByChave = async (company: EmpresaSefaz, chNFe: string) => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };

  const safeCompany = {
    id: String(company?.id || ""),
    razaoSocial: String(company?.razaoSocial || ""),
    cnpj: String(company?.cnpj || ""),
    uf: String(company?.uf || ""),
    regime: company?.regime,
    certPath: String(company?.certPath || ""),
    password: company?.password ? String(company.password) : "",
    ambiente: Number(company?.ambiente || 1),
  };

  return await ipc.invoke("sefaz:fetch-by-chave", {
    company: safeCompany,
    chNFe: String(chNFe || "").replace(/\D/g, ""),
  });
};

export interface AppSettings {
  customStorageDir: string;
  defaultStorageDir: string;
  modelSchedulers?: ModelSchedulersMap;
  scheduler: {
    enabled: boolean;
    time: string;
    lastRunDate?: string | null;
  };
  nfseScheduler?: {
    enabled: boolean;
    time: string;
    lastRunDate?: string | null;
  };
}

export const getAppSettings = async (): Promise<AppSettings | null> => {
  const ipc = getIpc();
  if (!ipc) return null;
  return await ipc.invoke("settings:get");
};

export const selectStorageFolder = async (): Promise<{
  success: boolean;
  customStorageDir?: string;
  canceled?: boolean;
  error?: string;
}> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:select-folder");
};

export const openStorageFolder = async (): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:open-storage-folder");
};

export const saveSchedulerSettings = async (scheduler: {
  enabled: boolean;
  time: string;
}): Promise<{ success: boolean; scheduler?: any; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:save-scheduler", scheduler);
};

export const saveNfseSchedulerSettings = async (nfseScheduler: {
  enabled: boolean;
  time: string;
}): Promise<{ success: boolean; nfseScheduler?: any; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:save-nfse-scheduler", nfseScheduler);
};

export const saveModelSchedulersSettings = async (
  modelSchedulers: ModelSchedulersMap
): Promise<{ success: boolean; modelSchedulers?: ModelSchedulersMap; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("settings:save-model-schedulers", modelSchedulers);
};

export const syncAllCompanies = async (
  companies: EmpresaSefaz[]
): Promise<{ success: boolean; total?: number; results?: any[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };

  const safeCompanies = (companies || []).map((c) => ({
    id: String(c?.id || ""),
    razaoSocial: String(c?.razaoSocial || ""),
    cnpj: String(c?.cnpj || ""),
    uf: String(c?.uf || ""),
    regime: c?.regime,
    certPath: String(c?.certPath || ""),
    password: c?.password ? String(c.password) : "",
    ambiente: Number(c?.ambiente || 1),
    modelosHabilitados: c?.modelosHabilitados,
  }));

  return await ipc.invoke("sefaz:sync-all", { companies: safeCompanies });
};

export const onSyncAllProgress = (callback: (info: any) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, info: any) => {
    callback(info);
  };

  ipc.on("sefaz:sync-all-progress", listener);
  return () => {
    ipc.removeListener("sefaz:sync-all-progress", listener);
  };
};

export const onSchedulerTrigger = (callback: (payload?: { type?: "sefaz" | "nfe" | "nfce" | "cte" | "nfse"; time?: string }) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, payload?: any) => {
    callback(payload);
  };

  ipc.on("scheduler:trigger-sync", listener);
  return () => {
    ipc.removeListener("scheduler:trigger-sync", listener);
  };
};

export const syncCompanyNfce = async (
  company: EmpresaSefaz,
  options?: { diasRetroativos?: number; forceFullScan?: boolean }
): Promise<{ success: boolean; result?: any; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };

  const safeCompany = {
    id: String(company?.id || ""),
    razaoSocial: String(company?.razaoSocial || ""),
    cnpj: String(company?.cnpj || ""),
    uf: String(company?.uf || ""),
    regime: company?.regime,
    certPath: String(company?.certPath || ""),
    password: company?.password ? String(company.password) : "",
    ambiente: Number(company?.ambiente || 1),
    modelosHabilitados: company?.modelosHabilitados,
  };

  return await ipc.invoke("sefaz:sync-nfce", {
    company: safeCompany,
    diasRetroativos: options?.diasRetroativos || 90,
    forceFullScan: options?.forceFullScan ?? false,
  });
};

export const listCompanyNfceXmls = async (
  cnpj: string,
  razaoSocial?: string,
  yearMonth?: string
): Promise<{ success: boolean; list: ParsedNfce[]; months: string[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, list: [], months: [], error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:list-nfce", { cnpj, razaoSocial, yearMonth });
};

export const openCompanyNfceFolder = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; dir?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:open-nfce-folder", { cnpj, razaoSocial });
};

export const onNfceProgress = (callback: (info: any) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, info: any) => {
    callback(info);
  };

  ipc.on("sefaz:sync-nfce-progress", listener);
  return () => {
    ipc.removeListener("sefaz:sync-nfce-progress", listener);
  };
};

export const openNfceDanfePdf = async (
  pdfPath?: string,
  xmlPath?: string
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:open-nfce-pdf", { pdfPath, xmlPath });
};

export const exportNfceCompetencia = async (
  cnpj: string,
  razaoSocial?: string,
  yearMonth?: string,
  exportType: "all" | "xml" | "pdf" = "all"
): Promise<{ success: boolean; canceled?: boolean; fileCount?: number; targetZipPath?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:export-nfce-competencia", { cnpj, razaoSocial, yearMonth, exportType });
};

export const saveSingleNfceXml = async (
  cnpj: string,
  chNFe: string,
  razaoSocial?: string,
  xmlPath?: string
): Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:save-single-nfce-xml", { cnpj, chNFe, razaoSocial, xmlPath });
};

export const getCompanyNfceCacheState = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; result?: { lastExecution: string | null; lastSyncTime: string | null; downloadedKeys: Record<string, any> }; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:get-nfce-cache-state", { cnpj, razaoSocial });
};

export const resetCompanyNfceCache = async (
  cnpj: string,
  razaoSocial?: string,
  clearFiles: boolean = false
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:reset-nfce-cache", { cnpj, razaoSocial, clearFiles });
};

export const syncCompanyCte = async (
  company: EmpresaSefaz
): Promise<{ success: boolean; result?: any; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };

  const safeCompany = {
    id: String(company?.id || ""),
    razaoSocial: String(company?.razaoSocial || ""),
    cnpj: String(company?.cnpj || ""),
    uf: String(company?.uf || ""),
    regime: company?.regime,
    certPath: String(company?.certPath || ""),
    password: company?.password ? String(company.password) : "",
    ambiente: Number(company?.ambiente || 1),
  };

  return await ipc.invoke("sefaz:sync-cte", { company: safeCompany });
};

export const listCompanyCteXmls = async (
  cnpj: string,
  razaoSocial?: string,
  yearMonth?: string
): Promise<{ success: boolean; list: ParsedCte[]; months: string[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, list: [], months: [], error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:list-cte", { cnpj, razaoSocial, yearMonth });
};

export const openCompanyCteFolder = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; dir?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:open-cte-folder", { cnpj, razaoSocial });
};

export const onCteProgress = (callback: (info: any) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, info: any) => {
    callback(info);
  };

  ipc.on("sefaz:sync-cte-progress", listener);
  return () => {
    ipc.removeListener("sefaz:sync-cte-progress", listener);
  };
};

export const openCteDactePdf = async (
  pdfPath?: string,
  xmlPath?: string
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:open-cte-pdf", { pdfPath, xmlPath });
};

export const exportCteCompetencia = async (
  cnpj: string,
  razaoSocial?: string,
  yearMonth?: string,
  exportType: "all" | "xml" | "pdf" = "all"
): Promise<{ success: boolean; canceled?: boolean; fileCount?: number; targetZipPath?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:export-cte-competencia", { cnpj, razaoSocial, yearMonth, exportType });
};

export const saveSingleCteXml = async (
  cnpj: string,
  chCTe: string,
  razaoSocial?: string,
  xmlPath?: string
): Promise<{ success: boolean; canceled?: boolean; filePath?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:save-single-cte-xml", { cnpj, chCTe, razaoSocial, xmlPath });
};

export const getCompanyCteNsuState = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; result?: { ultimoNsuCte: string; downloadedKeys: Record<string, any>; lastSync?: string }; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:get-cte-nsu-state", { cnpj, razaoSocial });
};

export const resetCompanyCteNsu = async (
  cnpj: string,
  razaoSocial?: string,
  targetNsu: string = "0",
  clearFiles: boolean = false
): Promise<{ success: boolean; targetNsu?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:reset-cte-nsu", { cnpj, razaoSocial, targetNsu, clearFiles });
};

export const getAutoStart = async (): Promise<boolean> => {
  const ipc = getIpc();
  if (!ipc) return false;
  try {
    return await ipc.invoke("app:get-auto-start");
  } catch (e) {
    return false;
  }
};

export const setAutoStart = async (enabled: boolean): Promise<boolean> => {
  const ipc = getIpc();
  if (!ipc) return false;
  try {
    const res = await ipc.invoke("app:set-auto-start", enabled);
    return !!res.openAtLogin;
  } catch (e) {
    return false;
  }
};

// =========================================================================
// MÉTODOS DE INTEGRAÇÃO DO MÓDULO NFS-E (PORTAL NACIONAL & SP)
// =========================================================================

export interface NfseSyncProgressPayload {
  message: string;
  type?: "info" | "warn" | "error";
  timestamp?: string;
  currentNsu?: number;
  docsCount?: number;
  cnpj?: string;
}

export const syncCompanyNfse = async (
  company: EmpresaSefaz,
  targetNsu?: string | number
): Promise<{ success: boolean; totalDocsBaixados?: number; novoNsu?: number; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:sync-company", { company, targetNsu });
};

export const syncSpNfse = async (
  company: EmpresaSefaz,
  params?: { ano?: string | number; mes?: string | number; dtInicio?: string; dtFim?: string }
): Promise<{ success: boolean; totalBaixadas?: number; totalCanceladas?: number; logs?: string[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:sync-sp", { company, params });
};

export const getNfseMetrics = async (
  cnpj: string,
  razaoSocial?: string,
  ano?: string,
  mes?: string,
  tipo?: string
): Promise<{ success: boolean; metricas?: NfseMetricas; totalNotas?: number; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:get-metrics", { cnpj, razaoSocial, ano, mes, tipo });
};

export const listNfseNotas = async (
  cnpj: string,
  razaoSocial?: string,
  ano?: string,
  mes?: string,
  tipo?: string
): Promise<{ success: boolean; notas: ParsedNfse[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, notas: [], error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:list-notas", { cnpj, razaoSocial, ano, mes, tipo });
};

export const getNfseState = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; state?: { ultimoNsuNfse: number; lastSync?: string }; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:get-state", { cnpj, razaoSocial });
};

export const resetNfseNsu = async (
  cnpj: string,
  razaoSocial?: string,
  targetNsu: number = 0
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:reset-nsu", { cnpj, razaoSocial, targetNsu });
};

export const exportNfseCsv = async (
  cnpj: string,
  razaoSocial?: string,
  ano?: string,
  mes?: string,
  tipo?: string,
  dataInicio?: string,
  dataFim?: string
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:export-csv", { cnpj, razaoSocial, ano, mes, tipo, dataInicio, dataFim });
};

export const downloadNfseZip = async (
  cnpj: string,
  razaoSocial?: string,
  ano?: string,
  mes?: string,
  tipo?: string,
  dataInicio?: string,
  dataFim?: string
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:download-zip", { cnpj, razaoSocial, ano, mes, tipo, dataInicio, dataFim });
};

export const openNfsePdf = async (
  pdfPath?: string,
  xmlPath?: string,
  xmlContent?: string
): Promise<{ success: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:open-pdf", { pdfPath, xmlPath, xmlContent });
};

export const saveNfseXml = async (
  xmlPath?: string,
  defaultName?: string,
  xmlContent?: string
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:save-xml", { xmlPath, defaultName, xmlContent });
};

export const openNfseFolder = async (
  cnpj: string,
  razaoSocial?: string
): Promise<{ success: boolean; dir?: string; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("nfse:open-folder", { cnpj, razaoSocial });
};

export interface TransmitirDpsResult {
  sucesso: boolean;
  status: string;
  numeroDps?: number;
  serieDps?: string;
  numeroNfse?: string;
  codigoVerificacao?: string;
  chaveAcesso?: string;
  savedXmlPath?: string;
  linkDanfse?: string;
  mensagem?: string;
  xmlEnvio?: string;
  xmlRetorno?: string;
  erros?: string[];
}

export const transmitirDpsNfse = async (
  empresa: EmpresaSefaz,
  dpsData: any
): Promise<TransmitirDpsResult> => {
  const ipc = getIpc();
  if (!ipc) {
    return { sucesso: false, status: "ERRO", mensagem: "Ambiente não é Electron." };
  }
  return await ipc.invoke("nfse:transmitir-dps", { empresa, dpsData });
};

export interface CancelarNfseResult {
  sucesso: boolean;
  status: string;
  chaveAcesso?: string;
  mensagem: string;
  savedEventXmlPath?: string;
  eventoXml?: string;
  erros?: any[];
}

export const cancelarNfseNacional = async (
  empresa: EmpresaSefaz,
  cancelData: {
    chaveAcesso: string;
    motivo: string;
    cMotivo?: string;
    ambiente?: string | number;
    caminhoXml?: string;
  }
): Promise<CancelarNfseResult> => {
  const ipc = getIpc();
  if (!ipc) {
    return { sucesso: false, status: "ERRO", mensagem: "Ambiente não é Electron." };
  }
  return await ipc.invoke("nfse:cancelar-nota", { empresa, cancelData });
};

export const onNfseProgress = (callback: (info: NfseSyncProgressPayload) => void) => {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: any, data: NfseSyncProgressPayload) => {
    callback(data);
  };

  ipc.on("nfse:sync-progress", listener);
  return () => {
    ipc.removeListener("nfse:sync-progress", listener);
  };
};

export const resetAllModelsNsu = async (options: {
  scope: "single" | "all";
  cnpj?: string;
  razaoSocial?: string;
  companies?: EmpresaSefaz[];
  clearFiles?: boolean;
  clearManifestations?: boolean;
}): Promise<{ success: boolean; total?: number; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("sefaz:reset-all-models-nsu", options);
};

export const saveCsvFile = async (
  defaultFilename: string,
  content: string,
  title: string = "Salvar Relatório em Planilha (.csv)"
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (ipc) {
    return await ipc.invoke("app:save-csv-file", { defaultFilename, content, title });
  } else {
    try {
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};

export const exportDiagnostics = async (
  activeEmpresa?: EmpresaSefaz | null
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron." };
  return await ipc.invoke("app:export-diagnostics", { activeEmpresa });
};

export const saveHtmlDashboard = async (
  defaultFilename: string,
  htmlContent: string,
  title: string = "Salvar Dashboard Executivo (.html)",
  autoOpen: boolean = true
): Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }> => {
  const ipc = getIpc();
  if (ipc) {
    return await ipc.invoke("app:save-html-dashboard", { defaultFilename, htmlContent, title, autoOpen });
  } else {
    try {
      const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
};

export const getCompaniesMetrics = async (
  companies: EmpresaSefaz[],
  forceRefresh: boolean = false
): Promise<{ success: boolean; metrics?: EmpresaMetrics[]; error?: string }> => {
  const ipc = getIpc();
  if (!ipc) return { success: false, error: "Ambiente não é Electron.", metrics: [] };
  const safeCompanies = (companies || []).map((c) => ({
    id: String(c?.id || ""),
    razaoSocial: String(c?.razaoSocial || ""),
    cnpj: String(c?.cnpj || ""),
    uf: String(c?.uf || ""),
    regime: c?.regime,
    certPath: String(c?.certPath || ""),
    password: c?.password ? String(c.password) : "",
    ambiente: Number(c?.ambiente || 1),
    certInfo: c?.certInfo,
    modelosHabilitados: c?.modelosHabilitados,
  }));
  return await ipc.invoke("app:get-companies-metrics", { companies: safeCompanies, forceRefresh });
};

