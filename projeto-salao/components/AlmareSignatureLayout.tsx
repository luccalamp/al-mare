"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  leftExtra?: ReactNode;
  leftFooter?: ReactNode | null;
  kicker?: string;
  title?: string;
  description?: string;
};

export default function AlmareSignatureLayout({
  children,
}: Props) {
  return <div className="min-h-screen p-4">{children}</div>;
}
