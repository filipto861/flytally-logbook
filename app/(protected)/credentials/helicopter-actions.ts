"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV163Schema } from "@/lib/v163-schema";

const text=(form:FormData,name:string,max=160)=>String(form.get(name)??"").trim().slice(0,max);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const refresh=()=>{revalidatePath("/credentials");revalidatePath("/dashboard")};

export async function addHelicopterProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV163Schema();const helicopterType=text(form,"helicopter_type",120),date=text(form,"evidence_date",10),signer=text(form,"signer",120),reference=text(form,"reference",120),note=text(form,"note",300);
  if(!helicopterType||!validDate(date)||!signer||!reference)return;
  await sql`INSERT INTO helicopter_recency_evidence(user_id,evidence_kind,helicopter_type,evidence_date,signer,reference,note) VALUES(${userId},'PROFICIENCY_CHECK',${helicopterType},${date},${signer},${reference},${note})`;
  refresh();
}

export async function deleteHelicopterProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV163Schema();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;await sql`DELETE FROM helicopter_recency_evidence WHERE id=${id} AND user_id=${userId}`;refresh();
}
