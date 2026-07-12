"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PORTAL_UPDATES_CHANNEL } from "@/lib/preConsultation";
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

type ReturnStatusTone = "calm" | "attention" | "late";

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

const DAY_MS = 1000 * 60 * 60 * 24;
const PORTAL_BACKGROUND_REFRESH_MS = 60_000;

const RETURN_TONE_STYLES: Record<
  ReturnStatusTone,
  { backgroundColor: string; color: string; borderColor: string }
> = {
  calm: {
    backgroundColor: "rgba(92, 117, 100, 0.12)",
    color: "#5c7564",
    borderColor: "rgba(92, 117, 100, 0.18)",
  },
  attention: {
    backgroundColor: "rgba(185, 117, 54, 0.12)",
    color: "#b97536",
    borderColor: "rgba(185, 117, 54, 0.18)",
  },
  late: {
    backgroundColor: "rgba(188, 84, 73, 0.12)",
    color: "#bc5449",
    borderColor: "rgba(188, 84, 73, 0.18)",
  },
};

function parseDateInput(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;

  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  const parsedDate = new Date(dateStr);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(dateStr: string | undefined): string {
  const date = parseDateInput(dateStr);
  if (!date) return dateStr ? "Data inválida" : "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const date = parseDateInput(dateStr);
  if (!date) return "Data inválida";
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

function extractCareItems(text: string | undefined): string[] {
  if (!text) return [];

  return text
    .split(/,\s*(?![^()]*\))/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getReturnStatus(dateStr: string | undefined): {
  label: string;
  detail: string;
  tone: ReturnStatusTone;
} | null {
  const targetDate = parseDateInput(dateStr);
  if (!targetDate) return null;

  const diffDays = Math.round((startOfDay(targetDate).getTime() - startOfDay(new Date()).getTime()) / DAY_MS);

  if (diffDays > 1) {
    return {
      label: `Faltam ${diffDays} dias`,
      detail: `Retorno sugerido para ${formatDate(dateStr)}.`,
      tone: "calm",
    };
  }

  if (diffDays === 1) {
    return {
      label: "Retorno amanhã",
      detail: `Seu próximo retorno sugerido é ${formatDate(dateStr)}.`,
      tone: "calm",
    };
  }

  if (diffDays === 0) {
    return {
      label: "Retorno hoje",
      detail: "Se precisar ajustar o horário, fale com a clínica.",
      tone: "attention",
    };
  }

  if (diffDays === -1) {
    return {
      label: "Retorno passou ontem",
      detail: "Se você ainda não voltou, vale alinhar o próximo passo com a clínica.",
      tone: "late",
    };
  }

  return {
    label: `Retorno em atraso há ${Math.abs(diffDays)} dias`,
    detail: "Se precisar remarcar ou atualizar seu plano, entre em contato com a clínica.",
    tone: "late",
  };
}

function getPaymentDescription(item: HomecareItem): string {
  if (item.forma_pagamento === "parcelado" && item.parcelas) {
    return `${item.parcelas}x no cartão`;
  }

  if (item.forma_pagamento === "avista") {
    return `À vista com ${CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontDiscountPercent}% de desconto`;
  }

  if (item.valor_total) {
    return "Valor definido pela clínica";
  }

  return "Sem valor registrado";
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

export default function PortalPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<PortalStatus>("loading");
  const [clientName, setClientName] = useState("");
  const [homecare, setHomecare] = useState<HomecareItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [preConsulta, setPreConsulta] = useState<PreConsultaStatus>({ linkActive: false, respondedAt: null });
  const [activeSection, setActiveSection] = useState<string>("homecare");
  const [expandedHomecare, setExpandedHomecare] = useState<string | null>(null);

  const [form, setForm] = useState<PreConsultaForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const loadPortal = useCallback(async (signal?: AbortSignal) => {
    try {
      // First, POST the token to set it as an httpOnly cookie
      const postRes = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
        signal,
      });

      const postData = await postRes.json().catch(() => null);

      if (!postData) {
        setStatus("error");
        return;
      }

      if (postData.status === "not_found") {
        setStatus("not_found");
        return;
      }

      if (postData.status === "inactive") {
        setStatus("inactive");
        return;
      }

      if (postData.status === "migration_required" || postData.status === "error") {
        setStatus("error");
        return;
      }

      if (postData.status === "ready") {
        setClientName(postData.clientName || "");
        setHomecare(postData.homecare || []);
        setGallery(postData.gallery || []);
        if (postData.preConsulta) {
          setPreConsulta(postData.preConsulta);
        }
        setStatus("ready");
        return;
      }

      setStatus("error");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setStatus("error");
    }
  }, [token]);

  useEffect(() => {
    const controller = new AbortController();
    void loadPortal(controller.signal);
    return () => controller.abort();
  }, [loadPortal]);

  useEffect(() => {
    if (!token) return;

    const refreshPortal = () => {
      if (document.visibilityState === "visible") {
        void loadPortal();
      }
    };

    const intervalId = window.setInterval(refreshPortal, PORTAL_BACKGROUND_REFRESH_MS);
    const updatesChannel = "BroadcastChannel" in window
      ? new BroadcastChannel(PORTAL_UPDATES_CHANNEL)
      : null;
    if (updatesChannel) {
      updatesChannel.onmessage = (event: MessageEvent<{ token?: string }>) => {
        if (event.data?.token === token) {
          void loadPortal();
        }
      };
    }
    window.addEventListener("focus", refreshPortal);

    return () => {
      window.clearInterval(intervalId);
      updatesChannel?.close();
      window.removeEventListener("focus", refreshPortal);
    };
  }, [token, loadPortal]);

  const updateField = <K extends keyof PreConsultaForm>(field: K, value: PreConsultaForm[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitPreConsulta = async () => {
    const queixaPrincipal = form.queixaPrincipal.trim();

    if (!queixaPrincipal) {
      setSubmitError("Informe sua queixa principal para continuar.");
      return;
    }

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
          token,
          ...form,
          queixaPrincipal,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        setSubmitError(data?.error || data?.message || "Não foi possível enviar a avaliação.");
        return;
      }

      if (data.status === "not_found" || data.status === "inactive") {
        setSubmitError(data?.message || "Não foi possível enviar a avaliação.");
        return;
      }

      setSubmitSuccess(true);
      setPreConsulta((prev) => ({
        ...prev,
        linkActive: false,
        respondedAt: typeof data.respondedAt === "string" ? data.respondedAt : new Date().toISOString(),
      }));
    } catch {
      setSubmitError("Erro ao enviar. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = clientName.split(" ")[0] || "Cliente";
  const latestHomecare = homecare[0];
  const sortedReturnItems = [...homecare]
    .filter((item) => item.data_retorno_sugerida)
    .sort((left, right) => {
      const leftTime = parseDateInput(left.data_retorno_sugerida)?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightTime = parseDateInput(right.data_retorno_sugerida)?.getTime() ?? Number.POSITIVE_INFINITY;
      return leftTime - rightTime;
    });
  const todayTime = startOfDay(new Date()).getTime();
  const upcomingReturn = sortedReturnItems.find((item) => {
    const date = parseDateInput(item.data_retorno_sugerida);
    return date ? startOfDay(date).getTime() >= todayTime : false;
  });
  const nextReturnItem = upcomingReturn || sortedReturnItems[sortedReturnItems.length - 1];
  const nextReturnStatus = getReturnStatus(nextReturnItem?.data_retorno_sugerida);
  const uniqueProductCount = new Set(homecare.flatMap((item) => extractCareItems(item.produtos_recomendados))).size;
  const pendingHomecare = homecare.filter((item) => item.valor_total && !item.pago);
  const pendingHomecareTotal = pendingHomecare.reduce((sum, item) => sum + (item.valor_total || 0), 0);
  const paidHomecareCount = homecare.filter((item) => item.pago).length;
  const latestCareItems = extractCareItems(latestHomecare?.produtos_recomendados).slice(0, 4);

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
              className="space-y-4"
            >
              <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                <motion.section
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                  className="rounded-[28px] p-5 sm:p-6"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,255,255,0.88) 0%, rgba(245,233,218,0.92) 100%)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                    boxShadow: "0 16px 40px rgba(140, 90, 45, 0.08)",
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: "#8c5a2d" }}>
                        Seu acompanhamento
                      </p>
                      <h2 className="mt-2 text-xl font-semibold leading-tight" style={{ color: "#4f2f19" }}>
                        {nextReturnStatus?.label || (latestHomecare ? "Seu plano está em andamento" : "Seu portal vai organizar seu tratamento")}
                      </h2>
                      <p className="mt-2 text-sm leading-6" style={{ color: "#7d624d" }}>
                        {nextReturnStatus?.detail || "Aqui você acompanha suas orientações, confere o retorno sugerido e entende com clareza cada etapa do seu homecare."}
                      </p>
                    </div>

                    <motion.div
                      animate={{ y: [0, -4, 0] }}
                      transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: "rgba(140, 90, 45, 0.1)", color: "#8c5a2d" }}
                    >
                      <Calendar size={22} />
                    </motion.div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.72)", border: "1px solid rgba(113, 76, 43, 0.08)" }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#ab917a" }}>
                        Próximo retorno
                      </p>
                      <p className="mt-2 text-base font-semibold" style={{ color: "#4f2f19" }}>
                        {nextReturnItem?.data_retorno_sugerida ? formatDate(nextReturnItem.data_retorno_sugerida) : "A definir com a clínica"}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "#7d624d" }}>
                        {nextReturnStatus?.detail || "Quando a clínica registrar uma nova data, ela aparecerá aqui com destaque."}
                      </p>
                    </div>

                    <div
                      className="rounded-2xl p-4"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.72)", border: "1px solid rgba(113, 76, 43, 0.08)" }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#ab917a" }}>
                        Última atualização
                      </p>
                      <p className="mt-2 text-base font-semibold" style={{ color: "#4f2f19" }}>
                        {latestHomecare ? formatDate(latestHomecare.created_at) : "Sem prescrição ainda"}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "#7d624d" }}>
                        {latestHomecare ? "Seu plano mais recente fica sempre no topo para facilitar a leitura." : "Assim que a clínica registrar seus cuidados, eles aparecerão aqui."}
                      </p>
                    </div>
                  </div>

                  {latestCareItems.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {latestCareItems.map((item) => (
                        <span
                          key={item}
                          className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                          style={{ backgroundColor: "rgba(92, 117, 100, 0.12)", color: "#5c7564" }}
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.section>

                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  {[
                    {
                      label: "Prescrições",
                      value: String(homecare.length).padStart(2, "0"),
                      detail: "planos salvos no seu portal",
                    },
                    {
                      label: "Produtos no plano",
                      value: String(uniqueProductCount).padStart(2, "0"),
                      detail: uniqueProductCount > 0 ? "itens diferentes recomendados" : "sem itens detalhados ainda",
                    },
                    {
                      label: pendingHomecareTotal > 0 ? "Investimento pendente" : "Situação financeira",
                      value: pendingHomecareTotal > 0 ? formatCurrency(pendingHomecareTotal) : `${paidHomecareCount} pago${paidHomecareCount === 1 ? "" : "s"}`,
                      detail: pendingHomecareTotal > 0 ? "valores aguardando confirmação" : "seus registros pagos aparecem marcados no plano",
                    },
                  ].map((card, index) => (
                    <motion.div
                      key={card.label}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.24, delay: index * 0.05 }}
                      whileHover={{ y: -2 }}
                      className="rounded-[24px] p-4"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.74)",
                        border: "1px solid rgba(113, 76, 43, 0.1)",
                        boxShadow: "0 12px 26px rgba(140, 90, 45, 0.06)",
                      }}
                    >
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#ab917a" }}>
                        {card.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold break-words" style={{ color: "#4f2f19" }}>
                        {card.value}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: "#7d624d" }}>
                        {card.detail}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1fr_0.95fr]">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.05 }}
                  className="rounded-[28px] p-5"
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
                      <h3 className="mt-1 text-base font-semibold" style={{ color: "#4f2f19" }}>
                        Manual e orçamento sempre à mão
                      </h3>
                      <p className="mt-1 text-xs leading-6" style={{ color: "#7d624d" }}>
                        Abra os PDFs para revisar orientações da sessão, condições de pagamento e referências do seu plano.
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
                      <motion.a
                        key={resource.id}
                        href={resource.href}
                        target="_blank"
                        rel="noreferrer"
                        whileHover={{ y: -1 }}
                        className="flex items-start justify-between gap-3 rounded-2xl p-3 transition-colors"
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
                      </motion.a>
                    ))}
                  </div>

                  <p className="mt-4 text-xs leading-relaxed" style={{ color: "#7d624d" }}>
                    {CAPILLARY_THERAPY_PAYMENT_POLICY.creditLabel}. {CAPILLARY_THERAPY_PAYMENT_POLICY.upfrontLabel}.
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: 0.08 }}
                  className="rounded-[28px] p-5"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.72)",
                    border: "1px solid rgba(113, 76, 43, 0.1)",
                  }}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8c5a2d" }}>
                    Guia rápido
                  </p>
                  <h3 className="mt-1 text-base font-semibold" style={{ color: "#4f2f19" }}>
                    O que observar até o retorno
                  </h3>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                        Na consulta
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {CAPILLARY_THERAPY_MANUAL_TOPICS.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                            style={{ backgroundColor: "rgba(92, 117, 100, 0.12)", color: "#5c7564" }}
                          >
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                        Durante a sessão
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {CAPILLARY_THERAPY_SESSION_STEPS.map((step, index) => (
                          <div
                            key={step}
                            className="rounded-2xl px-3.5 py-3"
                            style={{ backgroundColor: "rgba(140, 90, 45, 0.06)", border: "1px solid rgba(140, 90, 45, 0.08)" }}
                          >
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: "#ab917a" }}>
                              Etapa {String(index + 1).padStart(2, "0")}
                            </p>
                            <p className="mt-1 text-sm font-semibold" style={{ color: "#4f2f19" }}>
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
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
                <div className="space-y-3">
                  <div
                    className="rounded-[28px] p-5"
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.72)",
                      border: "1px solid rgba(113, 76, 43, 0.1)",
                    }}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8c5a2d" }}>
                      Sua jornada no homecare
                    </p>
                    <h3 className="mt-1 text-base font-semibold" style={{ color: "#4f2f19" }}>
                      Toque em cada plano para ver retorno, produtos e orientações
                    </h3>
                    <p className="mt-1 text-xs leading-6" style={{ color: "#7d624d" }}>
                      Cada cartão resume um momento do seu acompanhamento. Ao abrir, você vê com clareza a data sugerida de retorno e os cuidados registrados pela clínica.
                    </p>
                  </div>

                  {homecare.map((item, index) => {
                  const isExpanded = expandedHomecare === item.id;
                  const careItems = extractCareItems(item.produtos_recomendados);
                  const previewItems = careItems.slice(0, 3);
                  const returnStatus = getReturnStatus(item.data_retorno_sugerida);
                  const returnToneStyle = returnStatus ? RETURN_TONE_STYLES[returnStatus.tone] : null;

                  return (
                    <motion.article
                      layout="position"
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22, delay: index * 0.04 }}
                      whileHover={{ y: -2 }}
                      className="rounded-[28px] overflow-hidden"
                      style={{
                        backgroundColor: "rgba(255, 255, 255, 0.72)",
                        border: "1px solid rgba(113, 76, 43, 0.1)",
                        boxShadow: "0 14px 30px rgba(140, 90, 45, 0.06)",
                      }}
                    >
                      <button
                        onClick={() => setExpandedHomecare(isExpanded ? null : item.id)}
                        className="w-full flex items-start justify-between gap-4 p-4 sm:p-5 text-left"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-sm font-semibold"
                            style={{ backgroundColor: "rgba(92, 117, 100, 0.12)", color: "#5c7564" }}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>
                                Plano {String(homecare.length - index).padStart(2, "0")}
                              </p>
                              {item.pago ? (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(92, 139, 101, 0.12)", color: "#5c8b65" }}
                                >
                                  Pago
                                </span>
                              ) : item.valor_total ? (
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: "rgba(185, 117, 54, 0.12)", color: "#b97536" }}
                                >
                                  Aguardando confirmação
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs" style={{ color: "#7d624d" }}>
                              Registrado em {formatDate(item.created_at)}
                            </p>

                            {previewItems.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {previewItems.map((careItem) => (
                                  <span
                                    key={careItem}
                                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                                    style={{ backgroundColor: "rgba(140, 90, 45, 0.06)", color: "#8c5a2d" }}
                                  >
                                    {careItem}
                                  </span>
                                ))}
                                {careItems.length > previewItems.length && (
                                  <span
                                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                                    style={{ backgroundColor: "rgba(140, 90, 45, 0.06)", color: "#8c5a2d" }}
                                  >
                                    +{careItems.length - previewItems.length} item{careItems.length - previewItems.length > 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          {returnStatus && returnToneStyle ? (
                            <span
                              className="rounded-full border px-3 py-1.5 text-[10px] font-semibold text-right"
                              style={returnToneStyle}
                            >
                              {returnStatus.label}
                            </span>
                          ) : (
                            <span
                              className="rounded-full border px-3 py-1.5 text-[10px] font-semibold text-right"
                              style={{
                                backgroundColor: "rgba(140, 90, 45, 0.06)",
                                color: "#8c5a2d",
                                borderColor: "rgba(140, 90, 45, 0.12)",
                              }}
                            >
                              Retorno a definir
                            </span>
                          )}

                          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "#ab917a" }}>
                            {isExpanded ? "Ocultar" : "Ver detalhes"}
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 pb-4 sm:px-5 sm:pb-5 space-y-3"
                          >
                            <div className="grid gap-3 lg:grid-cols-3">
                              <div
                                className="rounded-2xl p-4"
                                style={{
                                  backgroundColor: returnToneStyle?.backgroundColor || "rgba(140, 90, 45, 0.06)",
                                  border: `1px solid ${returnToneStyle?.borderColor || "rgba(140, 90, 45, 0.1)"}`,
                                }}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                                  Data de retorno
                                </p>
                                <p className="mt-2 text-sm font-semibold" style={{ color: "#4f2f19" }}>
                                  {item.data_retorno_sugerida ? formatDate(item.data_retorno_sugerida) : "A definir"}
                                </p>
                                <p className="mt-1 text-xs leading-5" style={{ color: returnToneStyle?.color || "#7d624d" }}>
                                  {returnStatus?.label || "A clínica ainda não registrou uma nova data de retorno."}
                                </p>
                              </div>

                              <div
                                className="rounded-2xl p-4"
                                style={{ backgroundColor: "rgba(255, 255, 255, 0.82)", border: "1px solid rgba(113, 76, 43, 0.08)" }}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                                  Investimento
                                </p>
                                <p className="mt-2 text-sm font-semibold" style={{ color: "#4f2f19" }}>
                                  {item.valor_total ? formatCurrency(item.valor_total) : "Sem valor lançado"}
                                </p>
                                <p className="mt-1 text-xs leading-5" style={{ color: "#7d624d" }}>
                                  {getPaymentDescription(item)}
                                </p>
                              </div>

                              <div
                                className="rounded-2xl p-4"
                                style={{ backgroundColor: "rgba(255, 255, 255, 0.82)", border: "1px solid rgba(113, 76, 43, 0.08)" }}
                              >
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                                  Status do plano
                                </p>
                                <p className="mt-2 text-sm font-semibold" style={{ color: "#4f2f19" }}>
                                  {item.pago ? "Pagamento confirmado" : item.valor_total ? "Aguardando confirmação" : "Plano informativo"}
                                </p>
                                <p className="mt-1 text-xs leading-5" style={{ color: "#7d624d" }}>
                                  {item.pago ? "Este registro já foi marcado como pago pela clínica." : "Abra sempre este cartão para revisar o plano antes do retorno."}
                                </p>
                              </div>
                            </div>

                            <div
                              className="rounded-2xl p-4"
                              style={{ backgroundColor: "rgba(140, 90, 45, 0.06)", border: "1px solid rgba(140, 90, 45, 0.08)" }}
                            >
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                                Produtos e cuidados registrados
                              </p>
                              <p className="mt-2 text-sm leading-6" style={{ color: "#4f2f19" }}>
                                {item.produtos_recomendados}
                              </p>

                              {careItems.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {careItems.map((careItem) => (
                                    <span
                                      key={careItem}
                                      className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                                      style={{ backgroundColor: "rgba(255, 255, 255, 0.8)", color: "#8c5a2d" }}
                                    >
                                      {careItem}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {item.obs_cuidados && (
                              <div className="flex items-start gap-2 rounded-2xl p-4" style={{ backgroundColor: "rgba(255, 255, 255, 0.82)", border: "1px solid rgba(113, 76, 43, 0.08)" }}>
                                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: "#8c5a2d" }} />
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#ab917a" }}>
                                    Observações da clínica
                                  </p>
                                  <p className="mt-1 text-xs leading-6" style={{ color: "#7d624d" }}>
                                    {item.obs_cuidados}
                                  </p>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.article>
                  );
                  })}
                </div>
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
              className="space-y-4"
            >
              <div
                className="rounded-[28px] p-5"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.72)",
                  border: "1px solid rgba(113, 76, 43, 0.1)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: "#8c5a2d" }}>
                      Galeria de evolução
                    </p>
                    <h3 className="mt-1 text-base font-semibold" style={{ color: "#4f2f19" }}>
                      Compare seus registros com facilidade
                    </h3>
                    <p className="mt-1 text-xs leading-6" style={{ color: "#7d624d" }}>
                      Toque em qualquer imagem para abrir em tamanho maior. As fotos ajudam você a visualizar sua evolução entre as sessões.
                    </p>
                  </div>

                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(140, 90, 45, 0.08)", color: "#8c5a2d" }}
                  >
                    <Camera size={18} />
                  </div>
                </div>
              </div>

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
                  {gallery.map((photo, index) => (
                    <motion.a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      whileHover={{ y: -2 }}
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
                    </motion.a>
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
