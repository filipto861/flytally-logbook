import "server-only";

import { revalidatePath } from "next/cache";

export function revalidateFlightCertificationViews(flightId:number){
  revalidatePath(`/flights/${flightId}`);
  revalidatePath(`/flights/${flightId}/audit`);
  revalidatePath("/flights");
  revalidatePath("/certification");
  revalidatePath("/print");
  revalidatePath("/database");
  revalidatePath("/connections");
  revalidatePath("/notifications");
  revalidatePath("/credentials");
  revalidatePath("/dashboard");
}
export function revalidateFlightVoidViews(flightId:number){
  revalidateFlightCertificationViews(flightId);
  revalidatePath("/statistics");
  revalidatePath("/map");
  revalidatePath("/export");
  revalidatePath("/data");
}
