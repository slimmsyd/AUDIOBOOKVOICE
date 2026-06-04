"use client";

import type { ProjectSummary } from "@/lib/types";

interface SidebarProps {
  toolStatus: string;
  projects: ProjectSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
}

export default function Sidebar({ toolStatus, projects, activeId, onOpen }: SidebarProps) {
  return (
    <aside className="flex flex-col gap-6 border-b border-line bg-[#fcfaf4] p-[1.4rem] md:border-b-0 md:border-r">
      <div>
        <h1 className="text-[1.8rem] leading-[1.05] font-bold">PDF to Audiobook</h1>
      </div>

      <section
        className="rounded-lg border border-line bg-panel p-[0.85rem] text-[0.9rem] text-muted"
        aria-live="polite"
      >
        {toolStatus}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">Projects</h2>
        <div className="grid gap-[0.7rem]">
          {projects.length === 0 ? (
            <p className="text-sm text-muted">No projects yet.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => onOpen(project.id)}
                className={`block w-full rounded-lg border bg-panel p-[0.8rem] text-left text-ink transition-colors hover:border-accent ${
                  activeId === project.id ? "border-accent" : "border-line"
                }`}
              >
                <strong className="block">{project.title}</strong>
                <span className="mt-1 block text-[0.8rem] text-muted">
                  {project.chapterCount} chapters · {project.status}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </aside>
  );
}
