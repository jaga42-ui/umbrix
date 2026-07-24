import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Serif, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexSerif = IBM_Plex_Serif({
  variable: "--font-plex-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://umbrix.vercel.app"),
  title: {
    default: "Umbrix — Jobs Indian freshers actually qualify for",
    template: "%s · Umbrix",
  },
  description: "A daily feed of real, scam-checked jobs and internships for Indian students and freshers — filtered to your branch, batch, and skills, across every field.",
  applicationName: "Umbrix",
  openGraph: {
    title: "Umbrix — Jobs Indian freshers actually qualify for",
    description: "A daily feed of real, scam-checked jobs and internships for Indian students and freshers — filtered to your branch, batch, and skills, across every field.",
    siteName: "Umbrix",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Umbrix — Jobs Indian freshers actually qualify for",
    description: "A daily feed of real, scam-checked jobs and internships for Indian students and freshers — filtered to your branch, batch, and skills, across every field.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

import { AuthProvider } from "@/components/AuthProvider";
import { AnalyticsInit } from "@/components/AnalyticsInit";

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
      className={`${plexSans.variable} ${plexSerif.variable} ${plexMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans" suppressHydrationWarning>
        <AuthProvider firebaseConfig={firebaseConfig}>
          <AnalyticsInit />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
