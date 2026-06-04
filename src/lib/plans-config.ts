export interface PublicPlan {
  id: string;
  name: string;
  tagline: string;
  includes: string[];
  price: number; // cents
  htmlFile: string; // filename under private/
  previewImage: string; // path under public/
}

export const PUBLIC_PLANS: PublicPlan[] = [
  {
    id: "adirondack-chair",
    name: "Low Boy Adirondack Chair",
    tagline: "Complete DIY build plans — cut, assemble, finish.",
    includes: [
      "Full materials & cut list",
      "Point-to-point cut profiles with exact angles",
      "6-step photo assembly guide",
      "Pocket hole layout diagrams",
    ],
    price: 1800, // $18
    htmlFile: "chair-plans.html",
    previewImage: "/images/chair-plans/low-back-adirondack-preview.png",
  },
];

export function getPlanById(id: string): PublicPlan | undefined {
  return PUBLIC_PLANS.find((p) => p.id === id);
}
