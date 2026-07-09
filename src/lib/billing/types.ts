/**
 * Provider-agnostic billing seam.
 *
 * The concrete provider (Stripe / Paddle / Lemon Squeezy) is deliberately NOT
 * chosen yet. When it is, implement `BillingProvider` in
 * `src/lib/billing/<provider>.ts`, export a singleton from `billing/index.ts`,
 * and wire two routes: a checkout route that calls `createCheckoutSession` and
 * a webhook route that calls `handleWebhook` to upsert the Subscription record.
 * Nothing else in the app should import a provider SDK directly.
 */
import type { Subscription } from "@/models/Subscription";

export interface CheckoutParams {
  userId: string;
  email?: string;
  interval: "month" | "year";
  /** Where the provider redirects on success / cancel. */
  successUrl: string;
  cancelUrl: string;
}

export interface PortalParams {
  userId: string;
  returnUrl: string;
}

/** The Subscription-shaped patch a webhook produces to sync our record. */
export type SubscriptionSync = Partial<
  Pick<
    InstanceType<typeof Subscription>,
    | "plan"
    | "status"
    | "provider"
    | "providerCustomerId"
    | "providerSubscriptionId"
    | "interval"
    | "currentPeriodEnd"
    | "cancelAtPeriodEnd"
  >
> & { userId: string };

export interface BillingProvider {
  /** Stable identifier stored on the Subscription record, e.g. "stripe". */
  readonly id: string;
  /** Create a hosted checkout session and return its redirect URL. */
  createCheckoutSession(params: CheckoutParams): Promise<{ url: string }>;
  /** Create a customer billing-portal session (manage/cancel). */
  createPortalSession(params: PortalParams): Promise<{ url: string }>;
  /**
   * Verify and parse an incoming webhook request into a subscription sync
   * (or null for events we ignore). Verification of the signature is the
   * provider implementation's responsibility.
   */
  handleWebhook(request: Request): Promise<SubscriptionSync | null>;
}
