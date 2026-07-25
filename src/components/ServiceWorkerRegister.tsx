"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (public/sw.js) so Umbrix is installable and works
 * offline as a shell. Mounted once at the app root; renders nothing. Registers
 * after load so it never competes with the first paint.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* best-effort — the app works fine without it */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);
  return null;
}
