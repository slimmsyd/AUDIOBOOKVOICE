import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { generateAudiobook } from "@/lib/pipeline/orchestrate";
import type { GenerateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Books can take many minutes. maxDuration only caps on serverless platforms;
// under self-hosted `next start` the request runs unbounded (same as the original).
export const maxDuration = 3600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await request.json()) as GenerateRequest;
    const project = await generateAudiobook(id, body);
    return NextResponse.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
