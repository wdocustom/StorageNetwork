// ═══════════════════════════════════════════════════════════════════════════
// Services Config — Shared types & defaults for service offerings
//
// Extracted from "use server" file so these can be imported by both
// server actions and client/page components without Next.js errors.
// ═══════════════════════════════════════════════════════════════════════════

export interface ServiceOffering {
  id: string;
  name: string;
  description: string;
  price: number | null; // null for tote_storage (priced via configurator)
  enabled: boolean;
  built_in: boolean;
}

/** Default built-in services every installer starts with */
export const DEFAULT_SERVICES: ServiceOffering[] = [
  {
    id: "tote_storage",
    name: "Custom Tote Storage",
    description: "Design in 3D, get instant pricing, book installation.",
    price: null,
    enabled: true,
    built_in: true,
  },
  {
    id: "cleanout_1car",
    name: "1-Car Garage Clean Out",
    description: "Single bay / small basement",
    price: 349,
    enabled: true,
    built_in: true,
  },
  {
    id: "cleanout_2car",
    name: "2-Car Garage Clean Out",
    description: "Double bay / large basement",
    price: 549,
    enabled: true,
    built_in: true,
  },
];
