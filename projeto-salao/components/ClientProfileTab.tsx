"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Client, ClientProfile } from "@/types";
import { getClientAvatarUrl } from "@/lib/clientMedia";
import { AlertTriangle, Loader2, Save, Upload, User } from "lucide-react";
import ImageGridComposer from "./ImageGridComposer";

type ClientUpdateHandler = (client: Client, photoFiles?: { file: File; type: string }[]) => Promise<void> | void;

type EditableProfile = {
  nome: string;
  whatsapp: string;
  instagramHandle: string;
  dataAniversario: string;
  acquisitionChannel: string;
  endereco: string;
  bairro: string;
  cidadeEstado: string;
  cep: string;
  telResidencial: string;
  telComercial: string;
  email: string;
  profissao: string;
  estadoCivil: string;
};

const fieldLabel = "text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider";

function toEditableProfile(profile: ClientProfile): EditableProfile {
  return {
    nome: profile.nome,
    whatsapp: profile.whatsapp,
    instagramHandle: profile.instagramHandle || "",
    dataAniversario: profile.dataAniversario || "",
    acquisitionChannel: profile.acquisitionChannel || "",
    endereco: profile.endereco || "",
    bairro: profile.bairro || "",
    cidadeEstado: profile.cidadeEstado || "",
    cep: profile.cep || "",
    telResidencial: profile.telResidencial || "",
    telComercial: profile.telComercial || "",
    email: profile.email || "",
    profissao: profile.profissao || "",
    estadoCivil: profile.estadoCivil || "",
  };
}

interface ClientProfileTabProps {
  client: Client;
  onUpdate: ClientUpdateHandler;
  onDeleteClient: (clientId: string) => Promise<void>;
}

