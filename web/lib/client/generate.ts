import { assembleM4b, type ChapterAudio } from "@/lib/client/assemble";
import { estimateEta } from "@/lib/format";
import { chunkTextForTts } from "@/lib/pipeline/chunk";
import type { Chapter, GenerationProgress, GenerationStage } from "@/lib/types";

export interface GenerateOptions {
  chapters: Chapter[];
  title: string;
  author: string;
  apiKey: string;
  voiceId: string;
  modelId: string;
  onProgress: (progress: GenerationProgress) => void;
  signal?: AbortSignal;
}

// Orchestrates generation entirely in the browser:
//   for each chapter -> for each chunk -> POST /api/tts (BYO key) -> collect MP3
//   then ffmpeg.wasm assembles the M4B with chapter markers.
// Voice covers 0-90% of the bar; assembly covers 90-100%.
export async function generateAudiobookClient(options: GenerateOptions): Promise<Blob> {
  const { chapters, title, author, apiKey, voiceId, modelId, onProgress, signal } = options;

  const plans = chapters.map((chapter) => ({ chapter, chunks: chunkTextForTts(chapter.text) }));
  const totalChunks = plans.reduce((sum, p) => sum + p.chunks.length, 0);
  const totalCharacters = plans.reduce(
    (sum, p) => sum + p.chunks.reduce((s, c) => s + c.length, 0),
    0,
  );
  if (totalChunks === 0) throw new Error("There is no chapter text to narrate.");

  const startedAt = Date.now();
  let completedChunks = 0;
  let completedCharacters = 0;
  let generatedCharacters = 0;
  let generatedMs = 0;

  const emit = (stage: GenerationStage, message: string, percentOverride?: number) => {
    const voicePercent = totalCharacters
      ? Math.round((completedCharacters / totalCharacters) * 90)
      : 0;
    onProgress({
      stage,
      message,
      percent: percentOverride ?? voicePercent,
      completedChunks,
      totalChunks,
      chapterIndex: currentChapterIndex,
      chapterCount: plans.length,
      chapterTitle: currentChapterTitle,
      eta: estimateEta({
        startedAt,
        completedCharacters,
        totalCharacters,
        generatedCharacters,
        generatedMs,
      }),
    });
  };

  let currentChapterIndex = 0;
  let currentChapterTitle = plans[0]?.chapter.title ?? "";

  emit("start", "Preparing voice generation");

  const chapterAudio: ChapterAudio[] = [];
  for (let c = 0; c < plans.length; c += 1) {
    const { chapter, chunks } = plans[c];
    currentChapterIndex = c;
    currentChapterTitle = chapter.title;
    const mp3s: Uint8Array[] = [];

    for (let i = 0; i < chunks.length; i += 1) {
      if (signal?.aborted) throw new Error("Generation cancelled.");
      const chunk = chunks[i];
      const chunkStartedAt = Date.now();

      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, text: chunk, voiceId, modelId }),
        signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Voice request failed: ${response.status}`);
      }
      mp3s.push(new Uint8Array(await response.arrayBuffer()));

      generatedCharacters += chunk.length;
      generatedMs += Date.now() - chunkStartedAt;
      completedChunks += 1;
      completedCharacters += chunk.length;
      emit("voice", `Narrating “${chapter.title}” — chunk ${i + 1}/${chunks.length}`);
    }

    chapterAudio.push({ title: chapter.title, chunks: mp3s });
  }

  emit("export", "Assembling audiobook in your browser…", 92);
  const blob = await assembleM4b({
    title,
    author,
    chapters: chapterAudio,
    onStage: (message) => emit("export", message, 95),
  });

  emit("done", "Audiobook ready", 100);
  return blob;
}
