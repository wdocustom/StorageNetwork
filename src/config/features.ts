// Product switches — one place to turn a feature on or off everywhere.

/**
 * Customer-facing AI Design Assistant ("Build My Storage" chat on /design).
 * Off: it froze the page on phones (2026-10 report, not yet diagnosed).
 * Gates the widget, its features-page section and its announcement email.
 */
export const DESIGN_ASSISTANT_ENABLED = false;

/**
 * AI Asset Forge on the Marketing tab (FLUX image generation via Replicate).
 * Off: not being pursued for now.
 */
export const ASSET_FORGE_ENABLED = false;
