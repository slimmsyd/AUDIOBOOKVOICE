import { NextResponse } from "next/server";
import { commandExists } from "@/lib/run";
import type { HealthResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body: HealthResponse = {
    ok: true,
    tools: {
      pdftotext: await commandExists("pdftotext"),
      ffmpeg: await commandExists("ffmpeg"),
    },
  };
  return NextResponse.json(body);
}
