import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { slug } from "@/lib/format";
import { errorResponse } from "@/lib/http";
import { loadProject } from "@/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const project = await loadProject(id);
    const m4bPath = project.output?.m4bPath;
    if (!m4bPath || !existsSync(m4bPath)) {
      return NextResponse.json({ error: "No audiobook has been exported yet." }, { status: 404 });
    }

    const fileStat = await stat(m4bPath);
    const nodeStream = createReadStream(m4bPath);
    const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>;

    return new Response(webStream, {
      headers: {
        "Content-Type": "audio/mp4",
        "Content-Length": String(fileStat.size),
        "Content-Disposition": `attachment; filename="${slug(project.title)}.m4b"`,
      },
    });
  } catch (error) {
    return errorResponse(error, 404);
  }
}
