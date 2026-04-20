const BASE = "https://storage-network.app";

interface BreadcrumbItem {
  name: string;
  path: string;
}

/**
 * Generates a BreadcrumbList JSON-LD schema.
 * Automatically prepends "Home" as the first item.
 */
export function generateBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE,
      },
      ...items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 2,
        name: item.name,
        item: `${BASE}${item.path}`,
      })),
    ],
  };
}
