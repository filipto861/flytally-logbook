"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { sql } from "@/lib/db";
import { ensureV162Schema } from "@/lib/v162-schema";

const text=(form:FormData,name:string,max=160)=>String(form.get(name)??"").trim().slice(0,max);
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
const refresh=()=>{revalidatePath("/credentials");revalidatePath("/dashboard")};

export async function addSplProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV162Schema();const context=text(form,"aircraft_context",20).toUpperCase(),date=text(form,"evidence_date",10),signer=text(form,"signer",120),reference=text(form,"reference",120),note=text(form,"note",300);
  if(!["SAILPLANE","TMG"].includes(context)||!validDate(date)||!signer||!reference)return;
  await sql`INSERT INTO spl_recency_evidence(user_id,evidence_kind,aircraft_context,evidence_date,signer,reference,note) VALUES(${userId},'PROFICIENCY_CHECK',${context},${date},${signer},${reference},${note})`;
  refresh();
}

export async function deleteSplProficiencyEvidence(form:FormData){
  const{userId}=await requireUser();await ensureV162Schema();const id=Number(form.get("id"));if(!Number.isSafeInteger(id)||id<=0)return;await sql`DELETE FROM spl_recency_evidence WHERE id=${id} AND user_id=${userId}`;refresh();
}
