import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reach & Frequency Calculator",
  description:
    "Calculate reach, frequency, GRPs, and effective 3+ reach for media planning tactics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-100 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
