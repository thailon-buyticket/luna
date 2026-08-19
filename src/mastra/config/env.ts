import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const optionalString = () => z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());
const optionalEmail = () => z.preprocess(emptyToUndefined, z.string().email().optional());

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: optionalString(),
  OPENAI_EMBEDDING_MODEL: optionalString(),
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString(),

  SUPABASE_URL: optionalUrl(),
  SUPABASE_SERVICE_ROLE_KEY: optionalString(),
  // Connection string do Postgres do Supabase (Project Settings > Database > Connection string).
  // Usada como storage da memória da Luna (@mastra/pg), separado do client REST acima.
  SUPABASE_DB_URL: optionalUrl(),
  LUNA_TENANT_ID: optionalString(),
  LUNA_AGENT_ID: optionalString(),

  PINECONE_API_KEY: optionalString(),
  PINECONE_INDEX_NAME: optionalString(),

  ZENDESK_SUBDOMAIN: optionalString(),
  ZENDESK_EMAIL: optionalEmail(),
  ZENDESK_API_TOKEN: optionalString(),
  ZENDESK_APP_ID: optionalString(),
  ZENDESK_HUMAN_SWITCHBOARD_ID: optionalString(),
  ZENDESK_AI_AGENT_SWITCHBOARD_ID: optionalString(),
  ZENDESK_CONVERSATIONS_API_KEY_ID: optionalString(),
  ZENDESK_CONVERSATIONS_API_KEY: optionalString(),

  LUNA_MESSAGE_BUFFER_MS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  LUNA_BUSINESS_HOURS_START_HOUR: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(23).optional()),
  LUNA_BUSINESS_HOURS_END_HOUR: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(23).optional()),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
