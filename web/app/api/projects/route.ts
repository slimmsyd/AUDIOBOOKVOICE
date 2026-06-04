import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { listProjects } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (error) {
    return errorResponse(error);
  }
}
