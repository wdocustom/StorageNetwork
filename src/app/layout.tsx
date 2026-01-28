import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Shelf Dude Partner Network",
  description: "Tote-based garage shelving — built to fit your wall.",
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
