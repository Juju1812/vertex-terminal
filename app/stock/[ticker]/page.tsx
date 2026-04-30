import type { Metadata } from "next";
import TickerView from "./TickerView";

/* Server component shell — handles metadata for SEO + Open Graph,
   then renders the client TickerView for the interactive UI.
   The client component handles its own data fetching to keep the
   page snappy (no blocking SSR on slow Polygon calls). */

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  const title = `${ticker} · Live Price, AI Analysis, News · ArbibX`;
  const description = `Real-time price, technical indicators, recent news, and AI-powered analysis for ${ticker}. Powered by Claude AI on the ArbibX terminal.`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://www.arbibx.com/stock/${ticker}`,
      images: [{ url: "/logo.png", width: 512, height: 512, alt: "ArbibX" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/logo.png"],
    },
  };
}

export default async function StockPage({ params }: PageProps) {
  const { ticker: rawTicker } = await params;
  const ticker = rawTicker.toUpperCase();
  return <TickerView ticker={ticker} />;
}
