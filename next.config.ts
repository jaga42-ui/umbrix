import type { NextConfig } from "next";

// Security headers applied to every response. These are conservative and
// framework-safe (no CSP that would break the Firebase auth popup or inline
// styles used by Tailwind/Framer Motion).
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// Proxy Firebase Auth's reserved paths through our own origin so the OAuth
// sign-in handshake (handler + iframe) is first-party. This avoids the
// cross-domain storage partitioning that otherwise breaks signInWithRedirect
// (and popup persistence) in modern browsers. Requires authDomain to be set to
// this app's own domain (NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=hikari-tau.vercel.app).
const firebaseProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hikari-d7c84";
const firebaseAppDomain = `${firebaseProjectId}.firebaseapp.com`;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: `https://${firebaseAppDomain}/__/auth/:path*`,
      },
      {
        source: "/__/firebase/:path*",
        destination: `https://${firebaseAppDomain}/__/firebase/:path*`,
      },
    ];
  },
};

export default nextConfig;
