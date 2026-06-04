// Text cleaning + paragraph normalization, ported verbatim from server.js.

export function cleanExtractedText(rawText: string): string {
  const pages = rawText
    .replace(/\r/g, "")
    .split("\f")
    .map((page) => page.split("\n"));

  const counts = new Map<string, number>();
  for (const page of pages) {
    const seenOnPage = new Set<string>();
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
      .filter(
        ([, count]) =>
          pages.length >= 4 && count >= Math.max(3, Math.ceil(pages.length * 0.18)),
      )
      .map(([line]) => line),
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
      .join("\n"),
  );

  return normalizeParagraphs(cleanedPages.join("\n\n"));
}

export function normalizeParagraphs(text: string): string {
  const lines = text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/ /g, " ")
    .split("\n");

  const paragraphs: string[] = [];
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

export function normalizeNoiseLine(line: string): string {
  return line
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\d+/g, "#")
    .toLowerCase();
}
