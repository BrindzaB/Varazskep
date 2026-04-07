import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/services/product";
import { getProducts } from "@/lib/malfini/client";
import { getCategoryConfig } from "@/lib/malfini/categoryConfig";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const [localProducts, malfiniProducts] = await Promise.all([
    getActiveProducts(),
    getProducts("hu"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/designer`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const localProductRoutes: MetadataRoute.Sitemap = localProducts.map((product) => ({
    url: `${baseUrl}/products/${product.slug}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  // Only include Malfini products in a configured (designer-enabled) category
  // that have at least one variant with a front image.
  const malfiniProductRoutes: MetadataRoute.Sitemap = malfiniProducts
    .filter(
      (p) =>
        getCategoryConfig(p.categoryCode) !== null &&
        p.variants.some((v) => v.images.some((i) => i.viewCode === "a"))
    )
    .map((p) => ({
      url: `${baseUrl}/products/malfini/${p.code}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    }));

  return [...staticRoutes, ...localProductRoutes, ...malfiniProductRoutes];
}
