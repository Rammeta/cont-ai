export type ConsumerFinalMode = "auto" | "yes" | "no";
export type RegimeRemetente = "simples" | "normal" | "outro";
export type RegimeDestinatario = "simples" | "normal" | "outro";
export type AliqInterMode = "auto" | "4" | "7" | "12";
export type YesNoSelection = "yes" | "no";

export interface AppConfig {
  consumerFinalMode: ConsumerFinalMode;
  regimeRemet: RegimeRemetente;
  regimeDest: RegimeDestinatario;
  aliqInterna: string; // e.g. "18,00"
  aliqFcp: string;      // e.g. "2,00"
  aliqInterMode: AliqInterMode;
  calcPorDentro: YesNoSelection;
  includeIPI: YesNoSelection;
  applyFcpAntecipacao: YesNoSelection;
  obsLivre: string;
}

export interface ParsedItem {
  // XML Meta Info
  arquivo: string;
  nNF: string;
  dataEmissao: string;
  dataEmissaoRaw: string;
  ufRem: string;
  ufDest: string;
  cnpjCpfRem: string;
  emitenteKey: string;
  cnpjCpfDest: string;
  razaoRem: string;
  razaoDest: string;
  indFinal: string;
  itemSeq: string;

  // Product / Item specific
  itemConfigKey: string;
  cProd: string;
  xProd: string;
  ncm: string;
  orig: string;
  crt?: string;
  cst: string;
  ocst: string;
  cfop: string;
  cfopDesc: string;
  unidade: string;
  quantidade: number;
  vUnCom: number;
  vProd: number;
  vFreteItem: number;
  vSegItem: number;
  vOutroItem: number;
  vDescItem: number;
  vItem: number;
  vBCItem: number;
  vICMSItem: number;
  vIPIItem: number;
  pICMS: number;
  pIPI: number;

  // Computed Values (from calc engine)
  mode: "sem_difal" | "antecipacao" | "difal_consumidor_final" | "misto";
  modeLabel: string;
  modeBadge: string;
  fundamento: string;
  valorOperSemIPI: number;
  valorIPI: number;
  baseOrigem: number;
  baseCalculo: number;
  aliqInter: number;
  aliqInterna: number;
  aliqFcp?: number;
  difalRate: number;
  icmsOrigemCalc: number;
  difalPuro: number;
  fcpCalc: number;
  totalRecolher: number;
  memory: string;
  memoryShort: string;
  consumerFinalApplied: boolean;
  consumerFinalSource: string;
  regimeRemetAplicado: RegimeRemetente;
  regimeRemetOrigem: string;
  regimeDestAplicado: RegimeDestinatario;
  regimeDestOrigem?: string;
}

export interface ParsedNota {
  arquivo: string;
  nNF: string;
  dataEmissaoRaw: string;
  dataEmissao: string;
  ufRem: string;
  ufDest: string;
  idDest: string;
  indFinal: string;
  cnpjCpfRem: string;
  emitenteKey: string;
  cnpjCpfDest: string;
  razaoRem: string;
  razaoDest: string;

  // Original XML Totals
  vBC: number;
  vICMS: number;
  vBCST: number;
  vST: number;
  vII: number;
  vICMSUFRemet: number;
  vFCP: number;
  vPIS: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;
  vIPI: number;
  vICMSUFDest: number;
  vTotTrib: number;
  vCOFINS: number;
  vNF: number;

  // Aggregated calculations based on items active config
  mode: "sem_difal" | "antecipacao" | "difal_consumidor_final" | "misto";
  modeLabel: string;
  modeBadge: string;
  valorOperSemIPITotal: number;
  valorIPITotal: number;
  baseOrigemTotal: number;
  baseCalculoTotal: number;
  icmsOrigemCalcTotal: number;
  difalPuroTotal: number;
  fcpCalcTotal: number;
  totalRecolher: number;
  fundamento: string;
  regimeRemetAplicado: RegimeRemetente;
  regimeRemetOrigem: string;
  regimeDestAplicado: RegimeDestinatario;
  regimeDestOrigem: string;
}

export interface EmitenteUnico {
  emitenteKey: string;
  cnpjCpfRem: string;
  razaoRem: string;
  ufRem: string;
}

export interface DestinatarioUnico {
  destinatarioKey: string;
  cnpjCpfDest: string;
  razaoDest: string;
  ufDest: string;
}

export type EmitterRegimesMap = Record<string, RegimeRemetente>;
export type RecipientRegimesMap = Record<string, RegimeDestinatario>;
export type ItemConsumerOverridesMap = Record<string, string>; // "auto" | "yes" | "no"

