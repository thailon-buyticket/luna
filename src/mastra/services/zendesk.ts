import { env } from '../config/env';
import { requireEnv } from '../config/require-env';
import { basicAuthHeader, fetchOrThrow } from './http';

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

  const response = await fetchOrThrow(
    `https://${ZENDESK_SUBDOMAIN}.zendesk.com/api/${ZENDESK_API_VERSION}/${path}`,
    {
      method: options.method ?? 'GET',
      headers: {
        Authorization: basicAuthHeader(`${ZENDESK_EMAIL}/token:${ZENDESK_API_TOKEN}`),
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
    `Zendesk request to "${path}"`,
  );

  return response.json() as Promise<T>;
}

// API de conversas (Sunshine Conversations / Smooch) usada pela integração de mensageria/WhatsApp
// do Zendesk. Base, autenticação e app_id (que vem dinâmico em cada webhook, não fixo) são
// diferentes da API de tickets acima (`zendeskRequest`).
const ZENDESK_CONVERSATIONS_BASE_URL = 'https://api.smooch.io/v2';

function getZendeskConversationsCredentials() {
  return requireEnv(
    {
      ZENDESK_CONVERSATIONS_API_KEY_ID: env.ZENDESK_CONVERSATIONS_API_KEY_ID,
      ZENDESK_CONVERSATIONS_API_KEY: env.ZENDESK_CONVERSATIONS_API_KEY,
    },
    'Zendesk Conversations',
  );
}

export async function zendeskConversationsRequest<T>(
  appId: string,
  path: string,
  options: ZendeskRequestOptions = {},
): Promise<T> {
  const { ZENDESK_CONVERSATIONS_API_KEY_ID, ZENDESK_CONVERSATIONS_API_KEY } = getZendeskConversationsCredentials();

  const response = await fetchOrThrow(
    `${ZENDESK_CONVERSATIONS_BASE_URL}/apps/${appId}/${path}`,
    {
      method: options.method ?? 'GET',
      headers: {
        // Basic auth com a API key ID como usuário e a API key como senha (equivalente a `curl -u "KEY_ID:KEY"`).
        Authorization: basicAuthHeader(`${ZENDESK_CONVERSATIONS_API_KEY_ID}:${ZENDESK_CONVERSATIONS_API_KEY}`),
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
    `Zendesk Conversations request to "${path}"`,
  );

  return response.json() as Promise<T>;
}
