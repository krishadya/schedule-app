import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vernon Schedule System",
  description: "Staff availability and event scheduling",
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