export interface NcmRateRule {
  id: string;
  ncm: string;
  ufDest: string; // "TODOS" or specific e.g. "SP"
  aliqInterna: number; // e.g. 18.0
  aliqFcp: number; // e.g. 2.0
  description?: string;
}

export interface NfseConfigEmissao {
  opSimpNac?: string; // "" | "1" | "2" | "3" (1 - Não Optante, 2 - MEI, 3 - ME/EPP)
  regApTribSN?: string; // "1" | "2" | "3" (Regime de Apuração dos Tributos no Simples Nacional)
  regEspTrib?: string; // "0" a "9" (Regime Especial de Tributação)
  cLocEmi?: string; // Município emissor (Código IBGE ou Nome)
  inscricaoMunicipal?: string; // Inscrição Municipal (IM)
  fone?: string; // DDD + telefone
  email?: string; // E-mail de emissão
  pTotTribFed?: string; // % Carga Tributária Federal aproximada
  pTotTribMun?: string; // % Carga Tributária Municipal aproximada
  pTotTribSN?: string; // % Alíquota Simples Nacional
  tipoTotTribSN?: string; // Ex: "Alíquota do Simples Nacional"
}

export interface NfseModeloNota {
  id: string;
  nome: string; // Ex.: "Honorários mensais, Consultoria com ISS retido"
  cTribNac: string; // 6 dígitos (Código de Tributação Nacional)
  cNBS?: string; // 9 dígitos (Nomenclatura Brasileira de Serviços)
  cTribMun?: string; // 3 dígitos (Código Tributação Municipal, ex: 000)
  descricao: string; // Discriminação padrão dos serviços
  temDesconto?: boolean; // Na nota: Tem desconto
  pedeInfoComplementares?: boolean; // Na nota: Pede informações complementares
  tribISSQN: string; // "1 - Operação tributável", "2 - Imunidade", "3 - Exportação de serviço", "4 - Não Incidência", "5 - Isenção"
  tpRetISSQN: string; // "1 - Não retido", "2 - Retido pelo tomador", "3 - Retido pelo intermediário"
  cLocPrestacao: string; // "No endereço do prestador" | "No endereço do tomador" | "Outro município"
  cLocPrestacaoOutroMun?: string; // IBGE município prestação se outro
  vRetCP?: string; // % Retenção Contribuição Previdenciária
  cstPisCofins?: string; // CST PIS/COFINS (ex: "(não informado)", "01", etc.)
  temIbsCbs?: boolean; // Reforma Tributária IBS/CBS: Sim / Não
  cIndOp?: string; // "010101" - Estabelecimento do fornecedor como local da entrega...
  cClassTrib?: string; // "000001" - Situações tributadas integralmente pelo IBS e CBS...
  aliquotaIss?: string; // Alíquota ISS (%) opcional para autocompletar
  valorPadrao?: string; // Valor base padrão opcional
}

export interface NfseClienteTomador {
  id: string;
  cnpjCpf: string;
  razaoSocial: string;
  nomeFantasia?: string;
  email?: string;
  municipio?: string;
  uf?: string;
  inscricaoMunicipal?: string;
  telefone?: string;
}

export interface NfseNotaEmitida {
  id: string;
  numeroDps: string;
  serieDps: string;
  numeroNfse?: string;
  chaveAcesso?: string;
  dataEmissao: string;
  competencia: string;
  tomadorDoc: string;
  tomadorNome: string;
  tomadorEmail?: string;
  tomadorMunicipio?: string;
  discriminacao: string;
  cTribNac: string;
  cNBS?: string;
  cTribMun?: string;
  tribISSQN: string;
  tpRetISSQN: string;
  cLocPrestacao: string;
  valorServicos: number;
  aliquotaIss: number;
  valorIss: number;
  issRetido: boolean;
  totalRetencoes: number;
  valorLiquido: number;
  status: "Autorizada" | "Cancelada" | "Processando" | "Rejeitada";
  xmlAssinado?: string;
  caminhoXml?: string;
  codigoVerificacao?: string;
  motivoCancelamento?: string;
  dataCancelamento?: string;
  temIbsCbs?: boolean;
  cIndOp?: string;
  cClassTrib?: string;
  irrf?: number;
  pis?: number;
  cofins?: number;
  csll?: number;
  inss?: number;
}

