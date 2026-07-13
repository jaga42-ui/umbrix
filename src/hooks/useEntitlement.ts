"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { authedFetch } from "@/lib/authedFetch";
import { FREE_ENTITLEMENT, type Entitlement } from "@/lib/entitlements";

// Demo-only override: set localStorage.umbrix_demo_premium = "true" to preview
// premium-gated UI without a real subscription. Ignored outside demo mode.
const DEMO_PREMIUM_KEY = "umbrix_demo_premium";

const DEMO_PREMIUM_ENTITLEMENT: Entitlement = {
  plan: "premium",
  isPremium: true,
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  limits: { trackerActiveApplications: null, resumeTailorsPerMonth: null },
};

export interface UseEntitlement extends Entitlement {
  loading: boolean;
}

/**
 * Client hook exposing the current user's entitlement. Returns the free tier
 * until resolved, so callers can safely gate optimistically. In demo mode it
 * honors a localStorage override; otherwise it reads `GET /api/entitlement`.
 */
export function useEntitlement(): UseEntitlement {
  const { user, loading, isDemoMode } = useAuth();
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setEntitlement(FREE_ENTITLEMENT);
      setFetching(false);
      return;
    }

    if (isDemoMode) {
      const demoPremium =
        typeof window !== "undefined" &&
        localStorage.getItem(DEMO_PREMIUM_KEY) === "true";
      setEntitlement(demoPremium ? DEMO_PREMIUM_ENTITLEMENT : FREE_ENTITLEMENT);
      setFetching(false);
      return;
    }

    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        const res = await authedFetch(`/api/entitlement?userId=${user.uid}`);
        const data = await res.json();
        if (!cancelled && data.success) setEntitlement(data.entitlement);
      } catch {
        if (!cancelled) setEntitlement(FREE_ENTITLEMENT);
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading, isDemoMode]);

  return { ...entitlement, loading: fetching };
}
