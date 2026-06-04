import { elevenLabsBaseUrl, maxTtsChars } from "@/lib/config";
import type { GenerateSettings } from "@/lib/types";

// Text chunking + ElevenLabs request, ported verbatim from server.js.

export function chunkTextForTts(text: string): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length <= maxTtsChars) {
      current = (current ? `${current}\n\n${paragraph}` : paragraph).trim();
      continue;
    }

    if (current) chunks.push(current);
    if (paragraph.length <= maxTtsChars) {
      current = paragraph;
    } else {
      const sentences = paragraph.match(/[^.!?]+[.!?]+|\S.+$/g) || [paragraph];
      current = "";
      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > maxTtsChars) {
          if (current) chunks.push(current.trim());
          current = sentence.trim();
        } else {
          current = `${current} ${sentence}`.trim();
        }
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export async function requestElevenLabsAudio(
  apiKey: string,
  settings: GenerateSettings,
  text: string,
): Promise<Buffer> {
  const url = `${elevenLabsBaseUrl}/text-to-speech/${settings.voiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: settings.modelId,
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarityBoost,
        style: settings.style,
        use_speaker_boost: true,
        speed: settings.speed,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
