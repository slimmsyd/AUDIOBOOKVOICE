"use client";

import ApiKeyHelp from "@/components/ApiKeyHelp";
import type { TtsProvider } from "@/lib/types";

interface GenerationPanelProps {
  provider: TtsProvider;
  // ElevenLabs
  apiKey: string;
  voiceId: string;
  modelId: string;
  // Deepgram
  deepgramKey: string;
  deepgramModel: string;
  busy: boolean;
  downloadUrl: string | null;
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

const DEEPGRAM_VOICES: { id: string; label: string }[] = [
  { id: "aura-2-thalia-en", label: "Thalia (feminine)" },
  { id: "aura-2-asteria-en", label: "Asteria (feminine)" },
  { id: "aura-2-andromeda-en", label: "Andromeda (feminine)" },
  { id: "aura-2-aurora-en", label: "Aurora (feminine)" },
  { id: "aura-2-helena-en", label: "Helena (feminine)" },
  { id: "aura-2-apollo-en", label: "Apollo (masculine)" },
  { id: "aura-2-arcas-en", label: "Arcas (masculine)" },
  { id: "aura-2-atlas-en", label: "Atlas (masculine)" },
];

export default function GenerationPanel({
  provider,
  apiKey,
  voiceId,
  modelId,
  deepgramKey,
  deepgramModel,
  busy,
  downloadUrl,
  onProvider,
  onApiKey,
  onVoiceId,
  onModelId,
  onDeepgramKey,
  onDeepgramModel,
  onSave,
  onResplit,
  onGenerate,
}: GenerationPanelProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-panel p-4 max-[980px]:flex-col max-[980px]:items-stretch">
      <label className={`${labelClass} min-w-[140px]`}>
        Voice provider
        <select
          value={provider}
          onChange={(event) => onProvider(event.target.value as TtsProvider)}
          className={`${fieldClass} cursor-pointer`}
        >
          <option value="elevenlabs">ElevenLabs</option>
          <option value="deepgram">Deepgram</option>
        </select>
      </label>

      {provider === "elevenlabs" ? (
        <>
          <div className="grid min-w-[200px] flex-1 gap-1">
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
            <ApiKeyHelp provider="elevenlabs" />
          </div>
          <label className={`${labelClass} min-w-[150px] flex-1`}>
            Voice ID
            <input
              type="text"
              value={voiceId}
              onChange={(event) => onVoiceId(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label className={`${labelClass} min-w-[150px] flex-1`}>
            Model
            <input
              type="text"
              value={modelId}
              onChange={(event) => onModelId(event.target.value)}
              className={fieldClass}
            />
          </label>
        </>
      ) : (
        <>
          <div className="grid min-w-[200px] flex-1 gap-1">
            <label className={labelClass}>
              Deepgram API key
              <input
                type="password"
                autoComplete="off"
                placeholder="Deepgram API key"
                value={deepgramKey}
                onChange={(event) => onDeepgramKey(event.target.value)}
                className={fieldClass}
              />
            </label>
            <ApiKeyHelp provider="deepgram" />
          </div>
          <label className={`${labelClass} min-w-[180px] flex-1`}>
            Voice (Aura-2)
            <select
              value={deepgramModel}
              onChange={(event) => onDeepgramModel(event.target.value)}
              className={`${fieldClass} cursor-pointer`}
            >
              {DEEPGRAM_VOICES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <div className="flex flex-wrap items-end gap-3 max-[980px]:flex-col max-[980px]:items-stretch">
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
      </div>

      {downloadUrl ? (
        <a
          href={downloadUrl}
          className="w-full rounded-md bg-accent px-[0.95rem] py-[0.72rem] text-center font-bold text-white"
        >
          Download M4B
        </a>
      ) : null}
    </div>
  );
}
