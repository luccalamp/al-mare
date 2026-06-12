"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { AppointmentDraft, Client, ClientAppointment, DiagnosticoCapilar, Colorimetria, FichaAnamneseCapilarDados, ManutencaoHomecare } from "@/types";
import { normalizePhotoCategory, resolvePhotoCategory, sanitizePhotoCaption } from "@/lib/photos";
import { normalizeImageFileForUpload } from "@/lib/clientImageCompression";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeObject } from "@/lib/sanitize";
import { notifyPortalUpdate } from "@/lib/preConsultation";

const CLIENTS_SNAPSHOT_KEY = "salao-anamnese-clients-snapshot-v1";
const CLIENTS_REALTIME_TABLES = [
  "clientes",
  "diagnostico_capilar",
  "historico_procedimentos",
  "manutencao_homecare",
  "client_photos",
  "agendamentos",
  "ficha_anamnese_capilar",
] as const;
const CLIENTS_REALTIME_DEBOUNCE_MS = 300;
const CLIENTS_HEARTBEAT_INTERVAL_MS = 60_000;

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

type ClientsSnapshot = {
  savedAt: string;
  clients: Client[];
};

type UploadedImageAsset = {
  url: string;
  publicId: string;
};

type ClientMutationResponse = {
  id?: string;
  error?: string;
};

type ClientRecordMutationResponse = {
  record?: unknown;
  error?: string;
};

type ClientListResponse = {
  clients?: unknown[];
  error?: string;
};

function getClientsSnapshotKey() {
  return CLIENTS_SNAPSHOT_KEY;
}

const serializeProfilePayload = (profile: Client["profile"]) => ({
  endereco: profile.endereco || null,
  bairro: profile.bairro || null,
  cidadeEstado: profile.cidadeEstado || null,
  cep: profile.cep || null,
  telResidencial: profile.telResidencial || null,
  telComercial: profile.telComercial || null,
  email: profile.email || null,
  profissao: profile.profissao || null,
  estadoCivil: profile.estadoCivil || null,
  therapeuticPlan: profile.therapeuticPlan || null,
  evolutionWeeks: profile.evolutionWeeks ? JSON.parse(JSON.stringify(profile.evolutionWeeks)) : null,
  tricoscopiaComparativeSlots: Array.isArray(profile.tricoscopiaComparativeSlots)
    ? profile.tricoscopiaComparativeSlots.map((slot) => (typeof slot === "string" ? slot : null))
    : null,
  tricoscopiaIdentificationSlots: Array.isArray(profile.tricoscopiaIdentificationSlots)
    ? profile.tricoscopiaIdentificationSlots.map((slot) => (typeof slot === "string" ? slot : null))
    : null,
});

function normalizeGridSlots(value: unknown): Array<string | null> | undefined {
  if (!Array.isArray(value)) return undefined;

  const normalized = [null, null, null, null] as Array<string | null>;
  for (let index = 0; index < 4; index += 1) {
    const slot = value[index];
    normalized[index] = typeof slot === "string" && slot.trim() ? slot : null;
  }

  return normalized;
}

const mapDbAppointment = (row: any): ClientAppointment => ({
  id: row.id,
  titulo: row.titulo,
  inicioEm: row.inicio_em,
  fimEm: row.fim_em,
  status: row.status,
  origem: row.origem,
  observacoes: row.observacoes || undefined,
  googleEventId: row.google_event_id || undefined,
  googleCalendarId: row.google_calendar_id || undefined,
  metadata: row.metadata || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sortAppointments = (appointments: readonly ClientAppointment[]) =>
  [...appointments].sort((left, right) => new Date(right.inicioEm).getTime() - new Date(left.inicioEm).getTime());

function buildClientDbError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");

    if (/organization_context_required|not_authorized_for_organization|row-level security/i.test(message)) {
      return "Sua sessão atual não permite concluir esta operação.";
    }

    if (/null value in column .*nome|null value in column .*whatsapp|violates not-null constraint/i.test(message)) {
      return "Preencha nome e WhatsApp antes de salvar.";
    }

    if (/duplicate key value|already exists/i.test(message)) {
      return "Já existe um registro com esses dados.";
    }
  }

  return fallback;
}

function hasFichaAnamneseData(ficha: Client["fichaAnamnese"]) {
  return Boolean(ficha && Object.keys(ficha).length > 0);
}

