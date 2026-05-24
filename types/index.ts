// ============================================================
// TIPOS ILUMINARE STUDIO — Foco em Mechas de Luxo e Saúde Capilar
// ============================================================

import type { FichaAnamneseCapilarDados } from "./anamneseCapilar";
export type { FichaAnamneseCapilarDados };

export type SessionStage = {
  readonly higienizacao: boolean;
  readonly aplicacaoAtivos: boolean;
  readonly massagemEstimulante: boolean;
  readonly usoTecnologias: boolean;
};

export type EvolutionPlanWeek = {
  readonly id: string;
  readonly weekLabel: string;
  readonly notes: string;
  readonly stages?: SessionStage;
};

export type ClientProfile = {
  readonly nome: string;
  readonly whatsapp: string;
  readonly instagramHandle?: string;
  readonly dataAniversario?: string; // ISO YYYY-MM-DD
  readonly photoUrl?: string;
  readonly acquisitionChannel?: string;
  readonly endereco?: string;
  readonly bairro?: string;
  readonly cidadeEstado?: string;
  readonly cep?: string;
  readonly telResidencial?: string;
  readonly telComercial?: string;
  readonly email?: string;
  readonly profissao?: string;
  readonly estadoCivil?: string;
  readonly notes?: string; // Internal notes
  readonly therapeuticPlan?: string;
  readonly evolutionWeeks?: readonly EvolutionPlanWeek[];
  readonly tricoscopiaComparativeSlots?: readonly (string | null)[];
  readonly tricoscopiaIdentificationSlots?: readonly (string | null)[];
};

// 2. Módulo de Diagnóstico
export type DiagnosticoCapilar = {
  readonly id: string;
  readonly data: string;
  readonly elasticidade: 1 | 2 | 3;
  readonly porosidade: 1 | 2 | 3 | 4 | 5;
  readonly historiaQuimicaPrevia?: string;
  readonly presencaMetais: boolean;
  readonly resultadoTesteMecha: string;
};

// 3. Módulo de Colorimetria (Fórmulas Secretas) e Terapia Capilar
export type Colorimetria = {
  readonly id: string;
  readonly data: string;
  readonly tecnicaUtilizada: string;
  readonly alturaClareamento: number; // 1-10
  readonly fundoClareamentoObtido: string; // ex: 9.3
  readonly misturaTonalizante: string; // Receita exata
  readonly volumagemOx: string;
  readonly valor?: number;
  readonly tipoProcedimento?: "colorimetria" | "terapia_capilar" | "consulta";
  readonly etapasSessao?: SessionStage;
  readonly numeroSessao?: number;
  readonly totalSessoes?: number;
};

export type Service = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly durationMinutes: number;
  readonly price: number;
  readonly category: string | null;
  readonly isActive: boolean;
};

export function calcularPrecoComDesconto(valor: number, descontoPercentual: number): number {
  return valor * (1 - descontoPercentual / 100);
}

export function calcularParcelas(valor: number, numParcelas: number, jurosMensal = 0): number[] {
  if (numParcelas <= 1) return [valor];
  const valorParcela = valor / numParcelas;
  return Array.from({ length: numParcelas }, () => Math.round((valorParcela * (1 + jurosMensal / 100)) * 100) / 100);
}

// 4. Módulo de Pós-Venda
export type HomeCareProduct = {
  readonly name: string;
  readonly price: number;
  readonly description?: string;
  readonly priceLabel?: string;
};

export const HOME_CARE_PRODUCTS: readonly HomeCareProduct[] = [
  {
    name: "Kit Home Care",
    price: 580,
    description: "Shampoo + condicionador + tônico + máscara de tratamento",
    priceLabel: "Média R$ 580",
  },
];

export type ManutencaoHomecare = {
  readonly id: string;
  readonly data: string;
  readonly produtosRecomendados: string;
  readonly dataRetornoSugerida?: string;
  readonly obsCuidados?: string;
  readonly valorTotal?: number;
  readonly formaPagamento?: "normal" | "avista" | "parcelado";
  readonly parcelas?: number;
  readonly pago?: boolean;
  readonly confirmadoEm?: string;
};

export type GalleryPhoto = {
  readonly id: string;
  readonly date: string;
  readonly type: "antes" | "depois" | "referencia" | "referência";
  readonly url: string;
  readonly caption?: string;
  readonly technicalNote?: string;
};

