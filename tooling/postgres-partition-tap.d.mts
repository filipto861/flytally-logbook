/** Pure M2 Node TAP evidence validation. No executable database interfaces. */
export type StrictPartitionTapEvidence = Readonly<{
  planned:number;
  passed:number;
  failed:0;
  skipped:0;
  cancelled:0;
  todo:0;
  notApplicable:0;
  retries:0;
  suites:number;
  rootAssertions:number;
  tapSha256:string;
}>;
export type PartitionEvidenceObservation = Readonly<{
  partitionId:string;
  candidateId:string;
  headSha:string;
  configHash:string;
  toolchainHash:string;
  registrySha256:string;
  exitCode:number;
  command:string;
  stdout:string;
  stderr:string;
  databaseIdentity:string;
}>;
export type PartitionTapRegistry = Readonly<{
  schemaVersion:number;
  stage:string;
  expectedTests:number;
  partitions:readonly Readonly<{id:string;expectedTests:number}>[];
}>;
export type PartitionTapSummary = Readonly<{
  status:"VALIDATED-ONLY";
  releaseEvidence:"NOT RUN";
  candidateId:string;
  headSha:string;
  registrySha256:string;
  partitions:readonly Readonly<{
    id:string;planned:number;passed:number;tapSha256:string;databaseIdentity:string;
  }>[];
  planned:number;
  passed:number;
}>;
export function parseStrictPartitionTap(stdout:string,options:{
  expectedTests:number;
}):StrictPartitionTapEvidence;
export function aggregatePartitionTapEvidence(options:{
  registry:PartitionTapRegistry;
  candidateId:string;
  headSha:string;
  configHash:string;
  toolchainHash:string;
  registrySha256:string;
  observations:readonly PartitionEvidenceObservation[];
}):PartitionTapSummary;