function hasUpcomingAppointment(appointments: readonly ClientAppointment[]) {
  const now = Date.now();
  return appointments.some((appointment) => {
    if (!["agendado", "confirmado"].includes(appointment.status)) return false;
    return new Date(appointment.inicioEm).getTime() >= now;
  });
}

function deriveClientJourney(
  client: Pick<Client, "preConsultation" | "fichaAnamnese" | "diagnosticos" | "appointments">
): NonNullable<Client["journey"]> {
  const hasToken = Boolean(client.preConsultation?.token);
  const linkActive = Boolean(client.preConsultation?.linkActive);
  const respondedAt = Boolean(client.preConsultation?.respondedAt);
  const hasFicha = hasFichaAnamneseData(client.fichaAnamnese);
  const hasDiagnostico = client.diagnosticos.length > 0;
  const hasNextAppointment = hasUpcomingAppointment(client.appointments);

  if (!hasToken) {
    return {
      stage: "cadastro-inicial",
      stageLabel: "Triagem",
      nextActionLabel: "Gerar link de pre-consulta",
      nextTab: "pre-consulta",
      tone: "neutral",
    };
  }

  if (!respondedAt) {
    return {
      stage: linkActive ? "pre-consulta-pendente" : "cadastro-inicial",
      stageLabel: linkActive ? "Aguardando resposta" : "Triagem",
      nextActionLabel: linkActive ? "Enviar ou cobrar no WhatsApp" : "Gerar novo link",
      nextTab: "pre-consulta",
      tone: "warning",
    };
  }

  if (!hasFicha) {
    return {
      stage: "avaliacao-pendente",
      stageLabel: "Ficha clinica",
      nextActionLabel: "Completar ficha da paciente",
      nextTab: "anamnese",
      tone: "warning",
    };
  }

  if (!hasDiagnostico) {
    return {
      stage: "avaliacao-pendente",
      stageLabel: "Diagnostico",
      nextActionLabel: "Registrar diagnostico capilar",
      nextTab: "diagnostico",
      tone: "accent",
    };
  }

  if (!hasNextAppointment) {
    return {
      stage: "retorno-pendente",
      stageLabel: "Sem retorno",
      nextActionLabel: "Agendar proxima sessao",
      nextTab: "agenda",
      tone: "accent",
    };
  }

  return {
    stage: "em-acompanhamento",
    stageLabel: "Acompanhamento",
    nextActionLabel: "Monitorar agenda e evolucao",
    nextTab: "agenda",
    tone: "success",
  };
}

function enrichClient(client: Client): Client {
  return {
    ...client,
    journey: deriveClientJourney(client),
  };
}

const mergeClients = (localClients: Client[], remoteClients: Client[]): Client[] => {
  const remoteById = new Map<string, Client>();
  for (const client of remoteClients) {
    remoteById.set(client.id, client);
  }

  const localById = new Map<string, Client>();
  for (const client of localClients) {
    localById.set(client.id, client);
  }

  const merged: Client[] = [];

  for (const remoteClient of remoteClients) {
    const localClient = localById.get(remoteClient.id);
    if (!localClient) {
      merged.push(remoteClient);
      continue;
    }

    const remoteUpdatedAt = new Date(remoteClient.updatedAt || 0).getTime();
    const localUpdatedAt = new Date(localClient.updatedAt || 0).getTime();

    if (remoteUpdatedAt >= localUpdatedAt) {
      merged.push(remoteClient);
    } else {
      merged.push(localClient);
    }
  }

  merged.sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return merged;
};

