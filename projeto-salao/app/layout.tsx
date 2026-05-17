import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { BrandingConfigProvider } from "@/components/BrandingConfigProvider";
import OrganizationProvider from "@/components/OrganizationProvider";
import AuthGuard from "@/components/AuthGuard";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7eee4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${cormorant.variable}`} suppressHydrationWarning>
      <body className="antialiased">
        <OrganizationProvider>
          <BrandingConfigProvider>
            <AuthGuard>
              <div className="min-h-screen">
                <main>{children}</main>
              </div>
            </AuthGuard>
          </BrandingConfigProvider>
        </OrganizationProvider>
      </body>
    </html>
  );
}
