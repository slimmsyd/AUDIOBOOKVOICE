import type { FFmpeg } from "@ffmpeg/ffmpeg";

// Client-side M4B assembly with ffmpeg.wasm (single-threaded core — no COOP/COEP
// headers required). Mirrors the original server pipeline: per-chapter MP3 chunks
// -> AAC m4a, then concat + FFMETADATA chapter markers -> m4b.

const FFMPEG_VERSION = "0.12.10";
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_VERSION}/dist/umd`;

let ffmpegPromise: Promise<FFmpeg> | null = null;
let lastTimeSeconds = 0;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegPromise) return ffmpegPromise;
  ffmpegPromise = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();
    ffmpeg.on("log", ({ message }) => {
      // ffmpeg has no ffprobe; capture the running timestamp to derive durations.
      const match = message.match(/time=\s*(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        lastTimeSeconds =
          Number(match[1]) * 3600 +
          Number(match[2]) * 60 +
          Number(match[3]) +
          Number(match[4]) / 100;
      }
    });
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    return ffmpeg;
  })();
  return ffmpegPromise;
}

export interface ChapterAudio {
  title: string;
  chunks: Uint8Array[];
}

export interface AssembleOptions {
  title: string;
  author: string;
  chapters: ChapterAudio[];
  onStage?: (message: string) => void;
}

function escapeMetadata(value: string): string {
  return String(value).replace(/[\\=\n\r;]/g, " ").trim();
}

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export async function assembleM4b(options: AssembleOptions): Promise<Blob> {
  const { title, author, chapters, onStage } = options;
  const ffmpeg = await getFFmpeg();

  const chapterFiles: string[] = [];
  const chapterMeta: { title: string; durationMs: number }[] = [];

  for (let c = 0; c < chapters.length; c += 1) {
    const chapter = chapters[c];
    onStage?.(`Assembling chapter ${c + 1}/${chapters.length}`);

    const chunkNames: string[] = [];
    for (let i = 0; i < chapter.chunks.length; i += 1) {
      const name = `c${c}_chunk_${i}.mp3`;
      await ffmpeg.writeFile(name, chapter.chunks[i]);
      chunkNames.push(name);
    }

    const listName = `c${c}_list.txt`;
    await ffmpeg.writeFile(listName, enc(chunkNames.map((n) => `file '${n}'`).join("\n")));

    const chapterFile = `chapter_${c}.m4a`;
    lastTimeSeconds = 0;
    await ffmpeg.exec([
      "-f", "concat", "-safe", "0", "-i", listName,
      "-c:a", "aac", "-b:a", "128k", chapterFile,
    ]);

    chapterMeta.push({ title: chapter.title, durationMs: Math.max(1, Math.round(lastTimeSeconds * 1000)) });
    chapterFiles.push(chapterFile);

    // Free chunk files from the in-memory FS to limit memory growth.
    for (const name of chunkNames) await ffmpeg.deleteFile(name);
    await ffmpeg.deleteFile(listName);
  }

  // Build FFMETADATA with cumulative chapter timestamps.
  let cursorMs = 0;
  const metadata: string[] = [
    ";FFMETADATA1",
    `title=${escapeMetadata(title)}`,
    author ? `artist=${escapeMetadata(author)}` : "",
  ].filter(Boolean);
  for (const item of chapterMeta) {
    metadata.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${cursorMs}`,
      `END=${cursorMs + item.durationMs}`,
      `title=${escapeMetadata(item.title)}`,
    );
    cursorMs += item.durationMs;
  }

  await ffmpeg.writeFile("metadata.txt", enc(metadata.join("\n")));
  await ffmpeg.writeFile("concat.txt", enc(chapterFiles.map((n) => `file '${n}'`).join("\n")));

  onStage?.("Finalizing M4B with chapter markers");
  await ffmpeg.exec([
    "-f", "concat", "-safe", "0", "-i", "concat.txt",
    "-i", "metadata.txt", "-map_metadata", "1",
    "-c", "copy", "-f", "mp4", "output.m4b",
  ]);

  const data = await ffmpeg.readFile("output.m4b");

  // Cleanup chapter + meta files.
  for (const name of chapterFiles) await ffmpeg.deleteFile(name).catch(() => {});
  await ffmpeg.deleteFile("concat.txt").catch(() => {});
  await ffmpeg.deleteFile("metadata.txt").catch(() => {});
  await ffmpeg.deleteFile("output.m4b").catch(() => {});

  const bytes = typeof data === "string" ? enc(data) : data;
  return new Blob([bytes as BlobPart], { type: "audio/mp4" });
}
