/**
 * R2D.2 M2a — standalone synthetic-testable transport primitive.
 *
 * NOT imported by the production Satellite provider yet.
 * All numeric ceilings come from the caller, never invented defaults.
 * This validates transport, MIME and byte accounting, NOT raster integrity.
 */
export type SatelliteBoundedFailure =
  | "invalid-policy"
  | "caller-aborted"
  | "deadline"
  | "upstream"
  | "status"
  | "content-type"
  | "content-encoding"
  | "content-length"
  | "too-large"
  | "empty-body"
  | "incomplete-body";

export class SatelliteBoundedFetchError extends Error {
  readonly reason: SatelliteBoundedFailure;

  constructor(reason: SatelliteBoundedFailure) {
    super(`Satellite bounded fetch: ${reason}`);
    this.name = "SatelliteBoundedFetchError";
    this.reason = reason;
  }
}

export type SatelliteRasterMime = "image/png" | "image/jpeg";

export type SatelliteTransportResult = {
  contentType: SatelliteRasterMime;
  bytes: Uint8Array;
};

export type SatelliteBoundedFetchOptions = {
  url: string;
  fetcher: typeof fetch;
  init?: RequestInit;
  signal?: AbortSignal;
  maxBytes: number;
  timeoutMs: number;
};

function fail(reason: SatelliteBoundedFailure): never {
  throw new SatelliteBoundedFetchError(reason);
}

function contentLength(response: Response, maxBytes: number): number | null {
  const header = response.headers.get("content-length");
  if (header === null) return null; // Chunked streams are legitimate.
  // A received header is never silently interpreted as zero or infinity.
  if (!/^(0|[1-9][0-9]*)$/.test(header)) return fail("content-length");
  const length = Number(header);
  if (!Number.isSafeInteger(length)) return fail("content-length");
  if (length === 0) return fail("empty-body");
  if (length > maxBytes) return fail("too-large");
  return length;
}

function rasterMime(response: Response): SatelliteRasterMime {
  const header = response.headers.get("content-type");
  const mime = header?.split(";")[0]?.trim().toLowerCase();
  if (mime === "image/png" || mime === "image/jpeg") return mime;
  return fail("content-type");
}

function validateOptions(options: SatelliteBoundedFetchOptions): void {
  if (!options || typeof options.fetcher !== "function" ||
      typeof options.url !== "string" || options.url.length === 0 ||
      !Number.isSafeInteger(options.maxBytes) || options.maxBytes <= 0 ||
      !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0 ||
      options.timeoutMs > 2_147_483_647) {
    fail("invalid-policy");
  }
  // Reject Next-specific cache hints and alternate abort signals rather
  // than allowing the caller to weaken the bounded transport contract.
  const init = options.init as (RequestInit & { next?: unknown }) | undefined;
  if (init && ("next" in init || (init.cache && init.cache !== "no-store") ||
      init.signal)) {
    fail("invalid-policy");
  }
  if (options.signal && typeof options.signal.addEventListener !== "function") {
    fail("invalid-policy");
  }
}

/**
 * Controls ONE uncached upstream fetch, including connect, headers and body.
 * Transport bytes are bounded by caller-supplied maxBytes, but process memory
 * also depends on chunk copies, other in-flight requests and later Base64.
 *
 * On failure, error reasons do not contain tokens, URL or provider bodies.
 */
export async function fetchSatelliteBounded(
  options: SatelliteBoundedFetchOptions,
): Promise<SatelliteTransportResult> {
  validateOptions(options);
  if (options.signal?.aborted) fail("caller-aborted");

  const controller = new AbortController();
  let abortedBy: "caller-aborted" | "deadline" | null = null;
  let rejectAbort!: (error: SatelliteBoundedFetchError) => void;
  const abortGate = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  // The abort can race just before a reader/read Promise.race is installed.
  // This handler prevents a transient unhandled rejection in that interval.
  void abortGate.catch(() => {});

  const stop = (reason: "caller-aborted" | "deadline") => {
    if (abortedBy !== null) return;
    abortedBy = reason;
    controller.abort();
    rejectAbort(new SatelliteBoundedFetchError(reason));
  };
  const onCallerAbort = () => stop("caller-aborted");
  options.signal?.addEventListener("abort", onCallerAbort, { once: true });
  const timer = setTimeout(() => stop("deadline"), options.timeoutMs);
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let receivedBody: ReadableStream<Uint8Array> | null = null;
  let success = false;
  // Best-effort only. Cancellation does not establish remote settlement.
  const cancelBody = (body: ReadableStream<Uint8Array> | null): void => {
    if (!body) return;
    try { void body.cancel("satellite-bounded-fetch-cleanup").catch(() => {}); }
    catch { /* A failed cleanup must never override the original failure. */ }
  };

  try {
    if (options.signal?.aborted) stop("caller-aborted");
    // Attach a continuation to the original supplier promise, not merely
    // Promise.race: a non-cooperative fetcher can resolve after our deadline.
    const pending = Promise.resolve().then(() => options.fetcher(options.url, {
      ...(options.init ?? {}),
      cache: "no-store",
      signal: controller.signal,
    })).then(response => {
      if (abortedBy !== null) cancelBody(response?.body ?? null);
      return response;
    });
    const response = await Promise.race([pending, abortGate]);
    receivedBody = response?.body ?? null;
    if (abortedBy) return fail(abortedBy);
    if (!response.ok || !response.body) return fail("status");

    const contentType = rasterMime(response);
    const encoding = response.headers.get("content-encoding");
    if (encoding && encoding.toLowerCase() !== "identity") {
      // Do not conflate compressed wire length with decoded stream length.
      return fail("content-encoding");
    }
    const declaredLength = contentLength(response, options.maxBytes);
    reader = response.body.getReader();
    receivedBody = null; // Ownership passed to reader; never double-cancel.

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const part = await Promise.race([reader.read(), abortGate]);
      if (abortedBy) return fail(abortedBy);
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) return fail("incomplete-body");
      const length = part.value.byteLength;
      if (length > options.maxBytes - total) return fail("too-large");
      if (length === 0) continue;
      chunks.push(part.value.slice()); // Defensive copy for reused buffers.
      total += length;
    }
    if (total === 0) return fail("empty-body");
    if (declaredLength !== null && declaredLength !== total) {
      return fail("incomplete-body");
    }

    // Concatenation creates a temporary second copy of up to maxBytes.
    const bytes = new Uint8Array(total);
    let cursor = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, cursor);
      cursor += chunk.byteLength;
    }
    success = true;
    return { contentType, bytes };
  } catch (error) {
    if (error instanceof SatelliteBoundedFetchError) throw error;
    if (abortedBy !== null) fail(abortedBy);
    return fail("upstream");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
    if (!success && !controller.signal.aborted) controller.abort();
    if (!success && !reader) cancelBody(receivedBody);
    if (reader) {
      if (!success) {
        // Cancellation may itself wait indefinitely for a remote body/tee;
        // do not let cleanup erase a bounded deadline.
        void reader.cancel("satellite-bounded-fetch-cleanup").catch(() => {});
      }
      try { reader.releaseLock(); } catch {}
    }
  }
}
