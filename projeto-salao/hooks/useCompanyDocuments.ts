"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyDocument, CompanyDocumentFolder } from "@/types";
import { adminPostJson } from "@/lib/adminApi";
import { useOrganizations } from "@/components/OrganizationProvider";
import { supabase } from "@/lib/supabaseClient";

const COMPANY_DOCUMENT_BUCKET = "company-documents";
const COMPANY_DOCUMENTS_REALTIME_DEBOUNCE_MS = 300;

function sanitizeSegment(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "arquivo"
  );
}

function stripExtension(fileName: string) {
  const lastDot = fileName.lastIndexOf(".");
  return lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
}

function normalizeNotes(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function sortFolders(folders: CompanyDocumentFolder[]) {
  return [...folders].sort((left, right) => {
    const leftIsDefault = left.name.toLowerCase() === "geral";
    const rightIsDefault = right.name.toLowerCase() === "geral";

    if (leftIsDefault && !rightIsDefault) return -1;
    if (!leftIsDefault && rightIsDefault) return 1;
    return left.name.localeCompare(right.name, "pt-BR");
  });
}

function sortDocuments(documents: CompanyDocument[]) {
  return [...documents].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
}

function mapFolder(row: any): CompanyDocumentFolder {
  return {
    id: row.id,
    name: row.nome,
    notes: typeof row.notas === "string" ? row.notas : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDocument(row: any): CompanyDocument {
  const folderRelation = Array.isArray(row.company_document_folders)
    ? row.company_document_folders[0]
    : row.company_document_folders;

  return {
    id: row.id,
    folderId: row.folder_id,
    folderName: folderRelation?.nome || "Sem pasta",
    name: row.nome,
    fileName: row.arquivo_nome,
    mimeType: row.mime_type || undefined,
    sizeBytes: Number(row.tamanho_bytes || 0),
    url: row.public_url,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      if (/organization_context_required|not_authorized_for_organization|row-level security/i.test(message)) {
        return "Sua sessão atual não permite concluir esta operação.";
      }
      if (/duplicate key value|already exists|idx_company_document_folders_nome_unique/i.test(message)) {
        return "Ja existe uma pasta com esse nome.";
      }
      return message;
    }
  }

  return fallback;
}

type CompanyDocumentMutationResponse = {
  record?: unknown;
  error?: string;
};

async function runCompanyDocumentMutation(
  method: "POST" | "PUT",
  payload: Record<string, unknown>,
  fallbackMessage: string
) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token?.trim();

  if (!accessToken) {
    throw new Error("Sua sessão expirou. Entre novamente para continuar.");
  }

  const response = await fetch("/api/company-documents", {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as CompanyDocumentMutationResponse | null;
  if (!response.ok) {
    throw new Error(result?.error && typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result ?? {};
}

async function removeUploadedCompanyDocument(storagePath: string) {
  const { error } = await supabase.storage.from(COMPANY_DOCUMENT_BUCKET).remove([storagePath]);
  if (error) {
    console.error("Falha ao limpar documento enviado após erro de persistência:", error);
  }
}

export function useCompanyDocuments() {
  const { activeOrgId } = useOrganizations();
  const organizationId = activeOrgId ?? null;
  const [folders, setFolders] = useState<CompanyDocumentFolder[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requireOrganizationId = useCallback(() => {
    if (!organizationId) {
      throw new Error("Sua sessão expirou. Entre novamente para continuar.");
    }

    return organizationId;
  }, [organizationId]);

  const loadWorkspace = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    try {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      if (!organizationId) {
        setFolders([]);
        setDocuments([]);
        return;
      }

      const [foldersResult, documentsResult] = await Promise.all([
        supabase
          .from("company_document_folders")
          .select("*")
          .eq("user_id", organizationId)
          .order("created_at", { ascending: true }),
        supabase
          .from("company_documents")
          .select(
            "id, folder_id, nome, arquivo_nome, mime_type, tamanho_bytes, storage_path, public_url, created_at, updated_at, company_document_folders(nome)"
          )
          .eq("user_id", organizationId)
          .order("created_at", { ascending: false }),
      ]);

      if (foldersResult.error) throw foldersResult.error;
      if (documentsResult.error) throw documentsResult.error;

      setFolders(sortFolders((foldersResult.data || []).map(mapFolder)));
      setDocuments(sortDocuments((documentsResult.data || []).map(mapDocument)));
    } catch (loadError) {
      console.error(loadError);
      setError(buildErrorMessage(loadError, "Nao foi possivel carregar a central de arquivos agora."));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, [organizationId]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace, organizationId]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    const tenantFilter = `user_id=eq.${organizationId}`;

    const scheduleRefresh = () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
      }

      realtimeRefreshTimeoutRef.current = setTimeout(() => {
        realtimeRefreshTimeoutRef.current = null;
        void loadWorkspace({ background: true });
      }, COMPANY_DOCUMENTS_REALTIME_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`company-documents-sync-${organizationId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_document_folders", filter: tenantFilter },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "company_document_folders", filter: tenantFilter },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_documents", filter: tenantFilter },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "company_documents", filter: tenantFilter },
        scheduleRefresh
      );

    channel.subscribe();

    return () => {
      if (realtimeRefreshTimeoutRef.current) {
        clearTimeout(realtimeRefreshTimeoutRef.current);
        realtimeRefreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [loadWorkspace, organizationId]);

  const createFolder = useCallback(async (name: string, notes = "") => {
    requireOrganizationId();
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Informe o nome da pasta antes de salvar.");
    }

    try {
      setSyncing(true);
      setError(null);

      const response = await runCompanyDocumentMutation(
        "POST",
        {
          action: "create-folder",
          name: trimmedName,
          notes: normalizeNotes(notes),
        },
        "Nao foi possivel criar a pasta agora."
      );

      const data = response.record;
      if (!data) {
        throw new Error("Nao foi possivel criar a pasta agora.");
      }

      const folder = mapFolder(data);
      setFolders((current) => sortFolders([...current, folder]));
      return folder;
    } catch (createError) {
      throw new Error(buildErrorMessage(createError, "Nao foi possivel criar a pasta agora."));
    } finally {
      setSyncing(false);
    }
  }, [requireOrganizationId]);

  const updateFolderNotes = useCallback(async (folderId: string, notes: string) => {
    requireOrganizationId();
    if (!folderId) {
      throw new Error("Selecione uma pasta antes de salvar o texto.");
    }

    try {
      setSyncing(true);
      setError(null);

      const response = await runCompanyDocumentMutation(
        "PUT",
        {
          action: "update-folder-notes",
          folderId,
          notes: normalizeNotes(notes),
        },
        "Nao foi possivel salvar o texto da pasta agora."
      );

      const data = response.record;
      if (!data) {
        throw new Error("Nao foi possivel salvar o texto da pasta agora.");
      }

      const updatedFolder = mapFolder(data);
      setFolders((current) =>
        sortFolders(current.map((folder) => (folder.id === updatedFolder.id ? updatedFolder : folder)))
      );
      return updatedFolder;
    } catch (saveError) {
      throw new Error(buildErrorMessage(saveError, "Nao foi possivel salvar o texto da pasta agora."));
    } finally {
      setSyncing(false);
    }
  }, [requireOrganizationId]);

  const uploadDocuments = useCallback(async (folderId: string, files: File[]) => {
    requireOrganizationId();
    if (!folderId) {
      throw new Error("Selecione uma pasta para receber os arquivos.");
    }

    if (!files.length) {
      return [] as CompanyDocument[];
    }

    try {
      setSyncing(true);
      setError(null);

      const createdDocuments: CompanyDocument[] = [];

      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase();
        const baseName = sanitizeSegment(stripExtension(file.name));
        const storagePath = `${folderId}/${Date.now()}-${crypto.randomUUID()}${extension ? `-${baseName}.${extension}` : `-${baseName}`}`;

        const { error: uploadError } = await supabase.storage.from(COMPANY_DOCUMENT_BUCKET).upload(storagePath, file);
        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage.from(COMPANY_DOCUMENT_BUCKET).getPublicUrl(storagePath);

        let data: unknown = null;

        try {
          const response = await runCompanyDocumentMutation(
            "POST",
            {
              action: "register-document",
              folderId,
              name: stripExtension(file.name),
              fileName: file.name,
              mimeType: file.type || null,
              sizeBytes: file.size,
              storageBucket: COMPANY_DOCUMENT_BUCKET,
              storagePath,
              publicUrl: publicUrlData.publicUrl,
            },
            `Nao foi possivel registrar ${file.name} agora.`
          );

          data = response.record;
          if (!data) {
            throw new Error(`Nao foi possivel registrar ${file.name} agora.`);
          }
        } catch (insertError) {
          await removeUploadedCompanyDocument(storagePath);
          throw insertError;
        }

        createdDocuments.push(mapDocument(data));
      }

      setDocuments((current) => sortDocuments([...createdDocuments, ...current]));
      return createdDocuments;
    } catch (uploadError) {
      throw new Error(buildErrorMessage(uploadError, "Nao foi possivel enviar os documentos agora."));
    } finally {
      setSyncing(false);
    }
  }, [requireOrganizationId]);

  const deleteDocument = useCallback(
    async (documentId: string) => {
      const document = documents.find((entry) => entry.id === documentId);
      if (!document) {
        throw new Error("O documento selecionado nao foi encontrado.");
      }

      try {
        setSyncing(true);
        setError(null);

        await adminPostJson(
          "/api/admin/archive/document",
          {
            documentId,
            reason: `Arquivamento do documento ${document.fileName} na central da empresa.`,
          },
          "Informe a chave administrativa para arquivar este documento em quarentena privada."
        );

        setDocuments((current) => current.filter((entry) => entry.id !== documentId));
      } catch (removeError) {
        throw new Error(buildErrorMessage(removeError, "Nao foi possivel remover o documento agora."));
      } finally {
        setSyncing(false);
      }
    },
    [documents]
  );

  return {
    folders,
    documents,
    loading,
    syncing,
    error,
    reload: loadWorkspace,
    createFolder,
    updateFolderNotes,
    uploadDocuments,
    deleteDocument,
  };
}