// ═══════════════════════════════════════════════════════════════════════════
// HowTo JSON-LD Schema Generator
//
// Generates Google-compatible HowTo structured data from the assembly step
// definitions. Enables "Step 1, Step 2, Step 3" rich snippets in search
// results and provides structured data for AI agents.
//
// Usage:
//   const schema = generateHowToJsonLd({ cols: 5, rows: 4, hasWheels: true, hasTop: false });
//   <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
//
// The `description` field can be overridden with a Gemini-generated project
// summary for per-project enrichment.
// ═══════════════════════════════════════════════════════════════════════════

import {
  getStepsForConfig,
  computeMaterials,
  type BuildConfig,
} from "@/components/visualizer/assemblySteps";

// ── Types ────────────────────────────────────────────────────────────────

interface HowToConfig extends BuildConfig {
  cols?: number;
  rows?: number;
  /** Gemini-generated project summary for SEO enrichment */
  description?: string;
  /** Installer business name for attribution */
  installerName?: string;
}

interface HowToStep {
  "@type": "HowToStep";
  position: number;
  name: string;
  text: string;
  itemListElement?: HowToDirection[];
}

interface HowToDirection {
  "@type": "HowToDirection";
  text: string;
}

interface HowToSupply {
  "@type": "HowToSupply";
  name: string;
  requiredQuantity?: string;
}

interface HowToTool {
  "@type": "HowToTool";
  name: string;
}

interface HowToJsonLd {
  "@context": "https://schema.org";
  "@type": "HowTo";
  name: string;
  description: string;
  totalTime: string;
  estimatedCost?: {
    "@type": "MonetaryAmount";
    currency: "USD";
    value: string;
  };
  supply: HowToSupply[];
  tool: HowToTool[];
  step: HowToStep[];
}

// ── Default description (overridable by Gemini enrichment) ───────────────

const DEFAULT_DESCRIPTION =
  "Step-by-step guide to building a heavy-duty tote storage rack from 2×4 lumber and plywood. " +
  "This system stores 27-gallon totes (HDX or Greenmade) on custom-spaced plywood rails, " +
  "with optional casters for mobility and a plywood work surface on top. " +
  "No pilot holes required — all connections use star drive construction screws.";

// ── Estimated build times (minutes) ──────────────────────────────────────

const STEP_TIMES: Record<string, number> = {
  "cut-uprights": 20,
  "cut-plates": 10,
  "rip-rails": 30,
  "mark-posts": 15,
  "build-ladders": 40,
  "attach-bottom-plates": 20,
  "attach-top-plates": 20,
  "attach-casters": 25,
  "attach-top": 15,
  final: 10,
};

// ── Generator ────────────────────────────────────────────────────────────

export function generateHowToJsonLd(config: HowToConfig): HowToJsonLd {
  const cols = config.cols ?? 5;
  const rows = config.rows ?? 4;
  const buildConfig: BuildConfig = {
    hasWheels: config.hasWheels,
    hasTop: config.hasTop,
  };

  const steps = getStepsForConfig(buildConfig);

  // Compute total time in ISO 8601 duration
  const totalMinutes = steps.reduce(
    (sum, s) => sum + (STEP_TIMES[s.id] ?? 15),
    0
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalTime = `PT${hours}H${minutes > 0 ? `${minutes}M` : ""}`;

  // Collect unique supplies and tools across all steps
  const supplySet = new Map<string, HowToSupply>();
  const toolSet = new Map<string, HowToTool>();

  for (const step of steps) {
    const materials = computeMaterials(step, cols, rows, buildConfig);
    for (const m of materials) {
      if (!supplySet.has(m.name)) {
        supplySet.set(m.name, {
          "@type": "HowToSupply",
          name: m.name,
          requiredQuantity: m.qty,
        });
      }
    }
    for (const t of step.tools) {
      if (!toolSet.has(t.name)) {
        toolSet.set(t.name, {
          "@type": "HowToTool",
          name: t.detail ? `${t.name} (${t.detail})` : t.name,
        });
      }
    }
  }

  // Map assembly steps to HowToStep schema
  const howToSteps: HowToStep[] = steps.map((step, i) => {
    const howToStep: HowToStep = {
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.instruction,
    };

    // Add pro tip as a sub-direction if present
    if (step.proTip) {
      howToStep.itemListElement = [
        {
          "@type": "HowToDirection",
          text: step.instruction,
        },
        {
          "@type": "HowToDirection",
          text: `Pro Tip: ${step.proTip}`,
        },
      ];
    }

    return howToStep;
  });

  // Build unit descriptor for the name
  const toteCount = cols * rows;
  const unitDesc = `${cols}-Column, ${rows}-Tier`;
  const extras = [
    config.hasWheels ? "Rolling" : null,
    config.hasTop ? "with Work Surface" : null,
  ]
    .filter(Boolean)
    .join(" ");

  const name = config.installerName
    ? `How to Build a ${unitDesc} Tote Storage Rack (${toteCount} Totes) — by ${config.installerName}`
    : `How to Build a ${unitDesc} Tote Storage Rack (${toteCount} Totes)${extras ? ` — ${extras}` : ""}`;

  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name,
    description: config.description || DEFAULT_DESCRIPTION,
    totalTime,
    supply: Array.from(supplySet.values()),
    tool: Array.from(toolSet.values()),
    step: howToSteps,
  };
}
