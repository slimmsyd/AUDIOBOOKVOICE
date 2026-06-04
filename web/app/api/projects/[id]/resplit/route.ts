import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { resplitProject } from "@/lib/pipeline/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = await resplitProject(id);
    return NextResponse.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
