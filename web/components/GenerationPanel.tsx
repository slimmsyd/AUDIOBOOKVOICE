"use client";

interface GenerationPanelProps {
  apiKey: string;
  voiceId: string;
  modelId: string;
  busy: boolean;
  downloadUrl: string | null;
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

export default function GenerationPanel({
  apiKey,
  voiceId,
  modelId,
  busy,
  downloadUrl,
  onApiKey,
  onVoiceId,
  onModelId,
  onSave,
  onResplit,
  onGenerate,
}: GenerationPanelProps) {
  return (
    <div className="grid items-end gap-3 rounded-lg border border-line bg-panel p-4 grid-cols-[minmax(180px,1.1fr)_minmax(150px,0.7fr)_minmax(160px,0.7fr)_auto_auto_auto] max-[980px]:grid-cols-1">
      <label className={labelClass}>
        ElevenLabs API key
        <input
          type="password"
          autoComplete="off"
          placeholder="sk_..."
          value={apiKey}
          onChange={(event) => onApiKey(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Voice ID
        <input
          type="text"
          value={voiceId}
          onChange={(event) => onVoiceId(event.target.value)}
          className={fieldClass}
        />
      </label>
      <label className={labelClass}>
        Model
        <input
          type="text"
          value={modelId}
          onChange={(event) => onModelId(event.target.value)}
          className={fieldClass}
        />
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={onSave}
        className="rounded-md bg-accent px-[0.95rem] py-[0.72rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        Save Edits
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onResplit}
        className="rounded-md bg-secondary px-[0.95rem] py-[0.72rem] font-bold text-ink disabled:cursor-not-allowed disabled:opacity-55"
      >
        Re-split Chapters
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onGenerate}
        className="rounded-md bg-accent px-[0.95rem] py-[0.72rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
      >
        Generate M4B
      </button>
      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="col-span-full rounded-md bg-accent px-[0.95rem] py-[0.72rem] text-center font-bold text-white"
        >
          Download M4B
        </a>
      ) : null}
    </div>
  );
}
