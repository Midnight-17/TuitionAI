import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Runway | Student dashboard",
  description: "A focused workspace for building a consistent study rhythm.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
