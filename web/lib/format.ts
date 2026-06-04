// Formatting + slug helpers ported verbatim from the original server.js.

export function slug(value: string): string {
  return (
    String(value || "audiobook")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "audiobook"
  );
}

export function titleFromFileName(fileName: string): string {
  return (
    String(fileName)
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Untitled Audiobook"
  );
}

export function logProgress(stage: string, message: string): void {
  console.log(`[${new Date().toLocaleTimeString()}] [${stage}] ${message}`);
}

export function percent(value: number, total: number): string {
  if (!total) return "0%";
  return `${Math.min(100, Math.round((value / total) * 100))}%`;
}

export interface EtaInput {
  startedAt: number;
  completedCharacters: number;
  totalCharacters: number;
  generatedCharacters: number;
  generatedMs: number;
}

export function estimateEta({
  startedAt,
  completedCharacters,
  totalCharacters,
  generatedCharacters,
  generatedMs,
}: EtaInput): string {
  const remainingCharacters = Math.max(0, totalCharacters - completedCharacters);
  if (remainingCharacters === 0) return "finishing now";

  const generatedCharsPerMs =
    generatedMs > 0 && generatedCharacters > 0 ? generatedCharacters / generatedMs : 0;
  const overallCharsPerMs =
    completedCharacters > 0 ? completedCharacters / Math.max(1, Date.now() - startedAt) : 0;
  const charsPerMs = generatedCharsPerMs || overallCharsPerMs;

  if (!charsPerMs) return "calculating";
  return formatDuration(remainingCharacters / charsPerMs);
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(Number(value || 0)));
}

export function formatBytes(value: number): string {
  const bytes = Number(value || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
