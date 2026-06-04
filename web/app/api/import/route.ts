import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { importPdf } from "@/lib/pipeline/orchestrate";
import { ensureDataDir } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await ensureDataDir();
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Missing PDF upload." }, { status: 400 });
    }

    const fileName = file.name || "document.pdf";
    const bytes = Buffer.from(await file.arrayBuffer());
    const project = await importPdf(bytes, fileName);
    return NextResponse.json(project);
  } catch (error) {
    return errorResponse(error);
  }
}
