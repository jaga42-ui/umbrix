"use client";

import { useEffect, useRef } from "react";

/**
 * Scroll-reveal + count-up for the landing page.
 *
 * Deliberately NOT a one-shot IntersectionObserver. Three hard-won rules,
 * each of which fixed a real bug where sections rendered permanently blank:
 *
 *  1. Never hide a node that is already on screen — reveal can then only ever
 *     ADD visibility, never remove it. Worst case is "no animation", never
 *     "invisible content".
 *  2. Never snapshot the node list. Re-query on every sweep so nodes that
 *     mount late are picked up.
 *  3. Never gate the whole system behind a cached boolean or a rAF callback.
 *     rAF does not fire while the document is hidden (background tab,
 *     prerender, "open in new tab"), which would kill everything silently.
 *
 * Markup contract:
 *   data-reveal="120"          → fades up, 120ms stagger delay
 *   data-count="20000"         → counts up to 20000 on first view
 *   data-count data-comma      → formats with en-IN thousands separators
 */
export function useReveal() {
  const io = useRef<IntersectionObserver | null>(null);
  const cio = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const reveal = (el: Element) => {
      const node = el as HTMLElement;
      if (node.dataset.revealed) return;
      node.dataset.revealed = "1";
      node.style.transitionDelay = `${parseFloat(node.dataset.reveal || "0") || 0}ms`;
      node.style.opacity = "1";
      node.style.transform = "none";
      window.setTimeout(() => { node.style.willChange = "auto"; }, 1200);
      io.current?.unobserve(node);
    };

    const runCount = (el: Element) => {
      const node = el as HTMLElement;
      node.dataset.counted = "1";
      const target = parseFloat(node.dataset.count || "");
      if (!Number.isFinite(target)) return;
      const comma = node.dataset.comma !== undefined;
      const dur = 1500;
      let t0: number | null = null;
      const tick = (t: number) => {
        if (t0 === null) t0 = t;
        const p = Math.min(1, Math.max(0, (t - t0) / dur));
        const v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        node.textContent = comma ? v.toLocaleString("en-IN") : String(v);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const watchCounters = () => {
      if (!cio.current) {
        cio.current = new IntersectionObserver(
          (entries) => entries.forEach((e) => {
            if (!e.isIntersecting) return;
            cio.current?.unobserve(e.target);
            runCount(e.target);
          }),
          { threshold: 0.5 }
        );
      }
      document.querySelectorAll<HTMLElement>("[data-count]").forEach((n) => {
        if (n.dataset.counted || n.dataset.watched) return;
        n.dataset.watched = "1";
        cio.current?.observe(n);
      });
    };

    const arm = () => {
      const h = window.innerHeight;
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (el.dataset.armed) return;
        el.dataset.armed = "1";
        if (!still && el.getBoundingClientRect().top > h * 0.9) {
          el.style.opacity = "0";
          el.style.transform = "translate3d(0,22px,0)";
          el.style.willChange = "opacity, transform";
        }
        el.style.transition =
          "opacity .68s cubic-bezier(.16,.84,.28,1), transform .68s cubic-bezier(.16,.84,.28,1)";
        io.current?.observe(el);
      });
    };

    const sweep = () => {
      arm();
      const h = window.innerHeight;
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        if (el.dataset.revealed) return;
        if (el.getBoundingClientRect().top < h) reveal(el);
      });
      watchCounters();
      return document.querySelectorAll("[data-reveal]:not([data-revealed])").length;
    };

    io.current = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) reveal(e.target); }),
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 }
    );

    let last = 0;
    const onScroll = () => {
      const now = Date.now();
      if (now - last < 90) return;
      last = now;
      sweep();
    };
    const onVisible = () => sweep();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisible);
    sweep();

    const ticker = window.setInterval(() => {
      if (sweep() === 0 && document.querySelectorAll("[data-reveal]").length > 0) {
        window.clearInterval(ticker);
      }
    }, 400);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(ticker);
      io.current?.disconnect();
      cio.current?.disconnect();
    };
  }, []);
}
