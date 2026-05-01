import type { MetadataRoute } from "next";

/* The sitemap covers the home page plus a curated list of the most
   liquid US tickers — this is what we want indexed for organic
   search ("AAPL stock analysis" etc.). The list mirrors what's in
   the Markets tab and Top 15 universe so every ticker we already
   show has a chance to rank.

   Note: Next regenerates this on each build. If we add/remove
   tickers from the app, redeploy and the sitemap reflects it. */

const TICKERS = [
  // Mega-cap tech
  "NVDA","MSFT","AAPL","META","GOOGL","GOOG","AMD","AVGO","ORCL","CRM",
  "ADBE","INTC","QCOM","INTU","IBM","CSCO","ACN",
  // Semis
  "AMAT","LRCX","KLAC","MU","ARM","MRVL","NXPI","ON","ADI","MCHP","SMCI",
  // Cloud / SaaS / cyber
  "PLTR","CRWD","PANW","ZS","FTNT","OKTA","NET","SNOW","DDOG","ANET",
  "WDAY","MDB","TWLO","TEAM","CDNS","SNPS","VEEV",
  // Consumer / internet
  "AMZN","TSLA","NFLX","DIS","SBUX","NKE","MCD","CMG","HD","LOW","COST",
  "WMT","TGT","BKNG","ABNB","UBER","LYFT","DASH","SHOP","SPOT","ROKU",
  "PINS","SNAP","RBLX",
  // Financials
  "BRK.B","JPM","V","MA","BAC","WFC","GS","MS","C","AXP","BLK","SCHW",
  "PYPL","SQ","COIN","HOOD",
  // Health
  "LLY","UNH","JNJ","ABBV","PFE","MRK","TMO","ABT","DHR","BMY","AMGN",
  "ISRG","REGN","VRTX","GILD","NVO","BIIB","MRNA",
  // Energy / industrials
  "XOM","CVX","COP","SLB","EOG","OXY","BA","CAT","DE","GE","HON","UPS","FDX","LMT","RTX",
  // Communications / media
  "T","VZ","TMUS","CMCSA",
  // ETFs people search
  "SPY","QQQ","DIA","IWM","VTI","VOO","XLK","XLF","XLE","XLV",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url:        "https://www.arbibx.com",
      lastModified: now,
      changeFrequency: "daily",
      priority:   1.0,
    },
    ...TICKERS.map(t => ({
      url:        `https://www.arbibx.com/stock/${t}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority:   0.8,
    })),
  ];
}
