import { ImageResponse } from "next/og";

/**
 * Site-wide social preview card.
 *
 * Every page inherits this unless it defines its own, which closes a gap that
 * was costing real distribution: the site declared `twitter:card:
 * summary_large_image` on all eight page templates while shipping no image at
 * all, so every share rendered as a bare link. Indian students pass job links
 * around on WhatsApp constantly — an unfurled card is the cheapest reach this
 * codebase can buy.
 *
 * Typography-only on purpose. Rendering the emblem would mean reading a PNG off
 * disk at request time, and a font file would mean a network fetch; neither is
 * worth the failure mode when the wordmark carries the brand fine at this size.
 */
export const alt = "Umbrix — verified fresher jobs and internships in India";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#16352A";
const CREAM = "#F1EDE0";
const BRASS = "#BE7C2C";
const MUTED = "#ADA894";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, background: BRASS }} />
          <div
            style={{
              fontSize: 26,
              letterSpacing: "0.32em",
              color: CREAM,
              fontWeight: 500,
            }}
          >
            UMBRIX
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 78,
              lineHeight: 1.05,
              color: CREAM,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              maxWidth: 940,
            }}
          >
            Fresher jobs you actually qualify for.
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              lineHeight: 1.35,
              color: MUTED,
              maxWidth: 900,
            }}
          >
            Scam-checked roles across India, filtered by your branch, batch and CGPA.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            fontSize: 25,
            color: BRASS,
            fontWeight: 600,
          }}
        >
          umbrix.in
          <span style={{ color: "#4A5642" }}>·</span>
          <span style={{ color: MUTED, fontWeight: 400 }}>Free for students</span>
        </div>
      </div>
    ),
    size
  );
}
