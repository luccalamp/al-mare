"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CompanyDocument, CompanyDocumentFolder } from "@/types";

import { supabase } from "@/lib/supabaseClient";

const COMPANY_DOCUMENTS_REALTIME_DEBOUNCE_MS = 300;

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
        return "Sua sessÃ£o atual nÃ£o permite concluir esta operaÃ§Ã£o.";
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

type CompanyDocumentsWorkspaceResponse = {
  folders?: unknown[];
  documents?: unknown[];
  error?: string;
};

async function runCompanyDocumentMutation(
  method: "POST" | "PUT",
  payload: Record<string, unknown>,
  fallbackMessage: string
) {
  const response = await fetch("/api/company-documents", {
    method,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = (await response.json().catch(() => null)) as CompanyDocumentMutationResponse | null;
  if (!response.ok) {
    throw new Error(result?.error && typeof result.error === "string" ? result.error : fallbackMessage);
  }

  return result ?? {};
}

export function useCompanyDocuments() {
  const [folders, setFolders] = useState<CompanyDocumentFolder[]>([]);
  const [documents, setDocuments] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const realtimeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWorkspace = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    try {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      const response = await fetch("/api/company-documents", { method: "GET", cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as CompanyDocumentsWorkspaceResponse | null;

      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel carregar a central de arquivos agora.");
      }

      const folders = Array.isArray(payload?.folders) ? payload.folders : [];
      const documents = Array.isArray(payload?.documents) ? payload.documents : [];

      setFolders(sortFolders(folders.map(mapFolder)));
      setDocuments(sortDocuments(documents.map(mapDocument)));
    } catch (loadError) {
      console.error(loadError);
      setError(buildErrorMessage(loadError, "Nao foi possivel carregar a central de arquivos agora."));
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
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
      .channel(`company-documents-sync-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_document_folders" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "company_document_folders" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "company_documents" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "company_documents" },
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
  }, [loadWorkspace]);

  const createFolder = useCallback(async (name: string, notes = "") => {
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
  }, []);

  const updateFolderNotes = useCallback(async (folderId: string, notes: string) => {
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
  }, []);

  const uploadDocuments = useCallback(async (folderId: string, files: File[]) => {
    if (!folderId) {
      throw new Error("Selecione uma pasta para receber os arquivos.");
    }

    if (!files.length) {
      return [] as CompanyDocument[];
    }

    try {
      setSyncing(true);
      setError(null);

      const formData = new FormData();
      formData.set("folderId", folderId);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as { documents?: unknown[]; error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel enviar os documentos agora.");
      }

      const createdDocuments = Array.isArray(payload?.documents)
        ? payload.documents.map(mapDocument)
        : [];

      setDocuments((current) => sortDocuments([...createdDocuments, ...current]));
      return createdDocuments;
    } catch (uploadError) {
      throw new Error(buildErrorMessage(uploadError, "Nao foi possivel enviar os documentos agora."));
    } finally {
      setSyncing(false);
    }
  }, []);

  const deleteDocument = useCallback(
    async (documentId: string) => {
      const document = documents.find((entry) => entry.id === documentId);
      if (!document) {
        throw new Error("O documento selecionado nao foi encontrado.");
      }

      try {
        setSyncing(true);
        setError(null);

        const response = await fetch("/api/documents", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            documentId,
            reason: `Arquivamento do documento ${document.fileName} na central da empresa.`,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error && typeof payload.error === "string"
              ? payload.error
              : "Nao foi possivel remover o documento agora."
          );
        }

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
