export type BillingBasis = "BLOCK" | "AIR";

export type BillingSettings = {
  basis: BillingBasis;
  share: number;
};

export const BILLING_SHARES = [1, 2, 3, 4] as const;

export function parseBilling(value: unknown): BillingSettings {
  const raw = String(value ?? "BLOCK").trim().toUpperCase();
  const match = /^(BLOCK|AIR)(?:\/(\d+))?$/.exec(raw);
  const basis: BillingBasis = match?.[1] === "AIR" ? "AIR" : "BLOCK";
  const parsedShare = Number(match?.[2] ?? 1);
  const share = Number.isSafeInteger(parsedShare) && parsedShare >= 1 && parsedShare <= 20 ? parsedShare : 1;
  return { basis, share };
}

export function serializeBilling(basis: unknown, share: unknown): string {
  const normalizedBasis: BillingBasis = String(basis).toUpperCase() === "AIR" ? "AIR" : "BLOCK";
  const parsedShare = Number(share);
  const normalizedShare = Number.isSafeInteger(parsedShare) && parsedShare >= 1 && parsedShare <= 20 ? parsedShare : 1;
  return normalizedShare === 1 ? normalizedBasis : `${normalizedBasis}/${normalizedShare}`;
}

export function calculatedFlightPrice(
  pricePerHour: unknown,
  blockMinutes: unknown,
  airMinutes: unknown,
  billing: unknown,
): number {
  const hourly = Math.max(0, Number(pricePerHour) || 0);
  const { basis, share } = parseBilling(billing);
  const minutes = Math.max(0, Number(basis === "AIR" ? airMinutes : blockMinutes) || 0);
  return (hourly * minutes) / 60 / share;
}

export function billingLabel(value: unknown): string {
  const { basis, share } = parseBilling(value);
  return `${basis}${share > 1 ? ` · podíl 1/${share}` : " · celá cena"}`;
}
