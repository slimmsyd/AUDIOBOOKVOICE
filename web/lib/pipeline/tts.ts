import { deepgramSpeakUrl, elevenLabsBaseUrl } from "@/lib/config";
import type { GenerateSettings } from "@/lib/types";

// Server-side ElevenLabs request (used by the stateless /api/tts proxy).
export async function requestElevenLabsAudio(
  apiKey: string,
  settings: GenerateSettings,
  text: string,
): Promise<ArrayBuffer> {
  const url = `${elevenLabsBaseUrl}/text-to-speech/${settings.voiceId}?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: settings.modelId,
      voice_settings: {
        stability: settings.stability,
        similarity_boost: settings.similarityBoost,
        style: settings.style,
        use_speaker_boost: true,
        speed: settings.speed,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return response.arrayBuffer();
}

// Deepgram Aura-2 text-to-speech. The voice IS the model (e.g. aura-2-thalia-en).
// Default output is MP3, which matches the rest of the pipeline.
export async function requestDeepgramAudio(
  apiKey: string,
  model: string,
  text: string,
): Promise<ArrayBuffer> {
  const url = `${deepgramSpeakUrl}?model=${encodeURIComponent(model)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "text/plain",
    },
    body: text,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram error ${response.status}: ${errorText.slice(0, 500)}`);
  }

  return response.arrayBuffer();
}
