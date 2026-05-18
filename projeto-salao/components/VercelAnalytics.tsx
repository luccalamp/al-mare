"use client";

import { inject } from "@vercel/analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";

inject();

export default function VercelAnalytics() {
  return <SpeedInsights />;
}