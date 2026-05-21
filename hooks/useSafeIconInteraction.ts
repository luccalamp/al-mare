"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";

interface UseSafeIconInteractionOptions {
  onSelect: () => void;
  onOpen: () => void;
}

interface TouchState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
}

const TAP_MOVE_THRESHOLD = 8;
const SUPPRESS_CLICK_MS = 400;
const ICON_ROOT_STYLE: CSSProperties = { touchAction: "pan-y" };

function movedBeyondThreshold(
  touchState: TouchState,
  event: PointerEvent<HTMLElement>
) {
  const deltaX = event.clientX - touchState.startX;
  const deltaY = event.clientY - touchState.startY;

  return deltaX * deltaX + deltaY * deltaY > TAP_MOVE_THRESHOLD * TAP_MOVE_THRESHOLD;
}

export function useSafeIconInteraction({
  onSelect,
  onOpen,
}: UseSafeIconInteractionOptions) {
  const touchStateRef = useRef<TouchState | null>(null);
  const suppressNextClickRef = useRef(false);
  const suppressClickTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (suppressClickTimeoutRef.current !== null) {
        window.clearTimeout(suppressClickTimeoutRef.current);
      }
    };
  }, []);

  const clearTouchState = () => {
    touchStateRef.current = null;
  };

  const suppressNextClick = () => {
    suppressNextClickRef.current = true;

    if (suppressClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressClickTimeoutRef.current);
    }

    suppressClickTimeoutRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickTimeoutRef.current = null;
    }, SUPPRESS_CLICK_MS);
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextClickRef.current = false;
      return;
    }

    onSelect();
  };

  const handleDoubleClick = () => {
    onOpen();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    touchStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const touchState = touchStateRef.current;
    if (!touchState || touchState.pointerId !== event.pointerId || touchState.moved) {
      return;
    }

    touchState.moved = movedBeyondThreshold(touchState, event);
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const touchState = touchStateRef.current;
    if (!touchState || touchState.pointerId !== event.pointerId) {
      return;
    }

    const wasDrag = touchState.moved || movedBeyondThreshold(touchState, event);
    clearTouchState();
    suppressNextClick();

    if (!wasDrag) {
      onOpen();
    }
  };

  const handlePointerCancel = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch") {
      return;
    }

    const touchState = touchStateRef.current;
    if (!touchState || touchState.pointerId !== event.pointerId) {
      return;
    }

    clearTouchState();
    suppressNextClick();
  };

  return {
    iconInteractionProps: {
      onClick: handleClick,
      onDoubleClick: handleDoubleClick,
      onKeyDown: handleKeyDown,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      style: ICON_ROOT_STYLE,
    },
  };
}