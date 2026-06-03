import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const projectsDir = path.join(dataDir, "projects");
const port = Number(process.env.PORT || 5177);

const elevenLabsBaseUrl = "https://api.elevenlabs.io/v1";
const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM";
const maxTtsChars = 4500;

await mkdir(projectsDir, { recursive: true });

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".m4b": "audio/mp4",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg"
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith("/api/")) {
      await routeApi(req, res, url);
      return;
    }

    await serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
}).listen(port, () => {
  console.log(`PDF Audiobook Studio running at http://localhost:${port}`);
});

async function routeApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, {
      ok: true,
      tools: {
        pdftotext: await commandExists("pdftotext"),
        ffmpeg: await commandExists("ffmpeg")
      }
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/projects") {
    const projects = await listProjects();
    sendJson(res, 200, { projects });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/import") {
    const body = await readJsonBody(req);
    const project = await importPdf(body);
    sendJson(res, 200, project);
    return;
  }

  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && req.method === "GET") {
    sendJson(res, 200, await loadProject(projectMatch[1]));
    return;
  }

  if (projectMatch && req.method === "PUT") {
    const project = await loadProject(projectMatch[1]);
    const body = await readJsonBody(req);
    project.title = String(body.title || project.title || "Untitled Audiobook");
    project.author = String(body.author || project.author || "");
    project.chapters = normalizeEditedChapters(body.chapters);
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
    sendJson(res, 200, project);
    return;
  }

  const resplitMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/resplit$/);
  if (resplitMatch && req.method === "POST") {
    const project = await resplitProject(resplitMatch[1]);
    sendJson(res, 200, project);
    return;
  }

  const generateMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/generate$/);
  if (generateMatch && req.method === "POST") {
    const body = await readJsonBody(req);
    const result = await generateAudiobook(generateMatch[1], body);
    sendJson(res, 200, result);
    return;
  }

  const downloadMatch = url.pathname.match(/^\/api\/projects\/([^/]+)\/download$/);
  if (downloadMatch && req.method === "GET") {
    const project = await loadProject(downloadMatch[1]);
    if (!project.output?.m4bPath || !existsSync(project.output.m4bPath)) {
      sendJson(res, 404, { error: "No audiobook has been exported yet." });
      return;
    }
    await streamFile(res, project.output.m4bPath, `${slug(project.title)}.m4b`);
    return;
  }

  const deleteMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (deleteMatch && req.method === "DELETE") {
    await rm(projectPath(deleteMatch[1]), { recursive: true, force: true });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Route not found" });
}

async function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, safePath));
  if (!filePath.startsWith(publicDir)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    await stat(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": mimeTypes[ext] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

async function importPdf(body) {
  if (!body?.pdfBase64 || !body?.fileName) {
    throw new Error("Missing PDF upload.");
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const dir = projectPath(id);
  await mkdir(dir, { recursive: true });

  const pdfPath = path.join(dir, "source.pdf");
  const rawTextPath = path.join(dir, "raw.txt");
  const sourceBytes = Buffer.from(String(body.pdfBase64), "base64");
  await writeFile(pdfPath, sourceBytes);

  await run("pdftotext", ["-layout", "-enc", "UTF-8", pdfPath, rawTextPath], {
    timeoutMs: 1000 * 60 * 3
  });

  const rawText = await readFile(rawTextPath, "utf8");
  if (!rawText.trim()) {
    throw new Error("This looks like a scanned/image-only PDF. Text PDFs are supported in this MVP; OCR can be added later.");
  }

  const cleaned = cleanExtractedText(rawText);
  const chapters = splitIntoChapters(cleaned, rawText);
  const now = new Date().toISOString();
  const title = titleFromFileName(body.fileName);

  const project = {
    id,
    title,
    author: "",
    fileName: body.fileName,
    createdAt: now,
    updatedAt: now,
    status: "review",
    source: {
      pdfPath,
      rawTextPath,
      pageCountEstimate: rawText.split("\f").filter(Boolean).length || null
    },
    extraction: {
      rawCharacters: rawText.length,
      cleanedCharacters: cleaned.length,
      chapterCount: chapters.length
    },
    chapters,
    output: null
  };

  await saveProject(project);
  return project;
}

function cleanExtractedText(rawText) {
  const pages = rawText
    .replace(/\r/g, "")
    .split("\f")
    .map((page) => page.split("\n"));

  const counts = new Map();
  for (const page of pages) {
    const seenOnPage = new Set();
    for (const line of page) {
      const normalized = normalizeNoiseLine(line);
      if (normalized && normalized.length <= 120 && !/^\d+$/.test(normalized)) {
        seenOnPage.add(normalized);
      }
    }
    for (const line of seenOnPage) counts.set(line, (counts.get(line) || 0) + 1);
  }

  const repeated = new Set(
    [...counts.entries()]
      .filter(([, count]) => pages.length >= 4 && count >= Math.max(3, Math.ceil(pages.length * 0.18)))
      .map(([line]) => line)
  );

  const cleanedPages = pages.map((page) =>
    page
      .map((line) => line.replace(/\s+$/g, ""))
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return true;
        if (/^\d{1,5}$/.test(trimmed)) return false;
        if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(trimmed)) return false;
        return !repeated.has(normalizeNoiseLine(line));
      })
      .join("\n")
  );

  return normalizeParagraphs(cleanedPages.join("\n\n"));
}

