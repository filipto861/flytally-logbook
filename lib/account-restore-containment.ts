/** M0-A: fail closed for every full-account backup restore. No flag bypass. */
export const ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE =
  "Full account restore is temporarily unavailable while we protect your flight history. Backups can still be created, checked and downloaded.";

export function blockFullAccountRestore(): never {
  throw new Error(ACCOUNT_RESTORE_UNAVAILABLE_MESSAGE);
}
