import { NextResponse } from "next/server";

const ARCGIS_OPEN_STREETS_HOST = "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/open/streets/static/tile";
const ARCGIS_WORLD_IMAGERY_HOST = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile";
const ARCGIS_IMAGERY_LABELS_HOST = "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile";
const ARCGIS_REFERENCE_HOST = "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile";
const CACHE_SECONDS = 60 * 60 * 24 * 7;
const USER_AGENT = "FlyTally/1.0 (https://fly-tally.com; map service)";

function isImage(response: Response) {
  return response.ok && (response.headers.get("content-type") || "").startsWith("image/");
}

function publicReferer(request: Request) {
  const raw = request.headers.get("referer");
  if (!raw) return "https://fly-tally.com/";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" && (parsed.hostname === "fly-tally.com" || parsed.hostname.endsWith(".fly-tally.com") || parsed.hostname.endsWith(".vercel.app"))) return parsed.href;
  } catch {}
  return "https://fly-tally.com/";
}

async function imageDataUrl(response: Response) {
  const contentType = response.headers.get("content-type") || "image/png";
  const bytes = Buffer.from(await response.arrayBuffer()).toString("base64");
  return `data:${contentType};base64,${bytes}`;
}

async function satelliteTile(z: number, x: number, y: number, token: string, referer: string) {
  const common = { next: { revalidate: CACHE_SECONDS } } as const;
  const encodedToken = encodeURIComponent(token);
  const basePromise = fetch(
    `${ARCGIS_WORLD_IMAGERY_HOST}/${z}/${y}/${x}?token=${encodedToken}`,
    { headers: { Referer: referer, "User-Agent": USER_AGENT }, ...common },
  );
  const labelsPromise = fetch(
    `${ARCGIS_IMAGERY_LABELS_HOST}/${z}/${y}/${x}?language=en&token=${encodedToken}`,
    { headers: { Referer: referer, "User-Agent": USER_AGENT }, ...common },
  );

  const [base, preferredLabels] = await Promise.all([basePromise, labelsPromise]);
  if (!isImage(base)) return null;

  let labels = preferredLabels;
  if (!isImage(labels)) {
    labels = await fetch(`${ARCGIS_REFERENCE_HOST}/${z}/${y}/${x}`, {
      headers: { Referer: referer, "User-Agent": USER_AGENT },
      ...common,
    });
  }

  const baseHref = await imageDataUrl(base);
  const labelsHref = isImage(labels) ? await imageDataUrl(labels) : null;
  const overlay = labelsHref
    ? `<image href="${labelsHref}" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><image href="${baseHref}" x="0" y="0" width="256" height="256" preserveAspectRatio="none"/>${overlay}</svg>`;
}

async function streetTile(z: number, x: number, y: number, token: string, referer: string) {
  const upstream = await fetch(
    `${ARCGIS_OPEN_STREETS_HOST}/${z}/${y}/${x}?token=${encodeURIComponent(token)}`,
    { headers: { Referer: referer, "User-Agent": USER_AGENT }, next: { revalidate: CACHE_SECONDS } },
  );
  return isImage(upstream) ? upstream : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 18 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return new NextResponse("Invalid tile", { status: 400 });
  }

  const wantsSatellite = new URL(request.url).searchParams.get("style") === "satellite";
  const arcgisToken = process.env.ARCGIS_ACCESS_TOKEN?.trim();
  const referer = publicReferer(request);
  if (!arcgisToken) {
    return new NextResponse("Map service is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" },
    });
  }

  if (wantsSatellite) {
    const svg = await satelliteTile(z, x, y, arcgisToken, referer);
    if (!svg) return new NextResponse("Map tile unavailable", { status: 502, headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" } });
    return new NextResponse(svg, { headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "Access-Control-Allow-Origin": "*",
      "X-FlyTally-Map-Style": "satellite",
    }});
  }

  const upstream = await streetTile(z, x, y, arcgisToken, referer);
  if (!upstream) return new NextResponse("Map tile unavailable", { status: 502, headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" } });
  return new NextResponse(await upstream.arrayBuffer(), { headers: {
    "Content-Type": upstream.headers.get("content-type") || "image/png",
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    "Access-Control-Allow-Origin": "*",
    "X-FlyTally-Map-Style": "map",
  }});
}
