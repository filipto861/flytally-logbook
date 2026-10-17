/**
 * SYNTHETIC security design fixture ONLY, not app authentication or a grant issuer.
 * No real users, tokens, cookies, database queries, or claims of consent.
 */
export type MockSubject="r21_subject_alpha"|"r21_subject_beta";
export type MockGrant={
  subject:MockSubject;
  trackIds:readonly number[];
  expiresAtMs:number;
  revoked:boolean;
};
export type MockRequest={
  principal:MockSubject|null;
  trackId:number;
  trackOwner:MockSubject;
  nowMs:number;
};
export type MockDecision={status:"ALLOW"}|{status:"DENY";reason:"NOT_AUTHORIZED"};

/** Deliberately opaque DENY: do not disclose whether another subject/track exists. */
export function evaluateSyntheticGrant(grant:MockGrant|null,request:MockRequest):MockDecision{
  if(!grant||!request.principal||grant.revoked||
     !Number.isSafeInteger(request.trackId)||!Number.isFinite(request.nowMs)||
     !Number.isFinite(grant.expiresAtMs)||grant.expiresAtMs<=request.nowMs||
     grant.subject!==request.principal||request.trackOwner!==request.principal||
     !grant.trackIds.includes(request.trackId)){
    return{status:"DENY",reason:"NOT_AUTHORIZED"};
  }
  return{status:"ALLOW"};
}

/** Selector callback may only be reached with a positively validated mock grant.
 * This is NOT a DB-enforced policy, does not replace Postgres RLS, and never
 * authorizes access to a real FlyTally record. */
export function withSyntheticAuthorization<T>(
  grant:MockGrant|null,request:MockRequest,select:()=>T
):{status:"DENY";reason:"NOT_AUTHORIZED"}|{status:"ALLOW";result:T}{
  const d=evaluateSyntheticGrant(grant,request);
  if(d.status==="DENY")return d;
  return{status:"ALLOW",result:select()};
}
