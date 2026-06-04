import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultModelId, defaultVoiceId } from "@/lib/config";
import {
  estimateEta,
  formatBytes,
  formatDuration,
  formatNumber,
  logProgress,
  percent,
  slug,
  titleFromFileName,
} from "@/lib/format";
import { buildM4b, concatAudio, type ChapterAudio } from "@/lib/pipeline/audio";
import { splitIntoChapters, normalizeEditedChapters } from "@/lib/pipeline/chapters";
import { cleanExtractedText } from "@/lib/pipeline/extract";
import { chunkTextForTts, requestElevenLabsAudio } from "@/lib/pipeline/tts";
import { loadProject, projectPath, saveProject } from "@/lib/project-store";
import { run } from "@/lib/run";
import type { GenerateRequest, GenerateSettings, Project } from "@/lib/types";

// Import: write the PDF bytes, extract text via pdftotext, clean, split, persist.
// (Wire format deviates from the original base64-in-JSON: callers pass raw bytes.)
export async function importPdf(fileBytes: Buffer, fileName: string): Promise<Project> {
  if (!fileBytes?.length || !fileName) {
    throw new Error("Missing PDF upload.");
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const dir = projectPath(id);
  await mkdir(dir, { recursive: true });

  const pdfPath = path.join(dir, "source.pdf");
  const rawTextPath = path.join(dir, "raw.txt");
  await writeFile(pdfPath, fileBytes);

  await run("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, rawTextPath], {
    timeoutMs: 1000 * 60 * 3,
  });

  const rawText = await readFile(rawTextPath, "utf8");
  if (!rawText.trim()) {
    throw new Error(
      "This looks like a scanned/image-only PDF. Text PDFs are supported in this MVP; OCR can be added later.",
    );
  }

  const cleaned = cleanExtractedText(rawText);
  const chapters = splitIntoChapters(cleaned, rawText);
  const now = new Date().toISOString();
  const title = titleFromFileName(fileName);

  const project: Project = {
    id,
    title,
    author: "",
    fileName,
    createdAt: now,
    updatedAt: now,
    status: "review",
    source: {
      pdfPath,
      rawTextPath,
      pageCountEstimate: rawText.split("\f").filter(Boolean).length || null,
    },
    extraction: {
      rawCharacters: rawText.length,
      cleanedCharacters: cleaned.length,
      chapterCount: chapters.length,
    },
    chapters,
    output: null,
  };

  await saveProject(project);
  return project;
}

export async function resplitProject(id: string): Promise<Project> {
  const project = await loadProject(id);
  const rawText = await readFile(project.source.rawTextPath, "utf8");
  const cleaned = cleanExtractedText(rawText);
  project.chapters = splitIntoChapters(cleaned, rawText);
  project.status = "review";
  project.extraction = {
    ...project.extraction,
    rawCharacters: rawText.length,
    cleanedCharacters: cleaned.length,
    chapterCount: project.chapters.length,
  };
  project.output = null;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

export async function generateAudiobook(id: string, body: GenerateRequest): Promise<Project> {
  const project = await loadProject(id);
  project.title = String(body.title || project.title || "Untitled Audiobook");
  project.author = String(body.author || project.author || "");
  project.chapters = normalizeEditedChapters(body.chapters || project.chapters);
  project.status = "generating";
  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) throw new Error("ElevenLabs API key is required.");

  const settings: GenerateSettings = {
    voiceId: String(body.voiceId || defaultVoiceId).trim(),
    modelId: String(body.modelId || defaultModelId).trim(),
    stability: Number(body.stability ?? 0.45),
    similarityBoost: Number(body.similarityBoost ?? 0.85),
    style: Number(body.style ?? 0.15),
    speed: Number(body.speed ?? 1),
  };

  const dir = projectPath(id);
  const audioDir = path.join(dir, "audio");
  await mkdir(audioDir, { recursive: true });

  const chapterPlans = project.chapters.map((chapter) => {
    const chunks = chunkTextForTts(chapter.text);
    return {
      chapter,
      chunks,
      characterCount: chunks.reduce((total, chunk) => total + chunk.length, 0),
    };
  });
  const totalChunks = chapterPlans.reduce((total, plan) => total + plan.chunks.length, 0);
  const totalCharacters = chapterPlans.reduce((total, plan) => total + plan.characterCount, 0);
  const startedAt = Date.now();
  let completedChunks = 0;
  let completedCharacters = 0;
  let generatedCharacters = 0;
  let generatedMs = 0;

  logProgress(
    "start",
    `${project.title}: ${project.chapters.length} chapters, ${totalChunks} voice chunks, ${formatNumber(
      totalCharacters,
    )} characters`,
  );

  const chapterAudio: ChapterAudio[] = [];
  for (let chapterIndex = 0; chapterIndex < chapterPlans.length; chapterIndex += 1) {
    const { chapter, chunks } = chapterPlans[chapterIndex];
    chapter.status = "generating";
    await saveProject(project);

    const chunkFiles: string[] = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkPath = path.join(
        audioDir,
        `${chapter.id}-chunk-${String(i + 1).padStart(3, "0")}.mp3`,
      );
      const chunk = chunks[i];
      logProgress(
        "voice",
        `chapter ${chapterIndex + 1}/${chapterPlans.length} "${chapter.title}", chunk ${
          i + 1
        }/${chunks.length}, ${formatNumber(chunk.length)} chars`,
      );

      if (!existsSync(chunkPath)) {
        const chunkStartedAt = Date.now();
        const audio = await requestElevenLabsAudio(apiKey, settings, chunk);
        await writeFile(chunkPath, audio);
        const elapsedMs = Date.now() - chunkStartedAt;
        generatedCharacters += chunk.length;
        generatedMs += elapsedMs;
        logProgress("voice", `ElevenLabs returned ${formatBytes(audio.length)} in ${formatDuration(elapsedMs)}`);
      } else {
        logProgress("voice", "using cached audio chunk");
      }

      completedChunks += 1;
      completedCharacters += chunk.length;
      logProgress(
        "voice",
        `${percent(completedCharacters, totalCharacters)} complete (${completedChunks}/${totalChunks} chunks), ETA ${estimateEta(
          {
            startedAt,
            completedCharacters,
            totalCharacters,
            generatedCharacters,
            generatedMs,
          },
        )}`,
      );
      chunkFiles.push(chunkPath);
    }

    const chapterPath = path.join(audioDir, `${chapter.id}.m4a`);
    logProgress(
      "export",
      `combining ${chunks.length} chunks for chapter ${chapterIndex + 1}/${chapterPlans.length}`,
    );
    await concatAudio(chunkFiles, chapterPath);
    chapter.status = "generated";
    chapter.audioPath = chapterPath;
    chapterAudio.push({ chapter, path: chapterPath });
    await saveProject(project);
    logProgress("chapter", `finished "${chapter.title}"`);
  }

  const outputPath = path.join(dir, `${slug(project.title)}.m4b`);
  logProgress("export", `building final M4B with ${chapterAudio.length} chapter markers`);
  await buildM4b(project, chapterAudio, outputPath);

  project.status = "complete";
  project.output = {
    format: "m4b",
    m4bPath: outputPath,
    downloadUrl: `/api/projects/${project.id}/download`,
    generatedAt: new Date().toISOString(),
  };
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  logProgress("done", `${project.title} exported in ${formatDuration(Date.now() - startedAt)}: ${outputPath}`);

  return project;
}
