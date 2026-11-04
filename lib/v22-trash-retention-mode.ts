// Feature status is deliberately source-frozen. No environment toggle, rollout,
// automatic schema activation or production opt-in is allowed in this M0-B batch.
// A future approved implementation must replace this boundary explicitly.
export const V22_OWNER_TRASH_RETENTION_MODE = "off" as const;

export function positiveTrashOwnerId(value:unknown):number {
  if(typeof value!=="number"||!Number.isSafeInteger(value)||value<=0) {
    throw new Error("Trash retention requires a positive verified owner ID.");
  }
  return value;
}

export function requireLegacyTrashRetention(mode:unknown):void {
  if(mode!=="off") {
    throw new Error("V22 owner retention unavailable: schema, writer and privacy policy unapproved.");
  }
}