export interface EmpresaSefaz {
  id: string;
  razaoSocial: string;
  cnpj: string;
  uf: string;
  regime: RegimeDestinatario;
  certPath: string;
  password?: string;
  ambiente: number; // 1 = Produção, 2 = Homologação
  inscricaoMunicipal?: string;
  certificadoA1Validade?: string;
  certInfo?: {
    subject: string;
    issuer: string;
    validTo: string;
    daysRemaining: number;
    isExpired: boolean;
  };
  certStore?: "windows" | "file";
  certThumbprint?: string;
  modelosHabilitados?: {
    nfe?: boolean;  // Modelo 55 (Entradas) - padrão: true
    nfce?: boolean; // Modelo 65 (NFC-e Saídas) - padrão: true se emitir
    cte?: boolean;  // Modelo 57 (CT-e Fretes/Transportes) - padrão: true se tomar/emitir
    nfse?: boolean; // NFS-e (Serviços) - padrão: true se emitir/tomar
  };
  emissaoConfig?: NfseConfigEmissao;
  modelosNfse?: NfseModeloNota[];
  clientesNfse?: NfseClienteTomador[];
  notasEmitidasNfse?: NfseNotaEmitida[];
}

export interface SefazSyncStatus {
  syncing: boolean;
  message: string;
  totalBaixadas?: number;
  totalManifestadas?: number;
  error?: string;
}

export interface SimplesPeriodoAnterior {
  dataInicial: string;
  dataFinal: string;
  detalhamento: string;
}

export interface SimplesEventoFuturo {
  descricao: string;
  dataEfeito: string;
}

export interface CnpjConsultaResult {
  sucesso: boolean;
  cnpj: string;
  cnpj_formatado?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: string;
  data_abertura?: string;
  municipio?: string;
  uf?: string;
  opcao_simples_raw?: boolean;
  opcao_simples?: string;
  data_opcao_simples?: string;
  data_exclusao_simples?: string;
  opcao_simei_raw?: boolean;
  opcao_simei?: string;
  periodos_anteriores_simples?: SimplesPeriodoAnterior[];
  eventos_futuros_simples?: SimplesEventoFuturo[];
  consultado_portal_rfb?: boolean;
  data_consulta_portal?: string;
  cnae_principal?: {
    codigo: string;
    descricao: string;
  };
  fonte?: string;
  erro?: string;
  consultado_em?: string;
  doCache?: boolean;
}

export interface ParsedNfse {
  numeroNFe: string;
  dataGeracao: string;
  competencia: string;
  prestadorCnpj: string;
  prestadorNome: string;
  prestadorIM?: string;
  tomadorCnpj: string;
  tomadorNome: string;
  tomadorIM?: string;
  valorServicos: number;
  valorLiquido?: number;
  temRetencao?: boolean;
  origemCaptacao?: "PORTAL_SP" | "PORTAL_NACIONAL";
  tipo: string; // "Prestadas" | "Tomadas" | "Tomadas - São Paulo" | "Eventos" | etc.
  simplesNacional?: string;
  dpsNumero?: string;
  dpsSerie?: string;
  situacaoNFSe?: string;
  tributacaoISSQN?: string;
  munIncid?: string;
  descIncond?: number;
  descCond?: number;
  temDescontoCond?: boolean;
  temDescontoIncond?: boolean;
  temDesconto?: boolean;
  baseCalculo?: number;
  aliqISSQN?: number;
  valorISSQN?: number;
  retencaoISSQN?: string;
  codTribNac?: string;
  itemNBS?: string;
  descricaoServico?: string;
  cstIbsCbs?: string;
  classTribIbsCbs?: string;
  indicadorOperacao?: string;
  bcIbsCbs?: number | string;
  reembIbsCbs?: number | string;
  aliqCBS?: number | string;
  redAliqCBS?: number | string;
  aliqEfetCBS?: number | string;
  valorCBSTotal?: number | string;
  aliqIBSEstadual?: number | string;
  redAliqIBSEstadual?: number | string;
  aliqEfetIBSEstadual?: number | string;
  valorIBSEstadual?: number | string;
  aliqIBSMunicipal?: number | string;
  redAliqIBSMunicipal?: number | string;
  aliqEfetIBSMunicipal?: number | string;
  valorIBSMunicipal?: number | string;
  valorIBSTotal?: number | string;
  sitTribPisCofins?: string;
  bcPisCofins?: number;
  aliqPIS?: number;
  debitoPIS?: number;
  aliqCOFINS?: number;
  debitoCOFINS?: number;
  descrContribSociaisRet?: string;
  irrf?: number;
  csll?: number;
  inss?: number;
  percTotalTribSN?: number;
  xInfComp?: string;
  evento?: string;
  autorEvento?: string;
  dataEvento?: string;
  dataRegEvento?: string;
  situacao?: string;
  isCancelada: boolean;
  chaveNotaNacional?: string;
  caminhoXml: string;
  caminhoPdf: string | null;
  caminhoEventoXml?: string | null;
  nomeArquivoXml: string;
}

