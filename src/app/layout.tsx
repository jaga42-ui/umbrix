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
  // Names the audience and the country. The previous default ("Verified Jobs
  // from Official Company Career Pages") described the sourcing method and
  // matched no query anyone types: it contained none of "fresher", "student",
  // "graduate" or "India", while every other template on the site — and the
  // whole /jobs/{field}/{city} namespace — targets exactly those. The homepage
  // carries the most authority of any URL here, so it was the one page spending
  // it on nobody.
  title: {
    default: "Umbrix — Verified Fresher Jobs & Internships in India",
    template: "%s · Umbrix",
  },
  description: "Real, scam-checked jobs and internships for Indian freshers, sourced from official company career pages. See which roles you actually qualify for — by branch, batch and CGPA.",
  applicationName: "Umbrix",
  openGraph: {
    title: "Umbrix — Verified Fresher Jobs & Internships in India",
    description: "Real, scam-checked jobs and internships for Indian freshers, sourced from official company career pages. See which roles you actually qualify for.",
    siteName: "Umbrix",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umbrix — Verified Fresher Jobs & Internships in India",
    description: "Real, scam-checked jobs and internships for Indian freshers, sourced from official company career pages. See which roles you actually qualify for.",
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
  // Search Console / Bing Webmaster site verification.
  //
  // Read from the environment rather than hardcoded: the token is per-property,
  // and a DNS TXT record is the better verification method anyway (it survives
  // redeploys and covers every subdomain). This exists so the HTML-tag method
  // works without a code change if DNS isn't available.
  //
  // Only emitted when set — an empty verification tag is worse than none.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } }
      : {}),
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
