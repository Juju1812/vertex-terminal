import type { Metadata } from "next";
import EmbedBuilderClient from "./EmbedBuilderClient";

/* ── /embed-builder — public widget configurator ──────────────
   Public page where anyone can preview the iframe widget and
   copy a paste-ready embed code. Drives backlinks: every embed
   on someone's blog/Substack/Notion is a free /stock/[ticker]
   visit + a permanent backlink to www.arbibx.com. */

export const metadata: Metadata = {
  title: "Embed widget — paste live ArbibX prices into any blog · ArbibX",
  description: "Free, no-signup-required embed code. Drop a live stock ticker card into your Substack, Notion, blog, or website. Live price + 30-day sparkline + AI-powered link-through.",
  alternates: { canonical: "https://www.arbibx.com/embed-builder" },
  openGraph: {
    title: "Embed live stock widgets · ArbibX",
    description: "Paste a live, AI-linked ArbibX widget into any blog or Substack. Free, no signup.",
    type: "website",
    url:  "https://www.arbibx.com/embed-builder",
    siteName: "ArbibX",
    images: [{ url: "https://www.arbibx.com/api/og?type=default&h=Embed%20live%20ArbibX%20widgets&s=Free%20iframe%20widget%20for%20any%20blog%20or%20Substack", width: 1200, height: 630, alt: "ArbibX embed widget" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Embed live stock widgets · ArbibX",
    description: "Free iframe widget for any blog or Substack.",
    images: ["https://www.arbibx.com/api/og?type=default&h=Embed%20live%20ArbibX%20widgets"],
  },
};

export default function EmbedBuilderPage() {
  return <EmbedBuilderClient />;
}
