import { NextResponse } from "next/server";

const TILE_HOST = "https://tile.openstreetmap.org";

export async function GET(_request: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const { z: zs, x: xs, y: ys } = await params;
  const z = Number(zs), x = Number(xs), y = Number(ys);
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 18 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return new NextResponse("Invalid tile", { status: 400 });
  }
  const upstream = await fetch(`${TILE_HOST}/${z}/${x}/${y}.png`, {
    headers: { "User-Agent": "FlyTally/1.0 (https://fly-tally.com; flight story map)" },
    next: { revalidate: 60 * 60 * 24 * 7 },
  });
  if (!upstream.ok) return new NextResponse("Map tile unavailable", { status: upstream.status });
  return new NextResponse(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
