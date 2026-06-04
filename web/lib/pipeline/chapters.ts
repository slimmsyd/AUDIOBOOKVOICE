import type { Chapter, EditedChapter } from "@/lib/types";

interface TocTitle {
  display: string;
  match: string;
}

// Chapter detection + splitting, ported verbatim from server.js.

export function splitIntoChapters(cleanedText: string, rawText = ""): Chapter[] {
  const tocTitles = parseTocTitles(rawText);
  if (tocTitles.length >= 3) {
    const tocChapters = splitByToc(cleanedText, tocTitles);
    if (tocChapters.length >= Math.min(3, tocTitles.length)) return tocChapters;
  }

  const paragraphs = cleanedText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const starts: { index: number; title: string }[] = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const paragraph = paragraphs[i];
    const compact = paragraph.replace(/\s+/g, " ").trim();
    if (isChapterHeading(compact)) starts.push({ index: i, title: normalizeHeading(compact) });
  }

  if (!starts.length) {
    return [makeChapter("Book Text", paragraphs.join("\n\n"), 0)];
  }

  const firstStart = starts[0].index;
  const chapters: Chapter[] = [];
  if (firstStart > 0) {
    const introText = paragraphs.slice(0, firstStart).join("\n\n").trim();
    const usefulIntro = removeLikelyFrontMatter(introText);
    if (usefulIntro.length > 80)
      chapters.push(makeChapter("Introduction", usefulIntro, chapters.length));
  }

  for (let s = 0; s < starts.length; s += 1) {
    const start = starts[s];
    const next = starts[s + 1]?.index ?? paragraphs.length;
    const text = paragraphs.slice(start.index + 1, next).join("\n\n").trim();
    if (text.length > 80) chapters.push(makeChapter(start.title, text, chapters.length));
  }

  return chapters.length ? chapters : [makeChapter("Book Text", cleanedText, 0)];
}

export function parseTocTitles(rawText: string): TocTitle[] {
  const lines = rawText.replace(/\r/g, "").split("\n");
  const contentsIndex = lines.findIndex((line) => /^contents$/i.test(line.trim()));
  if (contentsIndex < 0) return [];

  const titles: TocTitle[] = [];
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
        match: normalizeTitleForMatch(normalized),
      });
    }
  }

  return dedupeTitles(titles);
}

export function splitByToc(cleanedText: string, tocTitles: TocTitle[]): Chapter[] {
  const paragraphs = cleanedText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const starts: { paragraphIndex: number; tocIndex: number }[] = [];

  for (let i = 0; i < paragraphs.length; i += 1) {
    const normalized = normalizeTitleForMatch(paragraphs[i]);
    const tocIndex = tocTitles.findIndex((title) => title.match === normalized);
    if (tocIndex >= 0) starts.push({ paragraphIndex: i, tocIndex });
  }

  const orderedStarts: { paragraphIndex: number; tocIndex: number }[] = [];
  let lastTocIndex = -1;
  for (const start of starts) {
    if (start.tocIndex > lastTocIndex) {
      orderedStarts.push(start);
      lastTocIndex = start.tocIndex;
    }
  }

  const chapters: Chapter[] = [];
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

function dedupeTitles(titles: TocTitle[]): TocTitle[] {
  const seen = new Set<string>();
  return titles.filter((title) => {
    if (!title.match || seen.has(title.match)) return false;
    seen.add(title.match);
    return true;
  });
}

export function normalizeTitleForMatch(value: string): string {
  return String(value)
    .replace(/\f/g, " ")
    .replace(/^\d+\s*[—–-]\s*/, "")
    .replace(/^[0-9ivxlcdm]+\s+/, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function removeLikelyFrontMatter(text: string): string {
  const tocIndex = text.search(/(?:table of contents|contents)\b/i);
  if (tocIndex >= 0 && tocIndex < 3000) {
    return text.slice(0, tocIndex).trim();
  }
  return text
    .replace(/isbn[-: ].{0,80}/gi, "")
    .replace(/all rights reserved\.?/gi, "")
    .trim();
}

export function isChapterHeading(text: string): boolean {
  if (text.length > 100) return false;
  if (
    /^((chapter|part|section)\s+([0-9ivxlcdm]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b.*|introduction|intro|preface|foreword|prologue|epilogue)$/i.test(
      text,
    )
  ) {
    return true;
  }

  const letters = text.replace(/[^a-z]/gi, "");
  const upperLetters = text.replace(/[^A-Z]/g, "");
  const upperRatio = letters.length ? upperLetters.length / letters.length : 0;
  return letters.length >= 8 && upperRatio > 0.82 && !/^\d+\s/.test(text);
}

function normalizeHeading(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\S/g, (match) => match.toUpperCase())
    .trim();
}

export function makeChapter(title: string, text: string, index: number): Chapter {
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    id: `chapter-${index + 1}`,
    order: index,
    title,
    text,
    wordCount,
    estimatedMinutes: Math.max(1, Math.round(wordCount / 155)),
    status: "ready",
  };
}

export function normalizeEditedChapters(chapters: unknown): Chapter[] {
  if (!Array.isArray(chapters)) throw new Error("Chapters must be an array.");
  return (chapters as EditedChapter[])
    .map((chapter, index) =>
      makeChapter(
        String(chapter.title || `Chapter ${index + 1}`).trim(),
        String(chapter.text || "").trim(),
        index,
      ),
    )
    .filter((chapter) => chapter.text.length > 0);
}
