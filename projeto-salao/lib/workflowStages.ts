import { WindowTab } from "@/types";

export type WorkflowStageId = WindowTab | `custom:${string}`;
export type WorkflowStageTemplate = "livre" | "checklist" | "orientacao" | "retorno";

export type WorkflowStageDefinition = {
  id: WorkflowStageId;
  source: "builtin" | "custom";
  label: string;
  visible: boolean;
  template: WorkflowStageTemplate;
  description?: string;
};

export const WORKFLOW_STAGE_STORAGE_KEY = "almare.workflow.stages.v1";
export const WORKFLOW_STAGE_PREFERENCE_KEY = "workflow-stages";

function getWorkflowStageCacheKey(organizationId: string | null) {
  return organizationId ? `${WORKFLOW_STAGE_STORAGE_KEY}:${organizationId}` : null;
}

export const WORKFLOW_STAGE_TEMPLATE_LABELS: Record<WorkflowStageTemplate, string> = {
  livre: "Etapa livre",
  checklist: "Checklist",
  orientacao: "Orientacao",
  retorno: "Retorno",
};

const BUILTIN_WORKFLOW_STAGE_DEFINITIONS: Array<Omit<WorkflowStageDefinition, "visible">> = [
  { id: "perfil", source: "builtin", label: "Perfil", template: "livre" },
  { id: "agenda", source: "builtin", label: "Agenda", template: "retorno" },
  { id: "pre-consulta", source: "builtin", label: "Pré-consulta", template: "checklist" },
  { id: "anamnese", source: "builtin", label: "Ficha", template: "checklist" },
  { id: "diagnostico", source: "builtin", label: "Saúde", template: "orientacao" },
  { id: "colorimetria", source: "builtin", label: "Procedimentos", template: "orientacao" },
  { id: "evolucao", source: "builtin", label: "Evolução", template: "livre" },
  { id: "financeiro", source: "builtin", label: "Financeiro", template: "livre" },
  { id: "pos-venda", source: "builtin", label: "Homecare", template: "retorno" },
  { id: "galeria", source: "builtin", label: "Galeria", template: "livre" },
];

function isWorkflowStageTemplate(value: unknown): value is WorkflowStageTemplate {
  return value === "livre" || value === "checklist" || value === "orientacao" || value === "retorno";
}

function isBuiltinWindowTab(value: unknown): value is WindowTab {
  return BUILTIN_WORKFLOW_STAGE_DEFINITIONS.some((stage) => stage.id === value);
}

export function isCustomWorkflowStageId(value: string): value is `custom:${string}` {
  return value.startsWith("custom:");
}

export function createDefaultWorkflowStages(): WorkflowStageDefinition[] {
  return BUILTIN_WORKFLOW_STAGE_DEFINITIONS.map((stage) => ({
    ...stage,
    visible: true,
    description: "",
  }));
}

export function createCustomWorkflowStage(input: {
  label: string;
  template: WorkflowStageTemplate;
  description?: string;
}): WorkflowStageDefinition {
  return {
    id: `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    source: "custom",
    label: input.label.trim(),
    visible: true,
    template: input.template,
    description: input.description?.trim() || "",
  };
}

export function mergeWorkflowStages(raw: unknown): WorkflowStageDefinition[] {
  const defaultStages = createDefaultWorkflowStages();
  const defaultsById = new Map(defaultStages.map((stage) => [stage.id, stage]));

  if (!Array.isArray(raw)) {
    return defaultStages;
  }

  const merged: WorkflowStageDefinition[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const candidate = entry as Partial<WorkflowStageDefinition>;
    const label = typeof candidate.label === "string" ? candidate.label.trim() : "";
    const description = typeof candidate.description === "string" ? candidate.description.trim() : "";
    const visible = candidate.visible !== false;
    const template = isWorkflowStageTemplate(candidate.template) ? candidate.template : "livre";

    if (candidate.source === "builtin" && isBuiltinWindowTab(candidate.id)) {
      const fallback = defaultsById.get(candidate.id);
      if (!fallback) continue;
      merged.push({
        ...fallback,
        label: label || fallback.label,
        visible,
        description,
      });
      defaultsById.delete(candidate.id);
      continue;
    }

    if (candidate.source === "custom" && typeof candidate.id === "string" && isCustomWorkflowStageId(candidate.id)) {
      merged.push({
        id: candidate.id,
        source: "custom",
        label: label || "Etapa extra",
        visible,
        template,
        description,
      });
    }
  }

  merged.push(...Array.from(defaultsById.values()));
  return merged;
}

function serializeWorkflowStages(stages: WorkflowStageDefinition[]) {
  return stages.map((stage) => ({
    id: stage.id,
    source: stage.source,
    label: stage.label,
    visible: stage.visible,
    template: stage.template,
    description: stage.description || "",
  }));
}

export function readWorkflowStagesCache(organizationId: string | null): WorkflowStageDefinition[] {
  if (typeof window === "undefined") {
    return createDefaultWorkflowStages();
  }

  const cacheKey = getWorkflowStageCacheKey(organizationId);
  if (!cacheKey) {
    return createDefaultWorkflowStages();
  }

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return createDefaultWorkflowStages();
    return mergeWorkflowStages(JSON.parse(raw));
  } catch {
    return createDefaultWorkflowStages();
  }
}

export function writeWorkflowStagesCache(stages: WorkflowStageDefinition[], organizationId: string | null) {
  if (typeof window === "undefined") return;
  const cacheKey = getWorkflowStageCacheKey(organizationId);
  if (!cacheKey) return;
  window.localStorage.setItem(cacheKey, JSON.stringify(stages));
}

export async function fetchWorkflowStagesFromSupabase(organizationId: string | null): Promise<WorkflowStageDefinition[] | null> {
  if (!organizationId) {
    return null;
  }

  const res = await fetch(
    `/api/clinic-preferences?key=${encodeURIComponent(WORKFLOW_STAGE_PREFERENCE_KEY)}`,
    { method: "GET", cache: "no-store" }
  );

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as Record<string, unknown>)["error"])
        : "Falha ao buscar fluxo.";
    throw new Error(message);
  }

  const payload = await res.json().catch(() => null);
  if (!payload || payload.payload == null) return null;
  return mergeWorkflowStages(payload.payload);
}

export async function saveWorkflowStagesToSupabase(stages: WorkflowStageDefinition[], organizationId: string | null) {
  if (!organizationId) {
    return;
  }
  const payload = serializeWorkflowStages(stages);

  const res = await fetch(`/api/clinic-preferences`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ key: WORKFLOW_STAGE_PREFERENCE_KEY, payload }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body
        ? String((body as Record<string, unknown>)["error"])
        : "Falha ao salvar fluxo.";
    throw new Error(message);
  }
}