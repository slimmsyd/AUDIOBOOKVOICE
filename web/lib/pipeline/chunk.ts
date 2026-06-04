import { maxTtsChars } from "@/lib/config";

// Pure text-chunking for TTS (client- and server-safe), ported from server.js.
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
