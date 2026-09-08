export type RecoveryCountMap=Record<string,number>;
export type RecoveryPreviewLike={source:RecoveryCountMap;add:RecoveryCountMap;skip:RecoveryCountMap;withheld?:RecoveryCountMap;settings?:boolean};
export type RecoveryGroupId="logbook"|"history"|"pilot"|"recency"|"support"|"other";

export type RecoveryPreviewItem={
  key:string;
  label:string;
  source:number;
  missing:number;
  present:number;
  withheld:number;
  protectedEvidence:boolean;
};
export type RecoveryPreviewGroup={
  id:RecoveryGroupId;
  label:string;
  description:string;
  protectedEvidence:boolean;
  source:number;
  missing:number;
  present:number;
  withheld:number;
  items:RecoveryPreviewItem[];
};
export type RecoveryPreviewSummary={
  source:number;
  missing:number;
  present:number;
  withheld:number;
  protectedEvidence:number;
  settingsIncluded:boolean;
  groups:RecoveryPreviewGroup[];
};

type Definition={key:string;label:string;group:RecoveryGroupId;protectedEvidence?:boolean};

const definitions:Definition[]=[
  {key:"flights",label:"Flights",group:"logbook"},
  {key:"flight_tracks",label:"GPS tracks",group:"logbook"},
  {key:"track_points",label:"Legacy GPS points",group:"logbook"},
  {key:"fstd_sessions",label:"FSTD sessions",group:"logbook"},
  {key:"flight_expenses",label:"Flight expenses",group:"logbook"},

  {key:"flight_certified_revisions",label:"Certified flight revisions",group:"history",protectedEvidence:true},
  {key:"fstd_certified_revisions",label:"Certified FSTD revisions",group:"history",protectedEvidence:true},
  {key:"audit_log",label:"Flight audit history",group:"history",protectedEvidence:true},
  {key:"deleted_flights",label:"Trash recovery history",group:"history",protectedEvidence:true},
  {key:"flight_verifications",label:"Signed flight verifications",group:"history",protectedEvidence:true},
  {key:"instructor_flight_approvals",label:"Instructor approvals",group:"history",protectedEvidence:true},

  {key:"pilot_licences",label:"Pilot licences",group:"pilot"},
  {key:"pilot_qualifications",label:"Pilot qualifications",group:"pilot"},
  {key:"pilot_connections",label:"Pilot connections",group:"pilot"},
  {key:"flight_participations",label:"Shared flight participations",group:"pilot",protectedEvidence:true},
  {key:"user_notifications",label:"Notifications",group:"pilot"},
  {key:"connection_audit_log",label:"Connection audit history",group:"pilot",protectedEvidence:true},

  {key:"spl_recency_evidence",label:"SPL recency evidence",group:"recency",protectedEvidence:true},
  {key:"helicopter_recency_evidence",label:"Helicopter recency evidence",group:"recency",protectedEvidence:true},
  {key:"bpl_recency_evidence",label:"BPL recency evidence",group:"recency",protectedEvidence:true},

  {key:"aircraft",label:"Aircraft",group:"support"},
  {key:"rates",label:"Rates",group:"support"},
  {key:"airports",label:"Custom airports",group:"support"},
  {key:"expiries",label:"Licences / documents",group:"support"},
];

export const RECOVERY_PREVIEW_SECTION_KEYS=definitions.map(item=>item.key);

const groupMeta:Record<RecoveryGroupId,{label:string;description:string;protectedEvidence:boolean}>={
  logbook:{label:"Logbook records",description:"Flights, simulator sessions, GPS evidence and flight expenses.",protectedEvidence:false},
  history:{label:"Certified & audit history",description:"Revision chains, signatures and historical evidence validated before recovery.",protectedEvidence:true},
  pilot:{label:"Pilot & sharing",description:"Pilot credentials, connections and shared-flight evidence.",protectedEvidence:false},
  recency:{label:"Recency evidence",description:"Saved evidence supporting category-specific recency records.",protectedEvidence:true},
  support:{label:"Supporting data",description:"Aircraft, rates, airports and document tracking used around the logbook.",protectedEvidence:false},
  other:{label:"Other backup data",description:"Additional recoverable sections retained for forward compatibility.",protectedEvidence:false},
};

const groupOrder:RecoveryGroupId[]=["logbook","history","pilot","recency","support","other"];
const definitionByKey=new Map(definitions.map(item=>[item.key,item]));
const count=(map:RecoveryCountMap,key:string)=>Math.max(0,Math.trunc(Number(map[key])||0));
const fallbackLabel=(key:string)=>key.replaceAll("_"," ").replace(/\b\w/g,char=>char.toUpperCase());

export function buildRecoveryPreviewSummary(preview:RecoveryPreviewLike):RecoveryPreviewSummary{
  const keys=[...definitions.map(item=>item.key),...Object.keys(preview.source).filter(key=>!definitionByKey.has(key)).sort()];
  const grouped=new Map<RecoveryGroupId,RecoveryPreviewItem[]>();
  let source=0,missing=0,present=0,withheld=0,protectedEvidence=0;

  for(const key of keys){
    const definition=definitionByKey.get(key),itemSource=count(preview.source,key),itemMissing=count(preview.add,key),itemPresent=count(preview.skip,key),itemWithheld=count(preview.withheld??{},key);
    if(itemSource===0&&itemMissing===0&&itemPresent===0)continue;
    const protectedItem=Boolean(definition?.protectedEvidence),item:RecoveryPreviewItem={key,label:definition?.label||fallbackLabel(key),source:itemSource,missing:itemMissing,present:itemPresent,withheld:itemWithheld,protectedEvidence:protectedItem};
    const group=definition?.group||"other",items=grouped.get(group)??[];items.push(item);grouped.set(group,items);
    source+=itemSource;missing+=itemMissing;present+=itemPresent;withheld+=itemWithheld;if(protectedItem)protectedEvidence+=itemSource;
  }

  const groups:RecoveryPreviewGroup[]=groupOrder.flatMap(id=>{
    const items=grouped.get(id);if(!items?.length)return[];
    const meta=groupMeta[id];
    return[{id,label:meta.label,description:meta.description,protectedEvidence:meta.protectedEvidence,source:items.reduce((sum,item)=>sum+item.source,0),missing:items.reduce((sum,item)=>sum+item.missing,0),present:items.reduce((sum,item)=>sum+item.present,0),withheld:items.reduce((sum,item)=>sum+item.withheld,0),items}];
  });

  return{source,missing,present,withheld,protectedEvidence,settingsIncluded:Boolean(preview.settings),groups};
}
