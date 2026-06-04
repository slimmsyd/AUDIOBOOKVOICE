import { writeFile } from "node:fs/promises";
import { run } from "@/lib/run";
import type { Chapter, Project } from "@/lib/types";

// FFmpeg/ffprobe audio assembly, ported verbatim from server.js.

export async function concatAudio(files: string[], outputPath: string): Promise<void> {
  if (files.length === 1) {
    await run("ffmpeg", ["-y", "-i", files[0], "-c:a", "aac", "-b:a", "128k", outputPath], {
      timeoutMs: 1000 * 60 * 10,
    });
    return;
  }

  const listPath = `${outputPath}.txt`;
  await writeFile(
    listPath,
    files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
  );
  await run(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "aac", "-b:a", "128k", outputPath],
    { timeoutMs: 1000 * 60 * 20 },
  );
}

export interface ChapterAudio {
  chapter: Chapter;
  path: string;
}

export async function buildM4b(
  project: Project,
  chapterAudio: ChapterAudio[],
  outputPath: string,
): Promise<void> {
  const listPath = `${outputPath}.concat.txt`;
  await writeFile(
    listPath,
    chapterAudio.map((item) => `file '${item.path.replaceAll("'", "'\\''")}'`).join("\n"),
  );

  const metadataPath = `${outputPath}.metadata.txt`;
  let cursorMs = 0;
  const metadata: string[] = [
    ";FFMETADATA1",
    `title=${escapeMetadata(project.title)}`,
    project.author ? `artist=${escapeMetadata(project.author)}` : "",
  ].filter(Boolean);

  for (const item of chapterAudio) {
    const durationMs = await probeDurationMs(item.path);
    metadata.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${cursorMs}`,
      `END=${cursorMs + durationMs}`,
      `title=${escapeMetadata(item.chapter.title)}`,
    );
    cursorMs += durationMs;
  }

  await writeFile(metadataPath, metadata.join("\n"));
  await run(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      listPath,
      "-i",
      metadataPath,
      "-map_metadata",
      "1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-f",
      "mp4",
      outputPath,
    ],
    { timeoutMs: 1000 * 60 * 30 },
  );
}

export async function probeDurationMs(filePath: string): Promise<number> {
  const output = await run(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { timeoutMs: 1000 * 60 },
  );
  return Math.max(1, Math.round(Number(output.stdout.trim()) * 1000));
}

export function escapeMetadata(value: string): string {
  return String(value).replace(/[\\=\n\r;]/g, " ").trim();
}
