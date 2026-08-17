import { env } from '../config/env';
import { requireEnv } from '../config/require-env';

const ZENDESK_API_VERSION = 'v2';

interface ZendeskRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
}

function getZendeskCredentials() {
  return requireEnv(
    {
      ZENDESK_SUBDOMAIN: env.ZENDESK_SUBDOMAIN,
      ZENDESK_EMAIL: env.ZENDESK_EMAIL,
      ZENDESK_API_TOKEN: env.ZENDESK_API_TOKEN,
    },
    'Zendesk',
  );
}

export async function zendeskRequest<T>(path: string, options: ZendeskRequestOptions = {}): Promise<T> {
  const { ZENDESK_SUBDOMAIN, ZENDESK_EMAIL, ZENDESK_API_TOKEN } = getZendeskCredentials();
  const credentials = Buffer.from(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`).toString('base64');

  const response = await fetch(`https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/${ZENDESK_API_VERSION}/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Zendesk request to "${path}" failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

// API de conversas (Sunshine Conversations / Smooch) usada pela integração de mensageria/WhatsApp
// do Zendesk. Base, autenticação e app_id (que vem dinâmico em cada webhook, não fixo) são
// diferentes da API de tickets acima (`zendeskRequest`).
const ZENDESK_CONVERSATIONS_BASE_URL = 'https://api.smooch.io/v2';

function getZendeskConversationsCredentials() {
  return requireEnv(
    { ZENDESK_CONVERSATIONS_API_KEY: env.ZENDESK_CONVERSATIONS_API_KEY },
    'Zendesk Conversations',
  );
}

export async function zendeskConversationsRequest<T>(
  appId: string,
  path: string,
  options: ZendeskRequestOptions = {},
): Promise<T> {
  const { ZENDESK_CONVERSATIONS_API_KEY } = getZendeskConversationsCredentials();
  // Basic auth com a API key como usuário e senha vazia (equivalente a `curl -u "API_KEY:"`).
  const credentials = Buffer.from(`${ZENDESK_CONVERSATIONS_API_KEY}:`).toString('base64');

  const response = await fetch(`${ZENDESK_CONVERSATIONS_BASE_URL}/apps/${appId}/${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    throw new Error(
      `Zendesk Conversations request to "${path}" failed with ${response.status}: ${await response.text()}`,
    );
  }

  return response.json() as Promise<T>;
}
