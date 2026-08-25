import type { Metadata } from "next";
import { ScamCheckClient } from "@/components/ScamCheckClient";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

export const metadata: Metadata = {
  title: "Free Job Scam Checker",
  description:
    "Paste any job post, WhatsApp message, or offer letter — UMBRIX instantly checks it for scam signals. Free, no signup. Job scams cost Indians ₹5,100 crore a year; don't be next.",
  alternates: { canonical: `${SITE}/scam-check` },
  openGraph: {
    title: "Is this job real? Free Job Scam Checker · UMBRIX",
    description:
      "Paste any job post, WhatsApp message, or offer letter and get an instant scam check. Free, no signup.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Is this job real? Free Job Scam Checker · UMBRIX",
    description:
      "Paste any job post, message, or offer letter and get an instant scam check. Free, no signup.",
  },
};

export default function ScamCheckPage() {
  return <ScamCheckClient />;
}
