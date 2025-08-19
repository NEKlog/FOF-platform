export const runtime = "nodejs";
import { NextResponse } from "next/server";
export async function GET() {
  // tilpas hvis I vil begrænse roller
  return NextResponse.json(["ADMIN", "CUSTOMER", "CARRIER"]);
}
