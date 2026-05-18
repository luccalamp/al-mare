"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import ImageConsentDocument from "@/components/ImageConsentDocument";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";
import {
  getPreConsultationSession,
  submitPreConsultation,
  type PublicPreConsultationPayload,
} from "@/lib/preConsultation";

type ScreenState =
  | { kind: "loading" }
  | { kind: "ready"; patientName: string; whatsapp?: string }
  | { kind: "submitted"; patientName: string }
  | { kind: "blocked"; message: string };

export default function PreConsultationPage() {
  const { config: branding } = useBrandingConfig();
  const params = useParams<{ token: string }>();
  const token = useMemo(() => {
    const value = params?.token;
    return Array.isArray(value) ? value[0] : value || "";
  }, [params]);
  const [screen, setScreen] = useState<ScreenState>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PublicPreConsultationPayload>({
    nome: "",
    whatsapp: "",
    queixaPrincipal: "",
    objetivoTratamento: "",
    alergias: "",
    medicacoes: "",
    observacoes: "",
    consentimentoDados: true,
    consentimentoImagem: false,
  });

  useEffect(() => {
    document.title = `${branding.preConsultationTitle} | ${getBrandDisplayTitle(branding)}`;
  }, [branding]);

  useEffect(() => {
    if (!token) {
      setScreen({ kind: "blocked", message: "Token de pré-consulta inválido." });
      return;
    }

    let active = true;
    void (async () => {
      try {
        const session = await getPreConsultationSession(token);
        if (!active) return;

        if (session.status !== "ready") {
          setScreen({ kind: "blocked", message: session.message });
          return;
        }

        setForm((prev) => ({
          ...prev,
          nome: session.patientName,
          whatsapp: session.whatsapp || prev.whatsapp,
        }));
        setScreen({ kind: "ready", patientName: session.patientName, whatsapp: session.whatsapp });
      } catch (loadError) {
        console.error(loadError);
        if (active) {
          setScreen({ kind: "blocked", message: "Não foi possível validar este link agora." });
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const updateField = <K extends keyof PublicPreConsultationPayload>(field: K, value: PublicPreConsultationPayload[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const result = await submitPreConsultation(token, form);
      if (result.status === "submitted") {
        setScreen({ kind: "submitted", patientName: result.patientName });
        return;
      }

      setScreen({ kind: "blocked", message: result.message });
    } catch (submitError) {
      console.error(submitError);
      setError("Não foi possível enviar sua pré-consulta agora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(135deg,rgba(244,230,211,0.88),rgba(255,251,247,0.96))] px-4 py-10 text-[var(--color-text)] sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 lg:flex-row">
        <section className="rounded-[36px] border border-[var(--color-brand-line)] bg-[rgba(255,250,243,0.82)] p-6 shadow-[0_28px_90px_rgba(94,58,28,0.10)] lg:w-[420px] lg:p-8">
          <BrandLogo />
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Pré-consulta</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight">{branding.preConsultationTitle}</h1>
          <p className="mt-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            {branding.preConsultationIntro}
          </p>

          <div className="mt-6 rounded-[28px] border border-[var(--color-brand-line)] bg-white/70 p-5 text-sm text-[var(--color-text-secondary)]">
            <div className="flex items-center gap-3 text-[var(--color-brand-deep)]">
              <ShieldCheck size={18} />
              <strong>Proteção do link</strong>
            </div>
            <p className="mt-3 leading-6">
              O token é validado de forma isolada e o envio segue por um canal protegido até o prontuário da clínica.
            </p>
          </div>
        </section>

        <section className="flex-1 rounded-[36px] border border-white/70 bg-white/85 p-6 shadow-[0_28px_90px_rgba(94,58,28,0.12)] lg:p-8">
          {screen.kind === "loading" && (
            <div className="flex min-h-[420px] items-center justify-center text-[var(--color-brand-deep)]">
              <Loader2 size={22} className="animate-spin" />
            </div>
          )}

          {screen.kind === "blocked" && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              {screen.message}
            </div>
          )}

          {screen.kind === "submitted" && (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
              <h2 className="text-xl font-semibold">Pré-consulta enviada</h2>
              <p className="mt-3 text-sm leading-6">
                Obrigado, {screen.patientName}. A clínica já pode revisar suas respostas antes do próximo atendimento.
              </p>
            </div>
          )}

          {screen.kind === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--color-brand-accent)]">Paciente</p>
                <h2 className="mt-2 text-2xl font-semibold">{screen.patientName}</h2>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Nome completo
                  <input className="input-light mt-2" value={form.nome} onChange={(event) => updateField("nome", event.target.value)} required />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  WhatsApp
                  <input className="input-light mt-2" value={form.whatsapp} onChange={(event) => updateField("whatsapp", event.target.value)} required />
                </label>
              </div>

              <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                Queixa principal
                <textarea className="input-light mt-2 min-h-28" value={form.queixaPrincipal} onChange={(event) => updateField("queixaPrincipal", event.target.value)} required />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Objetivo com o tratamento
                  <textarea className="input-light mt-2 min-h-24" value={form.objetivoTratamento} onChange={(event) => updateField("objetivoTratamento", event.target.value)} />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Observações adicionais
                  <textarea className="input-light mt-2 min-h-24" value={form.observacoes} onChange={(event) => updateField("observacoes", event.target.value)} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Alergias ou sensibilidades
                  <textarea className="input-light mt-2 min-h-24" value={form.alergias} onChange={(event) => updateField("alergias", event.target.value)} />
                </label>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-accent)]">
                  Medicações em uso
                  <textarea className="input-light mt-2 min-h-24" value={form.medicacoes} onChange={(event) => updateField("medicacoes", event.target.value)} />
                </label>
              </div>

              <ImageConsentDocument compact />

              <div className="space-y-3 rounded-[28px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] p-5">
                <label className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                  <input type="checkbox" className="mt-1" checked={form.consentimentoDados} onChange={(event) => updateField("consentimentoDados", event.target.checked)} />
                  Autorizo o uso dos meus dados para avaliação e continuidade do atendimento clínico.
                </label>
                <label className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                  <input type="checkbox" className="mt-1" checked={form.consentimentoImagem} onChange={(event) => updateField("consentimentoImagem", event.target.checked)} />
                  Li o termo acima e autorizo o uso de imagem para registro técnico interno da clínica.
                </label>
              </div>

              {error && <p className="text-sm text-rose-700">{error}</p>}

              <button type="submit" disabled={saving || !form.consentimentoDados} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#7a4921] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#623915] disabled:cursor-not-allowed disabled:opacity-40">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {saving ? "Enviando..." : "Enviar pré-consulta"}
              </button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}