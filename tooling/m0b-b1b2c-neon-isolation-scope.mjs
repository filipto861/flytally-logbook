// M0-B exact Neon read-only scope guard — no network/SQL/credentials.
 // Does not authorize destructive SQL or certify Neon HTTP transaction behavior.
 const TARGET=Object.freeze({
   projectId:'blue-haze-29352938',
   projectName:'FlyTally Logbook M0B Isolated Acceptance 2026-11-03',
   branchId:'br-patient-sound-bacf0trt',
   branchName:'m0b-isolated-empty-pg16-20261103',
   databaseName:'flytally_m0b_isolated',
   operatorRole:'flytally_m0b_operator',
   pgVersionNumber:'160015',
 });
 export function assertM0BReadOnlyTarget(input){
   if(input===null||typeof input!=='object'||Array.isArray(input))
     throw Error('M0-B missing explicit isolated Neon target');
   if(input.confirmation!=='M0B_EMPTY_SEPARATE_PROJECT_READONLY_CONFIRMED')
     throw Error('M0-B missing read-only confirmation');
   for(const [field,expected] of Object.entries(TARGET)){
     if(input[field]!==expected)throw Error('M0-B wrong or unverified '+field);
   }
   if(input.defaultBranch!==true||input.projectCreationSource!=='new-project'
     ||input.copiedProductionData!==false||input.publicTableCount!==0)
     throw Error('M0-B empty new-project evidence invalid or missing');
   if(input.operation!=='metadata-read-only')
     throw Error('M0-B operation not allowed by read-only target guard');
   return Object.freeze({projectId:TARGET.projectId,branchId:TARGET.branchId,
     databaseName:TARGET.databaseName,roleName:TARGET.operatorRole});
 }
 export const M0B_READ_ONLY_EXPECTED=TARGET;
