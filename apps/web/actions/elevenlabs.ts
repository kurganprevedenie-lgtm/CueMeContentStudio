"use server";

const API_BASE = "https://api.elevenlabs.io/v1";

export interface VoiceOption {
  id: string;
  name: string;
  previewUrl?: string;
}

export interface CreditsInfo {
  used: number;
  limit: number;
}

interface ElevenVoicesResponse {
  voices?: Array<{
    voice_id: string;
    name: string;
    preview_url?: string | null;
  }>;
}

interface ElevenSubscriptionResponse {
  character_count: number;
  character_limit: number;
}

function getApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY не задан — добавь его в .env в корне проекта и перезапусти pnpm dev"
    );
  }
  return key;
}

async function apiError(res: Response, context: string): Promise<Error> {
  // тело ответа ElevenLabs не содержит ключ, обрезаем на всякий случай
  const body = (await res.text().catch(() => "")).slice(0, 300);
  return new Error(`ElevenLabs ${context}: HTTP ${res.status}. ${body}`);
}

export async function getVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${API_BASE}/voices`, {
    headers: { "xi-api-key": getApiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw await apiError(res, "/voices");
  const data: ElevenVoicesResponse = await res.json();
  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    previewUrl: v.preview_url ?? undefined,
  }));
}

export async function generateVoice(
  text: string,
  voiceId: string
): Promise<string> {
  const res = await fetch(
    `${API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    }
  );
  if (!res.ok) throw await apiError(res, "text-to-speech");
  const buffer = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
}

export async function getCredits(): Promise<CreditsInfo> {
  const res = await fetch(`${API_BASE}/user/subscription`, {
    headers: { "xi-api-key": getApiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw await apiError(res, "/user/subscription");
  const data: ElevenSubscriptionResponse = await res.json();
  return { used: data.character_count, limit: data.character_limit };
}
