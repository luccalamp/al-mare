"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GOOGLE_CALENDAR_OAUTH_MESSAGE_TYPE,
  GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY,
} from "@/lib/googleCalendar";

function notifyOpener(status: "success" | "error", error?: string) {
  if (typeof window === "undefined") return false;
  if (!window.opener || window.opener.closed) {
    console.log("[gcal-callback-notify] No opener or closed");
    return false;
  }

  console.log("[gcal-callback-notify] Sending message:", status, error || "");
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

    console.log("[gcal-callback-page] === START ===");
    console.log("[gcal-callback-page] code:", code ? "present" : "missing");
    console.log("[gcal-callback-page] state:", state ? "present" : "missing");
    console.log("[gcal-callback-page] error:", error || "none");

    if (error) {
      console.log("[gcal-callback-page] Error from Google:", error);
      setStatus("error");
      if (notifyOpener("error", error)) {
        return;
      }
      router.replace(`/?gcal_error=${encodeURIComponent(error)}`);
      return;
    }

    if (!code || !state) {
      console.log("[gcal-callback-page] Missing params");
      setStatus("error");
      if (notifyOpener("error", "missing_params")) {
        return;
      }
      router.replace("/?gcal_error=missing_params");
      return;
    }

    const savedState = localStorage.getItem(GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_CALENDAR_OAUTH_STATE_STORAGE_KEY);

    console.log("[gcal-callback-page] savedState:", savedState ? "present" : "missing");
    console.log("[gcal-callback-page] state match:", state === savedState);

    if (state !== savedState) {
      console.log("[gcal-callback-page] State mismatch");
      setStatus("error");
      if (notifyOpener("error", "invalid_state")) {
        return;
      }
      router.replace("/?gcal_error=invalid_state");
      return;
    }

    console.log("[gcal-callback-page] Calling API callback...");
    fetch("/api/google-calendar/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, state }),
      credentials: "include",
    })
      .then(async (res) => {
        console.log("[gcal-callback-page] API response status:", res.status);
        if (res.ok) {
          console.log("[gcal-callback-page] === SUCCESS ===");
          setStatus("success");
          if (notifyOpener("success")) {
            return;
          }
          router.replace("/?gcal_connected=true");
        } else {
          const data = await res.json().catch(() => ({}));
          console.log("[gcal-callback-page] API error:", data);
          const errorCode = encodeURIComponent(data.error || "callback_failed");
          setStatus("error");
          if (notifyOpener("error", data.error || "callback_failed")) {
            return;
          }
          router.replace(`/?gcal_error=${errorCode}`);
        }
      })
      .catch((err) => {
        console.error("[gcal-callback-page] Network error:", err);
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
      {process.env.NODE_ENV !== "production" && (
        <div className="absolute bottom-4 left-4 text-xs text-gray-500">
          <p>Status: {status}</p>
          <p>Code: {searchParams.get("code") ? "present" : "missing"}</p>
          <p>State: {searchParams.get("state") ? "present" : "missing"}</p>
        </div>
      )}
    </div>
  );
}
