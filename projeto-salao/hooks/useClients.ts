"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppointmentDraft, Client, ClientAppointment, DiagnosticoCapilar, Colorimetria, FichaAnamneseCapilarDados, ManutencaoHomecare } from "@/types";
import { adminPostJson } from "@/lib/adminApi";
import { normalizePhotoCategory, resolvePhotoCategory, sanitizePhotoCaption } from "@/lib/photos";
import { useOrganizations } from "@/components/OrganizationProvider";
import { supabase } from "@/lib/supabaseClient";
import { sanitizeObject } from "@/lib/sanitize";

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

type ClientsSnapshot = {
  savedAt: string;
  clients: Client[];
};

type UploadedImageAsset = {
  publicUrl: string;
  storagePath: string;
};

type PreConsultationLinkMutationResponse = {
  token?: string | null;
  linkActive?: boolean | null;
  respondedAt?: string | null;
  error?: string;
};

type ClientMutationResponse = {
  id?: string;
  error?: string;
};

type ClientRecordMutationResponse = {
  record?: unknown;
  error?: string;
};

function getClientsSnapshotKey(organizationId: string | null) {
  return organizationId ? `${CLIENTS_SNAPSHOT_KEY}:${organizationId}` : null;
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
  assinatura: profile.signature?.imageDataUrl
    ? {
        imageDataUrl: profile.signature.imageDataUrl,
        signedAt: profile.signature.signedAt || null,
      }
    : null,
});

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

const mapDbClients = (dbClients: any[]): Client[] =>
  (dbClients || []).map((row) => {
    const ficha = row.ficha_anamnese_capilar;
    const record = Array.isArray(ficha) ? ficha[0] : ficha;
    const fichaDados = (record?.dados as FichaAnamneseCapilarDados | undefined) ?? null;
    const extraProfile = row.perfil_complementar || {};
    const savedSignature = extraProfile.assinatura || {};
    const legacySignature = fichaDados?.assinatura;

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
        signature:
          savedSignature.imageDataUrl || savedSignature.signedAt || legacySignature?.assinaturaBD || legacySignature?.dataAssinatura
            ? {
                imageDataUrl: savedSignature.imageDataUrl || legacySignature?.assinaturaBD || undefined,
                signedAt: savedSignature.signedAt || legacySignature?.dataAssinatura || undefined,
              }
            : undefined,
      },
      diagnosticos: (row.diagnostico_capilar || []).map((d: any) => ({
        id: d.id,
        data: d.created_at,
        elasticidade: d.elasticidade,
        porosidade: d.porosidade,
        historiaQuimicaPrevia: d.historia_quimica_previa,
        presencaMetais: d.presenca_metais,
        resultadoTesteMecha: d.resultado_teste_mecha,
      })),
      colorimetrias: (row.historico_procedimentos || []).map((c: any) => ({
        id: c.id,
        data: c.created_at,
        tecnicaUtilizada: c.tecnica_utilizada,
        alturaClareamento: c.altura_clareamento,
        fundoClareamentoObtido: c.fundo_clareamento_obtido,
        misturaTonalizante: c.mistura_tonalizante,
        volumagemOx: c.volumagem_ox,
        valor: c.valor_procedimento,
      })),
      homecare: (row.manutencao_homecare || []).map((m: any) => ({
        id: m.id,
        data: m.created_at,
        produtosRecomendados: m.produtos_recomendados,
        dataRetornoSugerida: m.data_retorno_sugerida,
        obsCuidados: m.obs_cuidados,
      })),
      gallery: (row.client_photos || []).map((p: any) => ({
        id: p.id,
        date: p.created_at,
        url: p.url,
        type: resolvePhotoCategory(p.categoria, p.type, p.url, p.caption),
        caption: sanitizePhotoCaption(p.caption),
        technicalNote: p.anotacao_tecnica || undefined,
      })),
      appointments: sortAppointments((row.agendamentos || []).map((appointment: any) => mapDbAppointment(appointment))),
      preConsultation: {
        token: row.token_pre_consulta || undefined,
        linkActive: row.link_ativo ?? undefined,
        respondedAt: row.pre_consulta_respondida_em || undefined,
      },
      fichaAnamnese: fichaDados,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  });