export default function ClientProfileTab({
  client,
  onUpdate,
  onDeleteClient,
}: ClientProfileTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditableProfile>(() => toEditableProfile(client.profile));
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(() => getClientAvatarUrl(client));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignatureStroke, setHasSignatureStroke] = useState(
    Boolean(client.profile.signature?.imageDataUrl || client.fichaAnamnese?.assinatura?.assinaturaBD)
  );

  const currentSignature = client.profile.signature?.imageDataUrl || client.fichaAnamnese?.assinatura?.assinaturaBD;
  const currentSignedAt = client.profile.signature?.signedAt || client.fichaAnamnese?.assinatura?.dataAssinatura;

  const initCanvas = useCallback(
    (signatureData?: string) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(ratio, ratio);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (!signatureData) return;

      const img = new Image();
      img.onload = () => {
        const context = canvas.getContext("2d");
        if (!context) return;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, rect.width, rect.height);
        context.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = signatureData;
    },
    []
  );

  useEffect(() => {
    setForm(toEditableProfile(client.profile));
    setAvatarPreview(getClientAvatarUrl(client));
    setAvatarFile(null);
    setHasSignatureStroke(Boolean(currentSignature));
    setFeedback(null);
    setError(null);
  }, [client, currentSignature]);

  useEffect(() => {
    initCanvas(currentSignature);
  }, [currentSignature, initCanvas]);

  useEffect(() => {
    const handleResize = () => initCanvas(currentSignature);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentSignature, initCanvas]);

  const updateField = <K extends keyof EditableProfile>(field: K, value: EditableProfile[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event);
    if (!point) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    setIsDrawing(true);
    setHasSignatureStroke(true);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const point = getCanvasPoint(event);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!point || !canvas || !ctx) return;
    event.preventDefault();
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (ctx) ctx.closePath();
    if (canvas && event) {
      canvas.releasePointerCapture?.(event.pointerId);
    }
  };

  const clearSignature = () => {
    initCanvas();
    setHasSignatureStroke(false);
    setFeedback("Assinatura removida. Salve o perfil para concluir.");
  };

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida para a foto do perfil.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(typeof reader.result === "string" ? reader.result : undefined);
      setAvatarFile(file);
      setFeedback("Nova foto pronta. Salve o perfil para aplicar.");
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Selecione uma imagem válida para importar a assinatura.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl.startsWith("data:image/")) {
        setError("Formato de assinatura inválido.");
        return;
      }
      setHasSignatureStroke(true);
      initCanvas(dataUrl);
      setFeedback("Assinatura importada. Salve o perfil para concluir.");
    };
    reader.readAsDataURL(file);

    if (signatureInputRef.current) {
      signatureInputRef.current.value = "";
    }
  };

  const buildSignature = () => {
    if (!hasSignatureStroke) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!imageDataUrl.startsWith("data:image/")) {
      throw new Error("Formato de assinatura inválido.");
    }
    if (imageDataUrl.length > 1024 * 1024) {
      throw new Error("A assinatura ficou muito grande. Tente refazer com um traço mais simples.");
    }
    return {
      imageDataUrl,
      signedAt: currentSignedAt || new Date().toISOString(),
    };
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      setError(null);
      setFeedback(null);

      const nextSignature = buildSignature();
      const updatedClient: Client = {
        ...client,
        profile: {
          ...client.profile,
          nome: form.nome,
          whatsapp: form.whatsapp,
          instagramHandle: form.instagramHandle || undefined,
          dataAniversario: form.dataAniversario || undefined,
          acquisitionChannel: form.acquisitionChannel || undefined,
          endereco: form.endereco || undefined,
          bairro: form.bairro || undefined,
          cidadeEstado: form.cidadeEstado || undefined,
          cep: form.cep || undefined,
          telResidencial: form.telResidencial || undefined,
          telComercial: form.telComercial || undefined,
          email: form.email || undefined,
          profissao: form.profissao || undefined,
          estadoCivil: form.estadoCivil || undefined,
          signature: nextSignature,
        },
        updatedAt: new Date().toISOString(),
      };

      const files = avatarFile ? [{ file: avatarFile, type: "avatar" }] : undefined;
      await Promise.resolve(onUpdate(updatedClient, files));
      setAvatarFile(null);
      setFeedback("Perfil salvo com sucesso.");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil agora.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirmText.trim().toLowerCase() !== "arquivar") {
      setError('Digite "arquivar" para confirmar o arquivamento.');
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);
      await onDeleteClient(client.id);
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível arquivar a paciente agora.");
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <div className="flex flex-col items-start gap-3 lg:w-[220px]">
            <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-white bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 shadow-sm">
              {avatarPreview ? (
                <NextImage src={avatarPreview} alt={form.nome} fill sizes="112px" className="object-cover" unoptimized />
              ) : (
                <User size={54} strokeWidth={1} />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#1d1d1f]">{form.nome || client.profile.nome}</h2>
              <p className="text-sm font-medium text-[var(--color-brand-accent)]">{form.whatsapp || client.profile.whatsapp}</p>
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-[var(--color-brand-soft)]"
            >
              <Upload size={16} /> Atualizar foto do perfil
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarSelect}
              className="hidden"
            />
            <p className="text-xs leading-5 text-[var(--color-text-secondary)]">
              A foto do perfil alimenta a pasta do paciente e os cards internos da plataforma.
            </p>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Perfil da paciente</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--color-text)]">Cadastro base para importar na ficha clínica</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className={fieldLabel}>
                Nome completo
                <input className="input-light mt-2" value={form.nome} onChange={(event) => updateField("nome", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                WhatsApp
                <input className="input-light mt-2" value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Instagram
                <input className="input-light mt-2" value={form.instagramHandle} onChange={(event) => updateField("instagramHandle", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Data de nascimento
                <input type="date" className="input-light mt-2" value={form.dataAniversario} onChange={(event) => updateField("dataAniversario", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                E-mail
                <input type="email" className="input-light mt-2" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Canal de aquisição
                <input className="input-light mt-2" value={form.acquisitionChannel} onChange={(event) => updateField("acquisitionChannel", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Profissão
                <input className="input-light mt-2" value={form.profissao} onChange={(event) => updateField("profissao", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Estado civil
                <input className="input-light mt-2" value={form.estadoCivil} onChange={(event) => updateField("estadoCivil", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Telefone residencial
                <input className="input-light mt-2" value={form.telResidencial} onChange={(event) => updateField("telResidencial", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Telefone comercial
                <input className="input-light mt-2" value={form.telComercial} onChange={(event) => updateField("telComercial", event.target.value)} />
              </label>
              <label className={`${fieldLabel} md:col-span-2`}>
                Endereço
                <input className="input-light mt-2" value={form.endereco} onChange={(event) => updateField("endereco", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Bairro
                <input className="input-light mt-2" value={form.bairro} onChange={(event) => updateField("bairro", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                Cidade / Estado
                <input className="input-light mt-2" value={form.cidadeEstado} onChange={(event) => updateField("cidadeEstado", event.target.value)} />
              </label>
              <label className={fieldLabel}>
                CEP
                <input className="input-light mt-2" value={form.cep} onChange={(event) => updateField("cep", event.target.value)} />
              </label>
            </div>

            <section className="rounded-[28px] border border-[var(--color-brand-line)] bg-white/75 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-text)]">Assinatura vinculada ao perfil</h4>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                    A assinatura deixa de ficar dentro da ficha e passa a acompanhar o cadastro principal da paciente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signatureInputRef.current?.click()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-3 text-sm font-semibold text-[var(--color-brand-deep)] transition hover:bg-white"
                >
                  <Upload size={16} /> Importar assinatura
                </button>
                <input
                  ref={signatureInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureImport}
                  className="hidden"
                />
              </div>

              <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
                onPointerCancel={stopDrawing}
                className="mt-4 w-full rounded-2xl border-2 border-white/50 bg-white/80 shadow-sm"
                style={{ height: "160px", cursor: "crosshair", touchAction: "none" }}
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={clearSignature}
                  className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Limpar assinatura
                </button>
                {currentSignedAt && (
                  <span className="inline-flex min-h-11 items-center rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
                    Última assinatura: {new Date(currentSignedAt).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>
            </section>

            {(feedback || error) && (
              <p className={`text-sm ${error ? "text-rose-700" : "text-emerald-700"}`}>{error || feedback}</p>
            )}

            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Salvando perfil..." : "Salvar perfil"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <ImageGridComposer
          title="Módulo de Grelha Comparativa (Tricoscopia)"
          subtitle="Consolide 4 imagens em uma visão analítica."
          labels={[
            "Área Central (Física/Macro)",
            "Área Central (Tricoscópio/Micro)",
            "Área Occipital (Física/Macro)",
            "Área Occipital (Tricoscópio/Micro)"
          ]}
        />
        <ImageGridComposer
          title="Módulo de Grelha de Identificação"
          subtitle="Fotos físicas para identificação das áreas da cabeça."
          labels={[
            "Central",
            "Occipital",
            "Lateral Direita",
            "Lateral Esquerda"
          ]}
        />
      </div>

      <section className="rounded-3xl border border-red-200 bg-red-50/80 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-red-100 p-2 text-red-600">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-700">Arquivar Paciente</h3>
              <p className="mt-1 text-sm text-red-700/90">
                Essa ação retira o cadastro da listagem principal, envia as mídias para quarentena privada e mantém a restauração disponível. Para confirmar, digite <strong>arquivar</strong>.
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="Digite arquivar"
                className="input-light min-h-11 border-red-200 bg-white"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText.trim().toLowerCase() !== "arquivar" || isDeleting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isDeleting ? "Arquivando..." : "Arquivar Paciente"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}