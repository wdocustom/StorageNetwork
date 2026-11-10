import "server-only";

// Paid plan HTML lives in private/ (never in public/, so it is never served
// as a static file). It is bundled into the server code as a string by the
// webpack rule in next.config.mjs, because Cloudflare Workers have no
// filesystem to read it from at request time. Access checks stay in the
// routes that call getPrivateFile().
import chairPlans from "../../../private/chair-plans.html";

const PRIVATE_FILES: Record<string, string> = {
  "chair-plans.html": chairPlans,
};

export function getPrivateFile(name: string): string | null {
  return PRIVATE_FILES[name] ?? null;
}
