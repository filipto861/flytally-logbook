import { NextResponse } from "next/server";

const OSM_TILE_HOST = "https://tile.openstreetmap.org";
const ARCGIS_WORLD_IMAGERY_HOST = "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile";

export async function GET(request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 18 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return new NextResponse("Invalid tile", { status: 400 });
  }

  const style = new URL(request.url).searchParams.get("style");
  const wantsSatellite = style === "satellite";
  const arcgisToken = process.env.ARCGIS_ACCESS_TOKEN;
  if (wantsSatellite && !arcgisToken) {
    return new NextResponse("Satellite imagery is not configured", {
      status: 503,
      headers: { "Cache-Control": "no-store", "X-FlyTally-Map-Style": "unavailable" },
    });
  }

  const upstreamUrl = wantsSatellite
    ? `${ARCGIS_WORLD_IMAGERY_HOST}/${z}/${y}/${x}`
    : `${OSM_TILE_HOST}/${z}/${x}/${y}.png`;

  const upstream = await fetch(upstreamUrl, {
    headers: wantsSatellite
      ? {
          Authorization: `Bearer ${arcgisToken}`,
          Referer: "https://fly-tally.com/",
          "User-Agent": "FlyTally/1.0 (https://fly-tally.com; flight story map)",
        }
      : { "User-Agent": "FlyTally/1.0 (https://fly-tally.com; flight story map)" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });

  if (!upstream.ok) {
    return new NextResponse("Map tile unavailable", {
      status: upstream.status,
      headers: {
        "Cache-Control": "no-store",
        "X-FlyTally-Map-Style": wantsSatellite ? "unavailable" : "map",
      },
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "Access-Control-Allow-Origin": "*",
      "X-FlyTally-Map-Style": wantsSatellite ? "satellite" : "map",
    },
  });
}
