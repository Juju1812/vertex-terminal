import type { Metadata } from "next";
import SharedPortfolioView from "./SharedPortfolioView";

interface PageProps { params: Promise<{ id: string }>; }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Shared Portfolio · ArbibX",
    description: `Public portfolio snapshot on ArbibX. AI-powered stock terminal.`,
    openGraph: {
      title: "Shared Portfolio · ArbibX",
      description: `Public portfolio snapshot on ArbibX.`,
      type: "website",
      url: `https://www.arbibx.com/p/${id}`,
      images: [{ url: "/logo.png", width: 512, height: 512, alt: "ArbibX" }],
    },
    twitter: {
      card: "summary",
      title: "Shared Portfolio · ArbibX",
      description: `Public portfolio snapshot on ArbibX.`,
      images: ["/logo.png"],
    },
  };
}

export default async function SharedPortfolioPage({ params }: PageProps) {
  const { id } = await params;
  return <SharedPortfolioView id={id} />;
}
