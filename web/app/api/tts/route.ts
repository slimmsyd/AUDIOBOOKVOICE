import { NextResponse } from "next/server";
import { defaultModelId, defaultVoiceId } from "@/lib/config";
import { errorResponse } from "@/lib/http";
import { requestElevenLabsAudio } from "@/lib/pipeline/tts";
import type { GenerateSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One short voice chunk per request — well under any serverless cap.
export const maxDuration = 60;

interface TtsRequest extends Partial<GenerateSettings> {
  apiKey?: string;
  text?: string;
}

// Stateless proxy: takes a BYO key + one text chunk, returns the MP3 bytes.
// The key is used only for this request and never stored.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsRequest;
    const apiKey = String(body.apiKey || "").trim();
    const text = String(body.text || "").trim();
    if (!apiKey) return NextResponse.json({ error: "ElevenLabs API key is required." }, { status: 400 });
    if (!text) return NextResponse.json({ error: "No text to narrate." }, { status: 400 });

    const settings: GenerateSettings = {
      voiceId: String(body.voiceId || defaultVoiceId).trim(),
      modelId: String(body.modelId || defaultModelId).trim(),
      stability: Number(body.stability ?? 0.45),
      similarityBoost: Number(body.similarityBoost ?? 0.85),
      style: Number(body.style ?? 0.15),
      speed: Number(body.speed ?? 1),
    };

    const audio = await requestElevenLabsAudio(apiKey, settings, text);
    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
