import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { getFlightTrackReview } from "@/lib/data/flight-track-review";

export const dynamic="force-dynamic";

export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  const{userId}=await requireUser();
  const id=Number((await params).id);
  if(!Number.isSafeInteger(id)||id<=0)return NextResponse.json({error:"Invalid flight."},{status:400,headers:{"Cache-Control":"private, no-store"}});
  const review=await getFlightTrackReview(userId,id);
  return NextResponse.json(review,{headers:{"Cache-Control":"private, no-store"}});
}
