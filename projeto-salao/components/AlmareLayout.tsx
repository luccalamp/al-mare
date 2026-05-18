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
          animate={{ rotate: [0, 360], scale: [1, 1.08, 1] }}
          transition={{ duration: 44, repeat: Infinity, ease: "linear" }}
          className="absolute -right-[14%] -top-[16%] h-[38rem] w-[38rem] rounded-full bg-[radial-gradient(circle,rgba(200,157,105,0.28)_0%,rgba(200,157,105,0.02)_62%,transparent_72%)] blur-3xl"
        />
        <motion.div
          animate={{ rotate: [360, 0], scale: [1, 1.14, 1] }}
          transition={{ duration: 52, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-[20%] -left-[8%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(92,117,100,0.18)_0%,rgba(92,117,100,0.02)_60%,transparent_74%)] blur-3xl"
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
