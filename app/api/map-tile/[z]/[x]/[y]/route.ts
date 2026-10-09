import { NextResponse } from "next/server";
import { parseMapTileStyle } from "@/lib/map-tile-style";
import { getSession } from "@/lib/auth/session";
import { satelliteTile, isImage, CACHE_SECONDS, USER_AGENT } from "@/lib/satellite-map-provider";

// Satellite tiles must be authorized per request, not served from a public route cache.
// This does not change public access to the existing Standard basemap.
export const dynamic = "force-dynamic";

const OSM_TILE_HOST = "https://tile.openstreetmap.org";
function publicReferer(request: Request) {
  const raw = request.headers.get("referer");
  if (!raw) return "https://fly-tally.com/";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "https:" && (parsed.hostname === "fly-tally.com" || parsed.hostname.endsWith(".fly-tally.com") || parsed.hostname.endsWith(".vercel.app"))) return parsed.href;
  } catch {}
  return "https://fly-tally.com/";
}

async function standardMapTile(z: number, x: number, y: number, referer: string) {
  const upstream = await fetch(`${OSM_TILE_HOST}/${z}/${x}/${y}.png`, {
    headers: { Referer: referer, "User-Agent": USER_AGENT },
    next: { revalidate: CACHE_SECONDS },
  });
  return isImage(upstream) ? upstream : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 18 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return new NextResponse("Invalid tile", { status: 400 });
  }

  const style = parseMapTileStyle(new URL(request.url).searchParams);
  if (style === null) {
    return NextResponse.json({ error: "unsupported_style" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const wantsSatellite = style === "satellite";
  // A client feature flag, Referer or ArcGIS token is not user authorization.
  // Both interactive map and Story are already authenticated FlyTally surfaces.
  // Public shared-flight replay retains its existing Standard-only surface.
  if (wantsSatellite && !(await getSession())) {
    return new NextResponse("Satellite sign-in required", {
      status: 401,
      headers: { "Cache-Control": "private, no-store", "X-FlyTally-Map-Style": "unavailable" },
    });
  }
  const arcgisToken = process.env.ARCGIS_ACCESS_TOKEN?.trim();
  const referer = publicReferer(request);
  if (wantsSatellite && !arcgisToken) {
    return new NextResponse("Satellite imagery is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" },
    });
  }

  if (wantsSatellite) {
    const svg = await satelliteTile(z, x, y, arcgisToken!, referer);
    if (!svg) return new NextResponse("Map tile unavailable", { status: 502, headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" } });
    return new NextResponse(svg, { headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Never let CDN/browser shared caches bypass the live session check.
      "Cache-Control": "private, no-store",
      "X-FlyTally-Map-Style": "satellite",
    }});
  }

  const upstream = await standardMapTile(z, x, y, referer);
  if (!upstream) return new NextResponse("Map tile unavailable", { status: 502, headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" } });
  return new NextResponse(await upstream.arrayBuffer(), { headers: {
    "Content-Type": upstream.headers.get("content-type") || "image/png",
    "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
    "Access-Control-Allow-Origin": "*",
    "X-FlyTally-Map-Style": "map",
  }});
}
