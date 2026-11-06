import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Account Vault",
  description: "A simple private vault for account passwords and backup codes."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
