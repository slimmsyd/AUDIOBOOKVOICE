import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectsDir } from "@/lib/config";
import type { Project, ProjectSummary } from "@/lib/types";

// App Router has no single boot point, so each handler ensures the dir lazily.
export async function ensureDataDir(): Promise<void> {
  await mkdir(projectsDir, { recursive: true });
}

export function projectPath(id: string): string {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(projectsDir, safeId);
}

export async function loadProject(id: string): Promise<Project> {
  const project = JSON.parse(
    await readFile(path.join(projectPath(id), "project.json"), "utf8"),
  ) as Project;
  if (project.id !== id) throw new Error("Project id mismatch.");
  return project;
}

export async function saveProject(project: Project): Promise<void> {
  const filePath = path.join(projectPath(project.id), "project.json");
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(project, null, 2));
  await rename(tempPath, filePath);
}

export async function listProjects(): Promise<ProjectSummary[]> {
  await ensureDataDir();
  const entries = await readdir(projectsDir, { withFileTypes: true });
  const projects: ProjectSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const project = await loadProject(entry.name);
      projects.push({
        id: project.id,
        title: project.title,
        fileName: project.fileName,
        status: project.status,
        chapterCount: project.chapters?.length || 0,
        updatedAt: project.updatedAt,
        output: project.output,
      });
    } catch {
      // Ignore incomplete project folders.
    }
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}
