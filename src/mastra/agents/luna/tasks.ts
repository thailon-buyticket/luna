import { env } from '../../config/env';
import { requireEnv } from '../../config/require-env';
import { getSupabaseClient } from '../../services/supabase';

const ASSIGNED_TO = '53692070-e875-43de-96b4-0f020b8acdf9';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface CreateLunaTaskInput {
  type: string;
  priority: TaskPriority;
  input: Record<string, unknown>;
  conversationId: string | undefined;
}

export async function createLunaTask(task: CreateLunaTaskInput): Promise<{ id: string }> {
  const { LUNA_TENANT_ID } = requireEnv({ LUNA_TENANT_ID: env.LUNA_TENANT_ID }, 'Luna tasks');

  const { data, error } = await getSupabaseClient()
    .from('tasks')
    .insert({
      tenant_id: LUNA_TENANT_ID,
      executor_type: 'user',
      priority: task.priority,
      status: 'pending',
      assigned_to: ASSIGNED_TO,
      input: task.input,
      conversation_id: task.conversationId,
      type: task.type,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create Luna task: ${error.message}`);
  }

  return data;
}
