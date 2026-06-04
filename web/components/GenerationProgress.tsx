"use client";

import type { GenerationProgress as Progress } from "@/lib/types";

interface GenerationProgressProps {
  progress: Progress;
  downloadUrl: string | null;
}

export default function GenerationProgress({ progress, downloadUrl }: GenerationProgressProps) {
  const completed = progress.stage === "done";
  const percent = Math.max(0, Math.min(100, progress.percent));
  const chapterCount = Math.max(1, progress.chapterCount);

  return (
    <section
      className="app-shadow relative overflow-hidden rounded-xl border border-line bg-panel p-6"
      aria-live="polite"
    >
      {/* Brand accent rail */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-1"
        style={{
          background: completed
            ? "var(--color-accent)"
            : "linear-gradient(90deg, var(--color-accent), var(--color-accent-2))",
        }}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {completed ? <CheckBadge /> : <SpinnerRing />}
          <div>
            <p className="text-[0.72rem] font-extrabold uppercase tracking-wide text-muted">
              {completed ? "Complete" : stageLabel(progress.stage)}
            </p>
            <h3 className="text-lg font-bold text-ink">
              {completed ? "Audiobook ready" : "Generating audiobook"}
            </h3>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-extrabold tabular-nums text-ink">{percent}%</div>
          {!completed && progress.eta ? (
            <div className="text-[0.8rem] text-muted">ETA {progress.eta}</div>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-soft"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Audiobook generation progress"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Current step */}
      <p className="mt-3 text-sm font-medium text-ink">
        {completed ? "All chapters narrated and assembled into an M4B." : progress.message}
      </p>
      <p className="mt-1 text-[0.8rem] text-muted">
        Chapter {Math.min(progress.chapterIndex + 1, chapterCount)} of {chapterCount}
        {progress.totalChunks
          ? ` · ${progress.completedChunks}/${progress.totalChunks} voice chunks`
          : ""}
      </p>

      {/* Per-chapter indicator */}
      <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: chapterCount }).map((_, index) => {
          const state = completed
            ? "done"
            : index < progress.chapterIndex
              ? "done"
              : index === progress.chapterIndex
                ? "current"
                : "pending";
          return (
            <span
              key={index}
              className={`h-1.5 min-w-[14px] flex-1 rounded-full transition-colors duration-300 ${
                state === "done"
                  ? "bg-accent"
                  : state === "current"
                    ? "animate-pulse bg-accent-2 motion-reduce:animate-none"
                    : "bg-line"
              }`}
            />
          );
        })}
      </div>

      {completed && downloadUrl ? (
        <a
          href={downloadUrl}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-3 font-bold text-white transition-colors duration-200 hover:bg-[#095a54]"
        >
          <DownloadIcon />
          Download M4B
        </a>
      ) : null}
    </section>
  );
}

function stageLabel(stage: Progress["stage"]): string {
  switch (stage) {
    case "voice":
      return "Narrating";
    case "export":
      return "Assembling";
    case "start":
      return "Starting";
    default:
      return "Working";
  }
}

function SpinnerRing() {
  return (
    <svg
      className="h-7 w-7 animate-spin text-accent motion-reduce:animate-none"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-white">
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12.5l4 4 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
