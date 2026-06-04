"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { TtsProvider } from "@/lib/types";

interface HelpContent {
  title: string;
  steps: ReactNode[];
  url: string;
  linkLabel: string;
}

const CONTENT: Record<TtsProvider, HelpContent> = {
  elevenlabs: {
    title: "Get your ElevenLabs API key",
    url: "https://elevenlabs.io/app/developers/api-keys",
    linkLabel: "Open ElevenLabs API Keys",
    steps: [
      <>Sign in at <strong>elevenlabs.io</strong> (a free account works).</>,
      <>Open <strong>Developers</strong> at the bottom of the left sidebar.</>,
      <>Click the <strong>API Keys</strong> tab.</>,
      <>Click <strong>+ Create Key</strong>, give it a name, and create it.</>,
      <><strong>Copy</strong> the key.</>,
      <>Paste it into the API key field here.</>,
    ],
  },
  deepgram: {
    title: "Get your Deepgram API key",
    url: "https://console.deepgram.com/",
    linkLabel: "Open Deepgram Console",
    steps: [
      <>Sign in at <strong>console.deepgram.com</strong> (free credit included).</>,
      <>Open <strong>API Keys</strong> in the left sidebar.</>,
      <>Click <strong>Create a New API Key</strong>.</>,
      <>Name it, keep the default scope, and create it.</>,
      <><strong>Copy</strong> the key.</>,
      <>Paste it here and pick an Aura-2 voice.</>,
    ],
  },
};

export default function ApiKeyHelp({ provider }: { provider: TtsProvider }) {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const content = CONTENT[provider];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-fit cursor-pointer rounded text-left text-[0.75rem] font-semibold normal-case text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        How do I get a key?
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 transition-opacity duration-200 motion-reduce:transition-none"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apikey-help-title"
            onClick={(e) => e.stopPropagation()}
            className="app-shadow w-full max-w-md rounded-xl border border-line bg-panel p-6 text-ink transition-transform duration-200 motion-reduce:transition-none"
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="apikey-help-title" className="text-lg font-bold">
                {content.title}
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 grid h-8 w-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <ol className="mt-4 grid gap-2.5">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm leading-relaxed">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-soft text-[0.7rem] font-bold text-accent">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <p className="mt-4 text-[0.8rem] leading-relaxed text-muted">
              Your key controls your usage and billing. We never store it — it&apos;s used only to
              generate your audio.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3">
              <a
                href={content.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#095a54] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {content.linkLabel}
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-md px-3 py-2.5 text-sm font-semibold text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
