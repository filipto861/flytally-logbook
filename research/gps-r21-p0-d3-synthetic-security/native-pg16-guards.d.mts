/** Synthetic-only native PG16 design predicates. No DB/Windows side effects. */
export declare const EXPECTED_BINARIES: string[];
export declare const EXPECTED_VERSION: string;
export declare const ATTEST_SQL: string;
export declare function ambientConnectionOverrides(env:Record<string,string|undefined>):string[];
export declare function validatePg16Versions(outputs:Record<string,string>):boolean;
export declare function sameWindowsPath(a:unknown,b:unknown):boolean;
export type CheckedPath={path:string;isReparsePoint:boolean;aclTrusted:boolean;trustedOwner:boolean;exists:boolean};
export declare function validateNativeRunPaths(input:{
  root:string;runDir:string;pgdata:string;ownerProfile:string;entries:CheckedPath[];
}):boolean;
export declare function validateMinimalHba(text:string):boolean;
export declare function validateStartupLog(text:string,port:number):boolean;
export declare function parseControlSystemIdentifier(text:string):string|null;
export declare function validateServerAttestation(
  expected:{pgdata:string;port:number;systemId:string;nonce:string},
  raw:string|Record<string,unknown>
):boolean;
export declare function validateOwnedPostmaster(input:{
  pidfile:string;pgdata:string;port:number;expectedPid:number;
  process:{pid:number;executable:string;startedByThisRun:boolean;commandLineMatchesPgdata:boolean};
}):boolean;
export declare function validateRunOwnershipForCleanup(state:{
  createdByThisRun:boolean;stoppedVerified:boolean;pidNotAliveVerified:boolean;
  aclTrusted:boolean;noReparsePoints:boolean;markerMatched:boolean;
  systemId:string;expectedSystemId:string;pathOwnedVerified:boolean;
}):boolean;
