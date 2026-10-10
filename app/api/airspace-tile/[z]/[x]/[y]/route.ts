import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { airspaceCapability, parseAirspaceTile } from "@/lib/openaip-airspace-contract";

/**
 * A2D PRIVATE tile transport for the COMBINED openAIP Aviation overlay.
 * The /api/airspace-tile internal path and X-Flytally-Airspaces response
 * header remain as backward-compatible names; no airspaces-only promise.
 * This layer does NOT provide active airspace, NOTAM or approved chart data.
 * Production remains OFF until explicit deployment enablement.
 *
 * Upstream PNG: owner-hidden-key live probe z9/x276/y173 returned 200 PNG
 * for /api/data/openaip (legacy /airspaces returned 404). This proves only
 * the sampled tile, not complete geographic/zoom coverage or data recency.
 * API key stays server-only; Aug 2024 x-openaip-api-key header retained.
 */
const OPENAIP_TILES_HOST = "https://api.tiles.openaip.net";
const MAX_REQUEST_ZOOM = 14; // Deliberate FlyTally budget guard, NOT a provider capability claim.
const MAX_IMAGE_BYTES = 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10] as const;

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function unavailable(status = 503) {
  return new NextResponse("Aviation overlay unavailable", {
    status,
    headers: { ...PRIVATE_HEADERS, "X-Flytally-Airspaces": "unavailable" },
  });
}

/** Read a bounded response body even when upstream omits Content-Length. */
async function readBoundedPng(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
) {
  const tile = parseAirspaceTile(await params);
  if (!tile || tile.z > MAX_REQUEST_ZOOM) {
    return new NextResponse("Invalid aviation tile", {
      status: 400,
      headers: PRIVATE_HEADERS,
    });
  }

  // Strict order: validate coordinates -> check live session -> read feature
  // gates -> read API key -> call only our one pinned HTTPS upstream host.
  const signedIn = Boolean(await getSession());
  if (!signedIn) return unavailable(401);

  const capability = airspaceCapability({
    requested: true,
    authenticated: signedIn,
    deploymentEnabled: process.env.FLYTALLY_OPENAIP_AIRSPACES_ENABLED === "true",
    providerContractVerified: process.env.FLYTALLY_OPENAIP_PROVIDER_VERIFIED === "true",
  });
  if (capability !== "ready") return unavailable();

  const apiKey = process.env.OPENAIP_API_KEY?.trim();
  if (!apiKey) return unavailable();

  const upstreamUrl =
    `${OPENAIP_TILES_HOST}/api/data/openaip/${tile.z}/${tile.x}/${tile.y}.png`;

  try {
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: { "x-openaip-api-key": apiKey, Accept: "image/png" },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
      redirect: "error",
    });

    if (response.status === 429) return unavailable(); // Do not retry provider rate limit.
    if (!response.ok) return unavailable(502);
    if ((response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() !== "image/png") {
      return unavailable(502);
    }
    const statedSize = response.headers.get("content-length");
    if (statedSize && (!/^\d+$/.test(statedSize) || Number(statedSize) > MAX_IMAGE_BYTES)) {
      return unavailable(502);
    }

    const bytes = await readBoundedPng(response);
    if (!bytes || bytes.byteLength < PNG_SIGNATURE.length ||
        !PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
      return unavailable(502);
    }
    // TypedArray.buffer is ArrayBufferLike (potentially SharedArrayBuffer).
    // Copy the already size-bounded PNG into an actual ArrayBuffer for BodyInit.
    const body = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(body).set(bytes);
    return new NextResponse(body, {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "image/png",
        "X-Flytally-Airspaces": "reference-only",
      },
    });
  } catch {
    // Timeout, invalid upstream, network exceptions and response body errors
    // are indistinguishable to the viewer; do not leak provider internals.
    return unavailable(502);
  }
}
