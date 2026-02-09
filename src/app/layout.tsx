import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storage Network | Custom Tote Storage Systems",
  description:
    "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds. Find certified installers or DIY with our cut lists.",
  keywords: [
    "tote storage",
    "27 gallon tote rack",
    "garage organization",
    "basement storage",
    "HDX tote shelving",
    "custom storage system",
    "tote organizer",
  ],
  icons: {
    icon: "/logo-storage-network.png",
    apple: "/logo-storage-network.png",
  },
  openGraph: {
    title: "Storage Network | Custom Tote Storage Systems",
    description:
      "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds.",
    type: "website",
    locale: "en_US",
    siteName: "Storage Network",
  },
  twitter: {
    card: "summary_large_image",
    title: "Storage Network | Custom Tote Storage Systems",
    description:
      "Design custom tote storage in 30 seconds. Free 3D configurator for garages, basements & sheds.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Organization Schema (JSON-LD)
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Storage Network",
  url: "https://storage-network.app",
  logo: "https://storage-network.app/logo-storage-network.png",
  description:
    "Professional tote storage system design and installation network. Custom solutions for garages, basements, sheds, and more.",
  foundingDate: "2024",
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: "English",
  },
  sameAs: [],
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Tote Storage Installation Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Professional Tote Storage Installation",
          description: "Custom-built tote storage systems installed by certified professionals",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "DIY Tote Storage Plans",
          description: "Complete cut lists and material guides for DIY builders",
        },
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
