"use client";

import { useEffect, useMemo, useState } from "react";
import { CompanyDocument } from "@/types";
import BrandLogo from "@/components/BrandLogo";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { useCompanyDocuments } from "@/hooks/useCompanyDocuments";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ExternalLink,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  FolderPlus,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

interface DocumentsWindowProps {
  onClose: () => void;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatBytes(value: number) {
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const size = value / 1024 ** index;
  return `${size >= 10 || index === 0 ? Math.round(size) : size.toFixed(1)} ${units[index]}`;
}

function renderDocumentIcon(document: CompanyDocument) {
  if (document.mimeType?.startsWith("image/")) {
    return <FileImage size={18} />;
  }

  if (document.mimeType?.includes("sheet") || document.mimeType?.includes("excel") || document.fileName.endsWith(".csv")) {
    return <FileSpreadsheet size={18} />;
  }

  if (document.mimeType?.includes("pdf") || document.mimeType?.includes("text") || document.mimeType?.includes("word")) {
    return <FileText size={18} />;
  }

  return <FileArchive size={18} />;
}

export default function DocumentsWindow({ onClose }: DocumentsWindowProps) {
  const { config: branding } = useBrandingConfig();
  const { folders, documents, loading, syncing, error, createFolder, updateFolderNotes, uploadDocuments, deleteDocument } = useCompanyDocuments();
  const [selectedFolderId, setSelectedFolderId] = useState<string>("all");
  const [folderDraft, setFolderDraft] = useState("");
  const [folderNoteDraft, setFolderNoteDraft] = useState("");
  const [newFolderNoteDraft, setNewFolderNoteDraft] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error">("success");
  const [uploading, setUploading] = useState(false);
  const [savingFolderNote, setSavingFolderNote] = useState(false);
  const [removingDocumentId, setRemovingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFolderId === "all") return;
    if (folders.length > 0 && !folders.some((folder) => folder.id === selectedFolderId)) {
      setSelectedFolderId("all");
    }
  }, [folders, selectedFolderId]);

  const selectedFolder = selectedFolderId === "all" ? null : folders.find((folder) => folder.id === selectedFolderId) ?? null;
  const targetFolderId = selectedFolder?.id ?? folders[0]?.id ?? null;
  const folderNoteDirty = (selectedFolder?.notes ?? "") !== folderNoteDraft;

  useEffect(() => {
    setFolderNoteDraft(selectedFolder?.notes ?? "");
  }, [selectedFolder?.id, selectedFolder?.notes, selectedFolder?.updatedAt]);

  const visibleDocuments = useMemo(() => {
    if (selectedFolderId === "all") return documents;
    return documents.filter((document) => document.folderId === selectedFolderId);
  }, [documents, selectedFolderId]);

  const totalSize = useMemo(
    () => visibleDocuments.reduce((accumulator, document) => accumulator + document.sizeBytes, 0),
    [visibleDocuments]
  );

  const applyFeedback = (tone: "success" | "error", message: string) => {
    setFeedbackTone(tone);
    setFeedback(message);
  };

  const handleCreateFolder = async () => {
    const name = folderDraft.trim();
    if (!name) return;

    try {
      setFeedback(null);
      const createdFolder = await createFolder(name, newFolderNoteDraft);
      setFolderDraft("");
      setNewFolderNoteDraft("");
      setSelectedFolderId(createdFolder.id);
      applyFeedback("success", "Pasta criada com sucesso.");
    } catch (createError) {
      console.error(createError);
      applyFeedback(
        "error",
        createError instanceof Error ? createError.message : "Nao foi possivel criar a pasta agora."
      );
    }
  };

  const handleSaveFolderNote = async () => {
    if (!selectedFolder) return;

    try {
      setSavingFolderNote(true);
      setFeedback(null);
      const updatedFolder = await updateFolderNotes(selectedFolder.id, folderNoteDraft);
      setFolderNoteDraft(updatedFolder.notes ?? "");
      applyFeedback("success", "Texto da pasta salvo com sucesso.");
    } catch (saveError) {
      console.error(saveError);
      applyFeedback(
        "error",
        saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o texto da pasta agora."
      );
    } finally {
      setSavingFolderNote(false);
    }
  };

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length || !targetFolderId) return;

    try {
      setUploading(true);
      setFeedback(null);
      await uploadDocuments(targetFolderId, files);
      applyFeedback(
        "success",
        files.length === 1 ? "Documento enviado com sucesso." : `${files.length} documentos enviados com sucesso.`
      );
    } catch (uploadError) {
      console.error(uploadError);
      applyFeedback(
        "error",
        uploadError instanceof Error ? uploadError.message : "Nao foi possivel enviar os documentos agora."
      );
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (document: CompanyDocument) => {
    const confirmed = window.confirm(`Arquivar o documento ${document.fileName} e mover o arquivo para quarentena privada?`);
    if (!confirmed) return;

    try {
      setRemovingDocumentId(document.id);
      setFeedback(null);
      await deleteDocument(document.id);
      applyFeedback("success", "Documento arquivado com sucesso e enviado para quarentena privada.");
    } catch (removeError) {
      console.error(removeError);
      applyFeedback(
        "error",
        removeError instanceof Error ? removeError.message : "Nao foi possivel arquivar o documento agora."
      );
    } finally {
      setRemovingDocumentId(null);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.1)", backdropFilter: "blur(6px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px]"
          style={{
            background: "rgba(255, 255, 255, 0.78)",
            backdropFilter: "blur(32px) saturate(1.8)",
            border: "1px solid rgba(255, 255, 255, 0.4)",
            boxShadow: "0 40px 100px rgba(0,0,0,0.15)",
          }}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-3 border-b border-black/5 px-4 py-4 sm:px-6">
            <button onClick={onClose} className="h-5 w-5 rounded-full bg-[#ff5f57] sm:h-3 sm:w-3" aria-label="Fechar janela" />
            <div className="flex flex-1 items-center justify-center gap-3">
              <Building2 size={16} className="text-[var(--color-brand-accent)]" />
              <BrandLogo compact />
            </div>
            <div className="w-8" />
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="rounded-[30px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">{branding.documentsTitle}</p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--color-text)]">{branding.documentsTitle}</h3>
                  <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
                    {branding.documentsDescription}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-2xl bg-white/70 px-3 py-3 text-[var(--color-brand-deep)]">
                    <strong className="block text-lg">{folders.length}</strong>
                    Pastas
                  </div>
                  <div className="rounded-2xl bg-white/70 px-3 py-3 text-[var(--color-brand-deep)]">
                    <strong className="block text-lg">{documents.length}</strong>
                    {branding.documentsLabel}
                  </div>
                  <div className="rounded-2xl bg-white/70 px-3 py-3 text-[var(--color-brand-deep)]">
                    <strong className="block text-lg">{formatBytes(totalSize)}</strong>
                    Volume
                  </div>
                </div>
              </div>
              <p className={`mt-3 text-xs ${syncing || uploading ? "text-[var(--color-brand-deep)]" : "text-[#6e6e73]"}`}>
                {syncing || uploading ? "Sincronizando central de arquivos na nuvem." : "Base pronta para novas pastas e uploads."}
              </p>
            </div>

            {(feedback || error) && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  (feedbackTone === "error" || error)
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800"
                }`}
              >
                {error || feedback}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-brand-line)] bg-white/80 px-5 py-4 text-sm text-[var(--color-brand-deep)] shadow-[0_12px_34px_rgba(94,58,28,0.08)]">
                  <Loader2 size={16} className="animate-spin" /> Carregando documentos da clínica...
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <section className="rounded-[30px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
                  <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">
                    <FolderOpen size={14} /> Pastas internas
                  </div>
                  <div className="mt-4 space-y-3">
                    <input
                      className="input-light"
                      value={folderDraft}
                      onChange={(event) => setFolderDraft(event.target.value)}
                      placeholder="Ex.: Contratos, financeiro, fornecedores"
                    />
                    <textarea
                      className="input-light min-h-[112px] resize-y"
                      value={newFolderNoteDraft}
                      onChange={(event) => setNewFolderNoteDraft(event.target.value)}
                      placeholder="Texto principal opcional da pasta: orientacoes, observacoes ou pontos importantes."
                    />
                    <button
                      type="button"
                      onClick={() => void handleCreateFolder()}
                      disabled={!folderDraft.trim() || syncing}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                    >
                      <FolderPlus size={16} /> Nova pasta
                    </button>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId("all")}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                        selectedFolderId === "all"
                          ? "bg-[#7a4921] text-white"
                          : "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] hover:bg-white"
                      }`}
                    >
                      Todas as pastas
                    </button>
                    {folders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setSelectedFolderId(folder.id)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                          selectedFolderId === folder.id
                            ? "bg-[#7a4921] text-white"
                            : "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)] hover:bg-white"
                        }`}
                      >
                        {folder.name}
                        {folder.notes ? <FileText size={12} aria-hidden="true" /> : null}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 rounded-[24px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-4 shadow-[0_12px_34px_rgba(94,58,28,0.06)]">
                    {selectedFolder ? (
                      <>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--color-brand-accent)]">
                              <FileText size={14} /> Texto principal da pasta
                            </div>
                            <h4 className="mt-2 text-base font-semibold text-[var(--color-text)]">{selectedFolder.name}</h4>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                              Salve recados, instrucoes, dados de contato ou qualquer conteudo importante ligado a esta pasta.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSaveFolderNote()}
                            disabled={!folderNoteDirty || savingFolderNote || syncing}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)] disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {savingFolderNote ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                            Salvar texto
                          </button>
                        </div>

                        <textarea
                          className="input-light mt-4 min-h-[160px] resize-y"
                          value={folderNoteDraft}
                          onChange={(event) => setFolderNoteDraft(event.target.value)}
                          placeholder="Escreva o texto principal desta pasta."
                        />

                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-secondary)]">
                          <span>
                            {folderNoteDraft.trim()
                              ? "Este texto fica salvo na pasta selecionada e reaparece quando ela for aberta."
                              : "Esta pasta ainda nao tem um texto principal salvo."}
                          </span>
                          <span>Atualizada em {formatDate(selectedFolder.updatedAt)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Selecione uma pasta para escrever e salvar o texto principal dela.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-4 text-sm text-[var(--color-text-secondary)]">
                    Os arquivos ativos ficam em armazenamento protegido e os itens arquivados seguem para uma área privada com possibilidade de restauração administrativa.
                  </div>
                </section>

                <section className="rounded-[30px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Acervo da empresa</p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">
                        {selectedFolder ? `${branding.documentsTitle} em ${selectedFolder.name}` : branding.documentsTitle}
                      </h3>
                    </div>

                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white">
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {targetFolderId
                        ? `Enviar para ${selectedFolder?.name || folders[0]?.name || "pasta padrão"}`
                        : "Crie uma pasta primeiro"}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => void handleUpload(event)}
                        disabled={!targetFolderId || uploading}
                      />
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3">
                    {visibleDocuments.length === 0 ? (
                      <div className="rounded-[24px] border border-dashed border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-6 text-sm text-[var(--color-text-secondary)]">
                        Nenhum documento nesta visualização ainda. Crie uma pasta ou envie o primeiro arquivo da clínica.
                      </div>
                    ) : (
                      visibleDocuments.map((document) => (
                        <div
                          key={document.id}
                          className="flex flex-col gap-4 rounded-[24px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-4 shadow-[0_12px_34px_rgba(94,58,28,0.06)] sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-deep)] shadow-sm">
                              {renderDocumentIcon(document)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-[var(--color-text)]">{document.name}</p>
                              <p className="truncate text-xs text-[var(--color-text-secondary)]">{document.fileName}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                                <span className="rounded-full bg-white px-2 py-1 font-semibold text-[var(--color-brand-deep)]">
                                  {document.folderName}
                                </span>
                                <span>{formatBytes(document.sizeBytes)}</span>
                                <span>{formatDate(document.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <button
                              type="button"
                              onClick={() => window.open(document.url, "_blank", "noopener,noreferrer")}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
                            >
                              <ExternalLink size={15} /> Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(document)}
                              disabled={removingDocumentId === document.id}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {removingDocumentId === document.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                              Arquivar
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}