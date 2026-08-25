import { NextResponse } from "next/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { getFlightDetailFast,getFlightFilterOptionsFast,getFlightsPageFast } from "@/lib/data/flights-fast";

export const dynamic="force-dynamic";
export async function GET(){
  const userId=-1;
  try{await getDashboardData(userId,"all");}catch(error){return NextResponse.json({ok:false,stage:"dashboard",error:String(error)},{status:500})}
  try{await getFlightsPageFast(userId,{page:1,size:25});}catch(error){return NextResponse.json({ok:false,stage:"flights",error:String(error)},{status:500})}
  try{await getFlightFilterOptionsFast(userId);}catch(error){return NextResponse.json({ok:false,stage:"filters",error:String(error)},{status:500})}
  try{await getFlightDetailFast(userId,-1);}catch(error){return NextResponse.json({ok:false,stage:"detail",error:String(error)},{status:500})}
  return NextResponse.json({ok:true,stages:["dashboard","flights","filters","detail"]});
}
