// Shared map-provider composition. Kept free of auth/Next route dependencies so
// the *same production fetch path* can be exercised with a deterministic mock.
export const CACHE_SECONDS = 60 * 60 * 24 * 7;
export const USER_AGENT = "FlyTally/1.0 (https://fly-tally.com; map service)";

const WORLD_IMAGERY = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile";
const IMAGERY_LABELS = "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile";
const REFERENCE_LABELS = "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile";

export function isImage(response: Response | null): response is Response {
  return response !== null && response.ok && (response.headers.get("content-type") || "").startsWith("image/");
}

async function imageDataUrl(response: Response) {
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${bytes}`;
}

async function fetchProviderTile(url: string, referer: string, fetchTile: typeof fetch, signal?: AbortSignal): Promise<Response | null> {
  if (signal?.aborted) return null;
  try {
    return await fetchTile(url, {
      headers: { Referer: referer, "User-Agent": USER_AGENT },
      next: { revalidate: CACHE_SECONDS },
      signal,
    });
  } catch {
    // A network failure must not become an unhandled 500. World imagery is
    // required; labels are optional and can use the published fallback.
    return null;
  }
}

/**
 * Build the Satellite SVG already returned by /api/map-tile. This function
 * intentionally does not read environment variables or authorize the caller:
 * the authenticated route must perform both checks before invoking it.
 */
export async function satelliteTile(
  z: number, x: number, y: number, token: string, referer: string,
  fetchTile: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) return null;
  const encodedToken = encodeURIComponent(token);
  const [base, preferredLabels] = await Promise.all([
    fetchProviderTile(`${WORLD_IMAGERY}/${z}/${y}/${x}?token=${encodedToken}`, referer, fetchTile, signal),
    fetchProviderTile(`${IMAGERY_LABELS}/${z}/${y}/${x}?language=en&token=${encodedToken}`, referer, fetchTile, signal),
  ]);
  if (signal?.aborted || !isImage(base)) return null;

  let labels = preferredLabels;
  if (signal?.aborted) return null;
  if (!isImage(labels)) {
    labels = await fetchProviderTile(`${REFERENCE_LABELS}/${z}/${y}/${x}`, referer, fetchTile, signal);
  }

  if (signal?.aborted) return null;
  const baseHref = await imageDataUrl(base);
  const labelsHref = isImage(labels) ? await imageDataUrl(labels) : null;
  const overlay = labelsHref
    ? `<image href="${labelsHref}" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>`
    : "";
  if (signal?.aborted) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image href="${baseHref}" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>${overlay}</svg>`;
}
