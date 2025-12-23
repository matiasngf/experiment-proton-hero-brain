import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brain Graph Visualization",
  description: "3D brain/graph structure visualization with Three.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
