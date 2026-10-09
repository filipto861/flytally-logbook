export type MapTileStyle = "map" | "satellite";

/**
 * The omitted query field is an existing legacy request for standard tiles.
 * A present query field is never silently defaulted or de-duplicated.
 */
export function parseMapTileStyle(params: URLSearchParams): MapTileStyle | null {
  // Treat form-array spellings as malformed styles, not as an omitted legacy style.
  if (Array.from(params.keys()).some(key => /^style\[(?:\d*)\]$/.test(key))) return null;
  const styles = params.getAll("style");
  if (styles.length === 0) return "map";
  if (styles.length !== 1) return null;
  return styles[0] === "map" || styles[0] === "satellite" ? styles[0] : null;
}
