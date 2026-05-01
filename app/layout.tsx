import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeInit from "@/components/ThemeInit";
import AdSenseLoader from "@/components/AdSenseLoader";

export const metadata: Metadata = {
  title: "ArbibX Terminal",
  description: "AI-powered stock intelligence. Real-time market data, Claude AI analysis, and portfolio tracking.",
  applicationName: "ArbibX",
  authors: [{ name: "ArbibX" }],
  keywords: ["stocks", "trading", "AI", "portfolio", "market data", "Claude AI"],
  manifest: "/manifest.json",

  metadataBase: new URL("https://www.arbibx.com"),

  // Open Graph (for link previews) — uses dynamic OG image so the
  // root site card has the same polish as ticker / portfolio cards.
  openGraph: {
    title: "ArbibX · AI-powered stock terminal",
    description: "Live charts, AI Top 15, earnings, news, and portfolio analytics — powered by Claude AI.",
    type: "website",
    url: "https://www.arbibx.com",
    siteName: "ArbibX",
    images: [{ url: "/api/og?type=default", width: 1200, height: 630, alt: "ArbibX — AI-powered stock terminal" }],
  },

  // Twitter card — large image so the dynamic OG actually shows up
  twitter: {
    card: "summary_large_image",
    title: "ArbibX · AI-powered stock terminal",
    description: "Live charts, AI Top 15, earnings, news, and portfolio analytics — powered by Claude AI.",
    images: ["/api/og?type=default"],
  },

  // Apple PWA
  appleWebApp: {
    capable: true,
    title: "ArbibX",
    statusBarStyle: "black-translucent",
    startupImage: [{ url: "/logo.png" }],
  },

  // Icons
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32",  type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
      { url: "/logo.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/logo.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: dark)",  color: "#050407" },
    { media: "(prefers-color-scheme: light)", color: "#050407" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* AdSense script is now loaded conditionally via
            <AdSenseLoader/> in the body — Pro users get an ad-free
            experience because the script never injects. */}

        {/* Apple-specific PWA tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="ArbibX" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/logo.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/logo.png" />

        {/* Microsoft tiles */}
        <meta name="msapplication-TileColor" content="#050407" />
        <meta name="msapplication-TileImage" content="/logo.png" />
        <meta name="msapplication-tap-highlight" content="no" />

        {/* Prevent phone number detection */}
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body>
        {/* Applies user's saved theme + perf prefs on every route,
            including /stock/[ticker] and /p/[id] which don't run
            the main page's useEffect. */}
        <ThemeInit />
        {/* Loads Google AdSense only for non-Pro users so paying
            members get a fully ad-free experience. */}
        <AdSenseLoader />
        {children}

        {/* Service worker registration */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js')
                    .then(function(reg) {
                      console.log('ArbibX SW registered:', reg.scope);
                    })
                    .catch(function(err) {
                      console.log('SW registration failed:', err);
                    });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
