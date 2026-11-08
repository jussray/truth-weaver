/**
 * Search/AI-discovery head helpers. Presentation only: never changes legal
 * truth states, commerce holds or authorization. Every JSON-LD fact here must
 * match visible page text; no ratings, credentials, prices or Product/Offer.
 */
export const SITE_URL = "https://www.truthweaver.jussco.company";
export const PARENT_URL = "https://www.jussco.company";
export const PARENT_NAME = "Juss & Co.";
export const PRODUCT_NAME = "Truth Weaver Counsel";
/** Share-sized (1200x630) crop of the home page library image, served from /public. */
export const OG_IMAGE = `${SITE_URL}/og-truth-weaver.jpg`;

/** Public, indexable canonical paths. Must match public/sitemap.xml exactly. */
export const INDEXABLE_PATHS = ["/", "/notice-analyzer", "/connectors", "/sources", "/legal-library", "/shop"] as const;

export function canonicalUrl(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  if (!clean.startsWith("/") || clean.startsWith("//")) throw new Error("path must be site-relative");
  const normalized = clean.length > 1 ? clean.replace(/\/+$/, "") : "/";
  return normalized === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalized}`;
}

/** Serialize JSON-LD safely for inline <script>: no `</script>` breakout. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export const ORGANIZATION_LD = {
  "@type": "Organization",
  "@id": `${PARENT_URL}/#organization`,
  name: PARENT_NAME,
  url: PARENT_URL,
};

type Crumb = { name: string; path: string };

export type PageHeadInput = {
  path: string;
  title: string;
  description: string;
  /** Private, account, admin or held-offer pages. */
  noindex?: boolean;
  breadcrumbs?: Crumb[];
  jsonLd?: Record<string, unknown>[];
};

export function pageHead(input: PageHeadInput) {
  const url = canonicalUrl(input.path);
  if (input.noindex) {
    return {
      meta: [
        { title: input.title },
        { name: "description", content: input.description },
        { name: "robots", content: "noindex, nofollow" },
      ],
      links: [] as { rel: string; href: string }[],
      scripts: [] as { type: string; children: string }[],
    };
  }
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: input.title,
      description: input.description,
      isPartOf: { "@id": `${SITE_URL}/#website` },
      publisher: { "@id": ORGANIZATION_LD["@id"] },
    },
    ...(input.jsonLd ?? []),
  ];
  if (input.breadcrumbs?.length) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: input.breadcrumbs.map((c, i) => ({
        "@type": "ListItem", position: i + 1, name: c.name, item: canonicalUrl(c.path),
      })),
    });
  }
  return {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:url", content: url },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: PRODUCT_NAME },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [{ type: "application/ld+json", children: safeJsonLd({ "@context": "https://schema.org", "@graph": graph }) }],
  };
}

/** Sitewide WebSite + parent Organization; emitted on the home page only. */
export const WEBSITE_LD: Record<string, unknown>[] = [
  { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`, name: PRODUCT_NAME, publisher: { "@id": ORGANIZATION_LD["@id"] } },
  ORGANIZATION_LD,
];

export const NOINDEX_HEAD = (title: string, description: string) =>
  pageHead({ path: "/", title, description, noindex: true });
