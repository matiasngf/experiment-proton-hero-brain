import type { Metadata } from "next";
import "./globals.css";
import { Header } from "../components/layout/header";

export const metadata: Metadata = {
  title: "Experiments",
  description: "A collection of experiments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
      </body>
    </html>
  );
}
