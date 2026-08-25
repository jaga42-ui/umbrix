import { attributionFor } from "@/lib/aggregatorAttribution";

/**
 * The "Jobs by <Aggregator>" label an advert must carry when its apply link
 * routes through an aggregator that requires attribution.
 *
 * Renders nothing for direct ATS listings, which need no credit.
 *
 * ## Meeting the size requirement
 *
 * Adzuna's terms set a minimum of 116 × 23 pixels. `min-w`/`min-h` enforce that
 * floor in CSS pixels rather than trusting the text to happen to fill it — at
 * the smallest breakpoint a bare 11px label measures well under 116px wide.
 *
 * ## The logo
 *
 * The terms also specify that the word "Adzuna" should be the Adzuna logo
 * image. That needs their official brand asset, which is not in this repo and
 * must not be recreated by hand or hotlinked from an unverified URL. The text
 * mark ships now — it satisfies the phrase, the link targets and the size
 * floor, and is strictly better than the nothing that was rendering before.
 * Swapping in the supplied logo is a drop-in change here.
 *
 * Laid out as a block-level `flex w-fit` rather than `inline-flex` so callers
 * never need to add `block` to force it onto its own line — the two collide,
 * and which one wins depends on Tailwind's emitted order rather than intent.
 *
 * `rel="nofollow"` because this is a contractual credit link, not an editorial
 * endorsement, and it points off-site from every job page on the domain.
 */
export function SourceAttribution({
  applyUrl,
  className = "",
}: {
  applyUrl: string | null | undefined;
  className?: string;
}) {
  const attribution = attributionFor(applyUrl);
  if (!attribution) return null;

  return (
    <p
      className={`flex w-fit items-center gap-1 text-[11px] leading-none text-muted-foreground min-w-[116px] min-h-[23px] ${className}`}
    >
      <a
        href={attribution.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 hover:text-foreground"
      >
        Jobs
      </a>
      <span>by</span>
      <a
        href={attribution.href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="font-semibold underline underline-offset-2 hover:text-foreground"
      >
        {attribution.name}
      </a>
    </p>
  );
}
