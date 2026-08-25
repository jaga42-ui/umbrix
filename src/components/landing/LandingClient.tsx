"use client";

import UmbrixLanding from "@/components/landing/UmbrixLanding";
import { useAuth } from "@/components/AuthProvider";

/**
 * Client boundary for the landing page.
 *
 * Split out of `src/app/page.tsx` so that file can stay a server component and
 * export `metadata` — a `"use client"` page cannot, which is why `/` was the
 * one indexable route shipping without a canonical tag.
 */
export default function LandingClient() {
  const { signInWithGoogle } = useAuth();
  return <UmbrixLanding onSignIn={() => signInWithGoogle()} />;
}
