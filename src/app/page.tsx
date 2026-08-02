"use client";

import UmbrixLanding from "@/components/landing/UmbrixLanding";
import { useAuth } from "@/components/AuthProvider";

export default function LandingPage() {
  const { signInWithGoogle } = useAuth();
  return <UmbrixLanding onSignIn={() => signInWithGoogle()} />;
}
