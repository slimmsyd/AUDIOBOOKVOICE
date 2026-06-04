"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/api";
import DropZone from "@/components/DropZone";
import ProjectEditor from "@/components/ProjectEditor";
import Sidebar from "@/components/Sidebar";
import type {
  Chapter,
  GenerateStreamEvent,
  GenerationProgress,
  HealthResponse,
  Project,
  ProjectSummary,
} from "@/lib/types";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export default function StudioApp() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [toolStatus, setToolStatus] = useState("Checking local tools...");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);

  // Editable working copy (controlled inputs), synced whenever the project changes.
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);

  // Generation settings persist across projects.
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICE_ID);
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);

  const loadProjects = useCallback(async () => {
    const response = await api<{ projects: ProjectSummary[] }>("/api/projects");
    setProjects(response.projects);
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const health = await api<HealthResponse>("/api/health");
      const pdftotext = health.tools.pdftotext ? "pdftotext ready" : "pdftotext missing";
      const ffmpeg = health.tools.ffmpeg ? "ffmpeg ready" : "ffmpeg missing";
      setToolStatus(`${pdftotext}. ${ffmpeg}.`);
    } catch (error) {
      setToolStatus(`Server check failed: ${messageOf(error)}`);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadProjects();
  }, [checkHealth, loadProjects]);

  // Sync editable fields when a new project is loaded/saved/generated.
  useEffect(() => {
    if (!project) return;
    setTitle(project.title || "");
    setAuthor(project.author || "");
    setChapters(project.chapters.map((chapter) => ({ ...chapter })));
  }, [project]);

  function collectPayload() {
    return {
      title: title.trim(),
      author: author.trim(),
      chapters: chapters.map((chapter, index) => ({
        id: chapter.id || `chapter-${index + 1}`,
        title: chapter.title.trim(),
        text: chapter.text.trim(),
      })),
    };
  }

  function onChapterChange(index: number, patch: { title?: string; text?: string }) {
    setChapters((prev) =>
      prev.map((chapter, i) => (i === index ? { ...chapter, ...patch } : chapter)),
    );
  }

  async function importFile(file: File) {
    setBusy(true);
    setProgress(null);
    setStatus("Extracting PDF text...");
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/import", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
      setProject(data as Project);
      await loadProjects();
      setStatus("Review the detected chapters, then generate the audiobook.");
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function openProject(id: string) {
    setStatus("Loading project...");
    setProgress(null);
    try {
      setProject(await api<Project>(`/api/projects/${id}`));
      setStatus("");
    } catch (error) {
      setStatus(messageOf(error));
    }
  }

  async function saveProject() {
    if (!project) return;
    setBusy(true);
    setStatus("Saving edits...");
    try {
      const updated = await api<Project>(`/api/projects/${project.id}`, {
        method: "PUT",
        body: collectPayload(),
      });
      setProject(updated);
      await loadProjects();
      setStatus("Edits saved.");
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setBusy(false);
    }
  }

  async function resplitProject() {
    if (!project) return;
    const shouldContinue = window.confirm(
      "Re-splitting replaces the current chapter edits for this project. Continue?",
    );
    if (!shouldContinue) return;

    setBusy(true);
    setStatus("Re-splitting chapters from the extracted text...");
    try {
      const updated = await api<Project>(`/api/projects/${project.id}/resplit`, {
        method: "POST",
        body: {},
      });
      setProject(updated);
      await loadProjects();
      setStatus(`Re-split complete: ${updated.chapters.length} sections detected.`);
    } catch (error) {
      setStatus(messageOf(error));
    } finally {
      setBusy(false);
    }
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
      const response = await fetch(`/api/projects/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...collectPayload(),
          apiKey: apiKey.trim(),
          voiceId: voiceId.trim(),
          modelId: modelId.trim(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const event = JSON.parse(line.slice(5).trim()) as GenerateStreamEvent;
          if (event.type === "progress") {
            const { type: _type, ...rest } = event;
            void _type;
            setProgress(rest);
          } else if (event.type === "done") {
            setProject(event.project);
          } else if (event.type === "error") {
            streamError = event.error;
          }
        }
      }

      if (streamError) {
        setStatus(streamError);
        setProgress(null);
      } else {
        await loadProjects();
      }
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
        toolStatus={toolStatus}
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
            onSave={saveProject}
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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
