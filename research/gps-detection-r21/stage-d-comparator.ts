/**
 * Stage D1: local-only, read-only comparison of two *hypothesis* engines.
 *
 * This research module never uses network, database, GPS persistence, flight
 * actions or certification. Neither legacy nor V2 proves wheel contact.
 * No raw source, coordinates, absolute timestamps, file names, pilot IDs,
 * registrations or device details are included in the returned object.
 */
import {parseTrackFile, splitPoints, touchAndGoEvents, trackFileFormat} from "../../lib/track-processing.ts";
import {inspectGpsV2HorizontalTrack, GPS_V2_ALGORITHM_REVISION} from "../../lib/gps-v2-advisory.ts";

export const STAGE_D_COMPARATOR_REVISION = "STAGE_D_COMPARATOR_V1" as const;
export const STAGE_D_MAX_SOURCE_CHARS = 2_000_000;
type Input = {
  sourceText: string;
  fileName: string; // consulted for format only; NEVER copied to output
  anonymousSampleId?: string | null;
  splitCuts?: readonly number[];
};
type Format = "kml" | "gpx" | "csv" | "unknown";
type Reason = "UNSUPPORTED_FORMAT" | "OVERSIZED_SOURCE" | "INSUFFICIENT_POINTS" |
  "NO_VALID_TIME_BASELINE" | "INVALID_SPLIT" | "INVALID_SAMPLE_ID" | "PARSER_UNAVAILABLE";
function failure(reason: Reason, format: Format, sample: string | null) {
  return {
    comparatorRevision: STAGE_D_COMPARATOR_REVISION, sample, format,
    status: "UNAVAILABLE" as const, reason,
    actualTouchAndGoes: "UNKNOWN" as const, actualFullStops: "UNKNOWN" as const,
    physicalContact: "UNRESOLVED" as const, canAffectCanonicalFlight: false as const,
    legacy: null, v2: null,
  };
}
function parseTime(value: string | null): number | null {
  if (!value) return null;
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}
function elapsed(value: string | null, origin: number): number | null {
  const millis = parseTime(value);
  if (millis === null || millis < origin) return null;
  const result = (millis - origin) / 1000;
  return Number.isFinite(result) ? Math.round(result * 10) / 10 : null;
}

/**
 * For a saved corpus, label ground truth separately with pilot provenance and
 * uncertainty. A missing/unsupported source is UNAVAILABLE, not zero events.
 * Even a successful read returns hypotheses, not verified landing counts.
 */
export function compareGpsV2StageD(input: Input) {
  const sample = input.anonymousSampleId ?? null;
  const suffix = input.fileName.toLowerCase().match(/\.(kml|gpx|csv)$/)?.[1] ?? null;
  const format: Format = suffix === "kml" || suffix === "gpx" || suffix === "csv"
    ? suffix : "unknown";
  if (sample !== null && !/^[a-z0-9][a-z0-9_-]{0,31}$/i.test(sample))
    return failure("INVALID_SAMPLE_ID", format, null);
  if (format === "unknown") return failure("UNSUPPORTED_FORMAT", format, sample);
  if (input.sourceText.length > STAGE_D_MAX_SOURCE_CHARS)
    return failure("OVERSIZED_SOURCE", format, sample);
  // Defensive check: an unexpected content/type combination is not a fallback
  // to arbitrary KML parsing simply because the file is named .kml.
  if (trackFileFormat(input.sourceText, "anonymous." + format) !== format)
    return failure("UNSUPPORTED_FORMAT", format, sample);

  try {
    const points = parseTrackFile(input.sourceText, "anonymous." + format);
    if (points.length < 2) return failure("INSUFFICIENT_POINTS", format, sample);
    const cuts = [...(input.splitCuts ?? [])];
    if (cuts.length > 19 || cuts.some((cut, index) =>
      !Number.isSafeInteger(cut) || cut <= 0 || cut >= points.length - 1 ||
      (index > 0 && cut <= cuts[index - 1])))
      return failure("INVALID_SPLIT", format, sample);

    const firstTime = points.map(point => parseTime(point.time)).find(
      (time): time is number => time !== null
    );
    if (firstTime === undefined)
      return failure("NO_VALID_TIME_BASELINE", format, sample);
    const timedTimes = points.map(point => parseTime(point.time)).filter(
      (time): time is number => time !== null
    );
    const finalTime = timedTimes.at(-1) ?? firstTime;
    const parts = splitPoints(points, cuts);
    const legacyParts = parts.map((part, index) => {
      const events = touchAndGoEvents(part);
      return {
        part: index + 1,
        touchAndGoHypothesisCount: events.length, // NOT a physical landing count
        reviewPoints: events.map(event => ({
          relativeSeconds: elapsed(event.time, firstTime),
          signal: event.signal,
          confidence: event.confidence, // legacy confidence is NOT truth
        })),
      };
    });
    const v2 = inspectGpsV2HorizontalTrack({
      sourceText: input.sourceText,
      fileName: "anonymous." + format,
      canonicalPoints: points,
      splitCuts: cuts,
    });
    return {
      comparatorRevision: STAGE_D_COMPARATOR_REVISION,
      sample, format,
      status: "DIAGNOSTIC_ONLY" as const,
      actualTouchAndGoes: "UNKNOWN" as const,
      actualFullStops: "UNKNOWN" as const,
      physicalContact: "UNRESOLVED" as const,
      canAffectCanonicalFlight: false as const,
      summary: {
        normalizedPoints: points.length,
        timedPoints: timedTimes.length,
        elapsedTrackSeconds: finalTime >= firstTime
          ? Math.round((finalTime - firstTime) / 100) / 10 : null,
        parts: parts.length,
      },
      legacy: {
        authority: "UNVERIFIED_HYPOTHESES" as const,
        parts: legacyParts,
      },
      v2: {
        algorithmRevision: GPS_V2_ALGORITHM_REVISION,
        sourceParserRevision: v2.sourceParserRevision,
        status: v2.status, reason: v2.reason,
        quarantinedSourceFixes: v2.quarantinedSourceFixes,
        physicalContact: v2.physicalContact,
        wholeFlightLandings: v2.wholeFlightLandings,
        reviewPoints: v2.status === "ADVISORY_ONLY"
          ? v2.events.map(event => ({
            part: event.splitIndex + 1,
            kind: event.kind,
            relativeSeconds: elapsed(event.utc, firstTime),
            physicalContact: event.physicalContact,
          })) : null, // null = unavailable, never interpret as zero
      },
      groundTruthComparison: "NOT_EVALUATED" as const,
    };
  } catch {
    // No exception text: it could contain a raw path or source fragment.
    return failure("PARSER_UNAVAILABLE", format, sample);
  }
}
