"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import BrandLogo from "./BrandLogo";
import { Sparkles, ShieldCheck } from "lucide-react";

type Props = {
  children: ReactNode;
  leftExtra?: ReactNode;
  leftFooter?: ReactNode | null;
  kicker?: string;
  title?: string;
  description?: string;
};

export default function AlmareLayout({
  children,
  leftExtra,
  leftFooter,
  kicker = "Acesso restrito",
  title = "Área profissional.",
  description = "Faça login para acessar o sistema.",
}: Props) {
  return (
    <div className="relative flex min-h-[var(--app-dvh)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 18, 0], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-x-[-12%] top-[-10%] h-64 bg-[linear-gradient(110deg,rgba(255,255,255,0.68),rgba(82,123,99,0.16),rgba(220,196,158,0.14),transparent)] blur-2xl"
        />
        <motion.div
          animate={{ x: [0, -16, 0], opacity: [0.7, 0.95, 0.7] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-x-[-10%] bottom-[-12%] h-72 bg-[linear-gradient(70deg,transparent,rgba(49,92,72,0.14),rgba(255,255,255,0.58))] blur-2xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", bounce: 0.24, duration: 0.85 }}
        className="relative z-10 grid w-full max-w-6xl gap-6 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <div className="premium-panel hidden min-h-[38rem] rounded-[2.25rem] p-8 lg:flex lg:flex-col lg:justify-between xl:p-10">
          <div>
            <div className="flex items-center gap-4">
              <BrandLogo subtitle={false} />
            </div>

            <div className="mt-12">
              <p className="premium-kicker">
                <Sparkles size={14} />
                {kicker}
              </p>
              <h1 className="premium-heading mt-4 max-w-xl">{title}</h1>
              <p className="premium-subtitle mt-5 max-w-xl text-base">{description}</p>
            </div>

            {leftExtra && <div className="mt-8">{leftExtra}</div>}
          </div>

          {leftFooter !== null && (leftFooter ?? (
            <div className="premium-card rounded-[1.75rem] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-sage-soft)] text-[var(--color-sage)]">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-ink)]">Acesso com curadoria da clínica</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    Cada conta passa por verificação antes de liberar o ambiente completo. Isso preserva privacidade, consistência de uso e segurança operacional.
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="premium-panel rounded-[2.25rem] p-6 sm:p-8 lg:p-10">{children}</div>
      </motion.div>
    </div>
  );
}
