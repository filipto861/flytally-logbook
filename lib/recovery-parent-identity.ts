/**
 * B1b: a matching database-generated ID is NOT enough to call a restored
 * flight/FSTD session "already present". The source and target also need a
 * complete, equal natural identity. This is only an advisory preview check;
 * it does NOT close the preview/commit race or authorize full-account writes.
 */
type RestoreIdentityRow = Record<string, unknown>;
export type RestoreParentKind = "flight" | "fstd";

const asText = (value: unknown): string =>
  typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

function completeDate(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function sameRestoreParentNaturalIdentity(
  source: RestoreIdentityRow,
  current: RestoreIdentityRow,
  kind: RestoreParentKind,
  naturalKey: (row: RestoreIdentityRow) => string,
): boolean {
  const sourceId = asText(source.id);
  if (!sourceId || sourceId !== asText(current.id)) return false;

  const dateField = kind === "flight" ? "date" : "session_date";
  if (!completeDate(source[dateField]) || !completeDate(current[dateField])) return false;
  if (source[dateField] !== current[dateField]) return false;

  const required = kind === "flight"
    ? ["registration", "off_block", "departure", "arrival"]
    : ["device_type", "qualification_number", "instruction"];

  // Missing and empty fields are NOT evidence of a matching identity.
  if (required.some(field => !asText(source[field]) || !asText(current[field]))) return false;

  if (kind === "fstd") {
    for (const row of [source, current]) {
      const raw = row.total_minutes;
      if (raw === null || raw === undefined || raw === "" ||
          !Number.isInteger(Number(raw)) || Number(raw) < 0) return false;
    }
  }

  const expected = naturalKey(source);
  return Boolean(expected) && expected === naturalKey(current);
}
