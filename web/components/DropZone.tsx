"use client";

import { useRef, useState } from "react";

interface DropZoneProps {
  disabled: boolean;
  onFile: (file: File) => void;
  onMessage: (message: string) => void;
}

export default function DropZone({ disabled, onFile, onMessage }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <section
      className={`drop-zone-surface grid min-h-[340px] place-items-center rounded-lg ${
        dragging ? "dragging" : ""
      }`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = [...event.dataTransfer.files].find(
          (item) => item.type === "application/pdf" || item.name.toLowerCase().endsWith(".pdf"),
        );
        if (file) onFile(file);
        else onMessage("Drop a PDF file to start.");
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <div className="max-w-[520px] p-8 text-center">
        <span className="mb-4 inline-grid h-12 w-[66px] place-items-center rounded-md border-2 border-accent font-black text-accent">
          PDF
        </span>
        <h2 className="mb-[0.4rem] text-[2rem] font-bold">Drop a PDF here</h2>
        <p className="leading-relaxed text-muted">
          Review the detected chapters, then generate the audiobook with your ElevenLabs or
          Deepgram API key.
        </p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="mt-5 rounded-md bg-accent px-[0.95rem] py-[0.72rem] font-bold text-white disabled:cursor-not-allowed disabled:opacity-55"
        >
          Choose PDF
        </button>
      </div>
    </section>
  );
}