export interface NfseMetricas {
  totalNotas: number;
  valorTotalEmitidas: number;
  valorTotalRecebidas: number;
  totalMovimentado?: number;
  totalImpostosRetidos: number;
  totalCanceladas: number;
  totalIbsCbsApurado: number;
}

export interface NotaAcompanhamentoItem {
  id: string;
  origem: "NFE" | "NFCE" | "CTE" | "NFSE_TOMADA" | "NFSE_PRESTADA";
  tipoBadge: string;
  numero: string;
  serie?: string;
  dataEmissao: string;
  competencia: string;
  parceiroNome: string;
  parceiroCnpj: string;
  papelParceiro: "Fornecedor" | "Cliente" | "Tomador" | "Prestador" | "Transportadora" | "Remetente" | "Destinatário";
  valorTotal: number;
  valorLiquido?: number;
  temRetencao?: boolean;
  origemCaptacao?: "PORTAL_SP" | "PORTAL_NACIONAL";
  temDesconto?: boolean;
  temDescontoCond?: boolean;
  temDescontoIncond?: boolean;
  valorDesconto?: number;
  valorTributoRecolher: number;
  detalheTributario: string;
  temAlertaTributario: boolean;
  status: "Normal" | "Cancelada" | "Substituída";
  isCancelada: boolean;
  chaveAcesso: string;
  caminhoXml: string;
  caminhoPdf?: string | null;
}

export interface ParsedNfce {
  name: string;
  fullPath: string;
  folder: string;
  chNFe: string;
  modelo: string;
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
  pdfPath?: string;
  isCancelada?: boolean;
}

export interface ParsedCte {
  name: string;
  fullPath: string;
  folder: string;
  chCTe: string;
  modelo: string; // "57" (CT-e) ou "67" (CT-e OS)
  nCT: string;
  serie: string;
  dhEmi: string;
  formattedDate: string;
  emitente: string;
  cnpjEmitente: string;
  ufEmit: string;
  remetente: string;
  cnpjRem: string;
  ufRem: string;
  destinatario: string;
  cnpjDest: string;
  ufDest: string;
  tomador: string;
  cnpjTomador: string;
  papelTomador: string; // "Remetente" | "Expedidor" | "Recebedor" | "Destinatário" | "Outros"
  vTPrest: number;
  vRec: number;
  modal: string; // "Rodoviário", "Aéreo", "Aquaviário", "Ferroviário"
  cfop: string;
  isInterestadual: boolean;
  pdfPath?: string;
  isCancelada?: boolean;
}

export interface ModelSchedulerConfig {
  enabled: boolean;
  time: string;
  lastRunDate?: string | null;
}

export interface ModelSchedulersMap {
  nfe: ModelSchedulerConfig;
  nfce: ModelSchedulerConfig;
  cte: ModelSchedulerConfig;
  nfse: ModelSchedulerConfig;
}

export interface AppSettings {
  customStorageDir?: string;
  customServerCertDir?: string;
  modelSchedulers?: ModelSchedulersMap;
  scheduler?: ModelSchedulerConfig;
  nfseScheduler?: ModelSchedulerConfig;
}

export interface InstalledCertItem {
  Subject: string;
  CommonName: string;
  CleanName: string;
  Issuer: string;
  Thumbprint: string;
  SerialNumber: string;
  NotBefore: string;
  NotAfter: string;
  HasPrivateKey: boolean;
  IsExportable: boolean;
  Documento: string;
  daysRemaining?: number;
  isExpired?: boolean;
  matchedPfxPath?: string;
}

export interface EmpresaMetrics {
  id: string;
  cnpj: string;
  razaoSocial: string;
  uf: string;
  regime?: RegimeDestinatario;
  nfeCount: number;
  nfceCount: number;
  cteCount: number;
  nfseTomadasCount: number;
  nfsePrestadasCount: number;
  nfseTotalCount: number;
  totalDocs: number;
  certStatus: "valid" | "expiring_soon" | "expired" | "missing" | "invalid";
  certDaysRemaining?: number | null;
  certValidTo?: string | null;
  certSubject?: string | null;
  certIssuer?: string | null;
  modelosHabilitados?: {
    nfe?: boolean;
    nfce?: boolean;
    cte?: boolean;
    nfse?: boolean;
  };
  lastSyncDate?: string | null;
  companyDir?: string;
}


