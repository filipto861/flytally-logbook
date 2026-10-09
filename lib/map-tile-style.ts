export type MapTileStyle = "map" | "satellite";

/**
 * The omitted query field is an existing legacy request for standard tiles.
 * A present query field is never silently defaulted or de-duplicated.
 */
export function parseMapTileStyle(params: URLSearchParams): MapTileStyle | null {
  // Reject any alternative style-key spelling, including nested/non-numeric brackets.
  // Unknown unrelated query keys are ignored for backward compatibility.
  if (Array.from(params.keys()).some(key => key !== "style" && key.startsWith("style"))) return null;
  const styles = params.getAll("style");
  if (styles.length === 0) return "map";
  if (styles.length !== 1) return null;
  return styles[0] === "map" || styles[0] === "satellite" ? styles[0] : null;
}
