"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE,
  GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY,
} from "@/lib/googleCalendar";

function notifyOpener(status: "success" | "error", error?: string) {
  if (typeof window === "undefined") return false;
  if (!window.opener || window.opener.closed) return false;

  window.opener.postMessage(
    {
      type: GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE,
      status,
      error,
    },
    window.location.origin
  );

  window.close();
  return true;
}

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
      if (notifyOpener("error", error)) {
        return;
      }
      router.replace(`/?gcal_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      if (notifyOpener("error", "missing_params")) {
        return;
      }
      router.replace("/?gcal_error=missing_params");
      return;
    }

    const savedState = localStorage.getItem(GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY);

    if (state !== savedState) {
      setStatus("error");
      if (notifyOpener("error", "invalid_state")) {
        return;
      }
      router.replace("/?gcal_error=invalid_state");
      return;
    }

    fetch("/api/google-calendar/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
      credentials: "include",
    })
      .then(async (res) => {
        if (res.ok) {
          setStatus("success");
          if (notifyOpener("success")) {
            return;
          }
          router.replace("/?gcal_connected=true");
        } else {
          const data = await res.json().catch(() => ({}));
          const errorCode = encodeURIComponent(data.error || "callback_failed");
          setStatus("error");
          if (notifyOpener("error", data.error || "callback_failed")) {
            return;
          }
          router.replace(`/?gcal_error=${errorCode}`);
        }
      })
      .catch(() => {
        setStatus("error");
        if (notifyOpener("error", "network_error")) {
          return;
        }
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