const readClientsSnapshot = (organizationId: string | null): ClientsSnapshot | null => {
  if (typeof window === "undefined") return null;
  const snapshotKey = getClientsSnapshotKey(organizationId);
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

const persistClientsSnapshot = (clients: Client[], organizationId: string | null): string | null => {
  if (typeof window === "undefined") return null;
  if (!organizationId) return null;
  const snapshotKey = getClientsSnapshotKey(organizationId);
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

async function runPreConsultationLinkMutation(method: "POST" | "PUT", clientId: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token?.trim();

  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const response = await fetch("/api/pre-consultation/link", {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ clientId }),
  });

  const payload = (await response.json().catch(() => null)) as PreConsultationLinkMutationResponse | null;
  if (!response.ok) {
    const fallbackMessage =
      method === "POST"
        ? "Não foi possível gerar o link de triagem agora."
        : "Não foi possível invalidar o link de triagem agora.";

    throw new Error(payload?.error && typeof payload.error === "string" ? payload.error : fallbackMessage);
  }

  return payload ?? {};
}

async function runClientMutation(
  method: "POST" | "PUT",
  payload: Record<string, unknown>,
  fallbackMessage: string
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token?.trim();

  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const response = await fetch("/api/clients", {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
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
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token?.trim();

  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const response = await fetch("/api/clients/records", {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as ClientRecordMutationResponse | null;
  if (!response.ok) {
    throw new Error(result?.error && typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result ?? {};
}

async function removeUploadedClientAsset(storagePath: string) {
  const { error } = await supabase.storage.from("anamnese-fotos").remove([storagePath]);
  if (error) {
    console.error("Falha ao limpar arquivo enviado após erro de persistência:", error);
  }
}

export function useClients() {
  const { activeOrgId } = useOrganizations();
  const organizationId = activeOrgId ?? null;
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const clientsRef = useRef<Client[]>([]);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeAllowShrinkRef = useRef(false);

  const requireOrganizationId = useCallback(() => {
    if (!organizationId) {
      throw new Error("Sua sessão expirou. Entre novamente para continuar.");
    }

    return organizationId;
  }, [organizationId]);

  const commitClients = useCallback((nextClients: Client[]) => {
    const enrichedClients = nextClients.map(enrichClient);
    clientsRef.current = enrichedClients;
    setClients(enrichedClients);
    const savedAt = persistClientsSnapshot(enrichedClients, organizationId);
    if (savedAt) {
      setLastSnapshotAt(savedAt);
    }
  }, [organizationId]);

  const restoreSnapshot = useCallback((warning: string) => {
    const snapshot = readClientsSnapshot(organizationId);
    if (!snapshot?.clients.length) return false;

    clientsRef.current = snapshot.clients;
    setClients(snapshot.clients);
    setLastSnapshotAt(snapshot.savedAt);
    setSyncWarning(warning);
    return true;
  }, [organizationId]);

  // 1. Loader Principal - Consome os 4 módulos do Iluminare Studio
  const loadClients = useCallback(async ({ allowShrink = false, background = false }: { allowShrink?: boolean; background?: boolean } = {}) => {
    try {
      if (!background) {
        setLoading(true);
      }

      if (!organizationId) {
        clientsRef.current = [];
        setClients([]);
        setLastSnapshotAt(null);
        setSyncWarning(null);
        return [];
      }

      const { data: dbClients, error } = await supabase
        .from('clientes')
        .select(`
          *,
          diagnostico_capilar (*),
          historico_procedimentos (*),
          manutencao_homecare (*),
          client_photos (*),
          agendamentos (*),
          ficha_anamnese_capilar (*)
        `)
        .eq("user_id", organizationId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formatted = mapDbClients(dbClients || []);
      const previousCount = clientsRef.current.length;

      if (!allowShrink && previousCount > 0 && formatted.length < previousCount) {
        setSyncWarning(
          `A base online retornou ${formatted.length} cliente(s), abaixo dos ${previousCount} ja carregados. Mantive a cópia local para evitar perda de dados na tela.`
        );
        return clientsRef.current;
      }

      commitClients(formatted);
      setSyncWarning(null);
      return formatted;
    } catch (err) {
      console.error("Falha ao carregar do Iluminare Studio:", err);
      restoreSnapshot("Falha ao ler a base agora. Mantive a ultima copia local salva neste navegador.");
      return clientsRef.current;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [commitClients, organizationId, restoreSnapshot]);

  useEffect(() => {
    const snapshot = readClientsSnapshot(organizationId);
    if (snapshot?.clients.length) {
      clientsRef.current = snapshot.clients;
      setClients(snapshot.clients);
      setLastSnapshotAt(snapshot.savedAt);
    } else if (!organizationId) {
      clientsRef.current = [];
      setClients([]);
      setLastSnapshotAt(null);
      setSyncWarning(null);
    } else {
      clientsRef.current = [];
      setClients([]);
      setLastSnapshotAt(null);
    }

    void loadClients();
  }, [loadClients, organizationId]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const tenantFilter = `user_id=eq.${organizationId}`;

    const scheduleRefresh = ({ allowShrink = false }: { allowShrink?: boolean } = {}) => {
      realtimeAllowShrinkRef.current = realtimeAllowShrinkRef.current || allowShrink;

      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }

      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        const nextAllowShrink = realtimeAllowShrinkRef.current;
        realtimeAllowShrinkRef.current = false;
        realtimeRefreshTimeoutRef.current = null;
        void loadClients({ allowShrink: nextAllowShrink, background: true });
      }, CLIENTS_REALTIME_DEBOUNCE_MS);
    };

    const channel = CLIENTS_REALTIME_TABLES.reduce(
      (currentChannel, table) =>
        currentChannel.on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table, filter: tenantFilter },
          () => {
            scheduleRefresh();
          }
        ).on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table, filter: tenantFilter },
          (payload) => {
            const allowShrink =
              table === "clientes" &&
              Boolean((payload.new as { deleted_at?: string | null } | null)?.deleted_at);

            scheduleRefresh({ allowShrink });
          }
        ),
      supabase.channel(`clients-sync-${organizationId}-${crypto.randomUUID()}`)
    );

    channel.subscribe();

    return () => {
      realtimeAllowShrinkRef.current = false;
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadClients, organizationId]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.profile.nome.toLowerCase().includes(q) ||
        c.profile.whatsapp.includes(q)
    );
  }, [clients, searchQuery]);

  const uploadImage = async (clientId: string, file: File, type?: string): Promise<UploadedImageAsset | null> => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const folder = type ? resolvePhotoCategory(type) : "avatar";
    const fileName = `${clientId}/${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('anamnese-fotos').upload(fileName, file);
    if (error) return null;
    const { data } = supabase.storage.from('anamnese-fotos').getPublicUrl(fileName);
    return {
      publicUrl: data.publicUrl,
      storagePath: fileName,
    };
  };

  const addClient = async (client: Client) => {
    requireOrganizationId();
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
    requireOrganizationId();
    const sanitized = sanitizeObject(updated);
    const avatarFile = photoFiles?.find((item) => item.type === "avatar");
    const galleryFiles = (photoFiles || []).filter((item) => item.type !== "avatar");
    let nextProfile = sanitized.profile;
    let avatarStoragePath: string | null = null;

    if (avatarFile) {
      const avatarUpload = await uploadImage(sanitized.id, avatarFile.file);
      if (!avatarUpload) {
        throw new Error(`Falha ao enviar a foto ${avatarFile.file.name}.`);
      }
      avatarStoragePath = avatarUpload.storagePath;
      nextProfile = {
        ...nextProfile,
        photoUrl: avatarUpload.publicUrl,
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
          perfilComplementar: serializeProfilePayload(nextProfile),
          ...(avatarStoragePath
            ? {
                profilePhotoStorageBucket: "anamnese-fotos",
                profilePhotoStoragePath: avatarStoragePath,
              }
            : {}),
        },
        "Nao foi possivel salvar essa atualizacao no banco."
      );
    } catch (error) {
      if (avatarStoragePath) {
        await removeUploadedClientAsset(avatarStoragePath);
      }

      throw error;
    }

    if (galleryFiles.length > 0) {
      for (const item of galleryFiles) {
        const category = resolvePhotoCategory(item.type);
        const uploadedPhoto = await uploadImage(sanitized.id, item.file, category);
        if (!uploadedPhoto) {
          throw new Error(`Falha ao enviar a foto ${item.file.name}.`);
        }

        try {
          await runClientRecordMutation(
            "POST",
            {
              action: "gallery-photo",
              clientId: sanitized.id,
              url: uploadedPhoto.publicUrl,
              type: category,
              categoria: category,
              caption: null,
              storageBucket: "anamnese-fotos",
              storagePath: uploadedPhoto.storagePath,
            },
            `Falha ao salvar a foto ${item.file.name}.`
          );
        } catch (error) {
          await removeUploadedClientAsset(uploadedPhoto.storagePath);
          throw error;
        }
      }
    }

    const nextClients = clientsRef.current.map((client) =>
      client.id === sanitized.id
        ? {
            ...client,
            profile: {
              ...client.profile,
              ...nextProfile,
            },
            updatedAt: new Date().toISOString(),
          }
        : client
    );

    commitClients(nextClients);
    await loadClients();
  };

  const deletePhoto = async (clientId: string, photoId: string) => {
    const client = clientsRef.current.find((entry) => entry.id === clientId);
    const photo = client?.gallery.find((entry) => entry.id === photoId);

    if (!client || !photo) {
      throw new Error("A foto selecionada nao foi encontrada.");
    }

    await adminPostJson(
      "/api/admin/archive/photo",
      {
        photoId,
        reason: `Arquivamento da foto ${normalizePhotoCategory(photo.type)} via galeria da paciente.`,
      },
      "Informe a chave administrativa para arquivar esta foto em quarentena privada."
    );

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
    requireOrganizationId();
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

    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, diagnosticos: [novoDiagnostico, ...client.diagnosticos], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);

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
    requireOrganizationId();
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

    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, colorimetrias: [novo, ...client.colorimetrias], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);

    return novo;
  };

  const addHomecare = async (
    clientId: string,
    input: {
      produtosRecomendados: string;
      obsCuidados?: string;
      dataRetornoSugerida?: string;
    }
  ): Promise<ManutencaoHomecare> => {
    requireOrganizationId();
    const response = await runClientRecordMutation(
      "POST",
      {
        action: "homecare",
        clientId,
        produtosRecomendados: input.produtosRecomendados,
        obsCuidados: input.obsCuidados || null,
        dataRetornoSugerida: input.dataRetornoSugerida || null,
      },
      "Falha ao salvar homecare."
    );

    const data = response.record as {
      id: string;
      created_at: string;
      produtos_recomendados?: string | null;
      obs_cuidados?: string | null;
      data_retorno_sugerida?: string | null;
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
    };

    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId
        ? { ...client, homecare: [novoHomecare, ...client.homecare], updatedAt: new Date().toISOString() }
        : client
    );
    commitClients(nextClients);

    return novoHomecare;
  };

  const saveFichaAnamnese = async (clientId: string, dados: FichaAnamneseCapilarDados): Promise<FichaAnamneseCapilarDados> => {
    requireOrganizationId();
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
    const nextClients = clientsRef.current.map((client) =>
      client.id === clientId ? { ...client, fichaAnamnese: next, updatedAt: new Date().toISOString() } : client
    );
    commitClients(nextClients);
    return next;
  };

  const addAppointment = async (clientId: string, input: AppointmentDraft): Promise<ClientAppointment> => {
    requireOrganizationId();
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
    requireOrganizationId();
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
    await adminPostJson(
      "/api/admin/archive/client",
      {
        clientId: id,
        reason: "Arquivamento administrativo da paciente com recuperacao posterior disponivel.",
      },
      "Informe a chave administrativa para arquivar esta paciente com recuperacao posterior."
    );

    commitClients(clientsRef.current.filter((client) => client.id !== id));
    await loadClients({ allowShrink: true });
  };

  const issuePreConsultationToken = async (clientId: string) => {
    const row = await runPreConsultationLinkMutation("POST", clientId);
    const token = row.token;

    if (!token) {
      throw new Error("O link de triagem não retornou um código válido.");
    }

    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              preConsultation: { token, linkActive: row.linkActive ?? true, respondedAt: row.respondedAt ?? undefined },
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );

    return token;
  };

  const deactivatePreConsultationToken = async (clientId: string) => {
    const row = await runPreConsultationLinkMutation("PUT", clientId);

    commitClients(
      clientsRef.current.map((client) =>
        client.id === clientId
          ? {
              ...client,
              preConsultation: {
                token: row.token ?? client.preConsultation?.token,
                linkActive: row.linkActive ?? false,
                respondedAt: row.respondedAt ?? client.preConsultation?.respondedAt,
              },
              updatedAt: new Date().toISOString(),
            }
          : client
      )
    );
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
    addHomecare,
    saveFichaAnamnese,
    addAppointment,
    linkAppointmentToGoogle,
    deletePhoto,
    deleteClient,
    issuePreConsultationToken,
    deactivatePreConsultationToken,
    loading,
    syncWarning,
    lastSnapshotAt,
    refreshClients: loadClients,
  };
}
