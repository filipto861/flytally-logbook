/** Explicit TS surface for offline source-byte verifier (.mjs implementation). */
export declare const PINNED_GIT_BLOB_SHA1:string;
export declare const EXPECTED_PUBLICATION:string;
export declare const OFFICIAL_SOURCE_URL:string;
export type IsoSnapshotComparisonStatus =
  |"invalid-xml"
  |"invalid-pin"
  |"different-publication"
  |"different-content"
  |"byte-identical";
export type IsoSnapshotComparison=Readonly<{
  status:IsoSnapshotComparisonStatus;
  candidateDate:string|null;
  pinnedDate:string|null;
  candidateSha256:string;
  pinnedSha256:string;
}>;
export declare function sha256(bytes:Uint8Array):string;
export declare function gitBlobSha1(bytes:Uint8Array):string;
export declare function xmlPublication(bytes:Uint8Array):string|null;
export declare function compareIso4217Snapshots(candidate:Uint8Array,pinned:Uint8Array):IsoSnapshotComparison;
