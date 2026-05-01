import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow:     "/",
        disallow:  ["/api/", "/p/"],
      },
    ],
    sitemap: "https://www.arbibx.com/sitemap.xml",
    host:    "https://www.arbibx.com",
  };
}
