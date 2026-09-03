"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV165Schema } from "@/lib/v165-schema";
import { QUALIFICATION_CATEGORIES,QUALIFICATION_FAMILIES,QUALIFICATION_ROLES,type QualificationCategory,type QualificationFamily,type QualificationRole } from "@/lib/qualification-structure";

const t=(form:FormData,key:string,max=300)=>String(form.get(key)??"").trim().slice(0,max);
const upper=<T extends string>(form:FormData,key:string,allowed:readonly T[],fallback:T)=>{const value=t(form,key,40).toUpperCase() as T;return allowed.includes(value)?value:fallback};
const date=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())?value:null;
const refresh=()=>{revalidatePath("/credentials");revalidatePath("/profile")};

export async function saveQualificationStructure(form:FormData){
  const{userId}=await requireUser();await ensureV165Schema();
  const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;
  const family=upper<QualificationFamily>(form,"qualification_family",QUALIFICATION_FAMILIES,"OTHER"),category=upper<QualificationCategory>(form,"regulatory_category",QUALIFICATION_CATEGORIES,"OTHER"),role=upper<QualificationRole>(form,"privilege_role",QUALIFICATION_ROLES,"OTHER"),scope=t(form,"qualification_scope",120),issuedOn=date(t(form,"issued_on",10)),limitations=t(form,"limitations",800);
  await sql`UPDATE pilot_qualifications SET qualification_family=${family},regulatory_category=${category},qualification_scope=${scope},privilege_role=${role},classification_source='USER_CONFIRMED',issued_on=${issuedOn},limitations=${limitations},updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND active=TRUE AND COALESCE(record_kind,'')<>'aircraft_training'`;
  refresh();
}

export async function clearQualificationStructure(form:FormData){
  const{userId}=await requireUser();await ensureV165Schema();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;
  await sql`UPDATE pilot_qualifications SET qualification_family=NULL,regulatory_category=NULL,qualification_scope=NULL,privilege_role=NULL,classification_source=NULL,issued_on=NULL,limitations=NULL,updated_at=NOW() WHERE id=${id} AND user_id=${userId} AND COALESCE(record_kind,'')<>'aircraft_training'`;
  refresh();
}
