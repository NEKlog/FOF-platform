import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redactPII } from "@/lib/redact";

export async function GET(req: Request) {
  // kun publiceret + evt. synlig efter dato
  const list = await prisma.task.findMany({
    where: {
      isPublished: true,
      OR: [{ visibleAfter: null }, { visibleAfter: { lte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, status: true, price: true, createdAt: true,
      // kun “ufarlige” dele – ingen rene kontaktfelter
      pickup: true, dropoff: true,
    },
  });

  // slør evt. kontaktinfo skrevet i title/notes
  const items = list.map(t => ({
    ...t,
    title: redactPII(t.title || ""),
    pickup: redactPII(t.pickup || ""),
    dropoff: redactPII(t.dropoff || ""),
  }));

  return NextResponse.json(items);
}
