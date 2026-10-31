import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