function normalizeParagraphs(text) {
  const lines = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\u00a0/g, " ")
    .split("\n");

  const paragraphs = [];
  let current = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.trim()) paragraphs.push(current.trim());
      current = "";
      continue;
    }

    if (!current) {
      current = trimmed;
    } else if (current.endsWith("-")) {
      current = `${current.slice(0, -1)}${trimmed}`;
    } else {
      current = `${current} ${trimmed}`;
    }
  }

  if (current.trim()) paragraphs.push(current.trim());

  return paragraphs
    .join("\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function resplitProject(id) {
  const project = await loadProject(id);
  const rawText = await readFile(project.source.rawTextPath, "utf8");
  const cleaned = cleanExtractedText(rawText);
  project.chapters = splitIntoChapters(cleaned, rawText);
  project.status = "review";
  project.extraction = {
    ...project.extraction,
    rawCharacters: rawText.length,
    cleanedCharacters: cleaned.length,
    chapterCount: project.chapters.length
  };
  project.output = null;
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  return project;
}

function splitIntoChapters(cleanedText, rawText = "") {
  const tocTitles = parseTocTitles(rawText);
  if (tocTitles.length >= 3) {
    const tocChapters = splitByToc(cleanedText, tocTitles);
    if (tocChapters.length >= Math.min(3, tocTitles.length)) return tocChapters;
  }

  const paragraphs = cleanedText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const starts = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const compact = paragraph.replace(/\s+/g, " ").trim();
    if (isChapterHeading(compact)) starts.push({ index: i, title: normalizeHeading(compact) });
  }

  if (!starts.length) {
    return [
      makeChapter("Book Text", paragraphs.join("\n\n"), 0)
    ];
  }

  const firstStart = starts[0].index;
  const chapters = [];
  if (firstStart > 0) {
    const introText = paragraphs.slice(0, firstStart).join("\n\n").trim();
    const usefulIntro = removeLikelyFrontMatter(introText);
    if (usefulIntro.length > 80) chapters.push(makeChapter("Introduction", usefulIntro, chapters.length));
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    const next = starts[s + 1]?.index ?? paragraphs.length;
    const text = paragraphs.slice(start.index + 1, next).join("\n\n").trim();
    if (text.length > 80) chapters.push(makeChapter(start.title, text, chapters.length));
  }

  return chapters.length ? chapters : [makeChapter("Book Text", cleanedText, 0)];
}

