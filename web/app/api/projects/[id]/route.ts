import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { normalizeEditedChapters } from "@/lib/pipeline/chapters";
import { ensureDataDir, loadProject, projectPath, saveProject } from "@/lib/project-store";
import type { ProjectUpdateRequest } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    return NextResponse.json(await loadProject(id));
  } catch (error) {
    return errorResponse(error, 404);
  }
}

export async function PUT(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = await loadProject(id);
    const body = (await request.json()) as ProjectUpdateRequest;
    project.title = String(body.title || project.title || "Untitled Audiobook");
    project.author = String(body.author || project.author || "");
    project.chapters = normalizeEditedChapters(body.chapters);
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
    return NextResponse.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    await ensureDataDir();
    const { id } = await params;
    await rm(projectPath(id), { recursive: true, force: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
