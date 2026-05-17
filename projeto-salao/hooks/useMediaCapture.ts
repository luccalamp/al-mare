"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type CameraFacingMode = "user" | "environment";

function buildPreferredCameraConstraints(
  facingMode: CameraFacingMode,
  strict: boolean
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: strict ? { exact: facingMode } : { ideal: facingMode },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  };
}

const FALLBACK_CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: true,
};

function isRecoverableCameraError(error: unknown) {
  return (
    error instanceof DOMException &&
    ["OverconstrainedError", "NotFoundError", "DevicesNotFoundError"].includes(error.name)
  );
}

function getCaptureErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "O navegador bloqueou a camera. Libere a permissao para este site e tente novamente.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Nenhuma camera foi encontrada neste dispositivo.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "A camera esta ocupada por outro aplicativo. Feche o outro app e tente novamente.";
    }

    if (error.name === "SecurityError") {
      return "A camera so pode ser usada em conexao segura. Abra o sistema em HTTPS ou localhost.";
    }
  }

  return "Nao foi possivel acessar a camera agora. Verifique a permissao do navegador e tente novamente.";
}

export function useMediaCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeFacingMode, setActiveFacingMode] = useState<CameraFacingMode>("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean | null>(null);

  const syncCameraAvailability = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((device) => device.kind === "videoinput");
      setHasMultipleCameras(videoInputs.length > 1);
    } catch {
      setHasMultipleCameras(null);
    }
  }, []);

  const clearStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const stopCapture = useCallback(() => {
    clearStream();
    setError(null);
    setIsBusy(false);
    setActiveFacingMode("user");
  }, [clearStream]);

  const startCapture = useCallback(async (requestedFacingMode: CameraFacingMode = "user") => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("A camera nao esta disponivel neste dispositivo.");
      return;
    }

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("A camera so pode ser usada em conexao segura. Abra o sistema em HTTPS ou localhost.");
      return;
    }

    try {
      setIsBusy(true);
      clearStream();
      setError(null);
      let stream: MediaStream;

      try {
        stream = await navigator.mediaDevices.getUserMedia(
          buildPreferredCameraConstraints(requestedFacingMode, true)
        );
      } catch (preferredError) {
        if (isRecoverableCameraError(preferredError)) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(
              buildPreferredCameraConstraints(requestedFacingMode, false)
            );
          } catch (relaxedError) {
            if (isRecoverableCameraError(relaxedError)) {
              stream = await navigator.mediaDevices.getUserMedia(FALLBACK_CAMERA_CONSTRAINTS);
            } else {
              throw relaxedError;
            }
          }
        } else {
          throw preferredError;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActiveFacingMode(requestedFacingMode);
      setIsActive(true);
      void syncCameraAvailability();
    } catch (captureError) {
      console.error(captureError);
      setError(getCaptureErrorMessage(captureError));
      clearStream();
    } finally {
      setIsBusy(false);
    }
  }, [clearStream, syncCameraAvailability]);

  const switchCamera = useCallback(async () => {
    if (hasMultipleCameras === false) {
      setError("Este dispositivo nao expoe uma segunda camera disponivel.");
      return;
    }

    const nextFacingMode = activeFacingMode === "user" ? "environment" : "user";
    await startCapture(nextFacingMode);
  }, [activeFacingMode, hasMultipleCameras, startCapture]);

  const captureFrame = useCallback(async (fileName?: string) => {
    const video = videoRef.current;
    if (!video || !isActive) return null;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.92);
    });

    if (!blob) return null;

    return new File([blob], fileName || `captura-${Date.now()}.jpg`, { type: "image/jpeg" });
  }, [isActive]);

  useEffect(() => {
    void syncCameraAvailability();
  }, [syncCameraAvailability]);

  useEffect(() => stopCapture, [stopCapture]);

  return {
    videoRef,
    isActive,
    error,
    isBusy,
    activeFacingMode,
    hasMultipleCameras,
    startCapture,
    stopCapture,
    switchCamera,
    captureFrame,
  };
}