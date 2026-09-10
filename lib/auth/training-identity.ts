import { createHmac, randomUUID } from "node:crypto";

export type TrainingIdentityRole = "admin" | "user";

export type TrainingIdentityClaims = {
  readonly iss: "flytally-logbook";
  readonly aud: "flytally-training";
  readonly sub: string;
  readonly role: TrainingIdentityRole;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
};

const VERSION = "ft1";
const ASSERTION_SECONDS = 2 * 60;

function identitySecret(): string {
  const value = process.env.FLYTALLY_IDENTITY_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("FLYTALLY_IDENTITY_SECRET must contain at least 32 characters.");
  return value;
}

function sign(input: string): string {
  return createHmac("sha256", identitySecret()).update(input).digest("base64url");
}

export function createTrainingIdentityAssertion(
  subject: string,
  role: TrainingIdentityRole,
  nowSeconds = Math.floor(Date.now() / 1000),
): string {
  if (!subject || subject.length > 128) throw new Error("Invalid FlyTally account subject.");
  const claims: TrainingIdentityClaims = {
    iss: "flytally-logbook",
    aud: "flytally-training",
    sub: subject,
    role,
    iat: nowSeconds,
    exp: nowSeconds + ASSERTION_SECONDS,
    jti: randomUUID(),
  };
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const input = `${VERSION}.${payload}`;
  return `${input}.${sign(input)}`;
}
