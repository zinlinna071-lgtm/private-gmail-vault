import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Private Gmail Vault",
  description: "A private, secure workspace for accessing your connected Gmail accounts."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}