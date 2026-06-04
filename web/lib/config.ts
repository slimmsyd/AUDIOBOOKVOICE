import type { TtsProvider } from "@/lib/types";

// ElevenLabs
export const elevenLabsBaseUrl = "https://api.elevenlabs.io/v1";
export const defaultVoiceId = "21m00Tcm4TlvDq8ikWAM";
export const defaultModelId = "eleven_multilingual_v2";

// Deepgram (Aura-2 text-to-speech)
export const deepgramSpeakUrl = "https://api.deepgram.com/v1/speak";
export const defaultDeepgramModel = "aura-2-thalia-en";

// Per-request character limits. Deepgram caps /v1/speak at 2000 chars; keep margin.
export const maxTtsCharsByProvider: Record<TtsProvider, number> = {
  elevenlabs: 4500,
  deepgram: 1900,
};

// Back-compat default (ElevenLabs).
export const maxTtsChars = maxTtsCharsByProvider.elevenlabs;
