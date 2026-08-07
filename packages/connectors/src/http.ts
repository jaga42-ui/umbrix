/**
 * Shared HTTP client for connectors.
 *
 * Every connector needs the same things — identify ourselves honestly, back off
 * on failure, respect rate limits, never hang forever — and today each adapter
 * either reimplements a slice of that or skips it. Centralising means a new
 * connector inherits correct network behaviour instead of having to remember
 * it, which is the point of a framework.
 */

/** Required by CLAUDE.md's scraper ethics: identify the bot on every request. */
export const USER_AGENT = 'UmbrixBot/1.0 (+https://umbrix.vercel.app/bot)';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly statusText: string,
    readonly url: string,
    readonly body?: string
  ) {
    super(`HTTP ${status} ${statusText} for ${url}`);
    this.name = 'HttpError';
  }

  /** Whether retrying could plausibly succeed. */
  get retryable(): boolean {
    // 429 and 5xx are transient. 4xx (other than 429) means the request itself
    // is wrong — retrying just burns quota against a wall.
    return this.status === 429 || this.status >= 500;
  }
}

export interface FetchOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  /** Total attempts including the first. */
  attempts?: number;
  /** Base delay for exponential backoff, milliseconds. */
  backoffMs?: number;
  /** Per-attempt timeout, milliseconds. */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Delay before the next attempt: exponential with full jitter.
 *
 * Jitter matters here specifically because the runner fetches many slugs
 * concurrently against the same host. Without it, a host-wide blip makes every
 * in-flight request fail at the same instant and retry at the same instant,
 * reproducing the load that caused the failure.
 */
export function backoffDelay(attempt: number, baseMs: number): number {
  const ceiling = Math.min(baseMs * 2 ** attempt, 30_000);
  return Math.round(ceiling * (0.5 + Math.random() * 0.5));
}

/** Honour a server's Retry-After (seconds, or an HTTP date) when present. */
function retryAfterMs(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

/**
 * GET JSON with retries, backoff and a timeout.
 *
 * @throws {HttpError} on a non-retryable status, or after the final attempt.
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 1_000;
  const timeoutMs = options.timeoutMs ?? 20_000;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    // A per-attempt timeout, combined with the caller's cancellation so an
    // aborted run stops promptly instead of finishing its backoff.
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...options.headers },
        signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        const error = new HttpError(response.status, response.statusText, url, body.slice(0, 500));
        if (!error.retryable || attempt === attempts - 1) throw error;
        await sleep(retryAfterMs(response) ?? backoffDelay(attempt, backoffMs));
        lastError = error;
        continue;
      }

      return (await response.json()) as T;
    } catch (error) {
      // The caller's own abort is intentional — never retry through it.
      if (options.signal?.aborted) throw error;
      if (error instanceof HttpError && !error.retryable) throw error;
      if (attempt === attempts - 1) throw error;
      lastError = error;
      await sleep(backoffDelay(attempt, backoffMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`fetch failed for ${url}`);
}

/**
 * Liveness probe: does this endpoint answer at all, and how fast?
 *
 * Single attempt on purpose — a health check that retries would mask exactly
 * the flakiness it exists to detect.
 */
export async function probe(url: string, timeoutMs = 10_000): Promise<{ healthy: boolean; latencyMs: number; detail?: string }> {
  const started = Date.now();
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      healthy: response.ok,
      latencyMs: Date.now() - started,
      detail: response.ok ? undefined : `HTTP ${response.status} ${response.statusText}`,
    };
  } catch (error) {
    return {
      healthy: false,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
