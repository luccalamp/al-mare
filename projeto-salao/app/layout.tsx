import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Cormorant_Garamond } from "next/font/google";
import { BrandingConfigProvider } from "@/components/BrandingConfigProvider";
import AuthGuard from "@/components/AuthGuard";
import VercelAnalytics from "@/components/VercelAnalytics";
import "./globals.css";

const geist = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-sans",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-brand",
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Al'maré Saúde Capilar",
    template: "%s | Al'maré Saúde Capilar",
  },
  description:
    "Prontuário clínico, evolução fotográfica, anamnese capilar e gestão operacional da Al'maré Saúde Capilar.",
  keywords: ["saude capilar", "anamnese", "prontuario", "tricologia", "paciente"],
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f4ecdf",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body className="antialiased text-[var(--color-text)]">
        <BrandingConfigProvider>
          <VercelAnalytics />
          <AuthGuard>
            <div className="relative min-h-screen">
              <main>{children}</main>
            </div>
          </AuthGuard>
        </BrandingConfigProvider>
      </body>
    </html>
  );
}
