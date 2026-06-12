"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { isSupabasePublicConfigConfigured } from "@/lib/supabase/config";
import type { User } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import BrandLogo from "./BrandLogo";
import AlmareLayout from "./AlmareLayout";
import {
  Mail,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";

type PublicAuthError = {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
};

const GOOGLE_LOGIN_INTENT_STORAGE_KEY = "auth:google-login-intent-at";
const GOOGLE_LOGIN_INTENT_MAX_AGE_MS = 10 * 60 * 1000;

function logAuthError(scope: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.error(`[auth] ${scope}`, error);
  }
}

function getPublicAuthMessage(error: PublicAuthError | null | undefined, provider: "email" | "google") {
  const errorText = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.name ?? ""}`.toLowerCase();

  if (errorText.includes("provider is not enabled") || errorText.includes("unsupported provider")) {
    return "O login com Google está temporariamente indisponível. Tente novamente mais tarde.";
  }

  if (errorText.includes("rate limit") || errorText.includes("too many requests")) {
    return provider === "email"
      ? "Muitas tentativas de envio. Aguarde um instante e tente novamente."
      : "Muitas tentativas de login. Aguarde um instante e tente novamente.";
  }

  if (errorText.includes("redirect") || errorText.includes("site url")) {
    return "A autenticação não pôde ser concluída por configuração de redirecionamento. Tente novamente em instantes.";
  }

  return provider === "email"
    ? "Não foi possível enviar o código de acesso agora. Tente novamente em instantes."
    : "Não foi possível iniciar o login com Google agora. Tente novamente mais tarde.";
}

function getPublicOtpMessage(error: PublicAuthError | null | undefined) {
  const errorText = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.name ?? ""}`.toLowerCase();

  if (errorText.includes("expired") || errorText.includes("token") || errorText.includes("otp")) {
    return "Código inválido ou expirado. Solicite um novo acesso e tente novamente.";
  }

  if (errorText.includes("rate limit") || errorText.includes("too many requests")) {
    return "Muitas tentativas de verificação. Aguarde um instante e tente novamente.";
  }

  return "Não foi possível validar o código agora. Tente novamente em instantes.";
}

