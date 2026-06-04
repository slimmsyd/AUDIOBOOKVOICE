"use client";

import { formatNumber } from "@/components/api";
import ChapterList from "@/components/ChapterList";
import GenerationPanel from "@/components/GenerationPanel";
import GenerationProgress from "@/components/GenerationProgress";
import type { Chapter, GenerationProgress as Progress, Project } from "@/lib/types";

interface ProjectEditorProps {
  project: Project;
  title: string;
  author: string;
  chapters: Chapter[];
  apiKey: string;
  voiceId: string;
  modelId: string;
  busy: boolean;
  status: string;
  progress: Progress | null;
  onTitle: (value: string) => void;
  onAuthor: (value: string) => void;
  onChapterChange: (index: number, patch: { title?: string; text?: string }) => void;
  onApiKey: (value: string) => void;
  onVoiceId: (value: string) => void;
  onModelId: (value: string) => void;
  onSave: () => void;
  onResplit: () => void;
  onGenerate: () => void;
}

const labelClass = "grid gap-[0.35rem] text-[0.78rem] font-extrabold uppercase text-muted";
const fieldClass =
  "w-full rounded-md border border-line bg-white px-3 py-[0.68rem] text-sm font-medium normal-case text-ink";

export default function ProjectEditor({
  project,
  title,
  author,
  chapters,
  apiKey,
  voiceId,
  modelId,
  busy,
  status,
  progress,
  onTitle,
  onAuthor,
  onChapterChange,
  onApiKey,
  onVoiceId,
  onModelId,
  onSave,
  onResplit,
  onGenerate,
}: ProjectEditorProps) {
  return (
    <div className="mt-4 grid gap-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 rounded-lg border border-line bg-panel p-4 max-[980px]:grid-cols-1">
        <div className="grid grid-cols-2 gap-[0.8rem] max-[980px]:grid-cols-1">
          <label className={labelClass}>
            Title
            <input
              type="text"
              value={title}
              onChange={(event) => onTitle(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            Author
            <input
              type="text"
              placeholder="Optional"
              value={author}
              onChange={(event) => onAuthor(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        <div className="self-end text-right text-[0.92rem] text-muted max-[980px]:text-left">
          {chapters.length} chapters ·{" "}
          {formatNumber(project.extraction?.cleanedCharacters || 0)} cleaned characters
        </div>
      </div>

      <GenerationPanel
        apiKey={apiKey}
        voiceId={voiceId}
        modelId={modelId}
        busy={busy}
        downloadUrl={project.output?.downloadUrl ?? null}
        onApiKey={onApiKey}
        onVoiceId={onVoiceId}
        onModelId={onModelId}
        onSave={onSave}
        onResplit={onResplit}
        onGenerate={onGenerate}
      />

      {progress ? (
        <GenerationProgress progress={progress} downloadUrl={project.output?.downloadUrl ?? null} />
      ) : (
        <div className="min-h-[1.4rem] font-bold text-accent-2">{status}</div>
      )}

      <ChapterList chapters={chapters} onChange={onChapterChange} />
    </div>
  );
}
