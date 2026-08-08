/**
 * Bounded concurrency with interleaving and a retry pass.
 *
 * Ported from `scripts/ingest-jobs.js`, whose comments record why each piece
 * exists — they encode real operational lessons, not preference:
 *
 *  - Interleaving by source: the registry groups entries by source for
 *    readability, so a naive worker pool sends every request for the slowest,
 *    most failure-prone host into the same window. Round-robin spreads
 *    same-host requests across the whole run.
 *  - The retry pass is sequential: most transient failures come from
 *    concurrency saturation, so retrying at full concurrency reproduces the
 *    condition that caused them.
 */

export interface RegistryEntry {
  slug: string;
  source: string;
  config: Record<string, unknown>;
}

/** Round-robin entries across sources instead of processing in file order. */
export function interleaveBySource<T extends { source: string }>(entries: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.source);
    if (bucket) bucket.push(entry);
    else groups.set(entry.source, [entry]);
  }

  const queues = [...groups.values()];
  const out: T[] = [];
  let remaining = entries.length;
  let i = 0;
  while (remaining > 0) {
    const queue = queues[i % queues.length];
    if (queue.length > 0) {
      out.push(queue.shift() as T);
      remaining--;
    }
    i++;
  }
  return out;
}

/** Run `worker` over `items` with at most `size` in flight. */
export async function pool<T, R>(items: T[], worker: (item: T, index: number) => Promise<R>, size: number): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(size, items.length)) }, run));
  return results;
}

/**
 * Run everything concurrently, then retry the failures once, sequentially.
 * `isFailure` decides what counts as needing a retry.
 */
export async function runWithRetryPass<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number,
  isFailure: (result: R) => boolean
): Promise<{ results: R[]; retried: number; recovered: number }> {
  const results = await pool(items, worker, concurrency);

  const failedIndexes: number[] = [];
  results.forEach((r, i) => {
    if (isFailure(r)) failedIndexes.push(i);
  });

  let recovered = 0;
  for (const i of failedIndexes) {
    const retry = await worker(items[i], i);
    results[i] = retry;
    if (!isFailure(retry)) recovered++;
  }

  return { results, retried: failedIndexes.length, recovered };
}
