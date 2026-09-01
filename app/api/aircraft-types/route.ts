import { NextResponse } from "next/server";
import { searchAircraftTypes } from "@/lib/aircraft-type-catalog";

export const dynamic="force-static";

export async function GET(request:Request){
  const url=new URL(request.url),query=String(url.searchParams.get("q")??"").slice(0,80),results=query.trim()?searchAircraftTypes(query,12):[];
  return NextResponse.json({results},{headers:{"Cache-Control":"public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"}});
}
