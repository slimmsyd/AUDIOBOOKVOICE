import { maxTtsChars } from "@/lib/config";

// Pure text-chunking for TTS (client- and server-safe), ported from server.js.
// maxChars defaults to the ElevenLabs limit; pass a smaller value for Deepgram (2000 cap).
export function chunkTextForTts(text: string, maxChars: number = maxTtsChars): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).trim().length <= maxChars) {
      current = (current ? `${current}\n\n${paragraph}` : paragraph).trim();
      continue;
    }

    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      const sentences = paragraph.match(/[^.!?]+[.!?]+|\S.+$/g) || [paragraph];
      current = "";
      for (const sentence of sentences) {
        if ((current + " " + sentence).trim().length > maxChars) {
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
