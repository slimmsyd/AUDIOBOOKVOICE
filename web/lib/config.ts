import path from "node:path";

// Data dir resolves against the process cwd (the `web/` dir under next dev/start),
// NOT __dirname (which points into .next/ after bundling). Override with AUDIOBOOK_DATA_DIR.
export const dataDir = process.env.AUDIOBOOK_DATA_DIR
  ? path.resolve(process.env.AUDIOBOOK_DATA_DIR)
  : path.join(process.cwd(), "data");

export const projectsDir = path.join(dataDir, "projects");

export const elevenLabsBaseUrl = "https://api.elevenlabs.io/v1";
export const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM";
export const defaultModelId = "eleven_multilingual_v2";
export const maxTtsChars = 4500;
