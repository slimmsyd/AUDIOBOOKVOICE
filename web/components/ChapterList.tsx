"use client";

import { formatNumber } from "@/components/api";
import type { Chapter } from "@/lib/types";

interface ChapterListProps {
  chapters: Chapter[];
  onChange: (index: number, patch: { title?: string; text?: string }) => void;
}

export default function ChapterList({ chapters, onChange }: ChapterListProps) {
  return (
    <div className="grid gap-4">
      {chapters.map((chapter, index) => (
        <section
          key={chapter.id || index}
          className="app-shadow overflow-hidden rounded-lg border border-line bg-panel"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line bg-soft p-[0.9rem] max-[980px]:grid-cols-1">
            <input
              type="text"
              aria-label="Chapter title"
              value={chapter.title}
              onChange={(event) => onChange(index, { title: event.target.value })}
              className="w-full rounded-md border border-transparent bg-white px-3 py-[0.68rem] text-base font-bold"
            />
            <div className="whitespace-nowrap text-[0.84rem] text-muted max-[980px]:whitespace-normal">
              {formatNumber(chapter.wordCount)} words · {chapter.estimatedMinutes} min ·{" "}
              {chapter.status || "ready"}
            </div>
          </div>
          <textarea
            aria-label="Chapter text"
            spellCheck
            value={chapter.text}
            onChange={(event) => onChange(index, { text: event.target.value })}
            className="min-h-[300px] w-full resize-y border-0 bg-white px-3 py-[0.68rem] leading-relaxed"
          />
        </section>
      ))}
    </div>
  );
}
