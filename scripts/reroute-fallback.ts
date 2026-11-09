// After an AI outage: re-run the AI on open enquiries that were sorted by the
// keyword fallback and haven't been touched by staff.
// Usage: npm run ai:retry
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { routeEnquiry } from "../src/lib/enquiries";

async function main() {
  const pending = await prisma.enquiry.findMany({
    where: { classifiedBy: "fallback", draftEdited: false },
    select: { id: true, reference: true },
  });
  console.log(`${pending.length} enquiries sorted by fallback`);
  for (const e of pending) {
    try {
      const r = await routeEnquiry(e.id);
      console.log(`  ${e.reference} → ${r.lane} (${r.classifiedBy}, ${r.confidence?.toFixed(2)})`);
    } catch (err) {
      console.log(`  ${e.reference} failed: ${(err as Error).message}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
