"use client";

import { useState } from "react";
import { Client } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Save, UserPlus } from "lucide-react";

interface NewClientFormProps {
  onClose: () => void;
  onSave: (client: Client) => Promise<void> | void;
}

export default function NewClientForm({ onClose, onSave }: NewClientFormProps) {
  const [form, setForm] = useState({
    nome: "",
    whatsapp: "",
    dataAniversario: "",
    instagramHandle: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.nome || !form.whatsapp || saving) return;

    const now = new Date().toISOString();
    const newClient: Client = {
      id: crypto.randomUUID(),
      profile: {
        nome: form.nome,
        whatsapp: form.whatsapp,
        dataAniversario: form.dataAniversario || undefined,
        instagramHandle: form.instagramHandle || undefined,
      },
      diagnosticos: [],
      colorimetrias: [],
      homecare: [],
      gallery: [],
      appointments: [],
      fichaAnamnese: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      setSaving(true);
      setError(null);
      await onSave(newClient);
    } catch (saveError) {
      console.error(saveError);
      setError(saveError instanceof Error && saveError.message ? saveError.message : "Nao foi possivel salvar o paciente no banco agora.");
    } finally {
      setSaving(false);
    }
  };

  const renderField = ({
    id,
    label,
    type = "text",
    placeholder,
    value,
    field,
    required,
  }: {
    id: string;
    label: string;
    type?: string;
    placeholder?: string;
    value: string;
    field: keyof typeof form;
    required?: boolean;
  }) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-wider">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        className="input-light min-h-11"
      />
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.15)", backdropFilter: "blur(4px)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(24px) saturate(1.8)",
            WebkitBackdropFilter: "blur(24px) saturate(1.8)",
            border: "1px solid rgba(255,255,255,0.5)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
          }}
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid rgba(0,0,0,0.07)", background: "rgba(255,255,255,0.4)" }}>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="w-5 h-5 rounded-full bg-[#ff5f57] sm:w-3 sm:h-3" />
            </div>
            <div className="flex-1 text-center">
                <span className="text-[#1d1d1f] text-sm font-semibold">Novo Paciente — Al&apos;maré</span>
            </div>
            <div className="w-8" />
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-center mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#d7b289] to-[#7a4921] flex items-center justify-center shadow-lg text-white">
                <UserPlus size={32} />
              </div>
            </div>

            {renderField({ id: "nc-nome", label: "Nome do Paciente", field: "nome", value: form.nome, required: true, placeholder: "Nome completo" })}
            {renderField({ id: "nc-whatsapp", label: "WhatsApp", field: "whatsapp", value: form.whatsapp, required: true, placeholder: "(00) 00000-0000" })}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {renderField({ id: "nc-birthday", label: "Aniversário", type: "date", field: "dataAniversario", value: form.dataAniversario })}
              {renderField({ id: "nc-instagram", label: "Instagram", field: "instagramHandle", value: form.instagramHandle, placeholder: "@id" })}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={!form.nome || !form.whatsapp || saving}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#1d1d1f] hover:bg-black disabled:opacity-30 rounded-xl text-white text-sm font-medium transition-all shadow-md min-h-11"
              >
                <Save size={14} /> {saving ? "Salvando..." : "Cadastrar no prontuário"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
