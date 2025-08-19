import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") || "";

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const task = await prisma.task.findFirst({
    where: {
      activationToken: token,
      activationExpires: { gt: new Date() },
      requiresActivation: true,
      isPublished: false,
    },
    select: {
      id: true, title: true, customerId: true,
    },
  });

  if (!task) {
    // token forkert eller udløbet
    return NextResponse.redirect(new URL("/customer?m=activation_invalid", process.env.NEXT_PUBLIC_BASE_URL));
  }

  const delayMs = Number(process.env.TASK_VISIBLE_DELAY_MS ?? 2 * 60 * 60 * 1000);
  const visibleAfter = new Date(Date.now() + delayMs);

  await prisma.task.update({
    where: { id: task.id },
    data: {
      requiresActivation: false,
      activationToken: null,
      activationExpires: null,
      isPublished: true,
      visibleAfter,
      publishedAt: new Date(),
    },
  });

  // valgfrit: kvitteringsmail
  try {
    // After (null-safe)
    let user: { email: string | null } | null = null;
    if (task.customerId != null) {
      user = await prisma.user.findUnique({
        where: { id: task.customerId ?? undefined },
        select: { email: true },
      });
    }

  } catch {}

  return NextResponse.redirect(new URL("/customer?m=task_activated", process.env.NEXT_PUBLIC_BASE_URL));
}
