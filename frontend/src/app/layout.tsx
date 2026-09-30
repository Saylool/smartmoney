import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "./globals.css";
import { Providers } from "./providers";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const description = "Perpl's top 20 traders just picked a side. Bet on whether smart money is right. Parimutuel rounds on Monad.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SmartMoney — is smart money right?",
  description,
  openGraph: {
    title: "SmartMoney — is smart money right?",
    description,
    images: [{ url: "/img/og.jpg", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/img/og.jpg"] },
};

export const viewport: Viewport = { themeColor: "#0b0d12" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preload" as="image" href="/img/hero-2400.webp" media="(min-width: 800px)" />
        <link rel="preload" as="image" href="/img/hero-1280.webp" media="(max-width: 799px)" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
