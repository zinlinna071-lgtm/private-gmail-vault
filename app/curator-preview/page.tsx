import type { Metadata } from "next";
import CuratorChallenge from "../curator-challenge";
import "./curator-challenge.css";

export const metadata: Metadata = {
  title: "The Curator's Signal | Private Account Vault",
  description: "An interactive archive discovery experience.",
  robots: { index: false, follow: false, noarchive: true }
};

export default function CuratorPreviewPage() {
  return <CuratorChallenge />;
}
