"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function GoogleCalendarCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"validating" | "success" | "error">("validating");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setStatus("error");
      router.replace(`/?gcal_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      router.replace("/?gcal_error=missing_params");
      return;
    }

    const savedState = sessionStorage.getItem("gcal_oauth_state");
    sessionStorage.removeItem("gcal_oauth_state");

    if (state !== savedState) {
      setStatus("error");
      router.replace("/?gcal_error=invalid_state");
      return;
    }

    fetch("/api/google-calendar/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    })
      .then((res) => {
        if (res.ok) {
          setStatus("success");
          router.replace("/?gcal_connected=true");
        } else {
          setStatus("error");
          router.replace("/?gcal_error=callback_failed");
        }
      })
      .catch(() => {
        setStatus("error");
        router.replace("/?gcal_error=network_error");
      });
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-lg">
        {status === "validating" && "Conectando ao Google Calendar..."}
        {status === "success" && "Conexão realizada com sucesso!"}
        {status === "error" && "Erro ao conectar. Tente novamente."}
      </p>
    </div>
  );
}
