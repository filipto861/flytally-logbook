/**
 * openAIP airspace overlay boundary — offline preparatory contract.
 * A known tile coordinate is NOT authority to request provider data.
 * URL/credential/usage policy must be supplied by a verified integration.
 */
export type AirspaceTile = Readonly<{ z: number; x: number; y: number }>;
export type AirspaceState = "disabled" | "unavailable" | "ready";

export function parseAirspaceTile(input: {
  z: string; x: string; y: string;
}): AirspaceTile | null {
  const values = [input.z, input.x, input.y];
  if (!values.every(value => /^(0|[1-9][0-9]*)$/.test(value))) return null;
  const [z, x, y] = values.map(Number);
  if (![z, x, y].every(Number.isSafeInteger) || z > 22 || x >= 2 ** z || y >= 2 ** z) return null;
  return { z, x, y };
}

/**
 * Fail closed until server has independently verified an explicit provider
 * contract, rights and an authorized deployment setting.
 */
export function airspaceCapability(input: {
  requested: boolean;
  authenticated: boolean;
  deploymentEnabled: boolean;
  providerContractVerified: boolean;
}): AirspaceState {
  if (!input.requested) return "disabled";
  if (!input.authenticated || !input.deploymentEnabled || !input.providerContractVerified) return "unavailable";
  return "ready";
}
