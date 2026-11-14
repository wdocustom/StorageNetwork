import MetaPixel from "@/components/tracking/MetaPixel";

// Every /plans page: the Meta Pixel for the Facebook / Instagram ad funnel
// (inactive until NEXT_PUBLIC_META_PIXEL_ID is set).
export default function PlansLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <MetaPixel />
    </>
  );
}
