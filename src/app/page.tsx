import type { Metadata } from "next";
import LandingClient from "@/components/landing/LandingClient";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.umbrix.in";

/**
 * Only the canonical is set here — title, description and Open Graph are
 * inherited from the root layout, which already describes the site itself.
 *
 * `/` is the most-linked page on the site and the likeliest to be shared with
 * `?utm_*` and other tracking parameters appended. Without a self-referencing
 * canonical each of those variants is a separate URL to Google, splitting the
 * signals of the one page every external link points at.
 */
export const metadata: Metadata = {
  alternates: { canonical: `${SITE}/` },
};

export default function LandingPage() {
  return <LandingClient />;
}
