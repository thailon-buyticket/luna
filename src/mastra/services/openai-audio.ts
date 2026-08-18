import { env } from '../config/env';
import { requireEnv } from '../config/require-env';
import { fetchOrThrow } from './http';

interface OpenAiTranscriptionResponse {
  text: string;
}

export async function transcribeAudio(mediaUrl: string): Promise<string> {
  const { OPENAI_API_KEY } = requireEnv({ OPENAI_API_KEY: env.OPENAI_API_KEY }, 'OpenAI audio transcription');

  const mediaResponse = await fetchOrThrow(mediaUrl, {}, `Downloading audio from "${mediaUrl}"`);

  const form = new FormData();
  form.append('file', await mediaResponse.blob(), 'audio.ogg');
  form.append('model', 'whisper-1');
  form.append('language', 'pt');

  const response = await fetchOrThrow(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    },
    'OpenAI audio transcription',
  );

  const { text } = (await response.json()) as OpenAiTranscriptionResponse;
  return text;
}