export type CompanyDocumentFolder = {
  readonly id: string;
  readonly name: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CompanyDocument = {
  readonly id: string;
  readonly folderId: string;
  readonly folderName: string;
  readonly name: string;
  readonly fileName: string;
  readonly mimeType?: string;
  readonly sizeBytes: number;
  readonly url: string;
  readonly storagePath: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type RecoverableTableName = "clientes" | "client_photos" | "company_documents";

export type DeletedRecordSummary = {
  readonly tableName: RecoverableTableName;
  readonly recordId: string;
  readonly clientId?: string;
  readonly displayName: string;
  readonly subtitle?: string;
  readonly deletedAt: string;
  readonly deleteReason?: string;
  readonly quarantinedStoragePath?: string;
};

export type RowChangeAuditEntry = {
  readonly auditId: number;
  readonly tableName: string;
  readonly operation: string;
  readonly changedAt: string;
  readonly transactionId: number;
  readonly jwtSubject?: string;
  readonly jwtRole?: string;
  readonly recordIdentity: Record<string, unknown>;
  readonly oldRecord?: Record<string, unknown>;
  readonly newRecord?: Record<string, unknown>;
};

export type BackupRunHistory = {
  readonly id: string;
  readonly triggerSource: string;
  readonly destination: string;
  readonly storageBucket?: string;
  readonly storagePath?: string;
  readonly s3Bucket?: string;
  readonly s3Key?: string;
  readonly checksum?: string;
  readonly payloadBytes: number;
  readonly tableCounts: Record<string, number>;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly status: "running" | "succeeded" | "failed";
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
};

export type RestoreDrillHistory = {
  readonly id: string;
  readonly triggerSource: string;
  readonly status: "running" | "succeeded" | "failed";
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly latestBackupRunId?: string;
  readonly latestBackupPath?: string;
  readonly verifiedTransactionId?: number;
  readonly verifiedRecordIdentity?: Record<string, unknown>;
  readonly resultSummary: Record<string, unknown>;
  readonly errorMessage?: string;
  readonly metadata: Record<string, unknown>;
};

export type RecoverySummary = {
  readonly deletedClients: readonly DeletedRecordSummary[];
  readonly deletedPhotos: readonly DeletedRecordSummary[];
  readonly deletedDocuments: readonly DeletedRecordSummary[];
  readonly latestBackup?: BackupRunHistory;
  readonly latestRestoreDrill?: RestoreDrillHistory;
};

export type RestoreOperationResult = {
  readonly tableName: RecoverableTableName;
  readonly recordId: string;
  readonly restoredFromAudit: boolean;
  readonly restoredStorage: boolean;
};

export type AppointmentStatus = "agendado" | "confirmado" | "realizado" | "cancelado" | "faltou";

export type AppointmentOrigin = "interno" | "google_calendar" | "n8n" | "manual";

export type AppointmentDraft = {
  readonly titulo: string;
  readonly inicioEm: string;
  readonly fimEm: string;
  readonly status: AppointmentStatus;
  readonly origem: AppointmentOrigin;
  readonly observacoes?: string;
  readonly googleEventId?: string;
  readonly googleCalendarId?: string;
  readonly metadata?: Record<string, unknown>;
};

export type ClientAppointment = AppointmentDraft & {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PreConsultationLink = {
  readonly token?: string;
  readonly linkActive?: boolean;
  readonly respondedAt?: string;
};

export type PortalLink = {
  readonly token?: string;
  readonly linkActive?: boolean;
  readonly createdAt?: string;
};

export type PortalSessionData = {
  status: "ready";
  clientName: string;
  homecare: readonly ManutencaoHomecare[];
  gallery: readonly GalleryPhoto[];
  upcomingAppointments: readonly ClientAppointment[];
};

export type WindowTab = "perfil" | "agenda" | "pre-consulta" | "anamnese" | "diagnostico" | "colorimetria" | "evolucao" | "pos-venda" | "galeria" | "financeiro" | "assinaturas";

export type ClientJourneyStage =
  | "cadastro-inicial"
  | "pre-consulta-pendente"
  | "avaliacao-pendente"
  | "retorno-pendente"
  | "em-acompanhamento";

export type ClientJourneyTone = "neutral" | "warning" | "accent" | "success";

export type ClientSignature = {
  readonly id: string;
  readonly label: string;
  readonly imageDataUrl: string;
  readonly signedAt: string;
};

export type ClientJourney = {
  readonly stage: ClientJourneyStage;
  readonly stageLabel: string;
  readonly nextActionLabel: string;
  readonly nextTab: WindowTab;
  readonly tone: ClientJourneyTone;
};

// ------ Cliente Iluminare Studio ------
export type Client = {
  readonly id: string;
  readonly profile: ClientProfile;
  readonly diagnosticos: readonly DiagnosticoCapilar[];
  readonly colorimetrias: readonly Colorimetria[];
  readonly homecare: readonly ManutencaoHomecare[];
  readonly gallery: readonly GalleryPhoto[];
  readonly appointments: readonly ClientAppointment[];
  readonly preConsultation?: PreConsultationLink;
  readonly portalLink?: PortalLink;
  readonly journey?: ClientJourney;
  readonly fichaAnamnese: FichaAnamneseCapilarDados | null;
  readonly signatures: readonly ClientSignature[];
  readonly createdAt: string;
  readonly updatedAt: string;
};
