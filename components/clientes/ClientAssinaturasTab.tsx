"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Client, ClientSignature } from "@/types";
import { Check, Loader2, Pencil, Trash2 } from "lucide-react";

type ClientUpdateHandler = (client: Client) => Promise<void> | void;

interface ClientAssinaturasTabProps {
  client: Client;
  onUpdate: ClientUpdateHandler;
}

export default function ClientAssinaturasTab({ client, onUpdate }: ClientAssinaturasTabProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const signatures = client.signatures || [];

  const initCanvas = useCallback((signatureData?: string) => {
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
      setHasStroke(true);
    };
    img.src = signatureData;
  }, []);

  useEffect(() => {
    initCanvas();
  }, [initCanvas]);

  useEffect(() => {
    const handleResize = () => initCanvas();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initCanvas]);

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
    setHasStroke(true);
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

  const clearCanvas = () => {
    initCanvas();
    setHasStroke(false);
  };

  const captureSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!imageDataUrl.startsWith("data:image/")) return null;
    if (imageDataUrl.length > 1024 * 1024) return null;
    return imageDataUrl;
  };

  const handleSave = async () => {
    if (!hasStroke) {
      setError("Desenhe a assinatura antes de salvar.");
      return;
    }
    if (!label.trim()) {
      setError("Dê um nome para esta assinatura.");
      return;
    }

    const imageDataUrl = captureSignature();
    if (!imageDataUrl) {
      setError("Não foi possível capturar a assinatura.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setFeedback(null);

      const newSignature: ClientSignature = {
        id: editingId || `sig-${Date.now()}`,
        label: label.trim(),
        imageDataUrl,
        signedAt: new Date().toISOString(),
      };

      const updatedSignatures = editingId
        ? signatures.map((s) => (s.id === editingId ? newSignature : s))
        : [...signatures, newSignature];

      const updatedClient: Client = {
        ...client,
        signatures: updatedSignatures,
        updatedAt: new Date().toISOString(),
      };

      await Promise.resolve(onUpdate(updatedClient));
      setLabel("");
      setEditingId(null);
      clearCanvas();
      setFeedback(editingId ? "Assinatura atualizada." : "Assinatura adicionada.");
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);
      setError(null);

      const updatedSignatures = signatures.filter((s) => s.id !== id);
      const updatedClient: Client = {
        ...client,
        signatures: updatedSignatures,
        updatedAt: new Date().toISOString(),
      };

      await Promise.resolve(onUpdate(updatedClient));
      setFeedback("Assinatura removida.");
    } catch (deleteError) {
      console.error(deleteError);
      setError("Não foi possível remover.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sig: ClientSignature) => {
    setEditingId(sig.id);
    setLabel(sig.label);
    initCanvas(sig.imageDataUrl);
    setHasStroke(true);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setLabel("");
    clearCanvas();
  };

  return (
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.8)] p-5 shadow-[0_18px_45px_rgba(94,58,28,0.08)]">
        <div className="flex items-center gap-2">
          <Pencil size={18} className="text-[var(--color-brand-accent)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {editingId ? "Editar assinatura" : "Nova assinatura"}
          </h3>
        </div>
        <div className="mt-4 flex items-center gap-4 rounded-2xl border-2 border-[var(--color-brand-accent)] bg-gradient-to-r from-[var(--color-brand-soft)] to-white p-4 shadow-lg">
          <NextImage
            src="/icons/resp-ass.png"
            alt="Responsável pela consulta"
            width={64}
            height={64}
            className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-md"
          />
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-[var(--color-brand-accent)]">
              Responsável pela Consulta
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--color-text)]">
              A assinatura abaixo vincula o cliente ao termo de responsabilidade da consulta.
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {editingId ? "Altere a assinatura e o nome abaixo." : "Desenhe a assinatura da paciente e dê um nome para identificá-la."}
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Nome da assinatura
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Termo de consentimento, Avaliação inicial..."
              className="mt-1 w-full rounded-xl border border-[var(--color-brand-line)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:border-[var(--color-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-accent)]/20"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-[#6e6e73]">
              Área de assinatura
            </label>
            <div className="mt-1 overflow-hidden rounded-xl border border-[var(--color-brand-line)] bg-white">
              <canvas
                ref={canvasRef}
                className="h-40 w-full touch-none"
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={clearCanvas}
                className="rounded-lg border border-[var(--color-brand-line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-brand-soft)]"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !hasStroke}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-accent)]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {editingId ? "Atualizar" : "Salvar assinatura"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="rounded-xl border border-[var(--color-brand-line)] bg-white px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-brand-soft)]"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </section>

      {feedback && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedback}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {signatures.length > 0 && (
        <section className="rounded-[32px] border border-[var(--color-brand-line)] bg-white/75 p-5 shadow-[0_18px_45px_rgba(94,58,28,0.06)]">
          <h3 className="text-lg font-semibold text-[var(--color-text)]">Assinaturas salvas</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {signatures.length} {signatures.length === 1 ? "assinatura" : "assinaturas"}
          </p>

          <div className="mt-4 space-y-3">
            {signatures.map((sig) => (
              <div
                key={sig.id}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-brand-line)] bg-white p-4"
              >
                <div className="h-16 w-32 overflow-hidden rounded-lg border border-[var(--color-brand-line)] bg-white">
                  <NextImage src={sig.imageDataUrl} alt={sig.label} width={128} height={64} className="h-full w-full object-contain" unoptimized />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--color-text)]">{sig.label}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {new Date(sig.signedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(sig)}
                    className="rounded-lg p-2 text-[var(--color-text-secondary)] transition hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand-accent)]"
                    title="Editar"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(sig.id)}
                    disabled={saving}
                    className="rounded-lg p-2 text-red-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