const mapDbClients = (dbClients: any[]): Client[] =>
  (dbClients || []).map((row) => {
    const diagnosticosRows = Array.isArray(row.diagnostico_capilar)
      ? row.diagnostico_capilar.filter((item: any) => !item?.deleted_at)
      : [];
    const colorimetriasRows = Array.isArray(row.historico_procedimentos)
      ? row.historico_procedimentos.filter((item: any) => !item?.deleted_at)
      : [];
    const homecareRows = Array.isArray(row.manutencao_homecare)
      ? row.manutencao_homecare.filter((item: any) => !item?.deleted_at)
      : [];
    const galleryRows = Array.isArray(row.client_photos)
      ? row.client_photos.filter((item: any) => !item?.deleted_at)
      : [];
    const appointmentsRows = Array.isArray(row.agendamentos)
      ? row.agendamentos.filter((item: any) => !item?.deleted_at)
      : [];
    const ficha = Array.isArray(row.ficha_anamnese_capilar)
      ? row.ficha_anamnese_capilar.filter((item: any) => !item?.deleted_at)
      : row.ficha_anamnese_capilar;
    const record = Array.isArray(ficha) ? ficha[0] : ficha;
    const fichaDados = (record?.dados as FichaAnamneseCapilarDados | undefined) ?? null;
    const extraProfile = row.perfil_complementar || {};
    const savedSignatures = Array.isArray(extraProfile.signatures) ? extraProfile.signatures : [];

    return enrichClient({
      id: row.id,
      profile: {
        nome: row.nome,
        whatsapp: row.whatsapp,
        instagramHandle: row.instagram_handle || undefined,
        dataAniversario: row.data_aniversario || "",
        photoUrl: row.photo_url || undefined,
        acquisitionChannel: row.canal_aquisicao || undefined,
        endereco: extraProfile.endereco || undefined,
        bairro: extraProfile.bairro || undefined,
        cidadeEstado: extraProfile.cidadeEstado || undefined,
        cep: extraProfile.cep || undefined,
        telResidencial: extraProfile.telResidencial || undefined,
        telComercial: extraProfile.telComercial || undefined,
        email: extraProfile.email || undefined,
        profissao: extraProfile.profissao || undefined,
        estadoCivil: extraProfile.estadoCivil || undefined,
        therapeuticPlan: extraProfile.therapeuticPlan || undefined,
        evolutionWeeks: Array.isArray(extraProfile.evolutionWeeks) ? extraProfile.evolutionWeeks : undefined,
        tricoscopiaComparativeSlots: normalizeGridSlots(extraProfile.tricoscopiaComparativeSlots),
        tricoscopiaIdentificationSlots: normalizeGridSlots(extraProfile.tricoscopiaIdentificationSlots),
      },
      diagnosticos: diagnosticosRows.map((d: any) => ({
        id: d.id,
        data: d.created_at,
        elasticidade: d.elasticidade,
        porosidade: d.porosidade,
        historiaQuimicaPrevia: d.historia_quimica_previa,
        presencaMetais: d.presenca_metais,
        resultadoTesteMecha: d.resultado_teste_mecha,
      })),
      colorimetrias: colorimetriasRows.map((c: any) => ({
        id: c.id,
        data: c.created_at,
        tecnicaUtilizada: c.tecnica_utilizada,
        alturaClareamento: c.altura_clareamento,
        fundoClareamentoObtido: c.fundo_clareamento_obtido,
        misturaTonalizante: c.mistura_tonalizante,
        volumagemOx: c.volumagem_ox,
        valor: c.valor_procedimento,
      })),
      homecare: homecareRows.map((m: any) => ({
        id: m.id,
        data: m.created_at,
        produtosRecomendados: m.produtos_recomendados,
        dataRetornoSugerida: m.data_retorno_sugerida,
        obsCuidados: m.obs_cuidados,
        valorTotal: m.valor_total ?? undefined,
        formaPagamento: m.forma_pagamento ?? undefined,
        parcelas: m.parcelas ?? undefined,
        pago: m.pago ?? undefined,
        confirmadoEm: m.confirmado_em ?? undefined,
      })),
      gallery: galleryRows.map((p: any) => ({
        id: p.id,
        date: p.created_at,
        url: p.url,
        type: resolvePhotoCategory(p.categoria, p.type, p.url, p.caption),
        caption: sanitizePhotoCaption(p.caption),
        technicalNote: p.anotacao_tecnica || undefined,
      })),
      appointments: sortAppointments(appointmentsRows.map((appointment: any) => mapDbAppointment(appointment))),
      preConsultation: {
        token: row.token_pre_consulta || undefined,
        linkActive: row.link_ativo ?? undefined,
        respondedAt: row.pre_consulta_respondida_em || undefined,
      },
      portalLink: {
        token: row.portal_token || undefined,
        linkActive: row.portal_active ?? undefined,
      },
      fichaAnamnese: fichaDados,
      signatures: savedSignatures,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

const readClientsSnapshot = (): ClientsSnapshot | null => {
  if (typeof window === "undefined") return null;
  const snapshotKey = getClientsSnapshotKey();
  if (!snapshotKey) return null;

  try {
    const raw = window.localStorage.getItem(snapshotKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClientsSnapshot;
    if (!Array.isArray(parsed.clients)) return null;
    return {
      ...parsed,
      clients: parsed.clients.map((client) =>
        enrichClient({
          ...(client as Client),
          gallery: Array.isArray((client as Client).gallery)
            ? (client as Client).gallery.map((photo) => ({
                ...photo,
                type: resolvePhotoCategory(photo.type, photo.url, photo.caption),
                caption: sanitizePhotoCaption(photo.caption),
              }))
            : [],
          appointments: Array.isArray((client as Client).appointments) ? (client as Client).appointments : [],
        })
      ),
    };
  } catch (error) {
    console.error("Falha ao ler snapshot local de clientes:", error);
    return null;
  }
};

const persistClientsSnapshot = (clients: Client[]): string | null => {
  if (typeof window === "undefined") return null;
  const snapshotKey = getClientsSnapshotKey();
  if (!snapshotKey) return null;

  try {
    const snapshot: ClientsSnapshot = {
      savedAt: new Date().toISOString(),
      clients,
    };
    window.localStorage.setItem(snapshotKey, JSON.stringify(snapshot));
    return snapshot.savedAt;
  } catch (error) {
    console.error("Falha ao gravar snapshot local de clientes:", error);
    return null;
  }
};

async function runClientMutation(
  method: "POST" | "PUT",
  payload: Record<string, unknown>,
  fallbackMessage: string
) {
  const response = await fetch("/api/clients", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as ClientMutationResponse | null;
  if (!response.ok) {
    throw new Error(result?.error && typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result ?? {};
}

async function runClientRecordMutation(
  method: "POST" | "PUT",
  payload: Record<string, unknown>,
  fallbackMessage: string
) {
  const response = await fetch("/api/clients/records", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as ClientRecordMutationResponse | null;
  if (!response.ok) {
    throw new Error(result?.error && typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result ?? {};
}

async function removeUploadedClientAsset(publicId: string) {
  const response = await fetch("/api/upload", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      publicId,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    console.error(
      "Falha ao limpar arquivo enviado após erro de persistência:",
      payload?.error && typeof payload.error === "string" ? payload.error : response.statusText
    );
  }
}

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const clientsRef = useRef<Client[]>([]);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const commitClients = useCallback((nextClients: Client[]) => {
    const enrichedClients = nextClients.map(enrichClient);
    clientsRef.current = enrichedClients;
    setClients(enrichedClients);
    const savedAt = persistClientsSnapshot(enrichedClients);
    if (savedAt) {
      setLastSnapshotAt(savedAt);
    }
  }, []);

  const restoreSnapshot = useCallback((warning: string) => {
    const snapshot = readClientsSnapshot();
    if (!snapshot?.clients.length) return false;

    clientsRef.current = snapshot.clients;
    setClients(snapshot.clients);
    setLastSnapshotAt(snapshot.savedAt);
    return true;
  }, []);

  // 1. Loader Principal - Consome os 4 módulos do Iluminare Studio
  const loadClients = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    try {
      if (!background) {
        setLoading(true);
      }
      setSyncStatus("syncing");

      const response = await fetch("/api/clients", { method: "GET", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as ClientListResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel carregar os pacientes agora.");
      }

      const dbClients = Array.isArray(payload?.clients) ? payload.clients : [];
      const formatted = mapDbClients(dbClients || []);

      const merged = mergeClients(clientsRef.current, formatted);
      commitClients(merged);
      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());
      return merged;
    } catch (err) {
      console.error("Falha ao carregar do Iluminare Studio:", err);
      setSyncStatus("error");
      restoreSnapshot("Falha ao ler a base agora. Mantive a ultima copia local salva neste navegador.");
      return clientsRef.current;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [commitClients, restoreSnapshot]);

  useEffect(() => {
    const snapshot = readClientsSnapshot();
    if (snapshot?.clients.length) {
      clientsRef.current = snapshot.clients;
      setClients(snapshot.clients);
      setLastSnapshotAt(snapshot.savedAt);
    }

    void loadClients();
  }, [loadClients]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }

      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        void loadClients({ background: true });
      }, CLIENTS_REALTIME_DEBOUNCE_MS);
    };

    const channel = CLIENTS_REALTIME_TABLES.reduce(
      (currentChannel, table) =>
        currentChannel
          .on("postgres_changes", { event: "INSERT", schema: "public", table }, () => {
            scheduleRefresh();
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table }, () => {
            scheduleRefresh();
          })
          .on("postgres_changes", { event: "DELETE", schema: "public", table }, () => {
            scheduleRefresh();
          }),
      supabase.channel(`clients-sync-${crypto.randomUUID()}`)
    );

    channel.subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadClients]);

  useEffect(() => {
    heartbeatIntervalRef.current = setInterval(() => {
      void loadClients({ background: true });
    }, CLIENTS_HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    if (!deferredSearchQuery.trim()) return clients;
    const q = deferredSearchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.profile.nome.toLowerCase().includes(q) ||
        c.profile.whatsapp.includes(q)
    );
  }, [clients, deferredSearchQuery]);

  const uploadImage = async (
    clientId: string,
    file: File,
    type?: string,
    options?: { persistClientPhoto?: boolean }
  ): Promise<UploadedImageAsset | null> => {
    const preparedFile = await normalizeImageFileForUpload(file);
    const shouldPersistClientPhoto = Boolean(options?.persistClientPhoto);

    const presignedResponse = await fetch("/api/upload/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: clientId,
        originalName: preparedFile.name,
        mimeType: preparedFile.type,
        category: type,
        photoCategory: type,
      }),
    });

    if (!presignedResponse.ok) {
      const err = await presignedResponse.json().catch(() => null);
      throw new Error(err?.error || "Falha ao gerar URL de upload.");
    }

    const { presignedUrl, objectKey, proxyUrl } = await presignedResponse.json();

    const uploadResponse = await fetch(presignedUrl, {
      method: "PUT",
      body: preparedFile,
      headers: { "Content-Type": preparedFile.type },
    });

    if (!uploadResponse.ok) {
      throw new Error("Falha ao enviar imagem para o storage.");
    }

    const confirmResponse = await fetch("/api/upload/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: clientId,
        objectKey,
        proxyUrl,
        category: type,
        photoCategory: type,
        persistClientPhoto: shouldPersistClientPhoto,
      }),
    });

    if (!confirmResponse.ok) {
      const err = await confirmResponse.json().catch(() => null);
      throw new Error(err?.error || "Falha ao confirmar upload.");
    }

    const result = await confirmResponse.json();

    return {
      url: result.url || proxyUrl,
      publicId: result.publicId || objectKey,
    };
  };

  const addClient = async (client: Client) => {
    const sanitized = sanitizeObject(client);
    await runClientMutation(
      "POST",
      {
        id: sanitized.id,
        nome: sanitized.profile.nome,
        whatsapp: sanitized.profile.whatsapp,
        instagram_handle: sanitized.profile.instagramHandle,
        instagramHandle: sanitized.profile.instagramHandle || null,
        data_aniversario: sanitized.profile.dataAniversario || null,
        dataAniversario: sanitized.profile.dataAniversario || null,
        photo_url: sanitized.profile.photoUrl || null,
        photoUrl: sanitized.profile.photoUrl || null,
        canal_aquisicao: sanitized.profile.acquisitionChannel || null,
        acquisitionChannel: sanitized.profile.acquisitionChannel || null,
        perfil_complementar: serializeProfilePayload(sanitized.profile),
        perfilComplementar: serializeProfilePayload(sanitized.profile),
      },
      "Nao foi possivel cadastrar o paciente no banco."
    );

    commitClients([sanitized, ...clientsRef.current]);
    await loadClients();
  };

  const updateClient = async (updated: Client, photoFiles?: { file: File, type: string }[]) => {
    const sanitized = sanitizeObject(updated);
    const avatarFile = photoFiles?.find((item) => item.type === "avatar");
    const galleryFiles = (photoFiles || []).filter((item) => item.type !== "avatar");
    let nextProfile = sanitized.profile;
    let avatarPublicId: string | null = null;

    if (avatarFile) {
      const avatarUpload = await uploadImage(sanitized.id, avatarFile.file);
      if (!avatarUpload) {
        throw new Error(`Falha ao enviar a foto ${avatarFile.file.name}.`);
      }
      avatarPublicId = avatarUpload.publicId;
      nextProfile = {
        ...nextProfile,
        photoUrl: avatarUpload.url,
      };
    }

    try {
      await runClientMutation(
        "PUT",
        {
          id: sanitized.id,
          nome: nextProfile.nome,
          whatsapp: nextProfile.whatsapp,
          instagramHandle: nextProfile.instagramHandle || null,
          dataAniversario: nextProfile.dataAniversario || null,
          photoUrl: nextProfile.photoUrl || null,
          acquisitionChannel: nextProfile.acquisitionChannel || null,
          perfilComplementar: {
            ...serializeProfilePayload(nextProfile),
            signatures: sanitized.signatures || [],
          },
          ...(avatarPublicId
            ? {
                profilePhotoStorageBucket: "s3",
                profilePhotoStoragePath: avatarPublicId,
              }
            : {}),
        },
        "Nao foi possivel salvar essa atualizacao no banco."
      );
    } catch (error) {
      if (avatarPublicId) {
        await removeUploadedClientAsset(avatarPublicId);
      }

      throw error;
    }

    if (galleryFiles.length > 0) {
      for (const item of galleryFiles) {
        const uploadedPhoto = await uploadImage(sanitized.id, item.file, item.type);
        if (!uploadedPhoto) {
          throw new Error(`Falha ao enviar a foto ${item.file.name}.`);
        }
      }
    }

    const clientToken = clientsRef.current.find((entry) => entry.id === sanitized.id)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === sanitized.id
        ? {
            ...client,
            profile: {
              ...client.profile,
              ...nextProfile,
            },
            signatures: sanitized.signatures || client.signatures,
            updatedAt: new Date().toISOString(),
          }
        : client
    );

    commitClients(nextClients);
    await loadClients();
    notifyPortalUpdate(clientToken);
  };

  const deletePhoto = async (clientId: string, photoId: string) => {
    const client = clientsRef.current.find((entry) => entry.id === clientId);
    const photo = client?.gallery.find((entry) => entry.id === photoId);

    if (!client || !photo) {
      throw new Error("A foto selecionada nao foi encontrada.");
    }

    const response = await fetch("/api/admin/archive/photo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        photoId,
        reason: `Arquivamento da foto ${normalizePhotoCategory(photo.type)} via galeria da paciente.`,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        payload?.error && typeof payload.error === "string"
          ? payload.error
          : "Falha ao arquivar a foto."
      );
    }

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    commitClients(
      clientsRef.current.map((entry) =>
        entry.id === clientId
          ? {
              ...entry,
              gallery: entry.gallery.filter((galleryPhoto) => galleryPhoto.id !== photoId),
              updatedAt: new Date().toISOString(),
            }
          : entry
      )
    );
    notifyPortalUpdate(token);
  };

  const addDiagnostico = async (
    clientId: string,
    diagnostico: {
      porosidade: 1 | 2 | 3 | 4 | 5;
      elasticidade: 1 | 2 | 3;
      historiaQuimicaPrevia?: string;
      resultadoTesteMecha: string;
    }
  ): Promise<DiagnosticoCapilar> => {
    const response = await runClientRecordMutation(
      "POST",
      {
        action: "diagnostico",
        clientId,
        porosidade: diagnostico.porosidade,
        elasticidade: diagnostico.elasticidade,
        historiaQuimicaPrevia: diagnostico.historiaQuimicaPrevia || null,
        resultadoTesteMecha: diagnostico.resultadoTesteMecha,
      },
      "Falha ao salvar diagnóstico."
    );

    const data = response.record as {
      id: string;
      created_at: string;
      porosidade: DiagnosticoCapilar["porosidade"];
      elasticidade: DiagnosticoCapilar["elasticidade"];
      historia_quimica_previa?: string | null;
      resultado_teste_mecha?: string | null;
      presenca_metais?: boolean | null;
    } | undefined;

    if (!data) {
      throw new Error("Falha ao salvar diagnóstico.");
    }

    const novoDiagnostico: DiagnosticoCapilar = {
      id: data.id,
      data: data.created_at,
      porosidade: data.porosidade,
      elasticidade: data.elasticidade,
      historiaQuimicaPrevia: data.historia_quimica_previa || "",
      resultadoTesteMecha: data.resultado_teste_mecha || "",
      presencaMetais: Boolean(data.presenca_metais),
    };

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, diagnosticos: [novoDiagnostico, ...client.diagnosticos], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);
    notifyPortalUpdate(token);

    return novoDiagnostico;
  };

  const addProcedimento = async (
    clientId: string,
    input: {
      tecnicaUtilizada: string;
      valor?: number | null;
      anotacoes?: string;
      alturaClareamento?: number | null;
      fundoClareamentoObtido?: string;
      volumagemOx?: string;
      misturaTonalizante?: string;
    }
  ): Promise<Colorimetria> => {
    const response = await runClientRecordMutation(
      "POST",
      {
        action: "procedimento",
        clientId,
        tecnicaUtilizada: input.tecnicaUtilizada.trim(),
        valor: input.valor != null && !Number.isNaN(Number(input.valor)) ? Number(input.valor) : null,
        misturaTonalizante: input.anotacoes?.trim() || input.misturaTonalizante?.trim() || null,
        alturaClareamento: input.alturaClareamento ?? null,
        fundoClareamentoObtido: input.fundoClareamentoObtido?.trim() || null,
        volumagemOx: input.volumagemOx?.trim() || null,
      },
      "Falha ao salvar procedimento."
    );

    const data = response.record as {
      id: string;
      created_at: string;
      tecnica_utilizada?: string | null;
      altura_clareamento?: number | null;
      fundo_clareamento_obtido?: string | null;
      mistura_tonalizante?: string | null;
      volumagem_ox?: string | null;
      valor_procedimento?: number | string | null;
    } | undefined;

    if (!data) {
      throw new Error("Falha ao salvar procedimento.");
    }

    const novo: Colorimetria = {
      id: data.id,
      data: data.created_at,
      tecnicaUtilizada: data.tecnica_utilizada || "",
      alturaClareamento: data.altura_clareamento ?? 0,
      fundoClareamentoObtido: data.fundo_clareamento_obtido || "",
      misturaTonalizante: data.mistura_tonalizante || "",
      volumagemOx: data.volumagem_ox || "",
      valor: data.valor_procedimento != null ? Number(data.valor_procedimento) : undefined,
    };

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, colorimetrias: [novo, ...client.colorimetrias], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);
    notifyPortalUpdate(token);

    return novo;
  };

  const deleteProcedimento = async (clientId: string, procedureId: string): Promise<void> => {
    const url = `/api/clients/records?action=procedimento&recordId=${encodeURIComponent(procedureId)}&clientId=${encodeURIComponent(clientId)}`;
    const response = await fetch(url, { method: "DELETE" });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        payload?.error && typeof payload.error === "string"
          ? payload.error
          : "Falha ao arquivar procedimento."
      );
    }

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? {
            ...client,
            colorimetrias: client.colorimetrias.filter((c) => c.id !== procedureId),
            updatedAt: new Date().toISOString(),
          }
        : client
    );
    commitClients(nextClients);
    notifyPortalUpdate(token);
  };

  const addHomecare = async (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
      valorTotal?: number;
      formaPagamento?: "normal" | "avista" | "parcelado";
      parcelas?: number;
    }
  ): Promise<ManutencaoHomecare> => {
    const response = await runClientRecordMutation(
      "POST",
      {
        action: "homecare",
        clientId,
        produtosRecomendados: input.produtosRecomendados,
        obsCuidados: input.obsCuidados || null,
        dataRetornoSugerida: input.dataRetornoSugerida || null,
        valorTotal: input.valorTotal || null,
        formaPagamento: input.formaPagamento || null,
        parcelas: input.parcelas || null,
      },
      "Falha ao salvar homecare."
    );

    const data = response.record as {
      id: string;
      created_at: string;
      produtos_recomendados?: string | null;
      obs_cuidados?: string | null;
      data_retorno_sugerida?: string | null;
      valor_total?: number | null;
      forma_pagamento?: string | null;
      parcelas?: number | null;
      pago?: boolean | null;
      confirmado_em?: string | null;
    } | undefined;

    if (!data) {
      throw new Error("Falha ao salvar homecare.");
    }

    const novoHomecare: ManutencaoHomecare = {
      id: data.id,
      data: data.created_at,
      produtosRecomendados: data.produtos_recomendados || "",
      obsCuidados: data.obs_cuidados || undefined,
      dataRetornoSugerida: data.data_retorno_sugerida || undefined,
      valorTotal: data.valor_total ?? undefined,
      formaPagamento: (data.forma_pagamento as "avista" | "parcelado") ?? undefined,
      parcelas: data.parcelas ?? undefined,
      pago: data.pago ?? undefined,
      confirmadoEm: data.confirmado_em ?? undefined,
    };

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, homecare: [novoHomecare, ...client.homecare], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);
    notifyPortalUpdate(token);

    return novoHomecare;
  };

  const confirmarPagamentoHomecare = async (clientId: string, homecareId: string): Promise<{ pago: boolean; confirmadoEm?: string }> => {
    const response = await runClientRecordMutation(
      "POST",
      { action: "confirmar-pagamento", clientId, homecareId },
      "Falha ao confirmar pagamento."
    );
    const data = response.record as { pago?: boolean; confirmado_em?: string } | undefined;
    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              homecare: client.homecare.map((h) =>
                h.id === homecareId
                  ? { ...h, pago: data?.pago ?? true, confirmadoEm: data?.confirmado_em ?? new Date().toISOString() }
                  : h
              ),
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );
    notifyPortalUpdate(token);
    return { pago: data?.pago ?? true, confirmadoEm: data?.confirmado_em };
  };

  const saveFichaAnamnese = async (clientId: string, dados: FichaAnamneseCapilarDados): Promise<FichaAnamneseCapilarDados> => {
    const sanitized = sanitizeObject(dados);
    const response = await runClientRecordMutation(
      "POST",
      {
        action: "ficha-anamnese",
        clientId,
        dados: sanitized,
      },
      "Falha ao salvar a ficha clínica."
    );

    const data = response.record as { dados?: FichaAnamneseCapilarDados } | undefined;

    const next = (data?.dados as FichaAnamneseCapilarDados) ?? sanitized;
    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId ? { ...client, fichaAnamnese: next, updatedAt: new Date().toISOString() } : client
    );
    commitClients(nextClients);
    notifyPortalUpdate(token);
    return next;
  };

  const addAppointment = async (clientId: string, input: AppointmentDraft): Promise<ClientAppointment> => {
    const payload = sanitizeObject({
      action: "appointment",
      clientId,
      titulo: input.titulo.trim(),
      inicioEm: input.inicioEm,
      fimEm: input.fimEm,
      status: input.status,
      origem: input.origem,
      observacoes: input.observacoes?.trim() || null,
      googleEventId: input.googleEventId || null,
      googleCalendarId: input.googleCalendarId || null,
      metadata: input.metadata || {},
    });

    const response = await runClientRecordMutation("POST", payload, "Falha ao salvar agendamento.");
    if (!response.record) {
      throw new Error("Falha ao salvar agendamento.");
    }

    const novoAgendamento = mapDbAppointment(response.record);
    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              appointments: sortAppointments([novoAgendamento, ...client.appointments]),
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );

    return novoAgendamento;
  };

  const linkAppointmentToGoogle = async (
    clientId: string,
    appointmentId: string,
    input: Pick<AppointmentDraft, "googleEventId" | "googleCalendarId" | "metadata">
  ): Promise<ClientAppointment> => {
    const payload = sanitizeObject({
      action: "link-google-appointment",
      clientId,
      appointmentId,
      googleEventId: input.googleEventId || null,
      googleCalendarId: input.googleCalendarId || null,
      metadata: input.metadata || {},
    });

    const response = await runClientRecordMutation("PUT", payload, "Falha ao vincular agendamento ao Google Calendar.");
    if (!response.record) {
      throw new Error("Falha ao vincular agendamento ao Google Calendar.");
    }

    const atualizado = mapDbAppointment(response.record);
    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              appointments: sortAppointments(
                client.appointments.map((appointment) =>
                  appointment.id === appointmentId ? atualizado : appointment
                )
              ),
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );

    return atualizado;
  };

  const deleteClient = async (id: string) => {
    const response = await fetch("/api/admin/archive/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: id,
        reason: "Arquivamento administrativo da paciente com recuperacao posterior disponivel.",
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        payload?.error && typeof payload.error === "string"
          ? payload.error
          : "Falha ao arquivar a paciente."
      );
    }

    commitClients(clientsRef.current.filter((client) => client.id !== id));
    await loadClients();
  };

  const togglePreConsultationToken = async (clientId: string, active: boolean) => {
    const response = await fetch("/api/portal/pre-consulta", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientId, active }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = body && typeof body === "object" && "error" in body ? String((body as Record<string, unknown>)["error"]) : "Não foi possível alterar o status.";
      throw new Error(message);
    }

    const row = await response.json();

    const token = clientsRef.current.find((entry) => entry.id === clientId)?.portalLink?.token;
    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              preConsultation: {
                token: client.preConsultation?.token,
                linkActive: row.linkActive ?? active,
                respondedAt: client.preConsultation?.respondedAt,
              },
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );

    await loadClients({ background: true });
    notifyPortalUpdate(token);
  };

  return {
    clients,
    filteredClients,
    searchQuery,
    setSearchQuery,
    addClient,
    updateClient,
    addDiagnostico,
    addProcedimento,
    deleteProcedimento,
    addHomecare,
    confirmarPagamentoHomecare,
    saveFichaAnamnese,
    addAppointment,
    linkAppointmentToGoogle,
    deletePhoto,
    deleteClient,
    togglePreConsultationToken,
    loading,
    syncStatus,
    lastSyncedAt,
    lastSnapshotAt,
    refreshClients: loadClients,
  };
}
