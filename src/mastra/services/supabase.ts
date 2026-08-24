import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';
import { requireEnv } from '../config/require-env';

let client: SupabaseClient | undefined;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = requireEnv(
      { SUPABASE_URL: env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY },
      'Supabase',
    );
    client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return client;
}

/** Todo dado da Luna é escopado por tenant no Supabase — atalho pro `LUNA_TENANT_ID` validado. */
export function requireTenantId(label: string): string {
  return requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, label).LUNA_TENANT_ID;
}

/** Linha da Luna na tabela `agents` do Supabase — atalho pro `LUNA_AGENT_ID` validado. */
export function requireAgentId(label: string): string {
  return requireEnv({ LUNA_AGENT_ID: env.LUNA_AGENT_ID }, label).LUNA_AGENT_ID;
}

/** Desembrulha o `{ data, error }` que toda query/mutation do Supabase retorna, lançando com uma mensagem consistente. */
export async function unwrapOrThrow<T>(
  query: PromiseLike<{ data: T | null; error: { message: string } | null }>,
  label: string,
): Promise<T | null> {
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to ${label}: ${error.message}`);
  }
  return data;
}
