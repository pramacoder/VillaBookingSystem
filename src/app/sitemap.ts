import type { MetadataRoute } from "next";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://sagaravillas.example.com";
  const locales = ["en", "id"];

  // Fetch active unit slugs with fallback for build environments
  let units: Array<{ slug: string; updatedAt: Date }> = [];
  try {
    if (process.env.DATABASE_URL) {
      units = await db.unit.findMany({
        where: { status: "ACTIVE" },
        select: { slug: true, updatedAt: true },
      });
    }
  } catch {
    units = [
      { slug: "garden-villa", updatedAt: new Date() },
      { slug: "pool-villa", updatedAt: new Date() },
      { slug: "family-residence", updatedAt: new Date() },
      { slug: "loft-suite", updatedAt: new Date() },
    ];
  }

  const routes: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    // 1. Home
    routes.push({
      url: `${baseUrl}/${locale}`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    });

    // 2. Catalog
    routes.push({
      url: `${baseUrl}/${locale}/villas`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    });

    // 3. Units
    for (const u of units) {
      routes.push({
        url: `${baseUrl}/${locale}/villas/${u.slug}`,
        lastModified: u.updatedAt,
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }

    // 4. Booking
    routes.push({
      url: `${baseUrl}/${locale}/book`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    });

    // 5. About, Location, Contact
    routes.push(
      {
        url: `${baseUrl}/${locale}/about`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/${locale}/location`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
      {
        url: `${baseUrl}/${locale}/contact`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.7,
      },
    );
  }

  return routes;
}
