import type { Metadata } from "next";
import "./globals.css";
import "./security-experience.css";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export const metadata: Metadata = {
  ...(getPublicSiteUrl() ? { metadataBase: getPublicSiteUrl() } : {}),
  title: "Private Account Vault",
  description: "A private account vault with a public, evidence-led cybersecurity research and transparency program."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