function parseTocTitles(rawText) {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const contentsIndex = lines.findIndex((line) => /^contents$/i.test(line.trim()));
  if (contentsIndex < 0) return [];

  const titles = [];
  for (let i = contentsIndex + 1; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (/^\f?\s*introduction$/i.test(trimmed) && titles.length) break;
    if (/^(praise for|isbn|contents|acknowledg|dedication|copyright)\b/i.test(trimmed)) continue;
    if (/^glossary$/i.test(trimmed)) break;
    if (trimmed.length > 120) continue;

    const normalized = trimmed
      .replace(/^\d+\s*[—–-]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    if (/^(introduction|epilogue)$/i.test(normalized) || /^\d+\s*[—–-]/.test(trimmed)) {
      titles.push({
        display: normalized,
        match: normalizeTitleForMatch(normalized)
      });
    }
  }

  return dedupeTitles(titles);
}

function splitByToc(cleanedText, tocTitles) {
  const paragraphs = cleanedText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const starts = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const normalized = normalizeTitleForMatch(paragraphs[i]);
    const tocIndex = tocTitles.findIndex((title) => title.match === normalized);
    if (tocIndex >= 0) starts.push({ paragraphIndex: i, tocIndex });
  }

  const orderedStarts = [];
  let lastTocIndex = -1;
  for (const start of starts) {
    if (start.tocIndex > lastTocIndex) {
      orderedStarts.push(start);
      lastTocIndex = start.tocIndex;
    }
  }

  const chapters = [];
  for (let i = 0; i < orderedStarts.length; i += 1) {
    const start = orderedStarts[i];
    const nextParagraph = orderedStarts[i + 1]?.paragraphIndex ?? paragraphs.length;
    const text = paragraphs.slice(start.paragraphIndex + 1, nextParagraph).join("\n\n").trim();
    if (text.length > 80) {
      chapters.push(makeChapter(tocTitles[start.tocIndex].display, text, chapters.length));
    }
  }

  return chapters;
}

function dedupeTitles(titles) {
  const seen = new Set();
  return titles.filter((title) => {
    if (!title.match || seen.has(title.match)) return false;
    seen.add(title.match);
    return true;
  });
}

