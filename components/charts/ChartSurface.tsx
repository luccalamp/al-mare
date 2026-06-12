"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

type ChartSurfaceProps = {
  children: ReactNode;
  className?: string;
  minHeight?: number | string;
};

export default function ChartSurface({ children, className, minHeight }: ChartSurfaceProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let frameId = 0;

    const updateReadyState = () => {
      cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const { width, height } = node.getBoundingClientRect();
        setIsReady(width > 0 && height > 0);
      });
    };

    updateReadyState();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateReadyState();
          });

    resizeObserver?.observe(node);
    window.addEventListener("resize", updateReadyState);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateReadyState);
    };
  }, []);

  return (
    <div ref={containerRef} className={className} style={minHeight ? { minHeight } : undefined}>
      {isReady ? children : <div aria-hidden className="h-full w-full rounded-[24px] bg-[rgba(122,73,33,0.05)]" />}
    </div>
  );
}
