"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ShoppingBag, Camera, Clock, AlertCircle, Sparkles, ChevronDown, ChevronUp, ExternalLink, ClipboardList, CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";

type PortalStatus = "loading" | "ready" | "not_found" | "inactive" | "error";
type PreConsultaStatus = "pending" | "completed" | "not_available";

type HomecareItem = { id: string; created_at: string; produtos_recomendados?: string; data_retorno_sugerida?: string; obs_cuidados?: string; valor_total?: number; pago?: boolean };
type GalleryItem = { id: string; captured_at: string; type: string; url: string; caption?: string };
type AppointmentItem = { id: string; titulo: string; inicio_em: string; fim_em: string; status: string; observacoes?: string };

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = { agendado: "Agendado", confirmado: "Confirmado", realizado: "Realizado", cancelado: "Cancelado", faltou: "Não compareceu" };
  return labels[status] || status;
}

export default function PortalPage({ params }: { params: { token: string } }) {
  const [status, setStatus] = useState<PortalStatus>("loading");
  const [clientName, setClientName] = useState("");
  const [homecare, setHomecare] = useState<HomecareItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [preConsultaStatus, setPreConsultaStatus] = useState<PreConsultaStatus>("not_available");
  const [activeSection, setActiveSection] = useState<string>("preconsulta");
  const [expandedHomecare, setExpandedHomecare] = useState<string | null>(null);

  const [preConsultaForm, setPreConsultaForm] = useState({ nome: "", whatsapp: "", queixaPrincipal: "", objetivoTratamento: "", alergias: "", medicacoes: "", observacoes: "", consentimentoDados: true, consentimentoImagem: false });
  const [preConsultaSaving, setPreConsultaSaving] = useState(false);
  const [preConsultaSubmitted, setPreConsultaSubmitted] = useState(false);
  const [preConsultaError, setPreConsultaError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`/api/portal/session?token=${encodeURIComponent(params.token)}`);
        const data = await res.json().catch(() => null);
        if (!data) { setStatus("error"); return; }
        if (data.status === "not_found") { setStatus("not_found"); return; }
        if (data.status === "inactive") { setStatus("inactive"); return; }
        if (data.status === "migration_required" || data.status === "error") { setStatus("error"); return; }
        if (data.status === "ready") {
          setClientName(data.clientName || "");
          setHomecare(data.homecare || []);
          setGallery(data.gallery || []);
          setAppointments(data.upcomingAppointments || []);
          if (data.preConsulta) setPreConsultaStatus(data.preConsulta.status || "not_available");
          if (data.clientName) setPreConsultaForm((prev) => ({ ...prev, nome: data.clientName }));
          setStatus("ready");
          if (data.preConsulta?.status === "completed") setPreConsultaSubmitted(true);
          return;
        }
        setStatus("error");
      } catch { setStatus("error"); }
    }
    void loadPortal();
  }, [params.token]);

  const firstName = clientName.split(" ")[0] || "Cliente";

  const handlePreConsultaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreConsultaSaving(true);
    setPreConsultaError(null);
    try {
      const res = await fetch(`/api/portal/pre-consulta?token=${encodeURIComponent(params.token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(preConsultaForm) });
      const data = await res.json();
      if (res.ok && data.status === "submitted") { setPreConsultaSubmitted(true); setPreConsultaStatus("completed"); }
      else setPreConsultaError(data.error || "Erro ao enviar. Tente novamente.");
    } catch { setPreConsultaError("Erro de conexão. Tente novamente."); }
    finally { setPreConsultaSaving(false); }
  };

  const updatePreConsultaField = (field: string, value: string | boolean) => { setPreConsultaForm((prev) => ({ ...prev, [field]: value })); };

  if (status === "loading") {
    return (<div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}><motion.div animate={{ scale: [0.9, 1, 0.9], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="text-center"><Sparkles size={32} className="mx-auto mb-4" style={{ color: "#8c5a2d" }} /><p className="text-sm" style={{ color: "#7d624d" }}>Carregando seu portal...</p></motion.div></div>);
  }
  if (status === "not_found") {
    return (<div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}><div className="max-w-md w-full text-center"><AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#ff3b30" }} /><h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>Link não encontrado</h1><p className="text-sm" style={{ color: "#7d624d" }}>Este link expirou ou foi removido. Entre em contato com a clínica para receber um novo acesso.</p></div></div>);
  }
  if (status === "inactive") {
    return (<div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}><div className="max-w-md w-full text-center"><AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#b97536" }} /><h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>Portal encerrado</h1><p className="text-sm" style={{ color: "#7d624d" }}>Este link de acesso foi encerrado pela clínica. Solicite um novo link se precisar consultar suas informações.</p></div></div>);
  }
  if (status === "error") {
    return (<div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: "#f4ecdf" }}><div className="max-w-md w-full text-center"><AlertCircle size={48} className="mx-auto mb-6" style={{ color: "#ff3b30" }} /><h1 className="text-2xl font-semibold mb-3" style={{ color: "#4f2f19" }}>Indisponível</h1><p className="text-sm" style={{ color: "#7d624d" }}>Não foi possível carregar o portal no momento. Tente novamente mais tarde.</p></div></div>);
  }

  type SectionDef = { id: string; label: string; icon: typeof ClipboardList; pending?: boolean; count?: number };
  const sections: SectionDef[] = [
    { id: "preconsulta", label: "Pré-consulta", icon: ClipboardList, pending: preConsultaStatus === "pending" },
    { id: "homecare", label: "Homecare", icon: ShoppingBag, count: homecare.length },
    { id: "appointments", label: "Agendamentos", icon: Calendar, count: appointments.length },
    { id: "gallery", label: "Galeria", icon: Camera, count: gallery.length },
  ];

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#f4ecdf" }}>
      <header className="sticky top-0 z-10 backdrop-blur-md" style={{ backgroundColor: "rgba(244, 236, 223, 0.85)" }}>
        <div className="max-w-2xl mx-auto px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: "#8c5a2d" }}>{firstName.charAt(0).toUpperCase()}</div>
            <div><p className="text-xs font-medium" style={{ color: "#ab917a" }}>Olá,</p><h1 className="text-lg font-semibold leading-tight" style={{ color: "#4f2f19" }}>{firstName}</h1></div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button key={section.id} onClick={() => setActiveSection(section.id)} className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all" style={isActive ? { backgroundColor: "#8c5a2d", color: "#fff", boxShadow: "0 4px 12px rgba(140, 90, 45, 0.25)" } : { backgroundColor: "rgba(255, 255, 255, 0.6)", color: "#7d624d", border: "1px solid rgba(113, 76, 43, 0.12)" }}>
                <Icon size={14} />{section.label}
                {section.pending && <span className="ml-0.5 w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? "#fff" : "#f59e0b" }} />}
                {section.count !== undefined && section.count > 0 && <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[10px]" style={isActive ? { backgroundColor: "rgba(255,255,255,0.25)" } : { backgroundColor: "rgba(140, 90, 45, 0.1)", color: "#8c5a2d" }}>{section.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-5 mt-6">
        <AnimatePresence mode="wait">
          {activeSection === "preconsulta" && (
            <motion.div key="preconsulta" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {preConsultaStatus === "not_available" ? (
                <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}><ClipboardList size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} /><p className="text-sm font-medium" style={{ color: "#7d624d" }}>Pré-consulta não disponível.</p><p className="text-xs mt-1" style={{ color: "#ab917a" }}>Entre em contato com a clínica para receber o link.</p></div>
              ) : preConsultaSubmitted || preConsultaStatus === "completed" ? (
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(92, 139, 101, 0.08)", border: "1px solid rgba(92, 139, 101, 0.2)" }}><CheckCircle2 size={40} className="mx-auto mb-4" style={{ color: "#5c8b65" }} /><h3 className="text-lg font-semibold" style={{ color: "#4f2f19" }}>Pré-consulta enviada!</h3><p className="text-sm mt-2" style={{ color: "#7d624d" }}>Obrigado, {firstName}. A clínica já pode revisar suas respostas.</p></motion.div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                    <div className="flex items-center gap-3 mb-3"><div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(140, 90, 45, 0.1)" }}><ShieldCheck size={16} style={{ color: "#8c5a2d" }} /></div><div><p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>Suas informações estão protegidas</p><p className="text-xs" style={{ color: "#ab917a" }}>Seus dados são enviados de forma segura para a clínica.</p></div></div>
                  </div>
                  <form onSubmit={handlePreConsultaSubmit} className="space-y-4">
                    <div className="rounded-2xl p-4 space-y-4" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8c5a2d" }}>Dados pessoais</p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Nome completo</label><input className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.nome} onChange={(e) => updatePreConsultaField("nome", e.target.value)} required /></div>
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>WhatsApp</label><input className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.whatsapp} onChange={(e) => updatePreConsultaField("whatsapp", e.target.value)} required /></div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-4 space-y-4" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8c5a2d" }}>Informações clínicas</p>
                      <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Queixa principal *</label><textarea className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 min-h-24" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.queixaPrincipal} onChange={(e) => updatePreConsultaField("queixaPrincipal", e.target.value)} required placeholder="Descreva o que te traz à clínica..." /></div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Objetivo com o tratamento</label><textarea className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 min-h-20" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.objetivoTratamento} onChange={(e) => updatePreConsultaField("objetivoTratamento", e.target.value)} placeholder="O que espera alcançar..." /></div>
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Observações adicionais</label><textarea className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 min-h-20" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.observacoes} onChange={(e) => updatePreConsultaField("observacoes", e.target.value)} placeholder="Alguma informação relevante..." /></div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Alergias ou sensibilidades</label><textarea className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 min-h-20" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.alergias} onChange={(e) => updatePreConsultaField("alergias", e.target.value)} placeholder="Liste suas alergias..." /></div>
                        <div><label className="text-xs font-medium" style={{ color: "#7d624d" }}>Medicações em uso</label><textarea className="w-full mt-1 px-3 py-2 rounded-xl text-sm border transition-all focus:outline-none focus:ring-2 min-h-20" style={{ backgroundColor: "rgba(255,255,255,0.8)", borderColor: "rgba(113, 76, 43, 0.15)", color: "#4f2f19" }} value={preConsultaForm.medicacoes} onChange={(e) => updatePreConsultaField("medicacoes", e.target.value)} placeholder="Liste seus medicamentos..." /></div>
                      </div>
                    </div>
                    <div className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8c5a2d" }}>Consentimentos</p>
                      <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="mt-0.5 w-4 h-4 rounded" checked={preConsultaForm.consentimentoDados} onChange={(e) => updatePreConsultaField("consentimentoDados", e.target.checked)} /><span className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>Autorizo o uso dos meus dados para avaliação e continuidade do atendimento clínico.</span></label>
                      <label className="flex items-start gap-3 cursor-pointer"><input type="checkbox" className="mt-0.5 w-4 h-4 rounded" checked={preConsultaForm.consentimentoImagem} onChange={(e) => updatePreConsultaField("consentimentoImagem", e.target.checked)} /><span className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>Li o termo e autorizo o uso de imagem para registro técnico interno da clínica.</span></label>
                    </div>
                    {preConsultaError && <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: "rgba(255, 59, 48, 0.08)", color: "#dc2626" }}>{preConsultaError}</div>}
                    <button type="submit" disabled={preConsultaSaving || !preConsultaForm.consentimentoDados || !preConsultaForm.queixaPrincipal} className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed" style={{ backgroundColor: "#8c5a2d" }}>
                      {preConsultaSaving ? <><Loader2 size={16} className="animate-spin" />Enviando...</> : <><Send size={16} />Enviar pré-consulta</>}
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {activeSection === "homecare" && (
            <motion.div key="homecare" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
              {homecare.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}><ShoppingBag size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} /><p className="text-sm font-medium" style={{ color: "#7d624d" }}>Nenhum homecare registrado ainda.</p><p className="text-xs mt-1" style={{ color: "#ab917a" }}>Seus cuidados recomendados aparecerão aqui.</p></div>
              ) : homecare.map((item) => {
                const isExpanded = expandedHomecare === item.id;
                return (
                  <div key={item.id} className="rounded-2xl overflow-hidden transition-all" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                    <button onClick={() => setExpandedHomecare(isExpanded ? null : item.id)} className="w-full flex items-center justify-between p-4 text-left">
                      <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: "rgba(92, 117, 100, 0.12)" }}><ShoppingBag size={16} style={{ color: "#5c7564" }} /></div><div><p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>{formatDate(item.created_at)}</p>{item.data_retorno_sugerida && <p className="text-xs flex items-center gap-1" style={{ color: "#ab917a" }}><Clock size={11} />Retorno: {formatDate(item.data_retorno_sugerida)}</p>}</div></div>
                      {isExpanded ? <ChevronUp size={18} style={{ color: "#ab917a" }} /> : <ChevronDown size={18} style={{ color: "#ab917a" }} />}
                    </button>
                    <AnimatePresence>{isExpanded && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="px-4 pb-4 space-y-3">
                      <div className="rounded-xl p-3 text-sm leading-relaxed" style={{ backgroundColor: "rgba(140, 90, 45, 0.06)", color: "#4f2f19" }}>{item.produtos_recomendados}</div>
                      {item.obs_cuidados && <div className="flex items-start gap-2"><Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: "#8c5a2d" }} /><p className="text-xs leading-relaxed" style={{ color: "#7d624d" }}>{item.obs_cuidados}</p></div>}
                      {item.valor_total !== undefined && item.valor_total > 0 && <div className="flex items-center justify-between pt-1"><p className="text-xs font-medium" style={{ color: "#7d624d" }}>Valor</p><div className="flex items-center gap-2">{item.pago && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(92, 139, 101, 0.12)", color: "#5c8b65" }}>Pago</span>}<p className="text-sm font-bold" style={{ color: "#4f2f19" }}>R$ {item.valor_total.toFixed(2).replace(".", ",")}</p></div></div>}
                    </motion.div>)}</AnimatePresence>
                  </div>
                );
              })}
            </motion.div>
          )}

          {activeSection === "appointments" && (
            <motion.div key="appointments" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
              {appointments.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}><Calendar size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} /><p className="text-sm font-medium" style={{ color: "#7d624d" }}>Nenhum agendamento próximo.</p><p className="text-xs mt-1" style={{ color: "#ab917a" }}>Seus próximos horários aparecerão aqui.</p></div>
              ) : appointments.map((apt) => (
                <div key={apt.id} className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                  <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(140, 90, 45, 0.1)" }}><Calendar size={16} style={{ color: "#8c5a2d" }} /></div><div><p className="text-sm font-semibold" style={{ color: "#4f2f19" }}>{apt.titulo}</p><p className="text-xs mt-0.5" style={{ color: "#7d624d" }}>{formatDateTime(apt.inicio_em)}</p>{apt.observacoes && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#ab917a" }}>{apt.observacoes}</p>}</div></div><span className="text-[10px] font-semibold whitespace-nowrap">{getStatusLabel(apt.status)}</span></div>
                </div>
              ))}
            </motion.div>
          )}

          {activeSection === "gallery" && (
            <motion.div key="gallery" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-3">
              {gallery.length === 0 ? (
                <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}><Camera size={32} className="mx-auto mb-3" style={{ color: "#ab917a" }} /><p className="text-sm font-medium" style={{ color: "#7d624d" }}>Nenhuma foto registrada.</p><p className="text-xs mt-1" style={{ color: "#ab917a" }}>Suas fotos de evolução aparecerão aqui.</p></div>
              ) : (
                <div className="grid grid-cols-2 gap-3">{gallery.map((photo) => (
                  <a key={photo.id} href={photo.url} target="_blank" rel="noopener noreferrer" className="group relative rounded-2xl overflow-hidden aspect-square" style={{ backgroundColor: "rgba(255, 255, 255, 0.6)", border: "1px solid rgba(113, 76, 43, 0.1)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.caption || "Foto do cliente"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>{photo.type === "antes" ? "Antes" : photo.type === "depois" ? "Depois" : photo.type}</span>{photo.caption && <p className="text-[10px] text-white/80 mt-1 truncate">{photo.caption}</p>}</div>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"><ExternalLink size={14} className="text-white drop-shadow" /></div>
                  </a>
                ))}</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 py-3 text-center" style={{ backgroundColor: "rgba(244, 236, 223, 0.9)" }}><p className="text-[10px]" style={{ color: "#ab917a" }}>Al&apos;maré Saúde Capilar © {new Date().getFullYear()}</p></footer>
    </div>
  );
}
