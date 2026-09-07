"use server";
import { revalidatePath } from "next/cache";
import { acceptConnection,declineConnection } from "@/app/(protected)/connections/actions";
import { declineSharedFlight } from "@/app/(protected)/flights/shared-actions";

const refresh=()=>revalidatePath("/actions");

export async function acceptConnectionAction(form:FormData){await acceptConnection(form);refresh()}
export async function declineConnectionAction(form:FormData){await declineConnection(form);refresh()}
export async function declineSharedFlightAction(participationId:number,form:FormData){await declineSharedFlight(participationId,form);refresh()}
