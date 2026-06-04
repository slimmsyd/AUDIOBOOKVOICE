// Shared types mirroring the on-disk project.json schema (1:1 with the original server.js).

export type ChapterStatus = "ready" | "generating" | "generated";
export type ProjectStatus = "review" | "generating" | "complete";

export interface Chapter {
  id: string; // "chapter-N"
  order: number;
  title: string;
  text: string;
  wordCount: number;
  estimatedMinutes: number;
  status: ChapterStatus;
  audioPath?: string; // absolute path, set during generate
}

export interface ProjectSource {
  pdfPath: string;
  rawTextPath: string;
  pageCountEstimate: number | null;
}

export interface ProjectExtraction {
  rawCharacters: number;
  cleanedCharacters: number;
  chapterCount: number;
}

export interface ProjectOutput {
  format: "m4b";
  m4bPath: string;
  downloadUrl: string;
  generatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  author: string;
  fileName: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  source: ProjectSource;
  extraction: ProjectExtraction;
  chapters: Chapter[];
  output: ProjectOutput | null;
}

// Summary returned by GET /api/projects
export interface ProjectSummary {
  id: string;
  title: string;
  fileName: string;
  status: ProjectStatus;
  chapterCount: number;
  updatedAt: string;
  output: ProjectOutput | null;
}

// Edited chapter payload coming from the client (PUT / generate).
export interface EditedChapter {
  id?: string;
  title: string;
  text: string;
}

export interface GenerateSettings {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  speed: number;
}

export interface GenerateRequest {
  title?: string;
  author?: string;
  chapters?: EditedChapter[];
  apiKey: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  speed?: number;
}

export interface ProjectUpdateRequest {
  title?: string;
  author?: string;
  chapters: EditedChapter[];
}

export interface HealthResponse {
  ok: boolean;
  tools: { pdftotext: boolean; ffmpeg: boolean };
}
