"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CAPILLARY_THERAPY_MANUAL_TOPICS,
  CAPILLARY_THERAPY_PAYMENT_POLICY,
  CAPILLARY_THERAPY_PDFS,
  CAPILLARY_THERAPY_SESSION_STEPS,
} from "@/lib/capillaryTherapyReference";
import {
  Calendar,
  ShoppingBag,
  Camera,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  CheckCircle,
} from "lucide-react";

type PortalStatus = "loading" | "ready" | "not_found" | "inactive" | "error";

type HomecareItem = {
  id: string;
  created_at: string;
  produtos_recomendados?: string;
  data_retorno_sugerida?: string;
  obs_cuidados?: string;
  valor_total?: number;
  forma_pagamento?: "avista" | "parcelado";
  parcelas?: number;
  pago?: boolean;
};

type GalleryItem = {
  id: string;
  captured_at: string;
  type: string;
  url: string;
  caption?: string;
};

type AppointmentItem = {
  id: string;
  titulo: string;
  inicio_em: string;
  fim_em: string;
  status: string;
  observacoes?: string;
};

type PreConsultaStatus = {
  linkActive: boolean;
  respondedAt: string | null;
};

type PreConsultaForm = {
  nome: string;
  whatsapp: string;
  queixaPrincipal: string;
  objetivoTratamento: string;
  alergias: string;
  medicacoes: string;
  observacoes: string;
  consentimentoDados: boolean;
  consentimentoImagem: boolean;
};

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    agendado: "Agendado",
    confirmado: "Confirmado",
    realizado: "Realizado",
    cancelado: "Cancelado",
    faltou: "Não compareceu",
  };
  return labels[status] || status;
}

const emptyForm: PreConsultaForm = {
  nome: "",
  whatsapp: "",
  queixaPrincipal: "",
  objetivoTratamento: "",
  alergias: "",
  medicacoes: "",
  observacoes: "",
  consentimentoDados: false,
  consentimentoImagem: false,
};

