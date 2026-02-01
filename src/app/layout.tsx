import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Storage-Network | Professional Organizer Installers",
  description: "Book local certified installers for your custom storage solutions.",
  icons: {
    icon: "/logo-storage-network.png",
    apple: "/logo-storage-network.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
