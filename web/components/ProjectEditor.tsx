"use client";

import { formatNumber } from "@/components/api";
import ChapterList from "@/components/ChapterList";
import GenerationPanel from "@/components/GenerationPanel";
import GenerationProgress from "@/components/GenerationProgress";
import type {
  Chapter,
  GenerationProgress as Progress,
  Project,
  TtsProvider,
} from "@/lib/types";

interface ProjectEditorProps {
  project: Project;
  title: string;
  author: string;
  chapters: Chapter[];
  provider: TtsProvider;
  apiKey: string;
  voiceId: string;
  modelId: string;
  deepgramKey: string;
  deepgramModel: string;
  busy: boolean;
  status: string;
  progress: Progress | null;
  onTitle: (value: string) => void;
  onAuthor: (value: string) => void;
  onChapterChange: (index: number, patch: { title?: string; text?: string }) => void;
  onProvider: (value: TtsProvider) => void;
  onApiKey: (value: string) => void;
  onVoiceId: (value: string) => void;
  onModelId: (value: string) => void;
  onDeepgramKey: (value: string) => void;
  onDeepgramModel: (value: string) => void;
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
  provider,
  apiKey,
  voiceId,
  modelId,
  deepgramKey,
  deepgramModel,
  busy,
  status,
  progress,
  onTitle,
  onAuthor,
  onChapterChange,
  onProvider,
  onApiKey,
  onVoiceId,
  onModelId,
  onDeepgramKey,
  onDeepgramModel,
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
        provider={provider}
        apiKey={apiKey}
        voiceId={voiceId}
        modelId={modelId}
        deepgramKey={deepgramKey}
        deepgramModel={deepgramModel}
        busy={busy}
        downloadUrl={project.output?.downloadUrl ?? null}
        onProvider={onProvider}
        onApiKey={onApiKey}
        onVoiceId={onVoiceId}
        onModelId={onModelId}
        onDeepgramKey={onDeepgramKey}
        onDeepgramModel={onDeepgramModel}
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
