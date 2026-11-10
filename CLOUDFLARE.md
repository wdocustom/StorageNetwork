# Hosting on Cloudflare Workers

The app runs on Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare).
The same code still deploys to Vercel, so both can run side by side during cutover.

## Pieces

| File | What it does |
|---|---|
| `wrangler.jsonc` | Worker config: bindings, CPU limit, cron triggers |
| `open-next.config.ts` | Next.js cache in R2, ISR revalidation queue |
| `cloudflare/worker.ts` | Worker entry: serves the app + runs cron jobs |
| `src/config/cron-jobs.ts` | Single list of cron jobs (test keeps wrangler + vercel.json in sync) |
| `src/lib/request-meta.ts` | Client IP + geo from Cloudflare or Vercel headers |

## Commands

```bash
npm run cf:build     # build for Workers
npm run cf:preview   # build + run locally on the Workers runtime (uses .dev.vars)
npm run cf:deploy    # build + deploy
```

## One-time setup

1. `npx wrangler login` (or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`).
2. `npx wrangler r2 bucket create storage-network-opennext-cache`
3. Add every variable from `.env.example` that production uses:
   - Secrets: `npx wrangler secret put NAME` (or dashboard → Worker → Settings → Variables).
   - `NEXT_PUBLIC_*` values are baked in at **build** time, so they must also be
     set in the environment that runs `cf:build` (shell, or Workers Builds settings).
4. `npm run cf:deploy` → test on the `*.workers.dev` URL.
5. Stripe: add the Workers URL as a webhook endpoint (platform + Connect) and
   test, or skip and repoint at cutover.
6. Zone → Rules → Managed Transforms → enable **Add visitor location headers**
   (city/region in analytics; country works without it).
7. Cutover: add the domain as a Custom Domain on the Worker (domain must be on
   Cloudflare DNS), confirm, then remove the Vercel project.

## Limits to know

- Worker size limit is 10 MB compressed; the build is ~7.9 MB. Check with
  `npx wrangler deploy --dry-run` after adding big server-side dependencies.
- `export const maxDuration` is ignored on Workers. CPU time is capped at
  5 min (`limits.cpu_ms`); network waits don't count toward it.
- Cron triggers run in UTC.
