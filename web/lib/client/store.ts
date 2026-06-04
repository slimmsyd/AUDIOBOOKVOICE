import type { Project, ProjectSummary } from "@/lib/types";

// Anonymous, client-side project history (text + chapters only; generated audio
// is not persisted — re-generate to download again). Browser-local, no server.

const KEY = "pdf-audiobook:projects";

function readAll(): Record<string, Project> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Record<string, Project>;
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, Project>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Quota exceeded or storage disabled — history is best-effort.
  }
}

export function listProjects(): ProjectSummary[] {
  return Object.values(readAll())
    .map((p) => ({
      id: p.id,
      title: p.title,
      fileName: p.fileName,
      status: p.status,
      chapterCount: p.chapters?.length || 0,
      updatedAt: p.updatedAt,
      output: p.output ?? null,
    }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function saveProject(project: Project): void {
  const map = readAll();
  // Strip any ephemeral object-URL output before persisting.
  map[project.id] = { ...project, output: null };
  writeAll(map);
}

export function getProject(id: string): Project | null {
  return readAll()[id] ?? null;
}

export function deleteProject(id: string): void {
  const map = readAll();
  delete map[id];
  writeAll(map);
}
