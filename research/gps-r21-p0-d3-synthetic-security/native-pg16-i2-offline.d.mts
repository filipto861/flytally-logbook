export type OfflineResult={ok:boolean;reason?:string;permitsRuntime?:false;permitsStop?:false;permitsDelete?:false};
export declare const REQUIRED_OS_EVIDENCE:readonly string[];
export declare function validateOfflineWindowsEvidence(e:unknown):OfflineResult;
export declare function evaluateOfflineStopEvidence(e:unknown):OfflineResult;
export declare function refuseNativeRuntime():never;
