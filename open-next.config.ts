import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

// Next.js cache (ISR pages with `revalidate`, unstable_cache) is stored in R2.
// The memory queue re-renders stale pages via the WORKER_SELF_REFERENCE
// service binding — fine at this traffic level, no Durable Objects needed.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