function setGoogleLoginIntent() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(GOOGLE_LOGIN_INTENT_STORAGE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function hasFreshGoogleLoginIntent() {
  if (typeof window === "undefined") return false;

  try {
    const storedAt = window.sessionStorage.getItem(GOOGLE_LOGIN_INTENT_STORAGE_KEY);
    if (!storedAt) return false;

    const startedAt = Number(storedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt > GOOGLE_LOGIN_INTENT_MAX_AGE_MS) {
      window.sessionStorage.removeItem(GOOGLE_LOGIN_INTENT_STORAGE_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function clearGoogleLoginIntent() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(GOOGLE_LOGIN_INTENT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

function MissingSupabaseConfigScreen() {
  return (
    <AlmareLayout
      kicker="Configuracao"
      title="Supabase pendente."
      description="O sistema esta de pe, mas precisa das credenciais publicas do Supabase para autenticar e carregar dados."
    >
      <div className="flex items-center justify-between gap-3">
        <BrandLogo compact subtitle={false} priority />
        <span className="premium-chip text-xs font-semibold">
          <AlertCircle size={14} />
          Acao necessaria
        </span>
      </div>

      <div className="mt-10">
        <p className="premium-kicker">
          <ShieldCheck size={14} />
          Ambiente protegido
        </p>
        <h2 className="premium-title mt-4 text-4xl font-semibold leading-none sm:text-[3.2rem]">
          Conexao pausada.
        </h2>
        <p className="premium-subtitle mt-4 text-sm sm:text-base">
          Preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
          ou `NEXT_PUBLIC_SUPABASE_ANON_KEY` no `.env.local` e reinicie o servidor.
        </p>
      </div>

      <div className="premium-card mt-8 rounded-[1.4rem] p-4 text-sm text-[var(--color-text-secondary)]">
        Nenhuma alteracao de dados foi executada. O app bloqueou a autenticacao para evitar uma falha em branco no navegador.
      </div>
    </AlmareLayout>
  );
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const supabaseConfigured = isSupabasePublicConfigConfigured();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [passwordSignIn, setPasswordSignIn] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAEmail, setPending2FAEmail] = useState("");
  const [pending2FAActive, setPending2FAActive] = useState(false);
  const pending2FAActiveRef = useRef(false);
  const [twoFACode, setTwoFACode] = useState("");
  const [twoFAMessage, setTwoFAMessage] = useState<string | null>(null);
  const [twoFABusy, setTwoFABusy] = useState(false);
  const pendingPasswordRef = useRef("");
  const checkingAuthRef = useRef(false);
  const googleLoginPendingRef = useRef(false);
  const isGoogleOAuthRef = useRef(false);

  const checkAuth = useCallback(async () => {
    if (!supabaseConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    if (checkingAuthRef.current) return;
    checkingAuthRef.current = true;
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const session = data?.session ?? null;
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
    } finally {
      setLoading(false);
      checkingAuthRef.current = false;
    }
  }, [supabaseConfigured]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }

    const handleAuthCallback = async () => {
      if (typeof window === "undefined") return;

      const hasTokenInHash = !!window.location.hash && window.location.hash.includes("access_token");
      const hasTokenInSearch = !!window.location.search && (window.location.search.includes("access_token") || window.location.search.includes("refresh_token") || window.location.search.includes("code") || window.location.search.includes("type="));

      if (process.env.NODE_ENV !== "production") {
        console.log("[auth] URL:", window.location.href);
        console.log("[auth] hasTokenInHash:", hasTokenInHash);
        console.log("[auth] hasTokenInSearch:", hasTokenInSearch);
        console.log("[auth] hash:", window.location.hash);
        console.log("[auth] search:", window.location.search);
      }

      if (!hasTokenInHash && !hasTokenInSearch) return;

      try {
        let access_token: string | null = null;
        let refresh_token: string | null = null;
        let code: string | null = null;

        if (hasTokenInHash) {
          const hash = window.location.hash.replace(/^#/, "");
          const params = new URLSearchParams(hash);
          access_token = params.get("access_token");
          refresh_token = params.get("refresh_token");
        } else if (hasTokenInSearch) {
          const params = new URLSearchParams(window.location.search);
          access_token = params.get("access_token");
          refresh_token = params.get("refresh_token");
          code = params.get("code");
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("[auth] access_token:", access_token ? "present" : "missing");
          console.log("[auth] refresh_token:", refresh_token ? "present" : "missing");
          console.log("[auth] code:", code ? "present" : "missing");
        }

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[auth] setSession error:", error);
            }
            throw error;
          }
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[auth] exchangeCodeForSession error:", error);
            }
            throw error;
          }
        }

        if (access_token || refresh_token || code) {
          try {
            const cleanUrl = new URL(window.location.href);
            const authParamNames = [
              "access_token",
              "refresh_token",
              "expires_in",
              "expires_at",
              "token_type",
              "type",
              "code",
              "provider_token",
              "provider_refresh_token",
            ];
            for (const paramName of authParamNames) {
              cleanUrl.searchParams.delete(paramName);
            }
            cleanUrl.hash = "";
            window.history.replaceState({}, document.title, `${cleanUrl.pathname}${cleanUrl.search}`);
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[auth] callback handling failed:", err);
        }
      }
    };

    const bootstrapAuth = async () => {
      await handleAuthCallback();
      await checkAuth();

      if (process.env.NODE_ENV !== "production") {
        const { data } = await supabase.auth.getSession();
        console.log("[auth] session after bootstrap:", data?.session ? "active" : "none");
      }
    };

    void bootstrapAuth();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[auth] onAuthStateChange:", _event, session ? "user present" : "no user");
      }

      if (_event === "SIGNED_IN" && session?.user) {
        const isGoogleLogin = session.user.app_metadata?.provider === "google";
        const hasProviderToken = !!session.provider_token;
        const shouldTriggerGoogle2FA = (isGoogleLogin || hasProviderToken) && hasFreshGoogleLoginIntent();

        if (shouldTriggerGoogle2FA && !pending2FAActiveRef.current && !googleLoginPendingRef.current) {
          googleLoginPendingRef.current = true;
          isGoogleOAuthRef.current = true;
          const userEmail = session.user.email?.toLowerCase().trim() || "";

          if (process.env.NODE_ENV !== "production") {
            console.log("[auth] Google login detected, triggering 2FA for:", userEmail);
          }

          try {
            const res = await fetch("/api/auth/2fa/send", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email: userEmail, password: "__google_oauth__" }),
              credentials: "include",
            });
            const sendData = await res.json().catch(() => null);

            if (res.ok) {
              setPending2FAEmail(userEmail);
              setShow2FA(true);
              setTwoFACode("");
              setTwoFAMessage(null);
              pending2FAActiveRef.current = true;
              setPending2FAActive(true);
              setUser(null);
              return;
            } else {
              if (process.env.NODE_ENV !== "production") {
                console.error("[auth] 2FA send failed:", sendData);
              }
              clearGoogleLoginIntent();
            }
          } catch (err) {
            if (process.env.NODE_ENV !== "production") {
              console.error("[auth] 2FA trigger error:", err);
            }
            clearGoogleLoginIntent();
          }

          googleLoginPendingRef.current = false;
          isGoogleOAuthRef.current = false;
        } else if (isGoogleLogin || hasProviderToken) {
          clearGoogleLoginIntent();
        }
      }

      setUser(session?.user ?? null);
      if (pending2FAActiveRef.current && _event === "SIGNED_IN") {
        return;
      }
      void checkAuth();
    });

    return () => {
      try {
        listener?.subscription?.unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
  }, [checkAuth, supabaseConfigured]);

  useEffect(() => {
    if (!loading && pathname === "/login" && user && !pending2FAActive) {
      router.replace("/");
    }
  }, [loading, pathname, pending2FAActive, router, user]);

  // Keep pre-consultation links public
  if (pathname.startsWith("/pre-consulta")) {
    return <>{children}</>;
  }

  if (!supabaseConfigured) {
    return <MissingSupabaseConfigScreen />;
  }

  async function signInWithPassword(e?: React.FormEvent) {
    if (e) e.preventDefault();

    setMessage(null);
    setTwoFAMessage(null);

    if (!supabaseConfigured) {
      setMessage("Configure o Supabase antes de iniciar sessao.");
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail || !passwordSignIn) {
      setMessage("Informe e-mail e senha para entrar dessa forma.");
      pending2FAActiveRef.current = false;
      setPending2FAActive(false);
      return;
    }

    setAuthBusy(true);

    try {
      pending2FAActiveRef.current = true;
      setPending2FAActive(true);
      pendingPasswordRef.current = passwordSignIn;
      const res = await fetch("/api/auth/2fa/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password: passwordSignIn }),
        credentials: "include",
      });
      const sendData = await res.json().catch(() => null);
      if (!res.ok) {
        setMessage(sendData?.error || "Não foi possível enviar o código de verificação.");
        pending2FAActiveRef.current = false;
        setPending2FAActive(false);
        pendingPasswordRef.current = "";
        return;
      }

      setPending2FAEmail(normalizedEmail);
      setShow2FA(true);
      setTwoFACode("");
      setTwoFAMessage(null);
      setPasswordSignIn("");
    } finally {
      setAuthBusy(false);
    }
  }

  async function verify2FA(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!supabaseConfigured) {
      setTwoFAMessage("Configure o Supabase antes de validar o codigo.");
      return;
    }

    if (!twoFACode || twoFACode.length < 6) {
      setTwoFAMessage("Digite o código de 6 dígitos.");
      return;
    }
    setTwoFABusy(true);
    setTwoFAMessage(null);
    try {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: twoFACode }),
        credentials: "include",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setTwoFAMessage(data?.error || "Código inválido ou expirado.");
        return;
      }

      if (!isGoogleOAuthRef.current) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: pending2FAEmail,
          password: pendingPasswordRef.current,
        });

        if (signInError) {
          throw signInError;
        }
      }

      setShow2FA(false);
      pending2FAActiveRef.current = false;
      setPending2FAActive(false);
      setTwoFACode("");
      setTwoFAMessage(null);
      pendingPasswordRef.current = "";
      setMessage(null);
      isGoogleOAuthRef.current = false;
      googleLoginPendingRef.current = false;
      clearGoogleLoginIntent();
    } catch (err) {
      logAuthError("verify_2fa", err);
      setTwoFAMessage(
        err && typeof err === "object" ? getPublicOtpMessage(err as PublicAuthError) : "Código inválido ou expirado."
      );
    } finally {
      setTwoFABusy(false);
    }
  }

  async function signInWithGoogle() {
    setMessage(null);

    if (!supabaseConfigured) {
      setMessage("Configure o Supabase antes de iniciar sessao.");
      return;
    }

    setAuthBusy(true);
    setGoogleLoginIntent();
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        logAuthError("google_oauth_start", error);
        setMessage(getPublicAuthMessage(error, "google"));
        clearGoogleLoginIntent();
        return;
      }
    } catch (error) {
      clearGoogleLoginIntent();
      throw error;
    } finally {
      setAuthBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[var(--app-dvh)] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-brand-accent)] border-t-transparent" />
          <p className="text-sm text-[var(--color-text-secondary)]">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AlmareLayout>
            <div className="flex items-center justify-between gap-3">
              <BrandLogo compact subtitle={false} priority />
              <div className="flex items-center gap-2">
                <span className="premium-chip text-xs font-semibold">
                  <ShieldCheck size={14} />
                  Ambiente reservado
                </span>
              </div>
            </div>

            <div className="mt-10">
              <p className="premium-kicker">
                <Sparkles size={14} />
                Acesso
              </p>
              <h2 className="premium-title mt-4 text-4xl font-semibold leading-none sm:text-[3.2rem]">
                Entrar.
              </h2>
              <p className="premium-subtitle mt-4 text-sm sm:text-base">
                {show2FA
                  ? "Código enviado para seu e-mail."
                  : "Informe seus dados para acessar."}
              </p>
            </div>

            {show2FA ? (
              <form onSubmit={verify2FA} className="relative z-10 mt-8 space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="2fa-code" className="ml-1 block text-sm font-semibold text-[var(--color-text)]">
                    Código de verificação
                  </label>
                  <div className="group relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--color-text-tertiary)] transition-colors group-focus-within:text-[var(--color-brand-accent)]">
                      <ShieldCheck size={18} />
                    </div>
                    <input
                      id="2fa-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="input-light !py-3.5 !pl-11 !pr-4 text-center text-2xl tracking-[0.3em] font-bold"
                      placeholder="000000"
                      maxLength={6}
                      value={twoFACode}
                      onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      disabled={twoFABusy}
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-text-secondary)] ml-1">
                    Enviamos um código de 6 dígitos para <strong>{pending2FAEmail}</strong>
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {twoFAMessage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, y: -8 }}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -8 }}
                      className="premium-card flex items-start gap-3 overflow-hidden rounded-[1.4rem] border-[var(--color-destructive)]/20 bg-[rgba(255,59,48,0.08)] p-4 text-sm text-[var(--color-destructive)]"
                    >
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                      <p className="leading-relaxed">{twoFAMessage}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                    type="submit"
                    className="premium-button-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm disabled:cursor-not-allowed"
                    disabled={twoFABusy || twoFACode.length < 6}
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      {twoFABusy ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                        />
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          Verificar código
                        </>
                      )}
                    </span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.985 }}
                    type="button"
                    className="premium-button-secondary flex w-full items-center justify-center gap-2 px-5 py-3 text-xs disabled:cursor-not-allowed"
                    onClick={() => { setShow2FA(false); pending2FAActiveRef.current = false; setPending2FAActive(false); setTwoFAMessage(null); pendingPasswordRef.current = ""; }}
                    disabled={twoFABusy}
                  >
                    Voltar ao login
                  </motion.button>
                </div>
              </form>
            ) : (
              <form onSubmit={signInWithPassword} className="relative z-10 mt-8 space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="email" className="ml-1 block text-sm font-semibold text-[var(--color-text)]">
                  E-mail de acesso
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--color-text-tertiary)] transition-colors group-focus-within:text-[var(--color-brand-accent)]">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="input-light !py-3.5 !pl-11 !pr-4"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={authBusy}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="ml-1 block text-sm font-semibold text-[var(--color-text)]">
                  Senha
                </label>
                <div className="group relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[var(--color-text-tertiary)] transition-colors group-focus-within:text-[var(--color-brand-accent)]">
                    <LockKeyhole size={18} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    className="input-light !py-3.5 !pl-11 !pr-4"
                    placeholder="Digite sua senha"
                    value={passwordSignIn}
                    onChange={(e) => setPasswordSignIn(e.target.value)}
                    disabled={authBusy}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -8 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -8 }}
                    className={`premium-card flex items-start gap-3 overflow-hidden rounded-[1.4rem] p-4 text-sm ${
                      message.includes("enviado")
                        ? "border-[var(--color-success)]/20 bg-[rgba(92,139,101,0.08)] text-[var(--color-success)]"
                        : "border-[var(--color-destructive)]/20 bg-[rgba(255,59,48,0.08)] text-[var(--color-destructive)]"
                    }`}
                  >
                    {message.includes("enviado") ? (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    )}
                    <p className="leading-relaxed">{message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="grid gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  className="premium-button-primary flex w-full items-center justify-center gap-2 px-5 py-3.5 text-sm disabled:cursor-not-allowed"
                  type="submit"
                  disabled={authBusy || !email || !passwordSignIn}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {authBusy ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white"
                      />
                    ) : (
                      <>
                        <LockKeyhole size={18} className="text-white/85" />
                        Entrar com senha
                        <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </span>
                </motion.button>

                <div className="relative flex items-center py-1">
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(113,76,43,0.18),transparent)]" />
                  <span className="px-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-text-tertiary)]">
                    ou
                  </span>
                  <div className="h-px flex-1 bg-[linear-gradient(90deg,transparent,rgba(113,76,43,0.18),transparent)]" />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  type="button"
                  className="premium-button-secondary flex w-full items-center justify-center gap-3 px-5 py-3.5 text-sm disabled:cursor-not-allowed"
                  onClick={() => void signInWithGoogle()}
                  disabled={authBusy}
                >
                  <span className="relative z-10 flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Continuar com Google
                  </span>
                </motion.button>
              </div>
            </form>
            )}

            <div className="mt-8 flex flex-wrap gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="premium-chip text-[11px] font-medium">Autenticacao criptografada</span>
              <span className="premium-chip text-[11px] font-medium">Acesso exclusivo para profissionais</span>
            </div>

            <p className="mt-6 text-xs font-medium text-[var(--color-text-secondary)]/80">
              Al&apos;mare Saude Capilar © {new Date().getFullYear()}.
            </p>
        </AlmareLayout>
    );
  }

  return <>{children}</>;
}
