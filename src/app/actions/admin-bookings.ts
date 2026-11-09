"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertStaff } from "@/lib/auth";
import { cancelConfirmed } from "@/lib/inventory";

/** GM-only: cancel a confirmed website booking and return the room to the allotment. */
export async function cancelBooking(id: string) {
  const user = await assertStaff();
  if (user.role !== "GM") throw new Error("Only the GM can cancel bookings");
  await cancelConfirmed(z.cuid().parse(id));
  console.info("booking cancelled", { by: user.email, id });
  revalidatePath("/admin/bookings");
}
