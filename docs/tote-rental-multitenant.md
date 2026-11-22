# Tote rental platform — multi-company plan (parked, Nov 2026)

Goal: run Tote To Go (totetogosc.com, Upstate SC) on Storage Network, then
let other tote rental companies run their operations on the same system.

## Recommended setup

1. **One app, one database, companies as accounts.** A `rental_companies`
   table: name, slug, logo, colors, service area, packages/prices, rental
   length, Stripe account, custom domain. Every rental table (bookings, totes,
   drivers, routes) carries `company_id`; RLS keeps companies apart. Tote To
   Go is company #1.
2. **Subdomain per company:** `<slug>.storage-network.app` (e.g.
   `totetogosc.storage-network.app`). Cloudflare: one wildcard DNS record +
   a `*.storage-network.app/*` route to the existing worker. Middleware reads
   the Host header and rewrites to the company's booking site. Adding a
   company = adding a row, no deploy.
3. **Their own domain (optional):** Cloudflare for SaaS custom hostnames —
   the company adds one DNS record, Cloudflare issues SSL. (~100 free, then
   about $0.10/mo each — confirm current pricing.) The subdomain stays as
   the fallback.
4. **One ops login:** owners/drivers sign in at storage-network.app/dashboard,
   scoped to their company (deliveries, pickups, tote counts, late returns).
   The installer Tote Rentals screen (realtor gifts) is a starting point.
5. **Payments:** Stripe Connect — customers pay the company directly; we take
   a monthly fee and/or per-booking fee. No holding others' money/refunds.

Rejected: separate site per company (unmaintainable), path-only
`storage-network.app/r/<slug>` (doesn't feel like their business, no custom
domains).

## Open questions before building

- Where does totetogosc.com live today (Wix/Squarespace/custom)?
- Brand: under Storage Network, or its own product name hosted by us?
- v1 scope: migrate Tote To Go only, or second-company-ready (signup,
  Connect, billing)?

Suggested first step: rebuild Tote To Go on the platform at
`totetogosc.storage-network.app`, then point totetogosc.com at it.
