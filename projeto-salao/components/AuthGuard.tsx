"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import BrandMark from "./BrandMark";
import BrandLogo from "./BrandLogo";
import { Mail, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

type PublicAuthError = {
  message?: string;
  code?: string;
  name?: string;
  status?: number;
};

const LOCAL_AUTH_HOSTS = new Set(["localhost", "127.0.0.1"]);

function logAuthError(scope: string, error: unknown) {
  console.error(`[auth] ${scope}`, error);
}

function getSafeRedirectTo() {
  if (typeof window === "undefined") return undefined;

  try {
    const origin = new URL(window.location.origin);
    const isSecureOrigin =
      origin.protocol === "https:" ||
      (origin.protocol === "http:" && LOCAL_AUTH_HOSTS.has(origin.hostname));

    if (!isSecureOrigin) return undefined;

    return new URL("/", origin).toString();
  } catch {
    return undefined;
  }
}

function getPublicAuthMessage(error: PublicAuthError | null | undefined, provider: "email" | "google") {
  const errorText = `${error?.message ?? ""} ${error?.code ?? ""} ${error?.name ?? ""}`.toLowerCase();

  if (errorText.includes("provider is not enabled") || errorText.includes("unsupported provider")) {
    return "O login com Google está temporariamente indisponível. Use o link mágico ou fale com o suporte.";
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
    ? "Não foi possível enviar o link de acesso agora. Tente novamente em instantes."
    : "Não foi possível iniciar o login com Google agora. Use o link mágico ou tente novamente mais tarde.";
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  // Hook calls must be unconditional
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const googleOAuthConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim());

  // Keep pre-consultation links public
  async function checkAuth() {
    setLoading(true);
    setAllowed(null);
    try {
      const { data } = await supabase.auth.getSession();
      const sessionUser = data?.session?.user ?? null;
      setUser(sessionUser);
      setAllowed(Boolean(sessionUser));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Try to complete OAuth callback if tokens are present in the URL/hash.
    // Many Supabase SDK helpers may be unavailable depending on installed auth package;
    // do a best-effort manual parse of access/refresh tokens from the URL and set session.
    const handleAuthCallback = async () => {
      if (typeof window === "undefined") return;
      try {
        const hasTokenInHash = !!window.location.hash && window.location.hash.includes("access_token");
        const hasTokenInSearch = !!window.location.search && (window.location.search.includes("access_token") || window.location.search.includes("refresh_token") || window.location.search.includes("code"));
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

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) {
              throw error;
            }
          } else if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) {
              throw error;
            }
          }

          if (access_token || refresh_token || code) {
            try {
              window.history.replaceState({}, document.title, window.location.pathname);
            } catch {
              /* ignore */
            }
          }
        } catch (err) {
          console.warn("auth callback handling failed:", err);
          await supabase.auth.signOut();
        }
      } catch {
        /* ignore */
      }
    };

    const bootstrapAuth = async () => {
      await handleAuthCallback();
      await checkAuth();
    };

    void bootstrapAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      void checkAuth();
    });

    return () => {
      try {
        listener?.subscription?.unsubscribe?.();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep pre-consultation links public
  if (pathname.startsWith("/pre-consulta")) {
    return <>{children}</>;
  }

  async function sendMagicLink(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMessage(null);
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: getSafeRedirectTo(),
        },
      });
      if (error) {
        logAuthError("magic_link_start", error);
        setMessage(getPublicAuthMessage(error, "email"));
      } else {
        setMessage("Um link de acesso foi enviado para seu e-mail. Verifique sua caixa de entrada.");
      }
    } finally {
      setSending(false);
    }
  }

  async function signInWithGoogle() {
    setMessage(null);

    if (!googleOAuthConfigured) {
      setMessage("O login com Google ainda não está disponível neste ambiente. Use o link mágico para entrar.");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: getSafeRedirectTo(),
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        logAuthError("google_oauth_start", error);
        setMessage(getPublicAuthMessage(error, "google"));
        return;
      }

      if (data?.url) {
        window.location.assign(data.url);
        return;
      }

      setMessage("Não foi possível iniciar o login com Google agora. Use o link mágico e tente novamente mais tarde.");
    } finally {
      setSending(false);
    }
  }

  async function signOut() {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-[var(--app-dvh)] flex items-center justify-center p-6">
        <motion.div
          animate={{ scale: [0.9, 1, 0.9], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <BrandMark className="w-16 h-16 opacity-70" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-[var(--app-dvh)] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
          <motion.div
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -right-[10%] w-[70vw] h-[70vw] max-w-[800px] max-h-[800px] rounded-full bg-gradient-to-br from-[#dcb992]/20 to-[#7a4921]/10 blur-3xl"
          />
          <motion.div
            animate={{ 
              rotate: [360, 0],
              scale: [1, 1.5, 1],
            }}
            transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-tr from-[#f4e6d3]/30 to-[#bea184]/20 blur-3xl"
          />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.8 }}
          className="relative w-full max-w-md z-10"
        >
          {/* Glass Card */}
          <div className="glass-dark rounded-3xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
            {/* Shimmer effect */}
            <motion.div 
              animate={{ x: ["-200%", "200%"] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
            />
            
            <div className="flex flex-col items-center mb-8 relative">
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.2 }}
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#dcb992] to-[#7a4921] flex items-center justify-center shadow-lg mb-6 relative group"
              >
                <BrandMark className="w-10 h-10 text-white" />
                <motion.div 
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-2xl ring-2 ring-white/40 ring-offset-2 ring-offset-transparent pointer-events-none"
                />
              </motion.div>
              <BrandLogo className="h-8" />
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-[#7d624d] mt-3 text-center font-medium"
              >
                Acesso exclusivo para profissionais
              </motion.p>
            </div>

            <form onSubmit={sendMagicLink} className="space-y-5 relative z-10">
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-sm font-semibold text-[#4f2f19] ml-1 block">
                  E-mail de Acesso
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#ab917a] group-focus-within:text-[#8c5a2d] transition-colors">
                    <Mail size={18} />
                  </div>
                  <input
                    id="email"
                    type="email"
                    className="w-full bg-white/70 border border-[#ab917a]/30 rounded-xl py-3.5 pl-11 pr-4 text-[#4f2f19] placeholder-[#ab917a] focus:outline-none focus:ring-2 focus:ring-[#8c5a2d]/40 focus:border-[#8c5a2d] transition-all shadow-sm backdrop-blur-sm"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={sending}
                  />
                </div>
              </div>

              <AnimatePresence mode="wait">
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    className={`flex items-start gap-3 p-4 rounded-xl text-sm overflow-hidden ${
                      message.includes("enviado") 
                        ? "bg-[#5c8b65]/10 text-[#5c8b65] border border-[#5c8b65]/20" 
                        : "bg-[#ff3b30]/10 text-[#ff3b30] border border-[#ff3b30]/20"
                    }`}
                  >
                    {message.includes("enviado") ? (
                      <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    )}
                    <p className="leading-relaxed">{message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full relative group overflow-hidden bg-gradient-to-r from-[#8c5a2d] to-[#7a4921] hover:from-[#7a4921] hover:to-[#6f431e] text-white font-medium py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={sending || !email}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {sending ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                      />
                    ) : (
                      <>
                        <Sparkles size={18} className="text-white/80" />
                        Receber Link Mágico
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                </motion.button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-[#ab917a]/20"></div>
                  <span className="flex-shrink-0 mx-4 text-[#ab917a] text-xs uppercase font-medium tracking-wider">Ou</span>
                  <div className="flex-grow border-t border-[#ab917a]/20"></div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  className="w-full bg-white/60 hover:bg-white/90 border border-[#ab917a]/20 text-[#4f2f19] font-medium py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-3 backdrop-blur-sm disabled:opacity-70 disabled:cursor-not-allowed"
                  onClick={() => void signInWithGoogle()}
                  disabled={sending}
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
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
                </motion.button>

                {!googleOAuthConfigured && (
                  <p className="text-xs text-[#7d624d] text-center leading-relaxed">
                    O login com Google será liberado assim que a ativação institucional deste ambiente for concluída.
                  </p>
                )}
              </div>
            </form>
          </div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center"
          >
            <p className="text-xs text-[#7d624d]/80 font-medium">
              Ambiente seguro e criptografado <br/> Al&apos;maré Saúde Capilar &copy; {new Date().getFullYear()}
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  if (allowed) {
    return <>{children}</>;
  }

  const adminEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "suporte@clinica.local";
  const mailTo = `mailto:${adminEmail}?subject=Solicitar%20Acesso&body=Olá,%0D%0A%0D%0APeço%20liberar%20o%20acesso%20para%20o%20email%20${encodeURIComponent(
    user.email || ""
  )}%0D%0A%0D%0AObrigado.`;

  return (
    <div className="relative min-h-[var(--app-dvh)] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center">
        <motion.div
          animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[10%] -right-[10%] w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-gradient-to-br from-[#ff3b30]/10 to-[#b97536]/10 blur-3xl"
        />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="relative w-full max-w-lg z-10 glass-dark rounded-3xl p-8 sm:p-10 shadow-2xl text-center"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
          className="mx-auto w-16 h-16 rounded-2xl bg-[#ff3b30]/10 flex items-center justify-center mb-6 border border-[#ff3b30]/20"
        >
          <AlertCircle className="w-8 h-8 text-[#ff3b30]" />
        </motion.div>
        
        <h2 className="text-xl font-bold text-[#4f2f19] mb-3">Acesso Restrito</h2>
        <p className="text-[#7d624d] mb-8 leading-relaxed">
          Seu e-mail <span className="font-semibold text-[#8c5a2d]">{user.email}</span> foi autenticado com sucesso, mas ainda não possui permissão para acessar o sistema.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <motion.a 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            href={mailTo}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#8c5a2d] to-[#7a4921] hover:from-[#7a4921] hover:to-[#6f431e] text-white rounded-xl font-medium shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Mail size={18} /> Solicitar Acesso
          </motion.a>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={signOut}
            className="w-full sm:w-auto px-6 py-3 bg-white/60 hover:bg-white/90 border border-[#ab917a]/20 text-[#4f2f19] rounded-xl font-medium shadow-sm transition-all flex items-center justify-center"
          >
            Sair da conta
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
