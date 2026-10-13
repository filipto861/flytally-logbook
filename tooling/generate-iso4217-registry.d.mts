/** Type declarations for the reviewed offline generator used by TS domain tests. */
export declare const SNAPSHOT_BLOB_SHA: string;
export type ParsedIsoEntry = Readonly<{
  code:string;
  name:string;
  numeric:string;
  minorUnits:number;
  fund:boolean;
}>;
export type ParsedIsoListOne = Readonly<{
  publishedAt:string;
  sourceRows:number;
  distinctCodes:number;
  monetary:ParsedIsoEntry[];
  excludedFunds:string[];
  excludedWithoutMinorUnits:string[];
  entriesWithoutCodes:number;
}>;
export declare function parseListOneXml(xml:string):ParsedIsoListOne;
export declare function renderRegistry(parsed:ParsedIsoListOne):string;
export declare function verifySnapshotBytes(raw:string):string;
