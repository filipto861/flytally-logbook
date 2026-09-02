"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV164Schema } from "@/lib/v164-schema";

const text=(form:FormData,name:string,max=160)=>String(form.get(name)??"").trim().slice(0,max);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const classes=new Set(["HOT_AIR_BALLOON","GAS_BALLOON","HOT_AIR_AIRSHIP","MIXED_BALLOON"]),groups=new Set(["","A","B","C","D"]);
const refresh=()=>{revalidatePath("/credentials");revalidatePath("/dashboard")};

export async function addBalloonProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV164Schema();const balloonClass=text(form,"balloon_class",24).toUpperCase(),rawGroup=text(form,"balloon_group",1).toUpperCase(),balloonGroup=balloonClass==="HOT_AIR_BALLOON"?rawGroup:"",date=text(form,"evidence_date",10),signer=text(form,"signer",120),reference=text(form,"reference",120),note=text(form,"note",300);
  if(!classes.has(balloonClass)||!groups.has(balloonGroup)||balloonClass==="HOT_AIR_BALLOON"&&!balloonGroup||!validDate(date)||!signer||!reference)return;
  await sql`INSERT INTO bpl_recency_evidence(user_id,evidence_kind,balloon_class,balloon_group,evidence_date,signer,reference,note) VALUES(${userId},'PROFICIENCY_CHECK',${balloonClass},${balloonGroup},${date},${signer},${reference},${note})`;
  refresh();
}

export async function deleteBalloonProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV164Schema();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;await sql`DELETE FROM bpl_recency_evidence WHERE id=${id} AND user_id=${userId}`;refresh();
}