function normalizeTitleForMatch(value) {
  return String(value)
    .replace(/\f/g, " ")
    .replace(/^\d+\s*[—–-]\s*/, "")
    .replace(/^[0-9ivxlcdm]+\s+/, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function removeLikelyFrontMatter(text) {
  const tocIndex = text.search(/(?:table of contents|contents)\b/i);
  if (tocIndex >= 0 && tocIndex < 3000) {
    return text.slice(0, tocIndex).trim();
  }
  return text
    .replace(/isbn[-: ].{0,80}/gi, "")
    .replace(/all rights reserved\.?/gi, "")
    .trim();
}

function isChapterHeading(text) {
  if (text.length > 100) return false;
  if (/^((chapter|part|section)\s+([0-9ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b.*|introduction|intro|preface|foreword|prologue|epilogue)$/i.test(text)) {
    return true;
  }

  const letters = text.replace(/[^a-z]/gi, "");
  const upperLetters = text.replace(/[^A-Z]/g, "");
  const upperRatio = letters.length ? upperLetters.length / letters.length : 0;
  return letters.length >= 8 && upperRatio > 0.82 && !/^\d+\s/.test(text);
}

function normalizeHeading(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .trim();
}

function makeChapter(title, text, index) {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    id: `chapter-${index + 1}`,
    order: index,
    title,
    text,
    wordCount,
    estimatedMinutes: Math.max(1, Math.round(wordCount / 155)),
    status: "ready"
  };
}

function normalizeNoiseLine(line) {
  return line
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\d+/g, "#")
    .toLowerCase();
}

function normalizeEditedChapters(chapters) {
  if (!Array.isArray(chapters)) throw new Error("Chapters must be an array.");
  return chapters
    .map((chapter, index) => makeChapter(
      String(chapter.title || `Chapter ${index + 1}`).trim(),
      String(chapter.text || "").trim(),
      index
    ))
    .filter((chapter) => chapter.text.length > 0);
}

async function generateAudiobook(id, body) {
  const project = await loadProject(id);
  project.title = String(body.title || project.title || "Untitled Audiobook");
  project.author = String(body.author || project.author || "");
  project.chapters = normalizeEditedChapters(body.chapters || project.chapters);
  project.status = "generating";
  project.updatedAt = new Date().toISOString();
  await saveProject(project);

  const apiKey = String(body.apiKey || "").trim();
  if (!apiKey) throw new Error("ElevenLabs API key is required.");

  const settings = {
    voiceId: String(body.voiceId || defaultVoiceId).trim(),
    modelId: String(body.modelId || "eleven_multilingual_v2").trim(),
    stability: Number(body.stability ?? 0.45),
    similarityBoost: Number(body.similarityBoost ?? 0.85),
    style: Number(body.style ?? 0.15),
    speed: Number(body.speed ?? 1)
  };

  const dir = projectPath(id);
  const audioDir = path.join(dir, "audio");
  await mkdir(audioDir, { recursive: true });

  const chapterPlans = project.chapters.map((chapter) => {
    const chunks = chunkTextForTts(chapter.text);
    return {
      chapter,
      chunks,
      characterCount: chunks.reduce((total, chunk) => total + chunk.length, 0)
    };
  });
  const totalChunks = chapterPlans.reduce((total, plan) => total + plan.chunks.length, 0);
  const totalCharacters = chapterPlans.reduce((total, plan) => total + plan.characterCount, 0);
  const startedAt = Date.now();
  let completedChunks = 0;
  let completedCharacters = 0;
  let generatedCharacters = 0;
  let generatedMs = 0;

  logProgress("start", `${project.title}: ${project.chapters.length} chapters, ${totalChunks} voice chunks, ${formatNumber(totalCharacters)} characters`);

  const chapterAudio = [];
  for (let chapterIndex = 0; chapterIndex < chapterPlans.length; chapterIndex += 1) {
    const { chapter, chunks } = chapterPlans[chapterIndex];
    chapter.status = "generating";
    await saveProject(project);

    const chunkFiles = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const chunkPath = path.join(audioDir, `${chapter.id}-chunk-${String(i + 1).padStart(3, "0")}.mp3`);
      const chunk = chunks[i];
      logProgress(
        "voice",
        `chapter ${chapterIndex + 1}/${chapterPlans.length} "${chapter.title}", chunk ${i + 1}/${chunks.length}, ${formatNumber(chunk.length)} chars`
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
        `${percent(completedCharacters, totalCharacters)} complete (${completedChunks}/${totalChunks} chunks), ETA ${estimateEta({
          startedAt,
          completedCharacters,
          totalCharacters,
          generatedCharacters,
          generatedMs
        })}`
      );
      chunkFiles.push(chunkPath);
    }

    const chapterPath = path.join(audioDir, `${chapter.id}.m4a`);
    logProgress("export", `combining ${chunks.length} chunks for chapter ${chapterIndex + 1}/${chapterPlans.length}`);
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
    generatedAt: new Date().toISOString()
  };
  project.updatedAt = new Date().toISOString();
  await saveProject(project);
  logProgress("done", `${project.title} exported in ${formatDuration(Date.now() - startedAt)}: ${outputPath}`);

  return project;
}

function chunkTextForTts(text) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
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

async function requestElevenLabsAudio(apiKey, settings, text) {
  const url = `${elevenLabsBaseUrl}/text-to-speech/${settings.voiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey
    },
    body: JSON.stringify({
      text,
      model_id: settings.modelId,
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarityBoost,
        style: settings.style,
        use_speaker_boost: true,
        speed: settings.speed
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function concatAudio(files, outputPath) {
  if (files.length === 1) {
    await run("ffmpeg", ["-y", "-i", files[0], "-c:a", "aac", "-b:a", "128k", outputPath], { timeoutMs: 1000 * 60 * 10 });
    return;
  }

  const listPath = `${outputPath}.txt`;
  await writeFile(listPath, files.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c:a", "aac", "-b:a", "128k", outputPath], {
    timeoutMs: 1000 * 60 * 20
  });
}

async function buildM4b(project, chapterAudio, outputPath) {
  const listPath = `${outputPath}.concat.txt`;
  await writeFile(listPath, chapterAudio.map((item) => `file '${item.path.replaceAll("'", "'\\''")}'`).join("\n"));

  const metadataPath = `${outputPath}.metadata.txt`;
  let cursorMs = 0;
  const metadata = [
    ";FFMETADATA1",
    `title=${escapeMetadata(project.title)}`,
    project.author ? `artist=${escapeMetadata(project.author)}` : ""
  ].filter(Boolean);

  for (const item of chapterAudio) {
    const durationMs = await probeDurationMs(item.path);
    metadata.push(
      "[CHAPTER]",
      "TIMEBASE=1/1000",
      `START=${cursorMs}`,
      `END=${cursorMs + durationMs}`,
      `title=${escapeMetadata(item.chapter.title)}`
    );
    cursorMs += durationMs;
  }

  await writeFile(metadataPath, metadata.join("\n"));
  await run("ffmpeg", [
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
    outputPath
  ], { timeoutMs: 1000 * 60 * 30 });
}

async function probeDurationMs(filePath) {
  const output = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath
  ], { timeoutMs: 1000 * 60 });
  return Math.max(1, Math.round(Number(output.stdout.trim()) * 1000));
}

function escapeMetadata(value) {
  return String(value).replace(/[\\=\n\r;]/g, " ").trim();
}

function logProgress(stage, message) {
  console.log(`[${new Date().toLocaleTimeString()}] [${stage}] ${message}`);
}

function percent(value, total) {
  if (!total) return "0%";
  return `${Math.min(100, Math.round((value / total) * 100))}%`;
}

function estimateEta({ startedAt, completedCharacters, totalCharacters, generatedCharacters, generatedMs }) {
  const remainingCharacters = Math.max(0, totalCharacters - completedCharacters);
  if (remainingCharacters === 0) return "finishing now";

  const generatedCharsPerMs = generatedMs > 0 && generatedCharacters > 0
    ? generatedCharacters / generatedMs
    : 0;
  const overallCharsPerMs = completedCharacters > 0
    ? completedCharacters / Math.max(1, Date.now() - startedAt)
    : 0;
  const charsPerMs = generatedCharsPerMs || overallCharsPerMs;

  if (!charsPerMs) return "calculating";
  return formatDuration(remainingCharacters / charsPerMs);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value || 0)));
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

async function listProjects() {
  const entries = await readdir(projectsDir, { withFileTypes: true });
  const projects = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await loadProject(entry.name);
      projects.push({
        id: project.id,
        title: project.title,
        fileName: project.fileName,
        status: project.status,
        chapterCount: project.chapters?.length || 0,
        updatedAt: project.updatedAt,
        output: project.output
      });
    } catch {
      // Ignore incomplete project folders.
    }
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

async function loadProject(id) {
  const project = JSON.parse(await readFile(path.join(projectPath(id), "project.json"), "utf8"));
  if (project.id !== id) throw new Error("Project id mismatch.");
  return project;
}

async function saveProject(project) {
  const filePath = path.join(projectPath(project.id), "project.json");
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(project, null, 2));
  await rename(tempPath, filePath);
}

function projectPath(id) {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(projectsDir, safeId);
}

function titleFromFileName(fileName) {
  return String(fileName)
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Untitled Audiobook";
}

function slug(value) {
  return String(value || "audiobook")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "audiobook";
}

async function commandExists(command) {
  try {
    await run("which", [command], { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 150 * 1024 * 1024) throw new Error("Request is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function streamFile(res, filePath, downloadName) {
  const fileStat = await stat(filePath);
  res.writeHead(200, {
    "content-type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    "content-length": fileStat.size,
    "content-disposition": `attachment; filename="${downloadName}"`
  });
  createReadStream(filePath).pipe(res);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`${command} timed out.`));
        }, options.timeoutMs)
      : null;

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} failed: ${stderr || stdout}`));
    });
  });
}
