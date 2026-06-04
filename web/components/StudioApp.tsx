"use client";

import { useCallback, useEffect, useState } from "react";
import DropZone from "@/components/DropZone";
import ProjectEditor from "@/components/ProjectEditor";
import Sidebar from "@/components/Sidebar";
import { extractProjectFromPdf } from "@/lib/client/extract-pdf";
import { generateAudiobookClient } from "@/lib/client/generate";
import * as store from "@/lib/client/store";
import { slug } from "@/lib/format";
import { normalizeEditedChapters, splitIntoChapters } from "@/lib/pipeline/chapters";
import { cleanExtractedText } from "@/lib/pipeline/extract";
import type {
  Chapter,
  GenerationProgress,
  Project,
  ProjectSummary,
} from "@/lib/types";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";
const TOOL_STATUS = "Runs in your browser · bring your own ElevenLabs key";

export default function StudioApp() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  // Editable working copy.
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Generation settings persist across projects.
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);

  const refreshProjects = useCallback(() => {
    setProjects(store.listProjects());
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Sync editable fields when a project is loaded/imported.
  useEffect(() => {
    if (!project) return;
    setTitle(project.title || "");
    setAuthor(project.author || "");
    setChapters(project.chapters.map((chapter) => ({ ...chapter })));
  }, [project]);

  function persist(updated: Project) {
    setProject(updated);
    store.saveProject(updated);
    refreshProjects();
  }

  function collectEditedChapters() {
    return chapters.map((chapter, index) => ({
      id: chapter.id || `chapter-${index + 1}`,
      title: chapter.title.trim(),
      text: chapter.text.trim(),
    }));
  }

  function onChapterChange(index: number, patch: { title?: string; text?: string }) {
    setChapters((prev) => prev.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)));
  }

  async function importFile(file: File) {
    setBusy(true);
    setProgress(null);
    setStatus("Reading PDF in your browser…");
    try {
      const imported = await extractProjectFromPdf(file);
      persist(imported);
      setStatus("Review the detected chapters, then generate the audiobook.");
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  function openProject(id: string) {
    setProgress(null);
    const loaded = store.getProject(id);
    if (loaded) {
      setProject(loaded);
      setStatus("");
    } else {
      setStatus("That project is no longer available.");
    }
  }

  function saveEdits() {
    if (!project) return;
    const updated: Project = {
      ...project,
      title: title.trim() || "Untitled Audiobook",
      author: author.trim(),
      chapters: normalizeEditedChapters(collectEditedChapters()),
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
    setStatus("Edits saved.");
  }

  function resplitProject() {
    if (!project) return;
    if (!project.rawText) {
      setStatus("Re-split needs the original text — re-import this PDF to re-split.");
      return;
    }
    if (!window.confirm("Re-splitting replaces the current chapter edits. Continue?")) return;

    const cleaned = cleanExtractedText(project.rawText);
    const next = splitIntoChapters(cleaned, project.rawText);
    const updated: Project = {
      ...project,
      chapters: next,
      status: "review",
      output: null,
      extraction: { ...project.extraction, cleanedCharacters: cleaned.length, chapterCount: next.length },
      updatedAt: new Date().toISOString(),
    };
    persist(updated);
    setStatus(`Re-split complete: ${next.length} sections detected.`);
  }

  async function generateAudiobook() {
    if (!project) return;
    if (!apiKey.trim()) {
      setStatus("Add your ElevenLabs API key first.");
      return;
    }

    setBusy(true);
    setStatus("");
    setProgress(null);
    try {
      const edited = normalizeEditedChapters(collectEditedChapters());
      const blob = await generateAudiobookClient({
        chapters: edited,
        title: title.trim() || "Untitled Audiobook",
        author: author.trim(),
        apiKey: apiKey.trim(),
        voiceId: voiceId.trim() || DEFAULT_VOICE_ID,
        modelId: modelId.trim() || DEFAULT_MODEL_ID,
        onProgress: setProgress,
      });

      const url = URL.createObjectURL(blob);
      const updated: Project = {
        ...project,
        title: title.trim() || "Untitled Audiobook",
        author: author.trim(),
        chapters: edited,
        status: "complete",
        output: { format: "m4b", downloadUrl: url, generatedAt: new Date().toISOString() },
        updatedAt: new Date().toISOString(),
      };
      setProject(updated);
      store.saveProject(updated); // output stripped on persist
      refreshProjects();
      triggerDownload(url, `${slug(updated.title)}.m4b`);
    } catch (error) {
      setStatus(messageOf(error));
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen grid-cols-[320px_minmax(0,1fr)] max-[980px]:grid-cols-1">
      <Sidebar
        toolStatus={TOOL_STATUS}
        projects={projects}
        activeId={project?.id ?? null}
        onOpen={openProject}
      />

      <section className="min-w-0 p-[1.4rem]">
        <DropZone disabled={busy} onFile={importFile} onMessage={setStatus} />

        {project ? (
          <ProjectEditor
            project={project}
            title={title}
            author={author}
            chapters={chapters}
            apiKey={apiKey}
            voiceId={voiceId}
            modelId={modelId}
            busy={busy}
            status={status}
            progress={progress}
            onTitle={setTitle}
            onAuthor={setAuthor}
            onChapterChange={onChapterChange}
            onApiKey={setApiKey}
            onVoiceId={setVoiceId}
            onModelId={setModelId}
            onSave={saveEdits}
            onResplit={resplitProject}
            onGenerate={generateAudiobook}
          />
        ) : (
          <div className="mt-4 min-h-[1.4rem] font-bold text-accent-2">{status}</div>
        )}
      </section>
    </main>
  );
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