export default function PortalPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<PortalStatus>("loading");
  const [clientName, setClientName] = useState("");
  const [homecare, setHomecare] = useState<HomecareItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [preConsulta, setPreConsulta] = useState<PreConsultaStatus>({ linkActive: false, respondedAt: null });
  const [activeSection, setActiveSection] = useState<string>("homecare");
  const [expandedHomecare, setExpandedHomecare] = useState<string | null>(null);

  const [form, setForm] = useState<PreConsultaForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`/api/portal/session?token=${encodeURIComponent(params.token)}`);
        const data = await res.json().catch(() => null);

        if (!data) {
          setStatus("error");
          return;
        }

        if (data.status === "not_found") {
          setStatus("not_found");
          return;
        }

        if (data.status === "inactive") {
          setStatus("inactive");
          return;
        }

        if (data.status === "migration_required" || data.status === "error") {
          setStatus("error");
          return;
        }

        if (data.status === "ready") {
          setClientName(data.clientName || "");
          setHomecare(data.homecare || []);
          setGallery(data.gallery || []);
          setAppointments(data.upcomingAppointments || []);
          if (data.preConsulta) {
            setPreConsulta(data.preConsulta);
          }
          setStatus("ready");
          return;
        }

        setStatus("error");
      } catch {
        setStatus("error");
      }
    }

    void loadPortal();
  }, [params.token]);

  const updateField = <K extends keyof PreConsultaForm>(field: K, value: PreConsultaForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitPreConsulta = async () => {
    if (!form.consentimentoDados || !form.consentimentoImagem) {
      setSubmitError("Aceite os termos de consentimento para continuar.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const res = await fetch("/api/portal/pre-consulta", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          ...form,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!data || data.status === "not_found" || data.status === "inactive") {
        setSubmitError(data?.message || "Não foi possível enviar a avaliação.");
        return;
      }

      setSubmitSuccess(true);
      setPreConsulta((prev) => ({ ...prev, respondedAt: new Date().toISOString() }));
    } catch {
      setSubmitError("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = clientName.split(" ")[0] || "Cliente";

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}>
        <motion.div
          animate={{ scale: [0.9, 1, 0.9], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="text-center"
        >
          <Sparkles size={32} className="mx-auto mb-4" style={{ color: "#8c5a2d" }} />
          <p className="text-sm" style={{ color: "#7d624d" }}>
            Carregando seu portal...
          </p>
        </motion.div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}>
        <div className="max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#ff3b30" }} />
          <h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>
            Link não encontrado
          </h1>
          <p className="text-sm" style={{ color: "#7d624d" }}>
            Este link expirou ou foi removido. Entre em contato com a clínica para receber um novo acesso.
          </p>
        </div>
      </div>
    );
  }

  if (status === "inactive") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}>
        <div className="max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#b97536" }} />
          <h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>
            Portal encerrado
          </h1>
          <p className="text-sm" style={{ color: "#7d624d" }}>
            Este link de acesso foi encerrado pela clínica. Solicite um novo link se precisar consultar suas informações.
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}>
        <div className="max-w-md w-full text-center">
          <AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#ff3b30" }} />
          <h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>
            Indisponível
          </h1>
          <p className="text-sm" style={{ color: "#7d624d" }}>
            Não foi possível carregar o portal no momento. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  const preConsultaEnabled = preConsulta.linkActive && !preConsulta.respondedAt;
  const preConsultaResponded = preConsulta.respondedAt;

  const sections = [
    { id: "homecare", label: "Homecare", icon: ShoppingBag, count: homecare.length },
    { id: "appointments", label: "Agendamentos", icon: Calendar, count: appointments.length },
    { id: "gallery", label: "Galeria", icon: Camera, count: gallery.length },
    ...(preConsultaEnabled || preConsultaResponded
      ? [{ id: "avaliacao", label: "Avaliação", icon: FileText, count: preConsultaResponded ? 1 : 0 }]
      : []),
  ];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#f4ecdf" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: "rgba(244, 236, 223, 0.85)" }}>
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: "#8c5a2d" }}
            >
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: "#ab917a" }}>
                Olá,
              </p>
              <h1 className="text-lg font-semibold leading-tight" style={{ color: "#4f2f19" }}>
                {firstName}
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Section tabs */}
      <div className="max-w-2xl mx-auto px-5 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all"
                style={
                  isActive
                    ? {
                        backgroundColor: "#8c5a2d",
                        color: "#fff",
                        boxShadow: "0 4px 12px rgba(140, 90, 45, 0.25)",
                      }
                    : {
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        color: "#7d624d",
                        border: "1px solid rgba(113, 76, 43, 0.12)",
                      }
                }
              >
                <Icon size={14} />
                {section.label}
                {section.count > 0 && (
                  <span
                    className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]"
                    style={
                      isActive
                        ? { backgroundColor: "rgba(255,255,255,0.25)" }
                        : { backgroundColor: "rgba(140, 90, 45, 0.1)", color: "#8c5a2d" }
                    }
                  >
                    {section.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 mt-6">
        <AnimatePresence mode="wait">
          {/* HOME CARE */}
          {activeSection === "homecare" && (
            <motion.div
              key="homecare"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div
                className="rounded-2xl p-4 sm:p-5"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  border: "1px solid rgba(113, 76, 43, 0.1)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8c5a2d" }}>
                      Materiais da terapia capilar
                    </p>
                    <h3 className="mt-1 text-sm font-semibold" style={{ color: "#4f2f19" }}>
                      Manual e orçamento atualizados
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                      Consulte as orientacoes da sessao e as condicoes do tratamento sempre que precisar revisar seu plano.
                    </p>
                  </div>

                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(140, 90, 45, 0.08)", color: "#8c5a2d" }}
                  >
                    <FileText size={18} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3">
                  {CAPILLARY_THERAPY_PDFS.map((resource) => (
                    <a
                      key={resource.id}
                      href={resource.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start justify-between gap-3 rounded-xl p-3 transition-colors"
                      style={{
                        backgroundColor: "rgba(140, 90, 45, 0.06)",
                        border: "1px solid rgba(140, 90, 45, 0.08)",
                      }}
                    >
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>
                          {resource.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                          {resource.description}
                        </p>
                      </div>
                      <ExternalLink size={14} className="mt-0.5 shrink-0" style={{ color: "#8c5a2d" }} />
                    </a>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {CAPILLARY_THERAPY_MANUAL_TOPICS.slice(0, 3).map((topic) => (
                    <span
                      key={topic}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "rgba(92, 117, 100, 0.12)", color: "#5c7564" }}
                    >
                      {topic}
                    </span>
                  ))}
                  {CAPILLARY_THERAPY_SESSION_STEPS.slice(0, 2).map((step) => (
                    <span
                      key={step}
                      className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "rgba(140, 90, 45, 0.08)", color: "#8c5a2d" }}
                    >
                      {step}
                    </span>
                  ))}
                </div>

                <p className="mt-4 text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                  {CAPILLARY_THERAPY_PAYMENT_POLICY.creditLabel}. {CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontLabel}.
                </p>
              </div>

              {homecare.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <ShoppingBag size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} />
                  <p className="text-sm font-medium" style={{ color: "#7d624d" }}>
                    Nenhum homecare registrado ainda.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#ab917a" }}>
                    Seus cuidados recomendados aparecerão aqui.
                  </p>
                </div>
              ) : (
                homecare.map((item) => {
                  const isExpanded = expandedHomecare === item.id;
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl overflow-hidden transition-all"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        border: "1px solid rgba(113, 76, 43, 0.1)",
                      }}
                    >
                      <button
                        onClick={() => setExpandedHomecare(isExpanded ? null : item.id)}
                        className="w-full flex items-center justify-between p-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: "rgba(92, 117, 100, 0.12)" }}
                          >
                            <ShoppingBag size={16} style={{ color: "#5c7564" }} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>
                              {formatDate(item.created_at)}
                            </p>
                            {item.data_retorno_sugerida && (
                              <p className="text-xs flex items-center gap-1" style={{ color: "#ab917a" }}>
                                <Clock size={11} />
                                Retorno: {formatDate(item.data_retorno_sugerida)}
                              </p>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={18} style={{ color: "#ab917a" }} />
                        ) : (
                          <ChevronDown size={18} style={{ color: "#ab917a" }} />
                        )}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 pb-4 space-y-3"
                          >
                            <div
                              className="rounded-xl p-3 text-sm leading-relaxed"
                              style={{
                                backgroundColor: "rgba(140, 90, 45, 0.06)",
                                color: "#4f2f19",
                              }}
                            >
                              {item.produtos_recomendados}
                            </div>

                            {item.obs_cuidados && (
                              <div className="flex items-start gap-2">
                                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: "#8c5a2d" }} />
                                <p className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                                  {item.obs_cuidados}
                                </p>
                              </div>
                            )}

                            {item.valor_total !== undefined && item.valor_total > 0 && (
                              <div className="space-y-2 pt-1">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-medium" style={{ color: "#7d624d" }}>
                                    Valor
                                  </p>
                                  <div className="flex items-center gap-2">
                                    {item.pago && (
                                      <span
                                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        style={{
                                          backgroundColor: "rgba(92, 139, 101, 0.12)",
                                          color: "#5c8b65",
                                        }}
                                      >
                                        Pago
                                      </span>
                                    )}
                                    <p className="text-sm font-bold" style={{ color: "#4f2f19" }}>
                                      {formatCurrency(item.valor_total)}
                                    </p>
                                  </div>
                                </div>

                                {(item.forma_pagamento || item.parcelas) && (
                                  <div className="flex flex-wrap gap-2">
                                    {item.forma_pagamento === "parcelado" && item.parcelas && (
                                      <span
                                        className="text-[10px] font-semibold px-2 py-1 rounded-full"
                                        style={{ backgroundColor: "rgba(140, 90, 45, 0.08)", color: "#8c5a2d" }}
                                      >
                                        {item.parcelas}x no cartao
                                      </span>
                                    )}
                                    {item.forma_pagamento === "avista" && (
                                      <span
                                        className="text-[10px] font-semibold px-2 py-1 rounded-full"
                                        style={{ backgroundColor: "rgba(92, 117, 100, 0.12)", color: "#5c7564" }}
                                      >
                                        A vista (-{CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent}%)
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {/* APPOINTMENTS */}
          {activeSection === "appointments" && (
            <motion.div
              key="appointments"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {appointments.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <Calendar size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} />
                  <p className="text-sm font-medium" style={{ color: "#7d624d" }}>
                    Nenhum agendamento próximo.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#ab917a" }}>
                    Seus próximos horários aparecerão aqui.
                  </p>
                </div>
              ) : (
                appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-2xl p-4"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      border: "1px solid rgba(113, 76, 43, 0.1)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: "rgba(140, 90, 45, 0.1)" }}
                        >
                          <Calendar size={16} style={{ color: "#8c5a2d" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>
                            {apt.titulo}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "#7d624d" }}>
                            {formatDateTime(apt.inicio_em)}
                          </p>
                          {apt.observacoes && (
                            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#ab917a" }}>
                              {apt.observacoes}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: "#8c5a2d" }}>
                        {getStatusLabel(apt.status)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {/* GALLERY */}
          {activeSection === "gallery" && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              {gallery.length === 0 ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <Camera size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} />
                  <p className="text-sm font-medium" style={{ color: "#7d624d" }}>
                    Nenhuma foto registrada.
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#ab917a" }}>
                    Suas fotos de evolução aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {gallery.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative rounded-2xl overflow-hidden aspect-square"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.6)",
                        border: "1px solid rgba(113, 76, 43, 0.1)",
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.url}
                        alt={photo.caption || "Foto do cliente"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
                        >
                          {photo.type === "antes" ? "Antes" : photo.type === "depois" ? "Depois" : photo.type}
                        </span>
                        {photo.caption && (
                          <p className="text-[10px] text-white/80 mt-1 truncate">{photo.caption}</p>
                        )}
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={14} className="text-white drop-shadow" />
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* AVALIAÇÃO (Pre-Consulta) */}
          {activeSection === "avaliacao" && (
            <motion.div
              key="avaliacao"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {preConsultaResponded && !preConsultaEnabled ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <CheckCircle size={48} className="mx-auto mb-4" style={{ color: "#5c8b65" }} />
                  <h2 className="text-lg font-semibold mb-2" style={{ color: "#4f2f19" }}>
                    Avaliação enviada
                  </h2>
                  <p className="text-sm" style={{ color: "#7d624d" }}>
                    Sua avaliação foi recebida com sucesso em {formatDateTime(preConsulta.respondedAt!)}.
                  </p>
                </div>
              ) : submitSuccess ? (
                <div
                  className="rounded-2xl p-8 text-center"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.6)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <CheckCircle size={48} className="mx-auto mb-4" style={{ color: "#5c8b65" }} />
                  <h2 className="text-lg font-semibold mb-2" style={{ color: "#4f2f19" }}>
                    Avaliação enviada com sucesso!
                  </h2>
                  <p className="text-sm" style={{ color: "#7d624d" }}>
                    Obrigado por preencher. A clínica já recebeu suas informações.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="rounded-2xl p-5"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      border: "1px solid rgba(113, 76, 43, 0.1)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={18} style={{ color: "#8c5a2d" }} />
                      <h2 className="text-lg font-semibold" style={{ color: "#4f2f19" }}>
                        Avaliação inicial
                      </h2>
                    </div>
                    <p className="text-sm" style={{ color: "#7d624d" }}>
                      Preencha as informações abaixo para ajudar a clínica a preparar seu atendimento.
                    </p>
                  </div>

                  <div
                    className="rounded-2xl p-5 space-y-4"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.6)",
                      border: "1px solid rgba(113, 76, 43, 0.1)",
                    }}
                  >
                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Nome completo
                      </label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) => updateField("nome", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        WhatsApp
                      </label>
                      <input
                        type="tel"
                        value={form.whatsapp}
                        onChange={(e) => updateField("whatsapp", e.target.value)}
                        placeholder="(00) 00000-0000"
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Qual sua queixa principal?
                      </label>
                      <textarea
                        value={form.queixaPrincipal}
                        onChange={(e) => updateField("queixaPrincipal", e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm resize-none"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Qual objetivo do tratamento?
                      </label>
                      <textarea
                        value={form.objetivoTratamento}
                        onChange={(e) => updateField("objetivoTratamento", e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm resize-none"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Alergias
                      </label>
                      <input
                        type="text"
                        value={form.alergias}
                        onChange={(e) => updateField("alergias", e.target.value)}
                        placeholder="Se houver, liste aqui"
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Medicamentos de uso contínuo
                      </label>
                      <input
                        type="text"
                        value={form.medicacoes}
                        onChange={(e) => updateField("medicacoes", e.target.value)}
                        placeholder="Se houver, liste aqui"
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#7d624d" }}>
                        Observações adicionais
                      </label>
                      <textarea
                        value={form.observacoes}
                        onChange={(e) => updateField("observacoes", e.target.value)}
                        rows={3}
                        className="mt-1 w-full rounded-xl border border-[rgba(113,76,43,0.15)] bg-white px-4 py-2.5 text-sm resize-none"
                        style={{ color: "#4f2f19" }}
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.consentimentoDados}
                          onChange={(e) => updateField("consentimentoDados", e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded"
                          style={{ accentColor: "#8c5a2d" }}
                        />
                        <span className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                          Concordo que meus dados sejam utilizados pela clínica para fins de atendimento e acompanhamento
                          terapêutico.
                        </span>
                      </label>

                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.consentimentoImagem}
                          onChange={(e) => updateField("consentimentoImagem", e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded"
                          style={{ accentColor: "#8c5a2d" }}
                        />
                        <span className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                          Concordo com o registro de imagens clínicas para documentação técnica e acompanhamento da minha
                          evolução.
                        </span>
                      </label>
                    </div>

                    {submitError && (
                      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {submitError}
                      </div>
                    )}

                    <button
                      onClick={handleSubmitPreConsulta}
                      disabled={submitting}
                      className="w-full rounded-xl py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ backgroundColor: "#8c5a2d" }}
                    >
                      {submitting ? "Enviando..." : "Enviar avaliação"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center" style={{ backgroundColor: "rgba(244, 236, 223, 0.9)" }}>
        <p className="text-[10px]" style={{ color: "#ab917a" }}>
          Al&apos;maré Saúde Capilar © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
