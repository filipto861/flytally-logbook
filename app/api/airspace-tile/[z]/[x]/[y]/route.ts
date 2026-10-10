import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { airspaceCapability, parseAirspaceTile } from "@/lib/openaip-airspace-contract";

/**
 * A2B1 PRIVATE tile transport. This route is not a source of current, active
 * or approved airspace information. Production use is OFF until separate
 * access/provider verification; never expose the openAIP key to the browser.
 *
 * Upstream PNG path: openAIP's published airspaces Tile API example (2022).
 * Auth header: openAIP vendor's Aug 2024 auth migration announcement.
 * The live API schema/zoom/quotas have NOT been verified on this deployment.
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
  return new NextResponse("Airspaces unavailable", {
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
    return new NextResponse("Invalid airspace tile", {
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
    `${OPENAIP_TILES_HOST}/api/data/airspaces/${tile.z}/${tile.x}/${tile.y}.png`;

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
    return new NextResponse(bytes.buffer, {
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
