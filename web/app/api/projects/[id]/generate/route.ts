import { messageOf } from "@/lib/http";
import { generateAudiobook } from "@/lib/pipeline/orchestrate";
import type { GenerateRequest, GenerateStreamEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Max allowed on Vercel Hobby is 300s. On a self-hosted `next start` server this
// cap is not enforced and long books run unbounded (the on-disk chunk cache also
// makes a re-POST resume where it left off). NOTE: full generation requires the
// pdftotext/ffmpeg binaries + a persistent disk, which Vercel serverless lacks —
// see README for self-hosting (Render/Railway/Fly/VPS/Docker).
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

// Streams generation progress as Server-Sent Events, ending with a `done`
// event carrying the final project (or an `error` event).
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;
  const body = (await request.json()) as GenerateRequest;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: GenerateStreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const project = await generateAudiobook(id, body, (progress) => {
          send({ type: "progress", ...progress });
        });
        send({ type: "done", project });
      } catch (error) {
        send({ type: "error", error: messageOf(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
