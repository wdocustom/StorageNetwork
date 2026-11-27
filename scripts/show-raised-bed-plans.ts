import { buildAllRaisedBedPlans } from "../src/lib/raised-beds-buildengine";

const plans = buildAllRaisedBedPlans();
for (const p of plans) {
  const legs = p.cuts.find((c) => c.name === "Leg long face")!;
  const ac = p.cuts.find((c) => c.name === "Side picket A/C")!;
  const bd = p.cuts.find((c) => c.name === "Side picket B/D")!;
  const totals = p.fasteners.reduce<Record<string, number>>((m, f) => {
    m[f.size] = (m[f.size] || 0) + f.qty;
    return m;
  }, {});
  console.log(
    p.sizeId.padEnd(24),
    `${p.dimensions.widthIn}×${p.dimensions.lengthIn}×${p.dimensions.heightIn}`.padEnd(14),
    `legs ${legs.lengthIn}"`.padEnd(13),
    `A/C ${ac.lengthIn}"×${ac.qty}`.padEnd(14),
    `B/D ${bd.lengthIn}"×${bd.qty}`.padEnd(17),
    `pickets≈${p.fencePicketsEstimate}`.padEnd(11),
    `1"=${totals['1"'] || 0} 1-1/4"=${totals['1-1/4"'] || 0}`,
    p.unspecified.length ? `[${p.unspecified.length} TBD]` : "",
  );
}
