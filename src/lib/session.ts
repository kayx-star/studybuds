import "server-only";
import { cookies } from "next/headers";

export const SID = "sid";

export async function currentStudentId() {
  return (await cookies()).get(SID)?.value ?? null;
}
