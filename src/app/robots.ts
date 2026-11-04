import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sagaravillas.example.com";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/en/", "/id/", "/api/public/"],
        disallow: ["/admin/", "/api/admin/", "/api/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
