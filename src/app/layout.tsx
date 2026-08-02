import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Instrument_Serif, Archivo, Jost } from "next/font/google";
import "./globals.css";
import "@/styles/umbrix-landing.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "600", "800"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in"),
  title: {
    default: "Umbrix — Verified Jobs from Official Company Career Pages",
    template: "%s · Umbrix",
  },
  description: "Discover verified jobs directly from official company career pages. No recruiters, no ghost jobs, no third-party spam. Search less and apply faster.",
  applicationName: "Umbrix",
  openGraph: {
    title: "Umbrix — Verified Jobs from Official Company Career Pages",
    description: "Discover verified jobs directly from official company career pages. No recruiters, no ghost jobs, no third-party spam.",
    siteName: "Umbrix",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umbrix — Verified Jobs from Official Company Career Pages",
    description: "Discover verified jobs directly from official company career pages. No recruiters, no ghost jobs, no third-party spam.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Umbrix",
  },
  icons: {
    icon: "/favicon-32.png",
    apple: "/apple-touch-icon.png",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
};

import { AuthProvider } from "@/components/AuthProvider";
import { AnalyticsInit } from "@/components/AnalyticsInit";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SiteJsonLd } from "@/components/SiteJsonLd";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${instrumentSerif.variable} ${plexMono.variable} ${archivo.variable} ${jost.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <SiteJsonLd />
        <AuthProvider firebaseConfig={firebaseConfig}>
          <AnalyticsInit />
          <ServiceWorkerRegister />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
