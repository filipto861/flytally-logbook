export type Pr340Candidate = {headSha:string;worktree:{files:string[]}};
export type Pr340Observation = {
  command:string;coverage:"full";planned:number;passed:number;failed:number;skipped:number;
  notApplicable:number;retries:number;sourceGate:"postgres";registrySha256:string;
  profile:string;partitions:unknown[];evidenceDirectory:string;
};
export function assertPr340AcceptancePreflight(options:{candidate:Pr340Candidate;env?:Partial<NodeJS.ProcessEnv>}):void;
export function runOwnedPr340PostgresAcceptance(options:{candidate:Pr340Candidate;env?:Partial<NodeJS.ProcessEnv>}):Pr340Observation;
