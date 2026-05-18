"use client";

import { useState } from "react";
import { Client } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import { Save, UserPlus } from "lucide-react";
import { useBrandingConfig } from "@/components/BrandingConfigProvider";
import { getBrandDisplayTitle } from "@/lib/brandingConfig";

interface NewClientFormProps {
  onClose: () => void;
  onSave: (client: Client) => Promise<void> | void;
}

export default function NewClientForm({ onClose, onSave }: NewClientFormProps) {
  const { config: branding } = useBrandingConfig();
  const brandTitle = getBrandDisplayTitle(branding);
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
      signatures: [],
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
        className="premium-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          className="premium-window relative w-full max-w-md overflow-hidden rounded-[2rem]"
          initial={{ opacity: 0, scale: 0.88, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          <div className="premium-window-header flex items-center gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="w-5 h-5 rounded-full bg-[#ff5f57] sm:w-3 sm:h-3" />
            </div>
            <div className="flex-1 text-center">
                <span className="text-sm font-semibold text-[var(--color-ink)]">Novo paciente — {brandTitle}</span>
            </div>
            <div className="w-8" />
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex justify-center mb-2">
              <div className="premium-card flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-[#d7b289] to-[#7a4921] text-white shadow-lg">
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
                className="premium-button-primary flex min-h-11 flex-1 items-center justify-center gap-2 px-4 py-3.5 text-sm disabled:opacity-30"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Save size={14} /> {saving ? "Salvando..." : "Cadastrar no prontuario"}
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
