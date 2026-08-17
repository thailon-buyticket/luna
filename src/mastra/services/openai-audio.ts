import { env } from '../config/env';
import { requireEnv } from '../config/require-env';

interface OpenAiTranscriptionResponse {
  text: string;
}

export async function transcribeAudio(mediaUrl: string): Promise<string> {
  const { OPENAI_API_KEY } = requireEnv({ OPENAI_API_KEY: env.OPENAI_API_KEY }, 'OpenAI audio transcription');

  const mediaResponse = await fetch(mediaUrl);
  if (!mediaResponse.ok) {
    throw new Error(`Failed to download audio from "${mediaUrl}": ${mediaResponse.status}`);
  }

  const form = new FormData();
  form.append('file', await mediaResponse.blob(), 'audio.ogg');
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OpenAI audio transcription failed with ${response.status}: ${await response.text()}`);
  }

  const { text } = (await response.json()) as OpenAiTranscriptionResponse;
  return text;
}
