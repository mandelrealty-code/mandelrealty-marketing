/** Shared document head updates for marketing LPs (title, description, canonical, robots). */
export function setPageSeo({
  title,
  description,
  path,
  robots = "index, follow, max-image-preview:large",
}: {
  title: string;
  description: string;
  /** Site path, e.g. `/` or `/full-service`. */
  path: string;
  robots?: string;
}) {
  document.title = title;

  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", description);

  const robotsMeta = document.querySelector('meta[name="robots"]');
  if (robotsMeta) robotsMeta.setAttribute("content", robots);

  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  const href =
    path === "/"
      ? "https://www.mandelrealtygroup.com/"
      : `https://www.mandelrealtygroup.com${path}`;
  canonical.setAttribute("href", href);
}
