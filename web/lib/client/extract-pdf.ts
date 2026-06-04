import { titleFromFileName } from "@/lib/format";
import { splitIntoChapters } from "@/lib/pipeline/chapters";
import { cleanExtractedText } from "@/lib/pipeline/extract";
import type { Project } from "@/lib/types";

// Minimal shape of the PDF.js text items we rely on.
interface TextItem {
  str: string;
  transform: number[]; // [a, b, c, d, x, y]
  width: number;
  height: number;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Reconstruct page text with line + paragraph structure from PDF.js positions,
// approximating what `pdftotext -layout` produced (which the chapter/TOC
// detection depends on). unpdf's flat extractText loses this structure.
function reconstructPageText(items: TextItem[]): string {
  const positioned: PositionedItem[] = items
    .filter((it) => typeof it.str === "string" && it.str.length > 0)
    .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height }));
  if (!positioned.length) return "";

  // Group items into lines by baseline y (PDF origin is bottom-left, so larger y = higher).
  positioned.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; items: PositionedItem[] }[] = [];
  for (const it of positioned) {
    const tol = Math.max(2, (it.h || 10) * 0.5);
    const line = lines.find((l) => Math.abs(l.y - it.y) <= tol);
    if (line) line.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }

  // Build each line's text, inserting spaces across horizontal gaps.
  const builtLines = lines.map((line) => {
    line.items.sort((a, b) => a.x - b.x);
    let text = "";
    let prev: PositionedItem | null = null;
    for (const it of line.items) {
      if (prev) {
        const gap = it.x - (prev.x + prev.w);
        const needsSpace = gap > (prev.h || 10) * 0.25 && !text.endsWith(" ") && !it.str.startsWith(" ");
        if (needsSpace) text += " ";
      }
      text += it.str;
      prev = it;
    }
    return { y: line.y, text: text.replace(/\s+$/g, "") };
  });

  // Estimate typical line spacing to detect paragraph breaks (larger vertical gaps).
  const gaps: number[] = [];
  for (let i = 1; i < builtLines.length; i += 1) {
    const gap = builtLines[i - 1].y - builtLines[i].y;
    if (gap > 0) gaps.push(gap);
  }
  const sorted = [...gaps].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

  let out = "";
  let prevY: number | null = null;
  for (const line of builtLines) {
    if (prevY !== null && median > 0) {
      const gap = prevY - line.y;
      if (gap > median * 1.6) out += "\n"; // blank line => paragraph break
    }
    out += `${line.text}\n`;
    prevY = line.y;
  }
  return out;
}

// Extracts text from a PDF entirely in the browser (no upload, no binaries) and
// reuses the existing clean + chapter-split pipeline.
export async function extractProjectFromPdf(file: File): Promise<Project> {
  const { getDocumentProxy } = await import("unpdf");

  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);

  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(reconstructPageText(content.items as TextItem[]));
  }

  // Form feeds between pages let the existing cleaner detect repeated headers/footers.
  const rawText = pageTexts.join("\f");
  if (!rawText.trim()) {
    throw new Error(
      "No selectable text found. This looks like a scanned/image-only PDF; OCR isn't supported yet.",
    );
  }

  const cleaned = cleanExtractedText(rawText);
  const chapters = splitIntoChapters(cleaned, rawText);
  const now = new Date().toISOString();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: titleFromFileName(file.name),
    author: "",
    fileName: file.name,
    createdAt: now,
    updatedAt: now,
    status: "review",
    extraction: {
      rawCharacters: rawText.length,
      cleanedCharacters: cleaned.length,
      chapterCount: chapters.length,
    },
    chapters,
    output: null,
    rawText,
  };
}
